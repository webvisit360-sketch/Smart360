/**
 * Phase 2: trusted in-process actors, disposable dev tenants, real handlers and host RLS.
 * No owner credential/session, schema mutation or provider delivery.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import pinoHttp from "pino-http";
import { eq, inArray } from "drizzle-orm";
import {
  db, tenantsTable, sectionsTable, categoriesTable, itemsTable, mediaTable,
  hostUsersTable, hostMembershipsTable, changelogTable, hostAuthEventsTable,
  translationsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { createAdminGateForTests } from "../lib/actorGate";
import type { Actor } from "../lib/actorContext";
import tenantRouter from "../routes/adminTenants";
import contentRouter from "../routes/adminContent";
import onboardingRouter from "../routes/hostOnboarding";
import distanceRouter from "../routes/adminDistanceReview";
import ordersRouter from "../routes/orders";
import messagesRouter from "../routes/messages";
import storageRouter from "../routes/storage";
import { createHostOnboardingDraft, currentHostOnboarding } from "../lib/hostOnboarding";
import { _setHostOnboardingDeliveryOverride } from "../lib/hostOnboardingEmail";
import { seedTenantContent } from "../lib/tenantSeeds";

function serve(actor: Actor) {
  const app = express();
  app.use(pinoHttp({ logger }));
  app.use(express.json());
  app.use(createAdminGateForTests(actor));
  app.use(tenantRouter, contentRouter, onboardingRouter, distanceRouter, ordersRouter, messagesRouter, storageRouter);
  return app;
}

async function listen(actor: Actor) {
  const server = serve(actor).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    base: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function send(base: string, method: string, path: string, body?: unknown) {
  return fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("phase2 permission fence: protected tenant fields are atomic; own operational settings and entries survive", async (t) => {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw new Error("Dev fixtures only");
  const marker = randomUUID();
  const [tenant] = await db.insert(tenantsTable).values({ slug: `phase2-${marker}`, name: "Phase2 original" }).returning();
  const [other] = await db.insert(tenantsTable).values({ slug: `phase2-other-${marker}`, name: "Other" }).returning();
  const [host] = await db.insert(hostUsersTable).values({ email: `phase2-${marker}@example.invalid` }).returning();
  await db.insert(hostMembershipsTable).values({ hostUserId: host.id, tenantId: tenant.id });
  const [section] = await db.insert(sectionsTable).values({ tenantId: tenant.id, key: "stay", title: "Stay" }).returning();
  const [category] = await db.insert(categoriesTable).values({ sectionId: section.id, label: "First" }).returning();
  const [target] = await db.insert(categoriesTable).values({ sectionId: section.id, label: "Second" }).returning();
  const [item] = await db.insert(itemsTable).values({ categoryId: category.id, title: "Original" }).returning();
  const hostServer = await listen({ kind: "host", hostUserId: host.id, tenantId: tenant.id, requestIp: "127.0.0.1" });
  const ownerServer = await listen({ kind: "owner", requestIp: "127.0.0.1" });
  t.after(async () => {
    await hostServer.close();
    await ownerServer.close();
    await db.delete(translationsTable).where(inArray(translationsTable.recordId, [tenant.id, other.id, section.id, category.id, target.id, item.id]));
    await db.delete(hostAuthEventsTable).where(eq(hostAuthEventsTable.hostUserId, host.id));
    await db.delete(changelogTable).where(inArray(changelogTable.tenantId, [tenant.id, other.id]));
    await db.delete(tenantsTable).where(inArray(tenantsTable.id, [tenant.id, other.id]));
    await db.delete(hostUsersTable).where(eq(hostUsersTable.id, host.id));
  });
  const patch = `/admin/tenants/${tenant.id}`;
  // Each newly protected field is tested with a mixed request: no partial change to phone.
  // Owner uses the same route/field and must pass the gate; handler validation is still independent.
  const restricted: Array<[string, unknown]> = [
    ["name", "Operator name"], ["subtitle", "Operator subtitle"],
    ["address", "Operator address"], ["mapQuery", "Ljubljana"], ["mapUrl", "https://maps.google.com/?q=Ljubljana"],
    ["latitude", 46.05], ["longitude", 14.5],
    ["theme", "mediterran"], ["guestUiMode", "living-guide"],
    ["bgColor", "#ffffff"], ["textColor", "#111111"], ["textFont", "Archivo"],
    ["textScale", 1], ["coverTitle", "Operator cover"], ["coverSubtitle", "Operator subtitle"],
    ["logoUrl", "https://example.invalid/logo.png"], ["logoSquareUrl", "https://example.invalid/square.png"],
    ["heroUrl", "https://example.invalid/hero.png"], ["livingGuideHeroUrl", "https://example.invalid/hero2.png"],
    ["tourUrl", "https://example.invalid/tour"], ["languages", ["sl", "en"]],
    ["livingGuideNav", []], ["isPublished", false],
  ];
  for (const [field, value] of restricted) {
    const denied = await send(hostServer.base, "PATCH", patch, { [field]: value, phone: "SHOULD-NOT-PERSIST" });
    assert.equal(denied.status, 403, `host field ${field}: ${await denied.clone().text()}`);
    const [saved] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenant.id));
    assert.notEqual(saved?.phone, "SHOULD-NOT-PERSIST", `${field} must deny atomically`);
    const operator = await send(ownerServer.base, "PATCH", patch, { [field]: value });
    assert.notEqual(operator.status, 403, `operator gate must admit ${field}: ${await operator.clone().text()}`);
  }
  for (const field of ["publishNow", "isPublished"]) {
    const response = await send(hostServer.base, "PATCH", patch, { [field]: true });
    assert.equal(response.status, 403, `${field} may not publish`);
    assert.match((await response.json() as { error: string }).error,
      /Objavo vodnika opravi Smart360 — sporočite nam, ko so spremembe pripravljene\./);
  }
  assert.equal((await send(hostServer.base, "PATCH", `/admin/tenants/${other.id}`, { theme: "x" })).status, 404);
  const ownSettings = await send(hostServer.base, "PATCH", patch, {
    phone: "+38640123456", email: "host@example.invalid", whatsapp: "+38640123456",
    viber: "+38640123456", instagram: "myhost", wifiSsid: "Guest Wifi",
    wifiPass: "guest-secret", wifiEnc: "WPA", orderNotifyEmail: true,
    messageNotifyEmail: true, orderPassword: "private-order-pass",
  });
  assert.equal(ownSettings.status, 200, await ownSettings.clone().text());
  const [settings] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenant.id));
  assert.equal(settings?.wifiSsid, "Guest Wifi");
  assert.equal(settings?.phone, "+38640123456");
  assert.equal(settings?.orderNotifyEmail, true);

  const created = await send(hostServer.base, "POST", `/admin/categories/${category.id}/items`, { title: "Host created", body: "Description" });
  assert.equal(created.status, 201, await created.clone().text());
  const newItem = await created.json() as { id: string };
  assert.equal((await send(hostServer.base, "PATCH", `/admin/items/${newItem.id}`, {
    categoryId: target.id, title: "Moved and edited", website: "https://example.invalid",
  })).status, 200);
  assert.equal((await send(hostServer.base, "POST", `/admin/items/${newItem.id}/duplicate`)).status, 201);
  assert.equal((await send(hostServer.base, "DELETE", `/admin/items/${newItem.id}`)).status, 204);
  assert.equal((await send(hostServer.base, "POST", `/admin/items/${newItem.id}/restore`)).status, 200);
  const [moved] = await db.select().from(itemsTable).where(eq(itemsTable.id, newItem.id));
  assert.equal(moved?.categoryId, target.id);
  assert.equal(moved?.deletedAt, null);
  const addMedia = await send(hostServer.base, "POST", `/admin/items/${newItem.id}/media`,
    { url: "https://example.invalid/image.jpg" });
  assert.equal(addMedia.status, 201, await addMedia.clone().text());
  const media = await addMedia.json() as { id: string };
  const crop = await send(hostServer.base, "PATCH", `/admin/media/${media.id}`, { focusX: 40, focusY: 60 });
  assert.equal(crop.status, 200, await crop.clone().text());
  assert.equal((await send(hostServer.base, "POST", "/admin/media/reorder", { ids: [media.id] })).status, 200);
  assert.equal((await send(hostServer.base, "DELETE", `/admin/media/${media.id}`)).status, 204);
  const translation = await send(hostServer.base, "PUT", "/admin/translations",
    { model: "item", recordId: newItem.id, field: "title", lang: "en", value: "Moved" });
  assert.equal(translation.status, 200, await translation.clone().text());
  // All four drafts already contain text: the actual translate-missing handler executes
  // but computes zero missing fields, so it never calls the paid model.
  const translateMissing = await send(hostServer.base, "POST", `/admin/items/${newItem.id}/translate-missing`, {
    translations: ["sl", "en", "de", "it"].map((language) => ({
      language, title: "Already translated", description: "Already translated",
    })),
  });
  assert.equal(translateMissing.status, 200, await translateMissing.clone().text());
  assert.deepEqual((await translateMissing.json() as { translations: unknown[] }).translations, []);
  assert.equal((await send(hostServer.base, "GET", `/admin/tenants/${tenant.id}/distance-review`)).status, 200);
  assert.equal((await send(hostServer.base, "GET", `/admin/tenants/${tenant.id}/orders`)).status, 200);
  assert.equal((await send(hostServer.base, "GET", `/admin/tenants/${tenant.id}/messages`)).status, 200);
  // Pass-through only: no live object-storage write, distance provider invocation, or
  // guest delivery. An invalid payload reaches handler validation, not the 403 gate.
  for (const [method, path, body] of [
    ["POST", `/admin/items/${newItem.id}/gpx`, {}],
    ["POST", `/admin/items/${newItem.id}/media/upload`, {}],
    ["POST", `/admin/tenants/${tenant.id}/distance-review/rows/${randomUUID()}/approve`, {}],
    ["PATCH", `/admin/orders/${randomUUID()}/status`, { status: "done", statusNote: "Test" }],
    ["POST", `/admin/tenants/${tenant.id}/messages/${randomUUID()}`, { body: "Test reply" }],
  ] as const) {
    const allowedThroughGate = await send(hostServer.base, method, path, body);
    assert.notEqual(allowedThroughGate.status, 403, `${method} ${path} must pass the host gate`);
    assert.notEqual(allowedThroughGate.status, 200, "this negative fixture must not accidentally mutate/deliver");
  }
  assert.equal((await send(hostServer.base, "GET", `/admin/tenants/${tenant.id}/changelog`)).status, 200);
  assert.equal((await send(hostServer.base, "GET", `/admin/tenants/${tenant.id}/publish-preview`)).status, 200);
  assert.equal((await send(hostServer.base, "GET", `/admin/tenants/${tenant.id}/qr.png`)).status, 200);
  assert.equal((await send(hostServer.base, "GET", `/admin/tenants/${tenant.id}/label.pdf`)).status, 200);
});

test("phase2 onboarding exception: actual host save, custom-category creation and submit cross the gate", async (t) => {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw new Error("Dev fixtures only");
  const marker = randomUUID();
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `phase2-onboard-${marker}`, name: "Disposable onboarding", tenantType: "apartmaji", guestUiMode: "living-guide",
  }).returning();
  const [host] = await db.insert(hostUsersTable).values({ email: `phase2-onboard-${marker}@example.invalid` }).returning();
  await db.insert(hostMembershipsTable).values({ hostUserId: host.id, tenantId: tenant.id });
  await seedTenantContent(tenant.id, "apartmaji");
  await db.transaction((tx) => createHostOnboardingDraft(tx, tenant.id, host.id));
  const server = await listen({ kind: "host", hostUserId: host.id, tenantId: tenant.id, requestIp: "127.0.0.1" });
  _setHostOnboardingDeliveryOverride(async () => ({ ok: true, providerMessageId: `phase2-${marker}` }));
  t.after(async () => {
    _setHostOnboardingDeliveryOverride(null);
    await server.close();
    await db.delete(changelogTable).where(eq(changelogTable.tenantId, tenant.id));
    await db.delete(hostAuthEventsTable).where(eq(hostAuthEventsTable.hostUserId, host.id));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
    await db.delete(hostUsersTable).where(eq(hostUsersTable.id, host.id));
  });
  const initial = await currentHostOnboarding(tenant.id, host.id);
  assert.ok(initial);
  const category = await send(server.base, "POST", "/admin/host/onboarding/categories", {
    sourceId: "rainy-day", sectionKey: "stay", name: "Za dež",
    revision: initial.round.revision, canonicalRevision: initial.canonicalRevision,
  });
  assert.equal(category.status, 201, await category.clone().text());
  const afterCategory = await currentHostOnboarding(tenant.id, host.id);
  assert.ok(afterCategory);
  const save = await send(server.base, "POST", "/admin/host/onboarding/save", {
    revision: afterCategory.round.revision, canonicalRevision: afterCategory.canonicalRevision,
    data: {
      accommodationName: "Disposable onboarding", address: "Testna 1",
      guestPhone: "+386 40 000 000", guestEmail: "guest@example.invalid",
      checkInFrom: "15:00", checkOutUntil: "10:00",
      contacts: [{ id: "contact-1", name: "Host", phone: "+386 40 000 001" }],
      customCategories: [{ id: "rain", name: "Deževni dnevi", entries: [{ id: "museum", name: "Muzej" }] }],
    },
  });
  assert.equal(save.status, 200, await save.clone().text());
  const saved = await currentHostOnboarding(tenant.id, host.id);
  assert.ok(saved);
  assert.equal(saved.round.draftData.accommodationName, "Disposable onboarding");
  const submit = await send(server.base, "POST", "/admin/host/onboarding/submit", {
    round: saved.round.round, revision: saved.round.revision,
    canonicalRevision: saved.canonicalRevision, data: saved.round.draftData,
  });
  assert.equal(submit.status, 200, await submit.clone().text());
  assert.equal((await submit.json() as { ok: boolean }).ok, true);
});