import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "node:crypto";
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
  getHostInvitationHistoryForTenant,
  upsertHostAccountForTenant,
} from "../lib/hostAuth";
import { sendHostResetEmail } from "../lib/hostResetEmail";
import { getWelcomePreview } from "../lib/welcomePreview";
import { requireAdmin, rpOrigin } from "../lib/adminAuth";
import { sendGuideReadyEmail, sendWelcomeEmail } from "../lib/lifecycleEmails";
import { sendConciergeWelcomeEmail } from "../lib/conciergeWelcomeEmail";
import { logChange } from "../lib/changelog";
import { logger } from "../lib/logger";
import { recordHostInviteDeliveryFailure } from "../lib/hostInviteDelivery";
import { onboardingRequired } from "../lib/hostOnboarding";
import { actorStorage } from "../lib/actorContext";
import { markTenantAdminChangeDirty } from "../lib/tenantPublicationState";
import { db, hostInvitesTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { guestUrl } from "../lib/guestUrl";
import { HOST_NOTIFICATION_REPLY_TO } from "../lib/businessContact";
import { defaultReadyMessage, renderReadyNotice, sendReadyNotice, READY_SUBJECT } from "../lib/guideReadyNotice";
import { recordLifecycleSend } from "../lib/lifecycleHistory";
import type { ResendResult } from "../lib/resendDelivery";

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

function archiveException(): ResendResult {
  // The host delivery has already succeeded. Never let an archive transport
  // exception turn that outcome into a false failure or persist raw details.
  return { ok: false, error: {
    code: "transport_error", message: "Arhivska kopija ni uspela",
    stage: "transport", httpStatus: null,
  } };
}

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
  res.json({
    authenticated: true,
    email: actor.email,
    tenantId: actor.tenantId,
    onboardingRequired: await onboardingRequired(actor.tenantId, actor.hostUserId),
  });
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
  const inviteHistory = await getHostInvitationHistoryForTenant(tenantId, account);
  res.json({
    account: account ? { ...account, inviteHistory } : null,
    inviteHistory,
  });
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

router.get("/admin/tenants/:id/host/welcome-preview", requireAdmin, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const tenantId = tenantParam(req, res);
  if (!tenantId) return;
  const preview = await getWelcomePreview(tenantId);
  if (!preview) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(preview);
});

router.get("/admin/tenants/:id/host/ready-preview", requireAdmin, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const tenantId = tenantParam(req, res);
  if (!tenantId) return;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenant) { res.status(404).json({ error: "Not found" }); return; }
  const url = guestUrl(tenant.slug);
  const rendered = await renderReadyNotice({ tenantName: tenant.name, slug: tenant.slug, guideUrl: url, mode: tenant.managementMode === "concierge" ? "concierge" : "self_service" });
  const account = tenant.managementMode === "self_service" ? await getHostAccountForTenant(tenantId) : null;
  res.json({ propertyName: tenant.name, recipient: tenant.managementMode === "concierge" ? tenant.email : account?.email ?? null,
    managementMode: tenant.managementMode, guideUrl: url, subject: rendered.subject, message: rendered.message, html: rendered.html, text: rendered.text });
});

router.post("/admin/tenants/:id/host/ready-preview", requireAdmin, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  res.locals["skipAdminMutationInvalidation"] = true;
  const tenantId = tenantParam(req, res);
  if (!tenantId) return;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenant) { res.status(404).json({ error: "Not found" }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body["subject"] !== "string" || typeof body["message"] !== "string") {
    res.status(400).json({ error: "Neveljavna zadeva ali besedilo." }); return;
  }
  try {
    const rendered = await renderReadyNotice({
      tenantName: tenant.name, slug: tenant.slug, guideUrl: guestUrl(tenant.slug),
      mode: tenant.managementMode === "concierge" ? "concierge" : "self_service", subject: body["subject"], message: body["message"],
    });
    res.json({ subject: rendered.subject, message: rendered.message, html: rendered.html, text: rendered.text });
  } catch { res.status(400).json({ error: "Neveljavna zadeva ali besedilo." }); }
});

router.post("/admin/tenants/:id/host/send-ready", requireAdmin, async (req, res): Promise<void> => {
  res.locals["skipAdminMutationInvalidation"] = true;
  const tenantId = tenantParam(req, res);
  if (!tenantId) return;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenant) { res.status(404).json({ error: "Not found" }); return; }
  const account = tenant.managementMode === "self_service" ? await getHostAccountForTenant(tenantId) : null;
  const recipient = tenant.managementMode === "concierge" ? tenant.email?.trim() : account?.email;
  if (!recipient) { res.status(409).json({ error: "Nastanitev nima e-poštnega naslova prejemnika." }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  if ((body["subject"] !== undefined && typeof body["subject"] !== "string") ||
      (body["message"] !== undefined && typeof body["message"] !== "string")) {
    res.status(400).json({ error: "Neveljavno besedilo sporočila." }); return;
  }
  const input = {
    recipient, tenantName: tenant.name, slug: tenant.slug,
    guideUrl: guestUrl(tenant.slug), mode: tenant.managementMode === "concierge" ? "concierge" as const : "self_service" as const,
    subject: (body["subject"] as string | undefined) ?? READY_SUBJECT,
    message: (body["message"] as string | undefined) ?? defaultReadyMessage(guestUrl(tenant.slug)),
  };
  try {
    // Validate/render before any provider call. An invalid edit cannot result in a send.
    await renderReadyNotice(input);
  } catch {
    res.status(400).json({ error: "Neveljavna zadeva ali besedilo sporočila." }); return;
  }
  const key = `ready-${tenantId}-${crypto.randomUUID()}`;
  let host: ResendResult;
  try { host = await sendReadyNotice(input, key); }
  catch {
    res.status(503).json({ error: "Nalepke ni bilo mogoče pripraviti. Sporočilo ni bilo poslano." }); return;
  }
  // A failed recipient send never causes an accidental archive-only message.
  let archive: ResendResult | null = null;
  if (host.ok) {
    try { archive = await sendReadyNotice({ ...input, recipient: HOST_NOTIFICATION_REPLY_TO }, `${key}-archive`); }
    catch { archive = archiveException(); }
  }
  await recordLifecycleSend(tenantId, "guide_ready", host, archive);
  if (!host.ok) { res.status(502).json({ sent: false, archiveStatus: "not_attempted", error: "Pošiljanje e-pošte ni uspelo." }); return; }
  res.json({ sent: true, to: recipient, kind: "guide_ready", archiveStatus: archive?.ok ? "accepted" : "failed" });
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
    const [tenant] = await db
      .select({
        email: tenantsTable.email,
        managementMode: tenantsTable.managementMode,
        name: tenantsTable.name,
        slug: tenantsTable.slug,
      })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId))
      .limit(1);
    if (!tenant) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (tenant.managementMode === "concierge") {
      res.locals["skipAdminMutationInvalidation"] = true;
      if (rawTemplate !== "welcome") {
        res.status(409).json({ error: "V načinu Ureja Smart360 je mogoče poslati le dobrodošlico brez dostopa." });
        return;
      }
      const recipient = tenant.email?.trim();
      if (!recipient) {
        res.status(409).json({ error: "Nastanitev nima e-poštnega naslova za dobrodošlico." });
        return;
      }
      const sent = await sendConciergeWelcomeEmail(
        {
          recipient,
          tenantName: tenant.name,
          guideUrl: guestUrl(tenant.slug),
        },
        `concierge-welcome-${tenantId}-${crypto.randomUUID()}`,
      );
      if (!sent.ok) {
        await recordLifecycleSend(tenantId, "welcome_without_access", sent, null);
        res.status(502).json({ error: "Pošiljanje e-pošte ni uspelo. Poskusite znova." });
        return;
      }
      let archive: ResendResult;
      try {
        archive = await sendConciergeWelcomeEmail(
          { recipient: HOST_NOTIFICATION_REPLY_TO, tenantName: tenant.name, guideUrl: guestUrl(tenant.slug) },
          `concierge-welcome-archive-${tenantId}-${crypto.randomUUID()}`,
        );
      } catch { archive = archiveException(); }
      await recordLifecycleSend(tenantId, "welcome_without_access", sent, archive);
      res.json({
        sent: true,
        to: recipient,
        template: "welcome",
        kind: "welcome_without_access",
        label: "dobrodošlica brez dostopa",
        archiveStatus: archive.ok ? "accepted" : "failed",
      });
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
      const failure = await recordHostInviteDeliveryFailure(issued.inviteId, sent);
      if (issued.template === "welcome") await recordLifecycleSend(tenantId, "welcome_with_access", sent, null);
      res.status(502).json({ error: failure.message });
      return;
    }
    let archive: ResendResult | null = null;
    if (issued.template === "welcome") {
      try {
        archive = await sendWelcomeEmail(
          { to: HOST_NOTIFICATION_REPLY_TO, propertyName: issued.propertyName, setPasswordUrl },
          `invite-archive-${issued.inviteId}`,
        );
      } catch { archive = archiveException(); }
    }
    if (issued.template === "welcome") await recordLifecycleSend(tenantId, "welcome_with_access", sent, archive);
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
      ...(archive ? { archiveStatus: archive.ok ? "accepted" : "failed" } : {}),
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
