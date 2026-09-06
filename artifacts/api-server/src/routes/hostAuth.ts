import { Router, type IRouter, type Request, type Response } from "express";
import {
  loginHost,
  destroyHostSession,
  findHostActor,
  changeHostPassword,
  issueHostInviteForTenant,
  consumeHostInvite,
  issueHostPasswordReset,
  consumeHostPasswordReset,
  getHostAccountForTenant,
  upsertHostAccountForTenant,
} from "../lib/hostAuth";
import { sendHostResetEmail } from "../lib/hostResetEmail";
import { requireAdmin, rpOrigin } from "../lib/adminAuth";
import { sendGuideReadyEmail, sendWelcomeEmail } from "../lib/lifecycleEmails";
import { logChange } from "../lib/changelog";
import { logger } from "../lib/logger";
import { actorStorage } from "../lib/actorContext";
import { markTenantAdminChangeDirty } from "../lib/tenantPublicationState";
import { db, hostInvitesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Host account routes (Instruction #28, CHECKPOINT 2).
 *
 * Anonymous endpoints (login, reset) answer UNIFORMLY: they never reveal
 * whether an e-mail has an account. Owner-side management endpoints live
 * under the tenant URL and are owner-only via the gate registry — a host
 * gets 404 on them. The owner can set the host's e-mail and trigger a reset
 * mail TO THE HOST'S ADDRESS, but can never see or set a password.
 */

const router: IRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function logAnonymousHostConfirmation(
  result: { hostUserId: string; tenantId: string },
  req: Request,
  entity: string,
  summary: string,
): Promise<void> {
  // These endpoints have no session actor. Set a tightly-scoped, server-derived
  // host context only after the atomic token operation has succeeded.
  await actorStorage.run(
    {
      kind: "host",
      hostUserId: result.hostUserId,
      tenantId: result.tenantId,
      requestIp: req.ip ?? null,
    },
    () =>
      logChange({
        tenantId: result.tenantId,
        action: "update",
        entity,
        summary,
      }),
  );
}

// ── Anonymous: login / session / logout ──────────────────────────────────────

router.post("/admin/host/login", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const result = await loginHost(body["email"], body["password"], req, res);
  if (!result.ok) {
    if (result.status === 429) {
      res.status(429).json({ error: "Preveč poskusov. Poskusite znova čez nekaj minut." });
      return;
    }
    // Uniform for wrong password, unknown e-mail, no password set, backoff.
    res.status(401).json({ error: "Napačen e-naslov ali geslo." });
    return;
  }
  res.json({ ok: true, tenantId: result.tenantId, email: result.email });
});

router.get("/admin/host/session", async (req, res): Promise<void> => {
  const actor = await findHostActor(req);
  if (!actor) {
    res.json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, email: actor.email, tenantId: actor.tenantId });
});

router.post("/admin/host/logout", async (req, res): Promise<void> => {
  await destroyHostSession(req, res);
  res.status(204).end();
});

// ── Host-self: password change ───────────────────────────────────────────────

router.post("/admin/host/password", async (req, res): Promise<void> => {
  const actor = await findHostActor(req);
  if (!actor) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const result = await changeHostPassword(actor, body["currentPassword"], body["newPassword"], req);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  await logChange({
    tenantId: actor.tenantId,
    action: "update",
    entity: "host-password-change",
    summary: "Geslo stranke je bilo spremenjeno.",
  });
  res.status(204).end();
});

// ── Anonymous: password reset ────────────────────────────────────────────────

router.post("/admin/host/reset/request", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const issued = await issueHostPasswordReset(body["email"], req);
  if (issued) {
    const sent = await sendHostResetEmail(issued.email, issued.token);
    if (!sent.ok) {
      // Still a uniform response — delivery problems must not become an
      // account-existence oracle. The failure is in the server log.
      logger.error("[hostAuth] reset e-mail delivery failed");
    }
  }
  res.json({ ok: true });
});

router.post("/admin/host/reset/confirm", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const result = await consumeHostPasswordReset(body["token"], body["newPassword"], req);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  await logAnonymousHostConfirmation(
    result,
    req,
    "host-password-reset-confirmed",
    "Stranka je potrdila ponastavitev gesla.",
  );
  res.status(204).end();
});

// ── Anonymous: account claim through a distinct 72-hour invite ───────────────

router.post("/admin/host/invite/confirm", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const result = await consumeHostInvite(body["token"], body["newPassword"], req);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  await logAnonymousHostConfirmation(
    result,
    req,
    "host-invite-confirmed",
    "Stranka je aktivirala dostop.",
  );
  res.status(204).end();
});

// ── Owner-only: host account management per tenant ──────────────────────────

function tenantParam(req: Request, res: Response): string | null {
  const raw = req.params["id"];
  const id = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  if (!UUID_RE.test(id)) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return id;
}

router.get("/admin/tenants/:id/host", requireAdmin, async (req, res): Promise<void> => {
  const tenantId = tenantParam(req, res);
  if (!tenantId) return;
  const account = await getHostAccountForTenant(tenantId);
  res.json({ account });
});

router.put("/admin/tenants/:id/host", requireAdmin, async (req, res): Promise<void> => {
  const tenantId = tenantParam(req, res);
  if (!tenantId) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const result = await upsertHostAccountForTenant(tenantId, body["email"], req);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  await markTenantAdminChangeDirty(tenantId);
  await logChange({
    tenantId,
    action: result.created ? "create" : "update",
    entity: result.created ? "host-account-created" : "host-account-email-changed",
    summary: result.created
      ? "Ustvarjen je bil dostop stranke."
      : "Spremenjen je bil e-naslov dostopa stranke.",
  });
  res.json({ ok: true, created: result.created, email: result.email });
});

router.post(
  "/admin/tenants/:id/host/send-invite",
  requireAdmin,
  async (req, res): Promise<void> => {
    const tenantId = tenantParam(req, res);
    if (!tenantId) return;
    const rawTemplate = (req.body as Record<string, unknown> | undefined)?.["template"];
    if (rawTemplate !== "welcome" && rawTemplate !== "guide-ready") {
      res.status(400).json({ error: "template must be welcome or guide-ready" });
      return;
    }
    const issued = await issueHostInviteForTenant(tenantId, rawTemplate, req);
    if (!issued.ok) {
      res.status(issued.status).json({ error: issued.error });
      return;
    }
    await markTenantAdminChangeDirty(tenantId);

    const setPasswordUrl =
      `${rpOrigin()}/portal/povabilo?token=${encodeURIComponent(issued.token)}`;
    const sent =
      issued.template === "welcome"
        ? await sendWelcomeEmail(
            {
              to: issued.email,
              propertyName: issued.propertyName,
              setPasswordUrl,
            },
            `invite-${issued.inviteId}`,
          )
        : await sendGuideReadyEmail(
            {
              to: issued.email,
              propertyName: issued.propertyName,
              slug: issued.slug,
              setPasswordUrl,
            },
            `invite-${issued.inviteId}`,
          );
    if (!sent.ok) {
      await db
        .update(hostInvitesTable)
        .set({ deliveryStatus: "failed", providerMessageId: null, deliveryAttemptedAt: new Date() })
        .where(eq(hostInvitesTable.id, issued.inviteId));
      res.status(502).json({ error: "Pošiljanje e-pošte ni uspelo. Poskusite znova." });
      return;
    }
    await db
      .update(hostInvitesTable)
      .set({
        deliveryStatus: "accepted",
        providerMessageId: sent.providerMessageId,
        deliveryAttemptedAt: new Date(),
      })
      .where(eq(hostInvitesTable.id, issued.inviteId));
    await logChange({
      tenantId,
      tenantName: issued.propertyName,
      action: "send",
      entity: "host-invite",
      summary: "Poslano je bilo povabilo stranki.",
    });
    res.json({
      sent: true,
      to: issued.email,
      template: issued.template,
      expiresAt: issued.expiresAt.toISOString(),
    });
  },
);

router.post(
  "/admin/tenants/:id/host/send-reset",
  requireAdmin,
  async (req, res): Promise<void> => {
    const tenantId = tenantParam(req, res);
    if (!tenantId) return;
    const account = await getHostAccountForTenant(tenantId);
    if (!account) {
      res.status(409).json({ error: "Ta namestitev še nima gostiteljskega računa." });
      return;
    }
    if (!account.hasPassword) {
      res.status(409).json({
        error: "Račun še ni aktiviran. Pošljite 72-urno vabilo namesto ponastavitve.",
      });
      return;
    }
    // No IP limiter here (owner cockpit), but the per-account 3/hour cap in
    // the DB still applies — it also covers the owner clicking repeatedly.
    const issued = await issueHostPasswordReset(account.email, null);
    if (!issued) {
      res.status(429).json({ error: "Omejitev: največ 3 zahteve na uro za ta račun." });
      return;
    }
    await markTenantAdminChangeDirty(tenantId);
    const sent = await sendHostResetEmail(issued.email, issued.token);
    if (!sent.ok) {
      res.status(502).json({ error: "Pošiljanje e-pošte ni uspelo. Poskusite znova." });
      return;
    }
    await logChange({
      tenantId,
      action: "send",
      entity: "host-password-reset",
      summary: "Poslana je bila ponastavitev gesla stranke.",
    });
    res.json({ sent: true, to: issued.email });
  },
);

export default router;
