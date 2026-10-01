import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import { UpdateTenantBody } from "@workspace/api-zod";
import {
  db, tenantsTable, sectionsTable, categoriesTable, itemsTable, mediaTable,
  hostUsersTable, hostMembershipsTable, hostAuthEventsTable,
} from "@workspace/db";
import {
  ADMIN_ROUTE_REGISTRY, createAdminGateForTests,
  HOST_PUBLISH_DENIAL, HOST_TENANT_WRITABLE_FIELDS, SELF_SERVICE_TENANT_WRITABLE_FIELDS,
} from "../lib/actorGate";
import type { Actor } from "../lib/actorContext";

// A trusted in-process actor is injected server-side. HTTP input cannot
// impersonate an owner. The 209 sentinel proves the route reached its handler.
async function start(actor: Actor) {
  const app = express();
  app.use(express.json());
  app.use(createAdminGateForTests(actor));
  app.use((_req, res) => res.status(209).json({ reached: true }));
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function send(url: string, method: string, path: string, body?: unknown) {
  return fetch(`${url}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("phase2: central route and field policy, own/foreign binding and onboarding exception", async (t) => {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const [tenant] = await db.insert(tenantsTable)
    .values({ slug: `phase2-${stamp}`, name: "Phase2", managementMode: "concierge" }).returning({ id: tenantsTable.id });
  const [foreign] = await db.insert(tenantsTable)
    .values({ slug: `phase2-foreign-${stamp}`, name: "Foreign" }).returning({ id: tenantsTable.id });
  const [host] = await db.insert(hostUsersTable)
    .values({ email: `phase2-${stamp}@example.com`, passwordHash: "unused-test-account" })
    .returning({ id: hostUsersTable.id });
  await db.insert(hostMembershipsTable).values({ hostUserId: host!.id, tenantId: tenant!.id });
  const [section] = await db.insert(sectionsTable)
    .values({ tenantId: tenant!.id, key: "phase2", title: "Section" })
    .returning({ id: sectionsTable.id });
  const [otherSection] = await db.insert(sectionsTable)
    .values({ tenantId: foreign!.id, key: "phase2", title: "Foreign" })
    .returning({ id: sectionsTable.id });
  const [category] = await db.insert(categoriesTable)
    .values({ sectionId: section!.id, label: "Category", position: 0 })
    .returning({ id: categoriesTable.id });
  const [otherCategory] = await db.insert(categoriesTable)
    .values({ sectionId: otherSection!.id, label: "Foreign", position: 0 })
    .returning({ id: categoriesTable.id });
  const [item] = await db.insert(itemsTable).values({
    categoryId: category!.id, title: "Entry",
  }).returning({ id: itemsTable.id });
  const [itemMedia] = await db.insert(mediaTable).values({
    itemId: item!.id, url: "/phase2-entry.jpg", position: 0,
  }).returning({ id: mediaTable.id });
  const [plan] = await db.insert(mediaTable)
    .values({ tenantId: tenant!.id, url: "/phase2-test.jpg", position: 0 })
    .returning({ id: mediaTable.id });
  const hostServer = await start({
    kind: "host", hostUserId: host!.id, tenantId: tenant!.id, requestIp: "127.0.0.1",
  });
  const ownerServer = await start({ kind: "owner", requestIp: "127.0.0.1" });
  t.after(async () => {
    await hostServer.close();
    await ownerServer.close();
    await db.delete(hostAuthEventsTable).where(eq(hostAuthEventsTable.hostUserId, host!.id));
    await db.delete(mediaTable).where(eq(mediaTable.id, plan!.id));
    await db.delete(hostUsersTable).where(eq(hostUsersTable.id, host!.id));
    await db.delete(tenantsTable).where(inArray(tenantsTable.id, [tenant!.id, foreign!.id]));
  });

  const tid = tenant!.id, sid = section!.id, cid = category!.id;
  const restricted: Array<[string, string, unknown?]> = [
    ["POST", `/admin/tenants/${tid}/sections`, { title: "X" }],
    ["POST", `/admin/sections/${sid}/categories`, { label: "X" }],
    ["PATCH", `/admin/sections/${sid}`, { title: "X", groupOrder: ["x"] }],
    ["DELETE", `/admin/sections/${sid}`],
    ["POST", `/admin/sections/${sid}/trash`],
    ["POST", `/admin/sections/${sid}/restore`],
    ["POST", "/admin/sections/reorder", { ids: [sid] }],
    ["PATCH", `/admin/categories/${cid}`, { label: "X", layout: "grid", icon: "x", isVisible: false }],
    ["DELETE", `/admin/categories/${cid}`],
    ["POST", `/admin/categories/${cid}/restore`],
    ["POST", "/admin/categories/reorder", { ids: [cid] }],
    ["POST", `/admin/tenants/${tid}/hero/upload`],
    ["POST", `/admin/tenants/${tid}/living-guide-hero/upload`],
    ["POST", `/admin/tenants/${tid}/logo/upload`],
    ["POST", `/admin/tenants/${tid}/site-plan-images/upload`],
    ["POST", `/admin/tenants/${tid}/site-plan-images/reorder`, { ids: [plan!.id] }],
    ["PATCH", `/admin/site-plan-images/${plan!.id}`, { position: 1 }],
    ["DELETE", `/admin/site-plan-images/${plan!.id}`],
    ["PATCH", `/admin/media/${plan!.id}`, { position: 1 }],
    ["DELETE", `/admin/media/${plan!.id}`],
    ["POST", "/admin/media/reorder", { ids: [plan!.id] }],
  ];
  for (const [method, path, body] of restricted) {
    assert.equal((await send(hostServer.url, method, path, body)).status, 403, `host ${method} ${path}`);
    assert.equal((await send(ownerServer.url, method, path, body)).status, 209, `owner ${method} ${path}`);
  }
  for (const [method, path] of [
    ["POST", `/admin/tenants/${foreign!.id}/sections`],
    ["POST", `/admin/sections/${otherSection!.id}/trash`],
    ["PATCH", `/admin/categories/${otherCategory!.id}`],
  ]) {
    assert.equal((await send(hostServer.url, method!, path!)).status, 404);
  }
  assert.equal((await send(hostServer.url, "POST", "/admin/sections/reorder",
    { ids: [otherSection!.id] })).status, 404);
  assert.equal((await send(hostServer.url, "POST", "/admin/categories/reorder",
    { ids: [otherCategory!.id] })).status, 404);

  const writable = new Set<string>(HOST_TENANT_WRITABLE_FIELDS);
  const schemaKeys = Object.keys(UpdateTenantBody.shape);
  const path = `/admin/tenants/${tid}`;
  for (const field of [...schemaKeys, "operatorDraftPending", "futureSensitiveField"]) {
    const body = { [field]: field === "isPublished" ? false : null };
    const response = await send(hostServer.url, "PATCH", path, body);
    assert.equal(response.status, writable.has(field) ? 209 : 403, `field ${field}`);
    assert.equal((await send(ownerServer.url, "PATCH", path, body)).status, 209, `owner field ${field}`);
  }
  for (const value of [true, false, null]) {
    const response = await send(hostServer.url, "PATCH", path, {
      wifiSsid: "kept", isPublished: value,
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json() as { error: string }).error, HOST_PUBLISH_DENIAL);
  }
  for (const [field, value] of [
    ["publishNow", true], ["publishNow", false], ["publishNow", null],
    ["publishToken", "token"], ["publishToken", null],
  ] as const) {
    const response = await send(hostServer.url, "PATCH", path, { [field]: value });
    assert.equal(response.status, 403, `${field} alone must be a publication denial`);
    assert.equal((await response.json() as { error: string }).error, HOST_PUBLISH_DENIAL);
  }
  assert.equal((await send(hostServer.url, "PATCH", `/admin/tenants/${foreign!.id}`,
    { isPublished: true })).status, 404);

  const allowed: Array<[string, string, unknown?]> = [
    ["POST", `/admin/categories/${cid}/items`, { title: "Entry" }],
    ["PATCH", `/admin/items/${item!.id}`, { title: "Edit", categoryId: cid,
      tint: "blue", frame: "none", mapUrl: "https://maps.example/entry" }],
    ["DELETE", `/admin/items/${item!.id}`],
    ["POST", `/admin/items/${item!.id}/restore`],
    ["POST", `/admin/items/${item!.id}/duplicate`],
    ["POST", `/admin/items/${item!.id}/gpx`],
    ["DELETE", `/admin/items/${item!.id}/gpx`],
    ["POST", `/admin/items/${item!.id}/distance/recompute`],
    ["POST", `/admin/items/${item!.id}/translate-missing`],
    ["POST", `/admin/items/${item!.id}/media`, { url: "/test-video.mp4" }],
    ["POST", `/admin/items/${item!.id}/media/upload`],
    ["PATCH", `/admin/media/${itemMedia!.id}`, { focusX: 50, focusY: 50 }],
    ["DELETE", `/admin/media/${itemMedia!.id}`],
    ["POST", "/admin/media/reorder", { ids: [itemMedia!.id] }],
    ["POST", "/admin/items/reorder", { ids: [] }],
    ["GET", `/admin/tenants/${tid}/orders`],
    ["GET", `/admin/tenants/${tid}/messages`],
    ["POST", `/admin/tenants/${tid}/messages/thread`, { message: "Hello" }],
    ["GET", `/admin/tenants/${tid}/distance-review`],
    ["POST", `/admin/tenants/${tid}/distance-review`, {}],
    ["GET", `/admin/tenants/${tid}/translations`],
    ["PUT", "/admin/translations", {}],
    ["PATCH", path, { wifiSsid: "ssid", wifiPass: "pass", wifiEnc: "WPA2",
      phone: "+386", email: "host@example.com", whatsapp: "+386",
      viber: "+386", instagram: "handle", orderNotifyEmail: true,
      messageNotifyEmail: true, notificationChannel: "email",
      notificationWhatsappPhone: "+38640123456", orderPassword: "secret" }],
    // Separate reviewed host-self onboarding paths intentionally bypass this policy.
    ["PATCH", "/admin/host/onboarding", { name: "Allowed" }],
    ["POST", "/admin/host/onboarding/save", { sections: [] }],
    ["POST", "/admin/host/onboarding/categories", { name: "Custom" }],
    ["POST", "/admin/host/onboarding/submit", {}],
  ];
  for (const [method, route, body] of allowed) {
    assert.equal((await send(hostServer.url, method, route, body)).status, 209, `kept ${method} ${route}`);
  }
  assert.equal((await send(ownerServer.url, "POST", "/admin/host/onboarding/submit")).status, 404);
  assert.equal(ADMIN_ROUTE_REGISTRY.find((r) => r.path === "/admin/sections/:id/trash")?.binding.kind,
    "operator-entity");
  const events = await db.select({ detail: hostAuthEventsTable.detail }).from(hostAuthEventsTable)
    .where(eq(hostAuthEventsTable.hostUserId, host!.id));
  assert.ok(events.some((row) => row.detail?.includes("operator_publication")));
  assert.ok(events.every((row) => !row.detail?.includes("secret") && !row.detail?.includes("ssid")));

  await db.update(tenantsTable).set({ managementMode: "self_service" })
    .where(eq(tenantsTable.id, tid));
  const selfServiceFields = new Set<string>(SELF_SERVICE_TENANT_WRITABLE_FIELDS);
  for (const field of [...schemaKeys, "draftSlug", "managementMode", "operatorDraftPending", "futureSensitiveField"]) {
    const response = await send(hostServer.url, "PATCH", path, { [field]: field === "isPublished" ? true : null });
    assert.equal(response.status, selfServiceFields.has(field) ? 209 : 403, `self-service field ${field}`);
  }
  for (const [method, route, body] of restricted) {
    const hardDelete = method === "DELETE" && route === `/admin/sections/${sid}`;
    assert.equal((await send(hostServer.url, method, route, body)).status, hardDelete ? 403 : 209,
      `self-service ${method} ${route}`);
  }
});