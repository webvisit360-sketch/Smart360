import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import { eq, inArray, sql } from "drizzle-orm";
import { CreateAdminPlaceResponse, SearchAdminPlacesResponse } from "@workspace/api-zod";
import {
  db, runWithHostDbContext, tenantsTable, sectionsTable, categoriesTable, itemsTable,
  hostUsersTable, hostMembershipsTable, hostSessionsTable, hostAuthEventsTable,
  creatorCanonicalPlacesTable, creatorRunsTable, creatorPlaceProposalsTable,
  itemDistanceProposalsTable, changelogTable,
} from "@workspace/db";
import app from "../app";
import { setHostPlaceDependenciesForTests } from "../lib/adminPlaceCreation";

test("real HOST HTTP place search/create uses shared identity without Creator privileges", async t => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const stamp = randomUUID();
  const tenants = await db.insert(tenantsTable).values(["a", "b"].map(key => ({
    slug: `host-place-${key}-${stamp}`, name: `Host place ${key}`,
    managementMode: "self_service", latitude: 46.3, longitude: 14.8,
    operatorDraftPending: false,
  }))).returning();
  const a = tenants[0]!, b = tenants[1]!;
  const sections = await db.insert(sectionsTable).values(tenants.map(tenant => ({
    tenantId: tenant.id, key: "explore", title: "Okolica",
  }))).returning();
  const categories = await db.insert(categoriesTable).values(sections.map(section => ({
    sectionId: section.id, label: "Izleti",
  }))).returning();
  const ca = categories.find(c => c.sectionId === sections.find(s => s.tenantId === a.id)!.id)!;
  const cb = categories.find(c => c.sectionId === sections.find(s => s.tenantId === b.id)!.id)!;
  const [host] = await db.insert(hostUsersTable).values({ email: `host-place-${stamp}@example.test` }).returning();
  await db.insert(hostMembershipsTable).values({ hostUserId: host!.id, tenantId: a.id });
  const token = randomUUID();
  await db.insert(hostSessionsTable).values({
    hostUserId: host!.id, tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 60_000),
  });
  // Fixtures only replace external providers. HTTP authorization, scoped
  // connections, shared canonical locks, storage and attribution are real.
  let providerCalls = 0;
  setHostPlaceDependenciesForTests({
    search: async () => {
      providerCalls++;
      return [{ osm_type: "way", osm_id: 987654321, name: "Selected fixture place",
        display_name: "Selected fixture location", lat: "46.31", lon: "14.81" }];
    },
    route: async () => ({ distanceMeters: 3200, durationMinutes: 8 }),
  });
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  t.after(async () => {
    setHostPlaceDependenciesForTests(null);
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.delete(hostAuthEventsTable).where(eq(hostAuthEventsTable.hostUserId, host!.id));
    await db.delete(hostUsersTable).where(eq(hostUsersTable.id, host!.id));
    await db.delete(tenantsTable).where(inArray(tenantsTable.id, tenants.map(row => row.id)));
  });
  const request = (method: string, path: string, body?: unknown) =>
    fetch(`http://127.0.0.1:${address.port}/api${path}`, {
      method, headers: { "content-type": "application/json", cookie: `__Host-s360_host=${token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const manual = { mode: "manual", name: "Manual fixture place",
    locationText: "Explicitly selected map pin", latitude: 46.32, longitude: 14.82 };
  for (const mode of ["self_service", "concierge"] as const) {
    await db.update(tenantsTable).set({ managementMode: mode }).where(eq(tenantsTable.id, a.id));
    for (const [method, path, body] of [
      ["GET", `/admin/categories/${cb.id}/place-search?q=fixture`],
      ["POST", `/admin/categories/${cb.id}/places`, manual],
    ] as const) {
      assert.equal((await request(method, path, body)).status, 404);
    }
    if (mode === "concierge") {
      assert.equal((await request("GET", `/admin/categories/${ca.id}/place-search?q=fixture`)).status, 403);
      assert.equal((await request("POST", `/admin/categories/${ca.id}/places`, manual)).status, 403);
    }
  }
  assert.equal(providerCalls, 0, "denials happen before providers or privileged work");
  await db.update(tenantsTable).set({ managementMode: "self_service", operatorDraftPending: false })
    .where(eq(tenantsTable.id, a.id));
  await runWithHostDbContext(a.id, async () => {
    const result = await db.execute<{ allowed: boolean }>(
      sql`SELECT has_table_privilege(current_user, 'creator_canonical_places', 'INSERT') AS allowed`);
    assert.equal(result.rows[0]!.allowed, false, "canonical ledger remains ungranted to hosts");
  });
  const found = await request("GET", `/admin/categories/${ca.id}/place-search?q=fixture`);
  assert.equal(found.status, 200, await found.clone().text());
  assert.equal(SearchAdminPlacesResponse.parse(await found.json()).candidates[0]!.osmId, 987654321);
  const created = await request("POST", `/admin/categories/${ca.id}/places`, manual);
  assert.equal(created.status, 201, await created.clone().text());
  const item = CreateAdminPlaceResponse.parse(await created.json());
  assert.equal(item.title, manual.name);
  assert.equal(item.categoryId, ca.id);
  assert.equal(item.distanceMeters, 3200);
  const repeated = await request("POST", `/admin/categories/${ca.id}/places`, manual);
  assert.equal(repeated.status, 409, await repeated.clone().text());
  assert.equal((await repeated.json() as { duplicateMatch: { id: string } }).duplicateMatch.id, item.id);
  const selected = await request("POST", `/admin/categories/${ca.id}/places`,
    { mode: "nominatim", osmType: "way", osmId: 987654321 });
  assert.equal(selected.status, 201, await selected.clone().text());
  const selectedItem = CreateAdminPlaceResponse.parse(await selected.json());
  const ledger = await db.select().from(creatorCanonicalPlacesTable)
    .where(eq(creatorCanonicalPlacesTable.tenantId, a.id));
  assert.equal(ledger.length, 2);
  assert.ok(ledger.some(row => row.entityKey === "osm:way:987654321" && row.itemId === selectedItem.id));
  const distance = await db.select().from(itemDistanceProposalsTable)
    .where(eq(itemDistanceProposalsTable.itemId, item.id));
  assert.equal(distance[0]!.status, "approved");
  assert.equal(distance[0]!.tenantId, a.id);
  assert.equal(distance[0]!.latitude, manual.latitude);
  assert.equal((await db.select().from(creatorRunsTable)
    .where(eq(creatorRunsTable.tenantId, a.id))).length, 0);
  assert.equal((await db.select().from(creatorPlaceProposalsTable)
    .where(eq(creatorPlaceProposalsTable.tenantId, a.id))).length, 0);
  const [fresh] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, a.id));
  assert.equal(fresh!.operatorDraftPending, false, "privileged write retains host attribution");
  assert.equal(fresh!.hasUnpublishedChanges, true);
  const history = await db.select().from(changelogTable).where(eq(changelogTable.tenantId, a.id));
  assert.equal(history.filter(row => row.actorType === "host" && row.entity === "item").length, 2);
  assert.equal((await db.select().from(itemsTable).where(eq(itemsTable.categoryId, cb.id))).length, 0);
  assert.equal((await request("POST", `/admin/tenants/${a.id}/creator/runs`, {})).status, 404);
  // Reverse switch applies to this same persisted session immediately.
  await db.update(tenantsTable).set({ managementMode: "concierge" }).where(eq(tenantsTable.id, a.id));
  assert.equal((await request("POST", `/admin/categories/${ca.id}/places`, manual)).status, 403);
});