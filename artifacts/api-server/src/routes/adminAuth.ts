import { Router, type IRouter } from "express";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import {
  db,
  adminCredentialsTable,
  adminRecoveryCodesTable,
  adminAuthEventsTable,
} from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import {
  rpID,
  rpOrigin,
  ADMIN_EMAIL,
  getAdminUser,
  listCredentials,
  countUnusedRecoveryCodes,
  issueRecoveryCodes,
  consumeRecoveryCode,
  createEnrollToken,
  isEnrollTokenValid,
  consumeEnrollToken,
  storeChallenge,
  consumeChallenge,
  createSession,
  destroyCurrentSession,
  isAuthenticated,
  requireAdmin,
  revokeAllSessions,
  logAuthEvent,
  loginRateLimited,
  recordRecoveryAttempt,
  markRecoveryAttemptSuccess,
  recoveryCodeCounts,
  SESSION_COOKIE,
} from "../lib/adminAuth";
import crypto from "node:crypto";

const router: IRouter = Router();

function parseTransports(json: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!json) return undefined;
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : undefined;
  } catch {
    return undefined;
  }
}

// ---------- Login (passkey) ----------

router.post("/admin/webauthn/login/options", async (req, res): Promise<void> => {
  const ip = req.ip ?? "unknown";
  if (loginRateLimited(ip, false)) {
    res.status(429).json({ error: "Preveč poskusov. Poskusite znova čez 15 minut." });
    return;
  }
  const credentials = await listCredentials();
  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    userVerification: "required",
    // Empty allowCredentials keeps discoverable-credential + cross-device QR flow available.
    allowCredentials: credentials.map((c) => ({
      id: c.credentialId,
      transports: parseTransports(c.transports),
    })),
  });
  const challengeId = await storeChallenge("authentication", options.challenge);
  res.json({ challengeId, options });
});

router.post("/admin/webauthn/login/verify", async (req, res): Promise<void> => {
  const ip = req.ip ?? "unknown";
  if (loginRateLimited(ip)) {
    res.status(429).json({ error: "Preveč poskusov. Poskusite znova čez 15 minut." });
    return;
  }
  const { challengeId, response } = req.body ?? {};
  if (typeof challengeId !== "string" || !response || typeof response.id !== "string") {
    res.status(400).json({ error: "Neveljavna zahteva." });
    return;
  }
  const stored = await consumeChallenge(challengeId, "authentication");
  if (!stored) {
    res.status(400).json({ error: "Prijavna seja je potekla. Poskusite znova." });
    return;
  }
  const [credential] = await db
    .select()
    .from(adminCredentialsTable)
    .where(eq(adminCredentialsTable.credentialId, response.id))
    .limit(1);
  if (!credential) {
    req.log.warn("Passkey login with unknown credential");
    res.status(401).json({ error: "Prijava ni uspela." });
    return;
  }
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: rpOrigin(),
      expectedRPID: rpID(),
      requireUserVerification: true,
      credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey, "base64url"),
        counter: credential.counter,
        transports: parseTransports(credential.transports),
      },
    });
  } catch (err) {
    req.log.warn({ err }, "Passkey verification failed");
    res.status(401).json({ error: "Prijava ni uspela." });
    return;
  }
  if (!verification.verified) {
    res.status(401).json({ error: "Prijava ni uspela." });
    return;
  }
  await db
    .update(adminCredentialsTable)
    .set({
      // Monotonic: never lower the stored counter on out-of-order logins.
      counter: sql`GREATEST(${adminCredentialsTable.counter}, ${verification.authenticationInfo.newCounter})`,
      lastUsedAt: new Date(),
    })
    .where(eq(adminCredentialsTable.id, credential.id));
  await createSession(req, res);
  await logAuthEvent(req, "login", `passkey:${credential.deviceName}`);
  res.json({ authenticated: true });
});

router.post("/admin/logout", async (req, res): Promise<void> => {
  await destroyCurrentSession(req, res);
  await logAuthEvent(req, "logout");
  res.json({ authenticated: false });
});

router.get("/admin/session", async (req, res): Promise<void> => {
  res.json({ authenticated: await isAuthenticated(req) });
});

// ---------- Enrolment (single-use link from shell or recovery code) ----------

router.post("/admin/enroll/options", async (req, res): Promise<void> => {
  const { token } = req.body ?? {};
  if (typeof token !== "string" || !(await isEnrollTokenValid(token))) {
    res.status(400).json({ error: "Povezava ni veljavna ali je potekla." });
    return;
  }
  const user = await getAdminUser();
  const existing = await listCredentials();
  const options = await generateRegistrationOptions({
    rpName: "Smart360",
    rpID: rpID(),
    userName: user?.email ?? ADMIN_EMAIL,
    userDisplayName: user?.displayName ?? "Upravitelj",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: parseTransports(c.transports),
    })),
  });
  const challengeId = await storeChallenge(
    "registration",
    options.challenge,
    `enroll:${crypto.createHash("sha256").update(token).digest("hex")}`,
  );
  res.json({ challengeId, options });
});

router.post("/admin/enroll/verify", async (req, res): Promise<void> => {
  const { token, challengeId, response, deviceName } = req.body ?? {};
  if (typeof token !== "string" || typeof challengeId !== "string" || !response) {
    res.status(400).json({ error: "Neveljavna zahteva." });
    return;
  }
  const stored = await consumeChallenge(challengeId, "registration");
  const expectedContext = `enroll:${crypto.createHash("sha256").update(token).digest("hex")}`;
  if (!stored || stored.context !== expectedContext) {
    res.status(400).json({ error: "Seja registracije je potekla. Poskusite znova." });
    return;
  }
  if (!(await isEnrollTokenValid(token))) {
    res.status(400).json({ error: "Povezava ni veljavna ali je potekla." });
    return;
  }
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: rpOrigin(),
      expectedRPID: rpID(),
      requireUserVerification: true,
    });
  } catch (err) {
    req.log.warn({ err }, "Passkey registration failed");
    res.status(400).json({ error: "Registracija ključa ni uspela." });
    return;
  }
  if (!verification.verified || !verification.registrationInfo) {
    res.status(400).json({ error: "Registracija ključa ni uspela." });
    return;
  }
  // Verification succeeded — only now burn the single-use token.
  const source = await consumeEnrollToken(token);
  if (!source) {
    res.status(400).json({ error: "Povezava ni veljavna ali je potekla." });
    return;
  }
  const info = verification.registrationInfo;
  const isFirst = (await listCredentials()).length === 0;
  await db.insert(adminCredentialsTable).values({
    credentialId: info.credential.id,
    publicKey: Buffer.from(info.credential.publicKey).toString("base64url"),
    counter: info.credential.counter,
    transports: JSON.stringify(info.credential.transports ?? []),
    deviceName:
      typeof deviceName === "string" && deviceName.trim()
        ? deviceName.trim().slice(0, 80)
        : "Passkey",
  });
  await logAuthEvent(req, "enroll", `source:${source}`);
  await createSession(req, res);
  // Recovery codes are issued exactly once — on first enrolment (or shell re-enrolment when none exist).
  let recoveryCodes: string[] | undefined;
  if (isFirst || (await countUnusedRecoveryCodes()) === 0) {
    recoveryCodes = await issueRecoveryCodes(10);
  }
  res.json({ ok: true, recoveryCodes });
});

// ---------- Recovery ----------

router.post("/admin/recovery", async (req, res): Promise<void> => {
  // Atomic check-and-reserve: the attempt is audited as "failure" BEFORE
  // verification (flipped to "success" only on a match). Fail-closed: if the
  // audit write fails, the error propagates and the attempt is denied.
  const { allowed, attemptId } = await recordRecoveryAttempt(
    req.ip ?? "unknown",
    req.get("user-agent") ?? null,
  );
  if (!allowed) {
    res.status(429).json({
      error: "Preveč poskusov (največ 5 na uro). Dostop je začasno zaklenjen.",
    });
    return;
  }
  const { code } = req.body ?? {};
  const ok = typeof code === "string" && (await consumeRecoveryCode(code));
  if (!ok) {
    res.status(401).json({ error: "Koda ni veljavna." });
    return;
  }
  if (attemptId) await markRecoveryAttemptSuccess(attemptId);
  // No session is created here: the enroll token only allows registering a
  // passkey; every other admin action still requires a passkey login.
  const token = await createEnrollToken("recovery");
  res.json({ enrollToken: token });
});

// ---------- Recovery codes management (authenticated) ----------

router.get("/admin/recovery-codes", requireAdmin, async (_req, res): Promise<void> => {
  res.json(await recoveryCodeCounts());
});

router.post("/admin/recovery-codes/rotate", requireAdmin, async (req, res): Promise<void> => {
  // Invalidate ALL existing codes and mint a fresh set of 10. Plaintext goes
  // only into this response (admin's screen); DB stores argon2 hashes.
  const recoveryCodes = await issueRecoveryCodes(10);
  await logAuthEvent(req, "recovery_codes_rotated", "count:10");
  res.json({ recoveryCodes });
});

router.get("/admin/auth-events", requireAdmin, async (_req, res): Promise<void> => {
  const events = await db
    .select()
    .from(adminAuthEventsTable)
    .orderBy(desc(adminAuthEventsTable.createdAt))
    .limit(200);
  res.json({
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      detail: e.detail,
      ip: e.ip,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

// ---------- Keys management (authenticated) ----------

router.get("/admin/credentials", requireAdmin, async (_req, res): Promise<void> => {
  const credentials = await listCredentials();
  res.json({
    credentials: credentials.map((c) => ({
      id: c.id,
      deviceName: c.deviceName,
      createdAt: c.createdAt.toISOString(),
      lastUsedAt: c.lastUsedAt ? c.lastUsedAt.toISOString() : null,
    })),
    unusedRecoveryCodes: await countUnusedRecoveryCodes(),
  });
});

router.patch("/admin/credentials/:id", requireAdmin, async (req, res): Promise<void> => {
  const { deviceName } = req.body ?? {};
  if (typeof deviceName !== "string" || !deviceName.trim()) {
    res.status(400).json({ error: "Ime naprave je obvezno." });
    return;
  }
  const [row] = await db
    .update(adminCredentialsTable)
    .set({ deviceName: deviceName.trim().slice(0, 80) })
    .where(eq(adminCredentialsTable.id, String(req.params["id"])))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Ključ ne obstaja." });
    return;
  }
  res.json({ ok: true });
});

router.delete("/admin/credentials/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params["id"]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(404).json({ error: "Ključ ne obstaja." });
    return;
  }
  // Atomic guard: delete only when another credential or an unused recovery code exists.
  const [deleted] = await db
    .delete(adminCredentialsTable)
    .where(
      sql`${adminCredentialsTable.id} = ${id} AND (
        EXISTS (SELECT 1 FROM ${adminCredentialsTable} c2 WHERE c2.id <> ${id})
        OR EXISTS (SELECT 1 FROM ${adminRecoveryCodesTable} r WHERE r.used_at IS NULL)
      )`,
    )
    .returning();
  if (!deleted) {
    const exists = (await listCredentials()).some((c) => c.id === id);
    if (!exists) {
      res.status(404).json({ error: "Ključ ne obstaja." });
      return;
    }
    res.status(400).json({
      error:
        "Zadnjega ključa ni mogoče izbrisati brez drugega ključa ali neporabljenih obnovitvenih kod.",
    });
    return;
  }
  await logAuthEvent(req, "credential_deleted", deleted.deviceName);
  res.json({ ok: true });
});

/** Add a passkey while signed in (no enroll token needed). */
router.post("/admin/credentials/options", requireAdmin, async (_req, res): Promise<void> => {
  const user = await getAdminUser();
  const existing = await listCredentials();
  const options = await generateRegistrationOptions({
    rpName: "Smart360",
    rpID: rpID(),
    userName: user?.email ?? ADMIN_EMAIL,
    userDisplayName: user?.displayName ?? "Upravitelj",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: parseTransports(c.transports),
    })),
  });
  const challengeId = await storeChallenge("registration", options.challenge, "session");
  res.json({ challengeId, options });
});

router.post("/admin/credentials/verify", requireAdmin, async (req, res): Promise<void> => {
  const { challengeId, response, deviceName } = req.body ?? {};
  if (typeof challengeId !== "string" || !response) {
    res.status(400).json({ error: "Neveljavna zahteva." });
    return;
  }
  const stored = await consumeChallenge(challengeId, "registration");
  if (!stored || stored.context !== "session") {
    res.status(400).json({ error: "Seja registracije je potekla. Poskusite znova." });
    return;
  }
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: rpOrigin(),
      expectedRPID: rpID(),
      requireUserVerification: true,
    });
  } catch (err) {
    req.log.warn({ err }, "Passkey registration failed");
    res.status(400).json({ error: "Registracija ključa ni uspela." });
    return;
  }
  if (!verification.verified || !verification.registrationInfo) {
    res.status(400).json({ error: "Registracija ključa ni uspela." });
    return;
  }
  const info = verification.registrationInfo;
  await db.insert(adminCredentialsTable).values({
    credentialId: info.credential.id,
    publicKey: Buffer.from(info.credential.publicKey).toString("base64url"),
    counter: info.credential.counter,
    transports: JSON.stringify(info.credential.transports ?? []),
    deviceName:
      typeof deviceName === "string" && deviceName.trim()
        ? deviceName.trim().slice(0, 80)
        : "Passkey",
  });
  await logAuthEvent(req, "enroll", "source:session");
  res.json({ ok: true });
});

router.post("/admin/sessions/revoke-all", requireAdmin, async (req, res): Promise<void> => {
  await revokeAllSessions();
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  await logAuthEvent(req, "revoke_all");
  res.json({ ok: true });
});

export default router;
