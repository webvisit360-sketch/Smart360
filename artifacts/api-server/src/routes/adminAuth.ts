import { Router, type IRouter } from "express";
import {
  AdminLoginBody,
  ChangeAdminPasswordBody,
  ForgotAdminPasswordBody,
  ResetAdminPasswordBody,
} from "@workspace/api-zod";
import {
  checkCredentials,
  createSession,
  destroyCurrentSession,
  isAuthenticated,
  requireAdmin,
  loginRateLimited,
  recordLoginFailure,
  resetLoginFailures,
  forgotRateLimited,
  getAdminUser,
  hashPassword,
  verifyPassword,
  revokeOtherSessions,
  revokeAllSessions,
  createResetToken,
  consumeResetToken,
  MIN_PASSWORD_LENGTH,
} from "../lib/adminAuth";
import { db, adminUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendMail } from "../lib/mailer";

const router: IRouter = Router();

const NEUTRAL_FORGOT_MESSAGE = "Če račun obstaja, smo poslali navodila.";

function passwordPolicyError(pw: string): string | null {
  if (typeof pw !== "string" || pw.length < MIN_PASSWORD_LENGTH) {
    return `Geslo mora imeti vsaj ${MIN_PASSWORD_LENGTH} znakov.`;
  }
  return null;
}

function appBaseUrl(): string {
  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0] || process.env["REPLIT_DEV_DOMAIN"];
  return domain ? `https://${domain}` : "http://localhost:80";
}

router.post("/admin/login", async (req, res): Promise<void> => {
  const ip = req.ip ?? "unknown";
  if (loginRateLimited(ip)) {
    res.status(429).json({ error: "Too many attempts, try again later" });
    return;
  }
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password } = parsed.data;
  const user = await checkCredentials(username, password);
  if (!user) {
    recordLoginFailure(ip);
    req.log.warn("Failed admin login attempt");
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  resetLoginFailures(ip);
  await createSession(req, res);
  res.json({ authenticated: true });
});

router.post("/admin/logout", async (req, res): Promise<void> => {
  await destroyCurrentSession(req, res);
  res.json({ authenticated: false });
});

router.get("/admin/session", async (req, res): Promise<void> => {
  res.json({ authenticated: await isAuthenticated(req) });
});

router.post("/admin/account/password", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ChangeAdminPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;
  const policyError = passwordPolicyError(newPassword);
  if (policyError) {
    res.status(400).json({ error: policyError });
    return;
  }
  const user = await getAdminUser();
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
    res.status(401).json({ error: "Trenutno geslo ni pravilno." });
    return;
  }
  await db
    .update(adminUsersTable)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(adminUsersTable.id, user.id));
  await revokeOtherSessions(req);

  const when = new Date().toLocaleString("sl-SI", { timeZone: "Europe/Ljubljana" });
  const device = req.get("user-agent") || "neznana naprava";
  const ip = req.ip ?? "neznan IP";
  try {
    await sendMail(
      user.email,
      "Smart360 — geslo je bilo spremenjeno",
      `Pozdravljeni,

geslo za administracijo Smart360 je bilo pravkar spremenjeno.

Kdaj: ${when}
Naprava: ${device}
IP naslov: ${ip}

Če tega niste storili vi, se takoj obrnite na skrbnika sistema.

Smart360`,
    );
  } catch (err) {
    req.log.error({ err }, "Failed to send password-change notification email");
  }
  res.json({ ok: true });
});

router.post("/admin/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotAdminPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = parsed.data.email.trim();
  const ip = req.ip ?? "unknown";
  if (forgotRateLimited(email, ip)) {
    res.status(429).json({ error: "Preveč zahtevkov. Poskusite znova čez eno uro." });
    return;
  }
  // Neutral response regardless of whether the account exists.
  res.json({ ok: true, message: NEUTRAL_FORGOT_MESSAGE });

  const user = await getAdminUser();
  if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
    req.log.info("Forgot-password request for unknown email");
    return;
  }
  try {
    const token = await createResetToken();
    const link = `${appBaseUrl()}/admin/reset-password?token=${token}`;
    await sendMail(
      user.email,
      "Smart360 — ponastavitev gesla",
      `Pozdravljeni,

prejeli smo zahtevo za ponastavitev gesla za administracijo Smart360.

Povezava za nastavitev novega gesla (velja 30 minut, deluje samo enkrat):
${link}

Če ponastavitve niste zahtevali vi, to sporočilo prezrite — geslo ostane nespremenjeno.

Smart360`,
    );
  } catch (err) {
    req.log.error({ err }, "Failed to send password-reset email");
  }
});

router.post("/admin/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetAdminPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { token, newPassword } = parsed.data;
  const policyError = passwordPolicyError(newPassword);
  if (policyError) {
    res.status(400).json({ error: policyError });
    return;
  }
  if (!(await consumeResetToken(token))) {
    res.status(400).json({ error: "Povezava ni veljavna ali je potekla." });
    return;
  }
  const user = await getAdminUser();
  if (!user) {
    res.status(400).json({ error: "Račun ne obstaja." });
    return;
  }
  await db
    .update(adminUsersTable)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(adminUsersTable.id, user.id));
  await revokeAllSessions();
  res.json({ ok: true });
});

export default router;
