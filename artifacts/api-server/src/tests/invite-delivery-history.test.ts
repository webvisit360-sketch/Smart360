import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { once } from "node:events";
import { eq } from "drizzle-orm";
import {
  adminSessionsTable,
  changelogTable,
  db,
  hostAuthEventsTable,
  hostInvitesTable,
  hostMembershipsTable,
  hostUsersTable,
  tenantsTable,
} from "@workspace/db";
import app from "../app";
import { _setLifecycleDeliveryOverride } from "../lib/lifecycleEmails";

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

test("invite delivery failures are durable, safe and owner-only", async (t) => {
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const stamp = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;

  const [tenant] = await db
    .insert(tenantsTable)
    .values({ slug: `delivery-${stamp}`, name: `Delivery ${stamp}` })
    .returning({ id: tenantsTable.id });
  const [host] = await db
    .insert(hostUsersTable)
    .values({ email: `delivery-${stamp}@example.com`, passwordHash: null })
    .returning({ id: hostUsersTable.id });
  await db.insert(hostMembershipsTable).values({
    hostUserId: host!.id,
    tenantId: tenant!.id,
  });

  const ownerToken = crypto.randomBytes(32).toString("base64url");
  const [ownerSession] = await db
    .insert(adminSessionsTable)
    .values({
      tokenHash: sha256(ownerToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning({ id: adminSessionsTable.id });
  const ownerCookie = `__Host-s360_admin=${ownerToken}`;
  const rawEvidence = "SECRET_API_KEY raw provider response";

  t.after(async () => {
    _setLifecycleDeliveryOverride(null);
    await db.delete(changelogTable).where(eq(changelogTable.tenantId, tenant!.id));
    await db.delete(hostAuthEventsTable).where(eq(hostAuthEventsTable.hostUserId, host!.id));
    await db.delete(hostUsersTable).where(eq(hostUsersTable.id, host!.id));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, ownerSession!.id));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  _setLifecycleDeliveryOverride(async () => ({
    ok: false,
    error: {
      code: "missing_api_key",
      message: "Poštni ključ ni nastavljen",
      httpStatus: null,
      stage: "configuration",
    },
  }));
  const missingKey = await request(
    base,
    "POST",
    `/admin/tenants/${tenant!.id}/host/send-invite`,
    ownerCookie,
    { template: "welcome" },
  );
  assert.equal(missingKey.status, 502);
  assert.deepEqual(await missingKey.json(), { error: "Poštni ključ ni nastavljen" });

  const [failedInvite] = await db
    .select()
    .from(hostInvitesTable)
    .where(eq(hostInvitesTable.hostUserId, host!.id));
  assert.equal(failedInvite!.deliveryStatus, "failed");
  assert.ok(failedInvite!.deliveryAttemptedAt);
  const missingKeyEvents = await db
    .select({ detail: hostAuthEventsTable.detail })
    .from(hostAuthEventsTable)
    .where(eq(hostAuthEventsTable.type, "invite_delivery_failed"));
  const missingKeyEvent = missingKeyEvents.find((event) =>
    event.detail?.includes(failedInvite!.id),
  );
  assert.ok(missingKeyEvent, "failure event is linked to the same invite row");

  const firstRead = await request(
    base,
    "GET",
    `/admin/tenants/${tenant!.id}/host`,
    ownerCookie,
  );
  assert.equal(firstRead.status, 200);
  const firstAccount = await firstRead.json() as {
    account: { inviteHistory: Array<Record<string, unknown>> };
  };
  assert.deepEqual(firstAccount.account.inviteHistory[0]?.["deliveryFailure"], {
    code: "missing_api_key",
    message: "Poštni ključ ni nastavljen",
    httpStatus: null,
    stage: "configuration",
  });

  // A new request proves the history is reconstructed from persisted audit
  // data rather than retained in process memory.
  const reread = await request(
    base,
    "GET",
    `/admin/tenants/${tenant!.id}/host`,
    ownerCookie,
  );
  assert.equal(reread.status, 200);
  assert.equal(
    ((await reread.json()) as {
      account: { inviteHistory: Array<{ deliveryFailure: { message: string } | null }> };
    }).account.inviteHistory[0]?.deliveryFailure?.message,
    "Poštni ključ ni nastavljen",
  );

  _setLifecycleDeliveryOverride(async () => ({
    ok: false,
    error: {
      code: "provider_unauthorized",
      message: rawEvidence,
      httpStatus: 401,
      stage: "provider",
    },
  }));
  const unauthorized = await request(
    base,
    "POST",
    `/admin/tenants/${tenant!.id}/host/send-invite`,
    ownerCookie,
    { template: "guide-ready" },
  );
  assert.equal(unauthorized.status, 502);
  assert.deepEqual(await unauthorized.json(), {
    error: "Ponudnik je zavrnil poštni ključ",
  });

  const eventsAfter401 = await db
    .select({ detail: hostAuthEventsTable.detail })
    .from(hostAuthEventsTable)
    .where(eq(hostAuthEventsTable.hostUserId, host!.id));
  assert.equal(
    eventsAfter401.some((event) => event.detail?.includes(rawEvidence)),
    false,
    "raw provider evidence is never persisted",
  );
  const history401 = await request(
    base,
    "GET",
    `/admin/tenants/${tenant!.id}/host`,
    ownerCookie,
  );
  const historyBody = JSON.stringify(await history401.json());
  assert.equal(historyBody.includes(rawEvidence), false);
  assert.match(historyBody, /provider_unauthorized/);
  assert.match(historyBody, /401/);
  assert.equal(historyBody.includes(ownerToken), false, "owner token is never exposed");

  _setLifecycleDeliveryOverride(async () => ({
    ok: true,
    providerMessageId: "provider-message-safe-123",
  }));
  const success = await request(
    base,
    "POST",
    `/admin/tenants/${tenant!.id}/host/send-invite`,
    ownerCookie,
    { template: "welcome" },
  );
  assert.equal(success.status, 200);
  const latestHistory = await request(
    base,
    "GET",
    `/admin/tenants/${tenant!.id}/host`,
    ownerCookie,
  );
  const latestBody = await latestHistory.json() as {
    account: {
      inviteHistory: Array<{
        deliveryStatus: string;
        providerMessageId: string | null;
        deliveryFailure: unknown;
      }>;
    };
  };
  assert.equal(latestBody.account.inviteHistory[0]?.deliveryStatus, "accepted");
  assert.equal(
    latestBody.account.inviteHistory[0]?.providerMessageId,
    "provider-message-safe-123",
  );
  assert.equal(latestBody.account.inviteHistory[0]?.deliveryFailure, null);

  const anonymous = await request(
    base,
    "GET",
    `/admin/tenants/${tenant!.id}/host`,
    null,
  );
  assert.equal(anonymous.status, 401, "delivery history remains owner-only");
});