import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import {
  db, pool, runWithHostDbContext, tenantsTable, sectionsTable, categoriesTable,
  itemsTable, hostUsersTable, hostMembershipsTable, hostSessionsTable,
  hostAuthEventsTable, tenantAliasesTable, tenantSlugReservationsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import adminTenantsRouter from "../routes/adminTenants";
import { createAdminGateForTests } from "../lib/actorGate";
import { hashPassword } from "../lib/hostAuth";
import { ensureTenantPublication, readPublishedContent } from "../lib/publishedSnapshots";

// Uses the current PostgreSQL catalog as-is: no schema ensure, grants,
// migrations, existing operator accounts, or operator credentials.
test("two-mode HTTP host flow: weekly event, offer, announcement, reviewed publication and isolation", async (t) => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const stamp = randomUUID();
  const [a, b] = await db.insert(tenantsTable).values([
    { slug: `mode-a-${stamp}`, name: "Mode A", managementMode: "self_service",
      guestUiMode: "living-guide", isPublished: true, firstPublishedAt: new Date() },
    { slug: `mode-b-${stamp}`, name: "Mode B", managementMode: "concierge",
      guestUiMode: "living-guide", isPublished: true, firstPublishedAt: new Date() },
  ]).returning();
  const password = `Fixture-password-${stamp}`;
  const [host] = await db.insert(hostUsersTable).values({
    email: `mode-${stamp}@example.test`, passwordHash: await hashPassword(password),
  }).returning();
  await db.insert(hostMembershipsTable).values({ hostUserId: host!.id, tenantId: a!.id });
  await ensureTenantPublication(a!.id);
  await ensureTenantPublication(b!.id);
  const [foreignSection] = await db.insert(sectionsTable).values({
    tenantId: b!.id, key: "stay", title: "Foreign section",
  }).returning();
  const [foreignCategory] = await db.insert(categoriesTable).values({
    sectionId: foreignSection!.id, label: "Foreign category",
  }).returning();
  const [foreignItem] = await db.insert(itemsTable).values({
    categoryId: foreignCategory!.id, title: "Foreign item",
  }).returning();
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api`;
  const operatorApp = express();
  operatorApp.use(express.json(), createAdminGateForTests({ kind: "owner" }), adminTenantsRouter);
  const operator = operatorApp.listen(0);
  await once(operator, "listening");
  const operatorAddress = operator.address();
  assert.ok(operatorAddress && typeof operatorAddress === "object");
  const ownerBase = `http://127.0.0.1:${operatorAddress.port}`;
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await new Promise<void>(resolve => operator.close(() => resolve()));
    await db.delete(hostAuthEventsTable).where(eq(hostAuthEventsTable.hostUserId, host!.id));
    await db.delete(hostUsersTable).where(eq(hostUsersTable.id, host!.id));
    await db.delete(tenantsTable).where(inArray(tenantsTable.id, [a!.id, b!.id]));
  });
  let cookie = "";
  const request = async (method: string, path: string, body?: unknown, hostCookie = cookie) =>
    fetch(`${base}${path}`, {
      method, headers: { "content-type": "application/json", ...(hostCookie ? { cookie: hostCookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const ok = async (method: string, path: string, body?: unknown, status = 200) => {
    const response = await request(method, path, body);
    const text = await response.text();
    assert.equal(response.status, status, `${method} ${path}: ${text}`);
    return text ? JSON.parse(text) : null;
  };
  const login = await request("POST", "/admin/host/login", { email: host!.email, password }, "");
  assert.equal(login.status, 200, await login.clone().text());
  cookie = login.headers.get("set-cookie")!.split(";")[0]!;
  const session = await ok("GET", "/admin/host/session");
  assert.equal(session.managementMode, "self_service");
  assert.equal(session.authenticated, true);
  const path = `/admin/tenants/${a!.id}`;
  const changeMode = async (managementMode: "self_service" | "concierge") => {
    const response = await fetch(`${ownerBase}${path}/management-mode`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ managementMode }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal((await ok("GET", "/admin/host/session")).managementMode, managementMode);
  };
  // RLS is independently effective, even without the actor/path fence.
  await runWithHostDbContext(a!.id, async () => {
    const role = await db.execute<{ current_user: string }>("SELECT current_user");
    assert.equal(role.rows[0]?.current_user, "smart360_host");
    assert.equal((await db.select().from(itemsTable).where(eq(itemsTable.id, foreignItem!.id))).length, 0);
    const changed = await db.update(tenantsTable).set({ name: "forbidden" })
      .where(eq(tenantsTable.id, b!.id)).returning();
    assert.equal(changed.length, 0);
  });
  for (const mode of ["self_service", "concierge"] as const) {
    await changeMode(mode);
    for (const [method, route, body] of [
      ["GET", `/admin/tenants/${b!.id}`],
      ["PATCH", `/admin/tenants/${b!.id}`, { name: "forbidden" }],
      ["POST", `/admin/tenants/${b!.id}/sections`, { key: "x", title: "x", icon: "x" }],
      ["PATCH", `/admin/sections/${foreignSection!.id}`, { title: "forbidden" }],
      ["PATCH", `/admin/categories/${foreignCategory!.id}`, { label: "forbidden" }],
      ["PATCH", `/admin/items/${foreignItem!.id}`, { title: "forbidden" }],
      ["POST", `/admin/categories/${foreignCategory!.id}/items`, { title: "forbidden" }],
      ["POST", "/admin/sections/reorder", { ids: [foreignSection!.id] }],
      ["POST", `/admin/tenants/${b!.id}/announcements`, { titleSl: "x", bodySl: "y" }],
    ] as const) {
      assert.equal((await request(method, route, body)).status, 404, `${mode}: ${method} ${route}`);
    }
    for (const fields of [
      { slug: "forbidden" }, { draftSlug: "forbidden" }, { isPublished: false },
      { isTemplate: true }, { mediaQuotaBytes: 123 }, { renewsAt: "2030-01-01" },
      { rating: "5" }, { reviewsCount: "100" }, { managementMode: "self_service" },
      { coordinateOverride: true }, { operatorDraftPending: false }, { unknownPrivilege: true },
    ]) {
      assert.equal((await request("PATCH", path, { wifiSsid: "MUST-NOT-SAVE", ...fields })).status, 403);
      const [fresh] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, a!.id));
      assert.notEqual(fresh!.wifiSsid, "MUST-NOT-SAVE", "mixed PATCH is atomic");
    }
    assert.equal((await request("PATCH", `${path}/management-mode`, { managementMode: "self_service" })).status, 403);
    for (const [method, route] of [
      ["POST", "/admin/tenants"], ["DELETE", path], ["POST", `${path}/creator/runs`],
    ]) assert.equal((await request(method!, route!, {})).status, 404);
  }
  assert.equal((await request("PATCH", path, { isPublished: true, publishNow: true })).status, 403);
  assert.equal((await request("PATCH", path, { name: "Concierge forbidden", wifiSsid: "no" })).status, 403);
  assert.equal((await request("POST", `${path}/sections`, { key: "x", title: "x", icon: "x" })).status, 403);
  await ok("PATCH", path, { wifiSsid: "Concierge allowed", phone: "+38640123456" });
  const conciergeLogin = await request("POST", "/admin/host/login", { email: host!.email, password }, "");
  assert.equal(conciergeLogin.status, 200, "concierge remains able to sign in");
  await changeMode("self_service");
  await ok("PATCH", path, {
    name: "Independent host", address: "Test address", mapQuery: "Test location",
    latitude: 46.1, longitude: 14.5, theme: "swipe", guestUiMode: "living-guide",
    tourRecordingEnabled: true, coverTitle: "Test cover", languages: ["sl", "en"],
    livingGuideNav: ["home", "stay", "offer", "explore", "program"],
  });
  const events = await ok("POST", `${path}/sections`,
    { key: "program", title: "Dogodki", icon: "calendar" }, 201);
  const eventCategory = await ok("POST", `/admin/sections/${events.id}/categories`,
    { label: "Tedenski dogodki", icon: "calendar", layout: "events", exploreGroup: "experiences" }, 201);
  const schedule = { type: "weekly", days: ["mon", "fri"], timeFrom: "18:00", timeTo: "19:30" };
  const event = await ok("POST", `/admin/categories/${eventCategory.id}/items`,
    { title: "Weekly host event", eventSchedule: schedule }, 201);
  assert.deepEqual(event.eventSchedule, schedule);
  const offer = await ok("POST", `${path}/sections`, { key: "offer", title: "Ponudba", icon: "tag" }, 201);
  const offerCategory = await ok("POST", `/admin/sections/${offer.id}/categories`,
    { label: "Cene", icon: "tag", layout: "list", exploreGroup: "experiences" }, 201);
  const offerItem = await ok("POST", `/admin/categories/${offerCategory.id}/items`,
    { title: "Host offer", price: "12.00" }, 201);
  await ok("PATCH", `/admin/items/${offerItem.id}`, { price: "15.00", body: "Updated host offer" });
  await ok("POST", "/admin/sections/reorder", { ids: [offer.id, events.id] });
  await ok("PATCH", `/admin/categories/${eventCategory.id}`, { label: "Tedenski Termin" });
  await ok("PUT", "/admin/translations", {
    model: "item", recordId: event.id, field: "title", lang: "en", value: "Weekly translated event",
  });
  const notice = await ok("POST", `${path}/announcements`, { titleSl: "Host notice", bodySl: "Important notice" }, 201);
  await ok("PATCH", `${path}/announcements/${notice.announcement.id}`, { bodySl: "Updated notice" });
  const beforeGuest = await request("GET", `/public/tenants/${a!.slug}`, undefined, "");
  assert.equal(beforeGuest.status, 200, await beforeGuest.clone().text());
  assert.doesNotMatch(await beforeGuest.text(), /Weekly host event|Updated host offer/);
  // Operator's pending content is included; their pending rename is NOT.
  await db.update(tenantsTable).set({
    draftSlug: `pending-${stamp}`, operatorDraftPending: true, hasUnpublishedChanges: true,
  }).where(eq(tenantsTable.id, a!.id));
  const reservationBefore = await db.select().from(tenantSlugReservationsTable)
    .where(eq(tenantSlugReservationsTable.tenantId, a!.id));
  const aliasesBefore = await db.select().from(tenantAliasesTable).where(eq(tenantAliasesTable.tenantId, a!.id));
  const preview = await ok("GET", `${path}/publish-preview`);
  assert.ok(preview.total > 0);
  assert.doesNotMatch(JSON.stringify(preview), /za vedno preusmerjen|pending-/);
  await ok("PATCH", `/admin/items/${event.id}`, { title: "Weekly host event final" });
  const snapshotBefore = await readPublishedContent(a!.id);
  assert.equal((await request("PATCH", path, {
    isPublished: true, publishNow: true, publishToken: preview.token,
  })).status, 409, "stale reviewed publication rejects atomically");
  assert.deepEqual(await readPublishedContent(a!.id), snapshotBefore);
  const current = await ok("GET", `${path}/publish-preview`);
  await ok("PATCH", path, { isPublished: true, publishNow: true, publishToken: current.token });
  const [published] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, a!.id));
  assert.equal(published!.operatorDraftPending, false);
  assert.equal(published!.slug, a!.slug);
  assert.equal(published!.draftSlug, `pending-${stamp}`);
  assert.equal(published!.hasUnpublishedChanges, true, "rename remains an unpublished operator draft");
  assert.deepEqual(await db.select().from(tenantSlugReservationsTable)
    .where(eq(tenantSlugReservationsTable.tenantId, a!.id)), reservationBefore);
  assert.deepEqual(await db.select().from(tenantAliasesTable)
    .where(eq(tenantAliasesTable.tenantId, a!.id)), aliasesBefore);
  const guest = await request("GET", `/public/tenants/${a!.slug}`, undefined, "");
  assert.equal(guest.status, 200, await guest.clone().text());
  const guestBody = await guest.json() as { sections: Array<{ categories: Array<{ items: Array<{ id: string; eventSchedule: unknown; price: string }> }> }> };
  const guestItems = guestBody.sections.flatMap(s => s.categories.flatMap(c => c.items));
  assert.deepEqual(guestItems.find(i => i.id === event.id)?.eventSchedule, schedule);
  assert.equal(guestItems.find(i => i.id === offerItem.id)?.price, "15.00");
  const guestNotice = await request("GET", `/guest/${a!.slug}/announcements`, undefined, "");
  assert.match(await guestNotice.text(), /Updated notice/);
  const history = await ok("GET", `${path}/changelog`);
  assert.match(JSON.stringify(history), /Stranka/);
  assert.match(JSON.stringify(history), /republish/);
  assert.equal((await request("DELETE", `/admin/sections/${events.id}`)).status, 403);
  assert.equal((await request("DELETE", `/admin/items/${event.id}/purge`)).status, 404);
  await ok("DELETE", `/admin/items/${event.id}`, undefined, 204);
  await ok("POST", `/admin/items/${event.id}/restore`);
  await ok("POST", `/admin/sections/${events.id}/trash`);
  await ok("POST", `/admin/sections/${events.id}/restore`);
  await changeMode("concierge");
  assert.equal((await request("PATCH", path, { isPublished: true, publishNow: true })).status, 403);
  assert.equal((await request("PATCH", `/admin/sections/${events.id}`, { title: "no" })).status, 403);
  await changeMode("self_service");
  await ok("PATCH", `/admin/sections/${events.id}`, { title: "Enabled immediately" });
  // Real session revocation still works independently of management mode.
  await db.delete(hostSessionsTable).where(eq(hostSessionsTable.hostUserId, host!.id));
  assert.equal((await request("GET", path)).status, 401);
  assert.equal((await ok("GET", "/admin/host/session")).authenticated, false);
  assert.equal((await pool.query("SELECT name FROM tenants WHERE id = $1", [b!.id])).rows[0].name, "Mode B");
});