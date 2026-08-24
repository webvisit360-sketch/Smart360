import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  hostAuthEventsTable,
  hostInvitesTable,
  hostMembershipsTable,
  hostSessionsTable,
  hostUsersTable,
  tenantsTable,
} from "@workspace/db";
import {
  consumeHostInvite,
  INVITE_TTL_MS,
  issueHostInviteForTenant,
  issueHostPasswordReset,
} from "../lib/hostAuth";

const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const ownerRequest = {
  actor: { kind: "owner" },
  ip: "127.0.0.1",
  get: (name: string) => name.toLowerCase() === "user-agent" ? "invite-test" : undefined,
} as unknown as Request;

async function makePasswordlessAccount(stamp: string) {
  const [tenant] = await db
    .insert(tenantsTable)
    .values({ slug: `invite-${stamp}`, name: `Invite ${stamp}` })
    .returning({ id: tenantsTable.id });
  const [user] = await db
    .insert(hostUsersTable)
    .values({ email: `invite-${stamp}@example.com`, passwordHash: null })
    .returning({ id: hostUsersTable.id });
  await db.insert(hostMembershipsTable).values({
    hostUserId: user!.id,
    tenantId: tenant!.id,
  });
  return { tenantId: tenant!.id, userId: user!.id };
}

test("CP3 invitations are separate, 72-hour, invalidating and single-use", async (t) => {
  const stamp = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  const main = await makePasswordlessAccount(`${stamp}-main`);
  const expiring = await makePasswordlessAccount(`${stamp}-expiry`);
  const limited = await makePasswordlessAccount(`${stamp}-limit`);
  const tenantIds = [main.tenantId, expiring.tenantId, limited.tenantId];
  const userIds = [main.userId, expiring.userId, limited.userId];

  t.after(async () => {
    for (const userId of userIds) {
      await db.delete(hostUsersTable).where(eq(hostUsersTable.id, userId));
    }
    for (const tenantId of tenantIds) {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    }
  });

  const first = await issueHostInviteForTenant(main.tenantId, "welcome", ownerRequest);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.ok(
    Math.abs(first.expiresAt.getTime() - Date.now() - INVITE_TTL_MS) < 5_000,
    "invite expires 72 hours after issue",
  );
  const [storedFirst] = await db
    .select()
    .from(hostInvitesTable)
    .where(eq(hostInvitesTable.hostUserId, main.userId));
  assert.equal(storedFirst!.tokenHash, sha256(first.token), "only SHA-256 is stored");
  assert.notEqual(storedFirst!.tokenHash, first.token, "raw token is never stored");

  const second = await issueHostInviteForTenant(main.tenantId, "guide-ready", ownerRequest);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const [invalidated] = await db
    .select({ invalidatedAt: hostInvitesTable.invalidatedAt })
    .from(hostInvitesTable)
    .where(eq(hostInvitesTable.tokenHash, sha256(first.token)));
  assert.ok(invalidated!.invalidatedAt, "new invitation invalidates the preceding one");
  assert.equal(
    (await consumeHostInvite(first.token, "veljavno-geslo-123", ownerRequest)).ok,
    false,
    "invalidated invitation is refused",
  );

  await db.insert(hostSessionsTable).values({
    hostUserId: main.userId,
    tokenHash: sha256("pre-claim-session"),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const concurrent = await Promise.all([
    consumeHostInvite(second.token, "veljavno-geslo-123", ownerRequest),
    consumeHostInvite(second.token, "drugo-geslo-456", ownerRequest),
  ]);
  assert.equal(concurrent.filter((result) => result.ok).length, 1, "exactly one concurrent use wins");
  const sessions = await db
    .select({ id: hostSessionsTable.id })
    .from(hostSessionsTable)
    .where(eq(hostSessionsTable.hostUserId, main.userId));
  assert.equal(sessions.length, 0, "claim revokes every existing session");

  const afterClaim = await issueHostInviteForTenant(main.tenantId, "welcome", ownerRequest);
  assert.ok(!afterClaim.ok && afterClaim.status === 409, "invite cannot reset a claimed account");
  const resetForClaimed = await issueHostPasswordReset(
    `invite-${stamp}-main@example.com`,
    ownerRequest,
  );
  assert.ok(resetForClaimed, "claimed account can receive a distinct 60-minute reset");
  const resetForUnclaimed = await issueHostPasswordReset(
    `invite-${stamp}-expiry@example.com`,
    ownerRequest,
  );
  assert.equal(resetForUnclaimed, null, "passwordless account cannot be claimed with a reset");

  const expiringInvite = await issueHostInviteForTenant(
    expiring.tenantId,
    "welcome",
    ownerRequest,
  );
  assert.equal(expiringInvite.ok, true);
  if (!expiringInvite.ok) return;
  await db
    .update(hostInvitesTable)
    .set({ expiresAt: new Date(Date.now() - 1) })
    .where(eq(hostInvitesTable.tokenHash, sha256(expiringInvite.token)));
  assert.equal(
    (await consumeHostInvite(expiringInvite.token, "veljavno-geslo-123", ownerRequest)).ok,
    false,
    "expired invitation is refused",
  );

  for (let index = 0; index < 3; index += 1) {
    const result = await issueHostInviteForTenant(limited.tenantId, "welcome", ownerRequest);
    assert.equal(result.ok, true, `invite ${index + 1} is within the DB-backed hourly cap`);
  }
  const capped = await issueHostInviteForTenant(limited.tenantId, "welcome", ownerRequest);
  assert.ok(!capped.ok && capped.status === 429, "fourth invite in one hour is rate-limited");

  const events = await db
    .select({ type: hostAuthEventsTable.type, detail: hostAuthEventsTable.detail })
    .from(hostAuthEventsTable)
    .where(eq(hostAuthEventsTable.hostUserId, main.userId));
  assert.equal(events.filter((event) => event.type === "invite_issued").length, 2);
  assert.equal(events.filter((event) => event.type === "invite_used").length, 1);
  assert.ok(
    events.every((event) => event.detail?.includes("actor=")),
    "every invite issue/use audit event carries actor context",
  );

  const tokenTypesOverlap = await db
    .select({ id: hostInvitesTable.id })
    .from(hostInvitesTable)
    .where(
      and(
        eq(hostInvitesTable.hostUserId, main.userId),
        eq(hostInvitesTable.tokenHash, sha256(resetForClaimed!.token)),
      ),
    );
  assert.equal(tokenTypesOverlap.length, 0, "invite and reset token hashes live in separate tables");
});