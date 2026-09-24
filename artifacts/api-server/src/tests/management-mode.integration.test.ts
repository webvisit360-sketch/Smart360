import assert from "node:assert/strict";
import crypto from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  adminSessionsTable,
  changelogTable,
  db,
  hostAuthEventsTable,
  hostInvitesTable,
  hostMembershipsTable,
  hostPasswordResetsTable,
  hostSessionsTable,
  hostUsersTable,
  messageThreadsTable,
  ordersTable,
  publishedSnapshotsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import app from "../app";
import { _setConciergeWelcomeDeliveryOverride } from "../lib/conciergeWelcomeEmail";
import { _setLifecycleDeliveryOverride } from "../lib/lifecycleEmails";
import { _setReadyDeliveryOverride } from "../lib/guideReadyNotice";
import { HOST_NOTIFICATION_REPLY_TO } from "../lib/businessContact";
import { ensureTenantPublication } from "../lib/publishedSnapshots";

const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

async function request(
  base: string,
  method: string,
  path: string,
  cookie: string | null,
  body?: unknown,
): Promise<Response> {
  return fetch(`${base}/api${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("management mode preserves guide state and closes every host access path", async (t) => {
  const stamp = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `management-mode-${stamp}`,
    name: "Management mode fixture",
    email: `management-mode-${stamp}@example.com`,
    managementMode: "concierge",
    isPublished: true,
    hasUnpublishedChanges: false,
  }).returning();
  await db.insert(sectionsTable).values({
    tenantId: tenant!.id,
    key: `fixture-${stamp}`,
    title: "Fixture content",
    position: 0,
    isVisible: true,
  });
  await ensureTenantPublication(tenant!.id);

  const ownerToken = crypto.randomBytes(32).toString("base64url");
  const [ownerSession] = await db.insert(adminSessionsTable).values({
    tokenHash: sha256(ownerToken),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  }).returning();
  const ownerCookie = `__Host-s360_admin=${ownerToken}`;

  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  let hostUserId: string | null = null;
  t.after(async () => {
    _setConciergeWelcomeDeliveryOverride(null);
    _setLifecycleDeliveryOverride(null);
    _setReadyDeliveryOverride(null);
    await db.delete(changelogTable).where(eq(changelogTable.tenantId, tenant!.id));
    if (hostUserId) {
      await db.delete(hostAuthEventsTable).where(eq(hostAuthEventsTable.hostUserId, hostUserId));
      await db.delete(hostUsersTable).where(eq(hostUsersTable.id, hostUserId));
    }
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, ownerSession!.id));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const state = async () => {
    const [row] = await db.select({
      isPublished: tenantsTable.isPublished,
      dirty: tenantsTable.hasUnpublishedChanges,
      orderNotifyEmail: tenantsTable.orderNotifyEmail,
      messageNotifyEmail: tenantsTable.messageNotifyEmail,
      notificationChannel: tenantsTable.notificationChannel,
    }).from(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
    const sections = await db.select().from(sectionsTable)
      .where(eq(sectionsTable.tenantId, tenant!.id));
    const [snapshot] = await db.select({ content: publishedSnapshotsTable.content })
      .from(publishedSnapshotsTable)
      .where(eq(publishedSnapshotsTable.tenantId, tenant!.id));
    const orders = await db.select({ id: ordersTable.id }).from(ordersTable)
      .where(eq(ordersTable.tenantId, tenant!.id));
    const threads = await db.select({ id: messageThreadsTable.id }).from(messageThreadsTable)
      .where(eq(messageThreadsTable.tenantId, tenant!.id));
    return {
      row,
      sectionHash: sha256(JSON.stringify(sections)),
      snapshotHash: sha256(JSON.stringify(snapshot?.content ?? null)),
      orderCount: orders.length,
      threadCount: threads.length,
    };
  };
  const before = await state();
  const authRowsBefore = {
    users: (await db.select().from(hostUsersTable)).length,
    invites: (await db.select().from(hostInvitesTable)).length,
    resets: (await db.select().from(hostPasswordResetsTable)).length,
  };

  const conciergeKeys: string[] = [];
  _setConciergeWelcomeDeliveryOverride(async (_body, options) => {
    conciergeKeys.push(options?.idempotencyKey ?? "");
    return {
      ok: false,
      error: {
        code: "provider_error",
        message: "fixture failure",
        httpStatus: 503,
        stage: "provider",
      },
    };
  });
  const failedConciergeSend = await request(
    base, "POST", `/admin/tenants/${tenant!.id}/host/send-invite`,
    ownerCookie, { template: "welcome" },
  );
  assert.equal(failedConciergeSend.status, 502);

  let conciergeDeliveries = 0;
  const conciergeBodies: Array<Record<string, unknown>> = [];
  _setConciergeWelcomeDeliveryOverride(async (body, options) => {
    conciergeBodies.push(body);
    conciergeDeliveries += 1;
    conciergeKeys.push(options?.idempotencyKey ?? "");
    return conciergeDeliveries === 1 ? { ok: true, providerMessageId: "fixture-concierge" } : {
      ok: false, error: { code: "private-address@secret.test", message: "https://secret.test", stage: "provider", httpStatus: 503 },
    };
  });
  const conciergeSend = await request(
    base, "POST", `/admin/tenants/${tenant!.id}/host/send-invite`,
    ownerCookie, { template: "welcome" },
  );
  assert.equal(conciergeSend.status, 200);
  assert.equal(conciergeDeliveries, 2);
  assert.equal(new Set(conciergeKeys).size, 3);
  assert.deepEqual(conciergeBodies[1]!.to, [HOST_NOTIFICATION_REPLY_TO]);
  assert.equal(conciergeBodies[0]!.html, conciergeBodies[1]!.html);
  assert.equal((await db.select().from(hostMembershipsTable)
    .where(eq(hostMembershipsTable.tenantId, tenant!.id))).length, 0);
  assert.deepEqual({
    users: (await db.select().from(hostUsersTable)).length,
    invites: (await db.select().from(hostInvitesTable)).length,
    resets: (await db.select().from(hostPasswordResetsTable)).length,
  }, authRowsBefore);

  const historyResponse = await request(
    base, "GET", `/admin/tenants/${tenant!.id}/host`, ownerCookie,
  );
  const historyBody = await historyResponse.json() as {
    account: unknown;
    inviteHistory: Array<{
      kind: string;
      label: string;
      createdAt: string;
      deliveryStatus: string;
      archiveStatus?: string;
    }>;
  };
  assert.equal(historyBody.account, null);
  assert.equal(historyBody.inviteHistory[0]?.kind, "welcome_without_access");
  assert.equal(historyBody.inviteHistory[0]?.deliveryStatus, "accepted");
  assert.equal(historyBody.inviteHistory[0]?.archiveStatus, "failed");
  assert.equal(historyBody.inviteHistory[1]?.deliveryStatus, "failed");
  assert.doesNotMatch(JSON.stringify(historyBody), /secret\.test|private-address/);
  // Re-send with a successful independent archive, without a live provider.
  _setConciergeWelcomeDeliveryOverride(async () => ({ ok: true, providerMessageId: "fixture-concierge-archived" }));
  const archivedConcierge = await request(
    base, "POST", `/admin/tenants/${tenant!.id}/host/send-invite`, ownerCookie, { template: "welcome" },
  );
  assert.equal(archivedConcierge.status, 200);
  assert.equal((await archivedConcierge.json() as { archiveStatus: string }).archiveStatus, "accepted");
  let conciergeThrowCount = 0;
  _setConciergeWelcomeDeliveryOverride(async () => {
    conciergeThrowCount++;
    if (conciergeThrowCount === 2) throw new Error("archive-only secret@example.test");
    return { ok: true, providerMessageId: "fixture-host-before-archive-exception" };
  });
  const conciergeException = await request(base, "POST", `/admin/tenants/${tenant!.id}/host/send-invite`, ownerCookie, { template: "welcome" });
  assert.equal(conciergeException.status, 200, "archive exception must not undo accepted host welcome");
  assert.equal((await conciergeException.json() as { archiveStatus: string }).archiveStatus, "failed");
  const conciergeReadyPreview = await request(base, "GET", `/admin/tenants/${tenant!.id}/host/ready-preview`, ownerCookie);
  assert.equal(conciergeReadyPreview.status, 200);
  assert.doesNotMatch((await conciergeReadyPreview.json() as { html: string }).html, /Uredite vodnik/);
  const readyBodies: Array<Record<string, unknown>> = [];
  _setReadyDeliveryOverride(async body => {
    readyBodies.push(body);
    return readyBodies.length === 1 ? { ok: true, providerMessageId: "ready-host" }
      : { ok: false, error: { code: "private-address@secret.test", message: "https://secret.test", stage: "provider", httpStatus: 503 } };
  });
  const readySend = await request(base, "POST", `/admin/tenants/${tenant!.id}/host/send-ready`, ownerCookie, {});
  assert.equal(readySend.status, 200);
  assert.equal((await readySend.json() as { archiveStatus: string }).archiveStatus, "failed");
  assert.deepEqual(readyBodies[1]?.["to"], [HOST_NOTIFICATION_REPLY_TO]);
  const readyHistory = await request(base, "GET", `/admin/tenants/${tenant!.id}/host`, ownerCookie);
  const readyHistoryText = await readyHistory.text();
  assert.match(readyHistoryText, /"kind":"guide_ready"/);
  assert.match(readyHistoryText, /"archiveStatus":"failed"/);
  assert.doesNotMatch(readyHistoryText, /secret\.test|private-address/);
  _setReadyDeliveryOverride(async () => ({ ok: true, providerMessageId: "concierge-ready-archived" }));
  const archivedConciergeReady = await request(base, "POST", `/admin/tenants/${tenant!.id}/host/send-ready`, ownerCookie, {});
  assert.equal(archivedConciergeReady.status, 200);
  assert.equal((await archivedConciergeReady.json() as { archiveStatus: string }).archiveStatus, "accepted");
  _setReadyDeliveryOverride(null);
  assert.deepEqual(await state(), before);

  const selfService = await request(
    base, "PATCH", `/admin/tenants/${tenant!.id}/management-mode`,
    ownerCookie, { managementMode: "self_service" },
  );
  assert.equal(selfService.status, 200);
  const selfServiceAdmin = await request(
    base, "GET", `/admin/tenants/${tenant!.id}`, ownerCookie,
  );
  assert.equal(selfServiceAdmin.status, 200);
  assert.equal((await selfServiceAdmin.json() as { managementMode: string }).managementMode, "self_service");
  assert.deepEqual(await state(), before);

  const hostEmail = `host-${stamp}@example.com`;
  const account = await request(
    base, "PUT", `/admin/tenants/${tenant!.id}/host`, ownerCookie, { email: hostEmail },
  );
  assert.equal(account.status, 200);
  const afterAccount = await state();
  assert.equal(afterAccount.row?.dirty, true);
  assert.equal(afterAccount.sectionHash, before.sectionHash);
  assert.equal(afterAccount.snapshotHash, before.snapshotHash);
  const [membership] = await db.select().from(hostMembershipsTable)
    .where(eq(hostMembershipsTable.tenantId, tenant!.id));
  assert.ok(membership);
  hostUserId = membership.hostUserId;

  let inviteToken: string | null = null;
  const inviteBodies: Array<Record<string, unknown>> = [];
  _setLifecycleDeliveryOverride(async (body) => {
    inviteBodies.push(body);
    const text = typeof body.text === "string" ? body.text : "";
    const match = text.match(/[?&]token=([A-Za-z0-9_-]+)/);
    inviteToken = match?.[1] ?? null;
    if (inviteBodies.length > 1) throw new Error("archive-only secret@example.test");
    return { ok: true, providerMessageId: "fixture-invitation" };
  });
  const invitation = await request(
    base, "POST", `/admin/tenants/${tenant!.id}/host/send-invite`,
    ownerCookie, { template: "welcome" },
  );
  assert.equal(invitation.status, 200);
  assert.ok(inviteToken);
  assert.deepEqual(inviteBodies[1]?.["to"], [HOST_NOTIFICATION_REPLY_TO]);
  assert.equal(inviteBodies[0]?.["html"], inviteBodies[1]?.["html"]);
  const selfReadyPreview = await request(base, "GET", `/admin/tenants/${tenant!.id}/host/ready-preview`, ownerCookie);
  assert.equal(selfReadyPreview.status, 200);
  assert.match((await selfReadyPreview.json() as { html: string }).html, /Uredite vodnik/);
  const invitesBeforeReady = (await db.select().from(hostInvitesTable)).length;
  let selfReadyDeliveries = 0;
  _setReadyDeliveryOverride(async body => {
    readyBodies.push(body);
    selfReadyDeliveries += 1;
    return selfReadyDeliveries === 1 ? { ok: true, providerMessageId: "self-ready" } : {
      ok: false, error: { code: "private-address@secret.test", message: "https://secret.test", stage: "provider", httpStatus: 503 },
    };
  });
  const selfReady = await request(base, "POST", `/admin/tenants/${tenant!.id}/host/send-ready`, ownerCookie, {});
  assert.equal(selfReady.status, 200);
  assert.equal((await selfReady.json() as { archiveStatus: string }).archiveStatus, "failed");
  assert.equal((await db.select().from(hostInvitesTable)).length, invitesBeforeReady, "ready must not issue/invalidate invitations");
  const selfHistory = await request(base, "GET", `/admin/tenants/${tenant!.id}/host`, ownerCookie);
  const selfHistoryText = await selfHistory.text();
  assert.match(selfHistoryText, /"kind":"guide_ready"/);
  assert.match(selfHistoryText, /"kind":"welcome_with_access"/);
  assert.match(selfHistoryText, /"archiveStatus":"failed"/);
  assert.doesNotMatch(selfHistoryText, /secret\.test|private-address/);
  _setReadyDeliveryOverride(async () => ({ ok: true, providerMessageId: "self-ready-archived" }));
  const archivedSelfReady = await request(base, "POST", `/admin/tenants/${tenant!.id}/host/send-ready`, ownerCookie, {});
  assert.equal(archivedSelfReady.status, 200);
  assert.equal((await archivedSelfReady.json() as { archiveStatus: string }).archiveStatus, "accepted");
  assert.equal((await db.select().from(hostInvitesTable)).length, invitesBeforeReady);
  _setReadyDeliveryOverride(null);

  const password = `Fixture-${stamp}-password`;
  const claim = await request(base, "POST", "/admin/host/invite/confirm", null, {
    token: inviteToken,
    newPassword: password,
  });
  assert.equal(claim.status, 204);
  const login = await request(base, "POST", "/admin/host/login", null, {
    email: hostEmail,
    password,
  });
  assert.equal(login.status, 200);
  const hostCookie = login.headers.get("set-cookie")?.split(";")[0] ?? null;
  assert.ok(hostCookie);
  const session = await request(base, "GET", "/admin/host/session", hostCookie);
  assert.equal((await session.json() as { authenticated: boolean }).authenticated, true);

  const hostModeEdit = await request(
    base, "PATCH", `/admin/tenants/${tenant!.id}/management-mode`,
    hostCookie, { managementMode: "concierge" },
  );
  assert.equal(hostModeEdit.status, 403);

  const [passwordBefore] = await db.select({ hash: hostUsersTable.passwordHash })
    .from(hostUsersTable).where(eq(hostUsersTable.id, hostUserId));
  const beforeConciergeTransition = await state();
  const concierge = await request(
    base, "PATCH", `/admin/tenants/${tenant!.id}/management-mode`,
    ownerCookie, { managementMode: "concierge" },
  );
  assert.equal(concierge.status, 200);
  const conciergeAdmin = await request(
    base, "GET", `/admin/tenants/${tenant!.id}`, ownerCookie,
  );
  assert.equal(conciergeAdmin.status, 200);
  assert.equal((await conciergeAdmin.json() as { managementMode: string }).managementMode, "concierge");
  assert.equal((await db.select().from(hostSessionsTable)
    .where(eq(hostSessionsTable.hostUserId, hostUserId))).length, 0);
  const revokedSession = await request(base, "GET", "/admin/host/session", hostCookie);
  assert.equal((await revokedSession.json() as { authenticated: boolean }).authenticated, false);
  assert.equal((await request(base, "POST", "/admin/host/login", null, {
    email: hostEmail,
    password,
  })).status, 401);
  const [passwordAfter] = await db.select({ hash: hostUsersTable.passwordHash })
    .from(hostUsersTable).where(eq(hostUsersTable.id, hostUserId));
  assert.equal(passwordAfter!.hash, passwordBefore!.hash);
  const afterConciergeTransition = await state();
  assert.deepEqual(afterConciergeTransition, beforeConciergeTransition);
  assert.equal(afterConciergeTransition.sectionHash, before.sectionHash);
  assert.equal(afterConciergeTransition.snapshotHash, before.snapshotHash);
  assert.equal(afterConciergeTransition.row?.isPublished, before.row?.isPublished);
  assert.equal(afterConciergeTransition.row?.orderNotifyEmail, before.row?.orderNotifyEmail);
  assert.equal(afterConciergeTransition.row?.messageNotifyEmail, before.row?.messageNotifyEmail);
  assert.equal(afterConciergeTransition.row?.notificationChannel, before.row?.notificationChannel);
  assert.equal(afterConciergeTransition.orderCount, before.orderCount);
  assert.equal(afterConciergeTransition.threadCount, before.threadCount);

  const outstanding = await db.select().from(hostInvitesTable)
    .where(eq(hostInvitesTable.hostUserId, hostUserId));
  assert.ok(outstanding.every((row) => row.usedAt !== null || row.invalidatedAt !== null));
});