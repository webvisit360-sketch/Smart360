import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { eq } from "drizzle-orm";
import { categoriesTable, db, itemsTable, publishedSnapshotsTable, sectionsTable, tenantsTable, translationsTable } from "@workspace/db";
import contentRouter from "../routes/adminContent";
import { createAdminGateForTests } from "../lib/actorGate";
import { buildTenantContent } from "../lib/contentTree";
import { buildDraftPublication, comparePublications, readPublishedContent, replacePublishedSnapshot } from "../lib/publishedSnapshots";
import { validateEventSchedule } from "../lib/eventSchedule";

test("schedule validation rejects missing end, invalid calendar, duplicate days, extras and season order", () => {
  const base = { type: "weekly", days: ["mon"], timeFrom: "08:00", timeTo: "09:00" };
  assert.equal(validateEventSchedule(base).success, true);
  for (const bad of [
    { ...base, timeTo: undefined }, { ...base, timeTo: "08:00" },
    { ...base, days: ["mon", "mon"] }, { ...base, days: [] },
    { ...base, date: "2026-01-01" }, { ...base, validFrom: "2026-12-01", validTo: "2026-01-01" },
    { ...base, validFrom: "2026-02-30" }, { ...base, inCamp: null },
    { ...base, extra: "discard me" }, { type: "once", date: "2026-02-30", timeFrom: "08:00", timeTo: "09:00" },
    { type: "once", date: "2026-01-01", timeFrom: "08:00" },
  ]) assert.equal(validateEventSchedule(bad).success, false, JSON.stringify(bad));
});

test("isolated host schedule CRUD, translation, snapshot isolation and legacy eventStart", async (t) => {
  if (process.env.NODE_ENV === "production") throw new Error("Fixture writes forbidden in production");
  if (!process.env.DATABASE_URL) return t.skip("development database unavailable");
  const id = randomUUID();
  const [tenant] = await db.insert(tenantsTable).values({
    id, slug: `schedule-test-${id}`, name: "Schedule fixture", isPublished: true,
  }).returning();
  assert.ok(tenant);
  const serverFor = async (tenantId: string) => {
    const app = express();
    app.use(express.json());
    app.use(createAdminGateForTests({ kind: "host", hostUserId: randomUUID(), tenantId }));
    app.use(contentRouter);
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    return { server, base: `http://127.0.0.1:${address.port}` };
  };
  const own = await serverFor(id);
  const foreign = await serverFor(randomUUID());
  t.after(async () => {
    await Promise.all([own, foreign].map(({ server }) => new Promise<void>(resolve => server.close(() => resolve()))));
    await db.delete(translationsTable).where(eq(translationsTable.recordId, itemId));
    await db.delete(publishedSnapshotsTable).where(eq(publishedSnapshotsTable.tenantId, id));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, id));
  });
  let itemId = "";
  const [section] = await db.insert(sectionsTable).values({ tenantId: id, key: "events", title: "Dogodki" }).returning();
  const [category] = await db.insert(categoriesTable).values({ sectionId: section!.id, key: "events", label: "Program" }).returning();
  const [legacy] = await db.insert(itemsTable).values({
    categoryId: category!.id, title: "Legacy", eventStart: "2026-06-20T08:00:00",
  }).returning();
  const [created] = await db.insert(itemsTable).values({
    categoryId: category!.id, title: "Yoga",
  }).returning();
  itemId = created!.id;
  const request = (base: string, method: string, path: string, body: unknown) => fetch(base + path, {
    method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const path = `/admin/items/${itemId}`;
  const schedule = { type: "weekly", days: ["thu", "fri", "sat", "sun"], timeFrom: "08:00", timeTo: "09:00",
    locationText: "Ob jezeru", ageText: "18+", inCamp: true };
  const createdByHost = await request(own.base, "POST", `/admin/categories/${category!.id}/items`, {
    title: "Popoldanski program", eventSchedule: { type: "once", date: "2026-06-21",
      timeFrom: "15:00", timeTo: "16:00" },
  });
  assert.equal(createdByHost.status, 201, await createdByHost.clone().text());
  assert.equal(((await createdByHost.json()) as { eventSchedule: { type: string } }).eventSchedule.type, "once");
  const missingEnd = await request(own.base, "POST", `/admin/categories/${category!.id}/items`, {
    title: "Neveljaven", eventSchedule: { type: "once", date: "2026-06-21", timeFrom: "15:00" },
  });
  assert.equal(missingEnd.status, 400);
  const invalid = await request(own.base, "PATCH", path, { eventSchedule: { ...schedule, timeTo: undefined } });
  assert.equal(invalid.status, 400);
  assert.equal((await db.select().from(itemsTable).where(eq(itemsTable.id, itemId)))[0]!.eventSchedule, null);
  const denied = await request(foreign.base, "PATCH", path, { eventSchedule: schedule });
  assert.equal(denied.status, 404, await denied.text());
  const saved = await request(own.base, "PATCH", path, { eventSchedule: schedule });
  assert.equal(saved.status, 200, await saved.clone().text());
  assert.deepEqual((await db.select().from(itemsTable).where(eq(itemsTable.id, itemId)))[0]!.eventSchedule, schedule);
  const duplicate = await fetch(own.base + `${path}/duplicate`, { method: "POST" });
  assert.equal(duplicate.status, 201, await duplicate.clone().text());
  assert.deepEqual(((await duplicate.json()) as { eventSchedule: unknown }).eventSchedule, schedule);
  const legacyConversion = await request(own.base, "PATCH", `/admin/items/${legacy!.id}`, {
    eventSchedule: { type: "once", date: "2026-06-20", timeFrom: "08:00", timeTo: "09:00" },
  });
  assert.equal(legacyConversion.status, 200, await legacyConversion.clone().text());
  assert.equal((await db.select().from(itemsTable).where(eq(itemsTable.id, legacy!.id)))[0]!.eventStart,
    "2026-06-20T08:00:00", "legacy start is preserved on first save");
  const sl = await buildTenantContent(tenant, { visibleOnly: true });
  const yoga = sl.sections.flatMap(s => s.categories).flatMap(c => c.items).find(i => i.id === itemId);
  assert.deepEqual(yoga?.eventSchedule, schedule);
  assert.equal(sl.sections.flatMap(s => s.categories).flatMap(c => c.items).find(i => i.id === legacy!.id)?.eventStart,
    "2026-06-20T08:00:00");
  await db.insert(translationsTable).values({
    model: "item", recordId: itemId, field: "eventSchedule.locationText", lang: "en", value: "By the lake",
  });
  const english = await buildTenantContent(tenant, { visibleOnly: true, lang: "en" });
  assert.equal(english.sections.flatMap(s => s.categories).flatMap(c => c.items)
    .find(i => i.id === itemId)?.eventSchedule?.locationText, "By the lake");
  // Fixture-only snapshot replacement; not a real tenant or application publish.
  await replacePublishedSnapshot(tenant);
  const published = await readPublishedContent(id);
  assert.deepEqual(published.languages.sl!.tree.sections.flatMap(s => s.categories).flatMap(c => c.items)
    .find(i => i.id === itemId)?.eventSchedule, schedule);
  const changedSchedule = { ...schedule, timeFrom: "10:00", timeTo: "11:00" };
  const edited = await request(own.base, "PATCH", path, { eventSchedule: changedSchedule });
  assert.equal(edited.status, 200, await edited.clone().text());
  assert.deepEqual((await readPublishedContent(id)).languages.sl!.tree.sections.flatMap(s => s.categories)
    .flatMap(c => c.items).find(i => i.id === itemId)?.eventSchedule, schedule, "guest stays on published schedule");
  const draft = await buildDraftPublication(tenant);
  assert.ok(comparePublications(draft, published).changed.some(line => line.startsWith("Termin")));
});