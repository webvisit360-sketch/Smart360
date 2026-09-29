import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db, tenantsTable, sectionsTable, hostUsersTable, hostMembershipsTable,
  hostAuthEventsTable, changelogTable,
} from "@workspace/db";
import tenantRouter from "../routes/adminTenants";
import contentRouter from "../routes/adminContent";
import { ADMIN_ROUTE_REGISTRY, createAdminGateForTests } from "../lib/actorGate";
import type { Actor } from "../lib/actorContext";

// The actor is pinned by this in-process harness, not supplied by HTTP input.
// No owner account, passkey or production auth override is created.
async function start(actor: Actor) {
  const app = express();
  app.use(express.json());
  app.use(createAdminGateForTests(actor));
  app.use(tenantRouter);
  app.use(contentRouter);
  const server = app.listen(0);
  await once(server, "listening");
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  return {
    base: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function send(base: string, method: string, path: string, body?: unknown) {
  return fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("phase1: field presence denies host atomically; owner reaches the real tenant handler", async (t) => {
  const stamp = Date.now().toString(36);
  const [tenant] = await db.insert(tenantsTable)
    .values({ slug: `gate-phase1-${stamp}`, name: "Before" })
    .returning({ id: tenantsTable.id });
  const [foreign] = await db.insert(tenantsTable)
    .values({ slug: `gate-phase1-other-${stamp}`, name: "Other" })
    .returning({ id: tenantsTable.id });
  const [host] = await db.insert(hostUsersTable)
    .values({ email: `gate-phase1-${stamp}@example.com`, passwordHash: "unused-test-account" })
    .returning({ id: hostUsersTable.id });
  await db.insert(hostMembershipsTable).values({ hostUserId: host!.id, tenantId: tenant!.id });
  const [section] = await db.insert(sectionsTable)
    .values({ tenantId: tenant!.id, key: "phase1", title: "Still here" })
    .returning({ id: sectionsTable.id });
  const [foreignSection] = await db.insert(sectionsTable)
    .values({ tenantId: foreign!.id, key: "phase1", title: "Other" })
    .returning({ id: sectionsTable.id });
  const hostServer = await start({
    kind: "host", tenantId: tenant!.id, hostUserId: host!.id, requestIp: "127.0.0.1",
  });
  const ownerServer = await start({ kind: "owner", requestIp: "127.0.0.1" });
  t.after(async () => {
    await hostServer.close();
    await ownerServer.close();
    await db.delete(hostAuthEventsTable).where(eq(hostAuthEventsTable.hostUserId, host!.id));
    await db.delete(changelogTable).where(inArray(changelogTable.tenantId, [tenant!.id, foreign!.id]));
    await db.delete(hostUsersTable).where(eq(hostUsersTable.id, host!.id));
    await db.delete(tenantsTable).where(inArray(tenantsTable.id, [tenant!.id, foreign!.id]));
  });

  const path = `/admin/tenants/${tenant!.id}`;
  const restricted: Array<[string, unknown]> = [
    ["isTemplate", true], ["isTemplate", false],
    ["mediaQuotaBytes", 8_000_000_000], ["mediaQuotaBytes", null],
    ["renewsAt", "2030-06-01T00:00:00.000Z"], ["renewsAt", null],
    ["coordinateOverride", true], ["coordinateOverride", false],
    ["rating", "5.0"], ["rating", null],
    ["reviewsCount", "777"], ["reviewsCount", null],
  ];
  for (const [field, value] of restricted) {
    const res = await send(hostServer.base, "PATCH", path, { name: `HACK-${field}`, [field]: value });
    assert.equal(res.status, 403, `${field}=${String(value)} must deny before the handler`);
    const [saved] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
    assert.equal(saved!.name, "Before", `${field} cannot partially update an allowed field`);
  }

  const mixed = await send(hostServer.base, "PATCH", path,
    { name: "HACK-MIX", rating: null, coordinateOverride: false, renewsAt: null });
  assert.equal(mixed.status, 403);
  const [unchanged] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
  assert.equal(unchanged!.name, "Before");
  assert.equal(unchanged!.renewsAt, null);
  assert.equal(unchanged!.rating, null);

  // Preserve historical routing-identity response and foreign-tenant opacity.
  for (const field of ["slug", "customDomain"]) {
    assert.equal((await send(hostServer.base, "PATCH", path, { [field]: null })).status, 400);
  }
  assert.equal((await send(hostServer.base, "PATCH", `/admin/tenants/${foreign!.id}`,
    { isTemplate: true })).status, 404);

  const entries = await db.select({ detail: hostAuthEventsTable.detail })
    .from(hostAuthEventsTable).where(eq(hostAuthEventsTable.hostUserId, host!.id));
  const denials = entries.map((e) => e.detail ?? "").filter((s) => s.includes("operator_field"));
  assert.equal(denials.length, restricted.length + 1);
  assert.ok(denials.every((s) => !s.includes("HACK") && !s.includes("2030-06-01") &&
    s.includes('"route":"/admin/tenants/:id"') && s.includes('"tenantId"')));

  // The same real handler accepts a trusted owner actor. No synthetic login.
  const owner = await send(ownerServer.base, "PATCH", path, {
    name: "Owner edit", isTemplate: true, mediaQuotaBytes: 3_000_000_000,
    renewsAt: "2030-06-01T00:00:00.000Z", rating: "4.9", reviewsCount: "9",
  });
  assert.equal(owner.status, 200, await owner.clone().text());
  const [saved] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
  assert.equal(saved!.name, "Owner edit");
  assert.equal(saved!.isTemplate, true);
  assert.equal(saved!.mediaQuotaBytes, 3_000_000_000);
  assert.equal(saved!.rating, "4.9");
  assert.equal(saved!.reviewsCount, "9");

  const ownEdit = await send(hostServer.base, "PATCH", path, { name: "Host allowed edit" });
  assert.equal(ownEdit.status, 200, await ownEdit.clone().text());
  const [hostEdited] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
  assert.equal(hostEdited!.name, "Host allowed edit");

  assert.equal((await send(hostServer.base, "DELETE", `/admin/sections/${section!.id}`)).status, 403);
  assert.equal((await send(hostServer.base, "DELETE", `/admin/sections/${foreignSection!.id}`)).status, 404);
  const [stillThere] = await db.select().from(sectionsTable).where(eq(sectionsTable.id, section!.id));
  assert.ok(stillThere, "operator-only hard cascade did not run for host");
  assert.equal((await send(hostServer.base, "POST", `/admin/sections/${foreignSection!.id}/trash`)).status, 404);
  assert.equal((await send(hostServer.base, "POST", `/admin/sections/${section!.id}/trash`)).status, 200);
  assert.equal((await send(hostServer.base, "POST", `/admin/sections/${section!.id}/restore`)).status, 200);
  assert.equal(ADMIN_ROUTE_REGISTRY.find((r) =>
    r.method === "post" && r.path === "/admin/sections/:id/trash")?.binding.kind, "entity");
  assert.equal(ADMIN_ROUTE_REGISTRY.find((r) =>
    r.method === "post" && r.path === "/admin/sections/:id/restore")?.binding.kind, "entity");
});