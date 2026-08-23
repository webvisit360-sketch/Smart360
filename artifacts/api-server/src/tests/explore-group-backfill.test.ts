import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  db,
  categoriesTable,
  sectionsTable,
  tenantsTable,
  itemsTable,
  itemDistanceProposalsTable,
} from "@workspace/db";
import {
  applyExploreGroupBackfill,
  EXPLORE_GROUP_LEDGER,
} from "../lib/exploreGroupBackfill";
import { buildTenantContent } from "../lib/contentTree";

test("explore-group backfill applies once, honours labels, and never reruns", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tenantId = "";
  try {
    const [tenant] = await db.insert(tenantsTable).values({
      slug: `backfill-test-${suffix}`,
      name: `Backfill test ${suffix}`,
    }).returning();
    tenantId = tenant!.id;
    const [section] = await db.insert(sectionsTable).values({
      tenantId, key: `explore-${suffix}`, title: "Okolica",
    }).returning();
    // Broken production signature: every category sits in the default group.
    const [food] = await db.insert(categoriesTable).values({
      sectionId: section!.id, label: "Zajtrk", layout: "poi",
    }).returning();
    const [repurposed] = await db.insert(categoriesTable).values({
      sectionId: section!.id, label: "Ni več Trgovine", layout: "poi",
    }).returning();
    const [untouched] = await db.insert(categoriesTable).values({
      sectionId: section!.id, label: "Izleti", layout: "poi",
    }).returning();

    const ledger = [
      { categoryId: food!.id, expectedLabel: "Zajtrk", exploreGroup: "food_drink" },
      // Label changed since the ledger was written — must be skipped, not regrouped.
      { categoryId: repurposed!.id, expectedLabel: "Trgovine", exploreGroup: "services" },
    ];

    const first = await applyExploreGroupBackfill(tenantId, ledger);
    assert.equal(first.applied, true);
    assert.equal(first.updated, 1);
    assert.deepEqual(first.skipped, ["Trgovine"]);

    const [foodAfter] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, food!.id));
    assert.equal(foodAfter!.exploreGroup, "food_drink");
    const [repurposedAfter] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, repurposed!.id));
    assert.equal(repurposedAfter!.exploreGroup, "experiences");
    const [untouchedAfter] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, untouched!.id));
    assert.equal(untouchedAfter!.exploreGroup, "experiences");

    // A later host edit must never be overwritten: simulate one, rerun, verify no-op.
    await db.update(categoriesTable).set({ exploreGroup: "sights" }).where(eq(categoriesTable.id, food!.id));
    const second = await applyExploreGroupBackfill(tenantId, ledger);
    assert.equal(second.applied, false);
    assert.equal(second.updated, 0);
    const [foodFinal] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, food!.id));
    assert.equal(foodFinal!.exploreGroup, "sights");
  } finally {
    if (tenantId) await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
  }
});

test("real ledger is a no-op against the development database (groups already assigned)", async () => {
  const result = await applyExploreGroupBackfill();
  assert.equal(result.applied, false);
  assert.equal(result.updated, 0);
});

test("real ledger rows stay consistent with the five approved groups", () => {
  const allowed = new Set(["food_drink", "nature_trails", "sights", "services"]);
  assert.equal(EXPLORE_GROUP_LEDGER.length, 15);
  for (const entry of EXPLORE_GROUP_LEDGER) {
    assert.ok(allowed.has(entry.exploreGroup), `${entry.expectedLabel}: ${entry.exploreGroup}`);
  }
});

test("guest payload exposes approved review coordinates and hides unapproved ones", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tenantId = "";
  try {
    const [tenant] = await db.insert(tenantsTable).values({
      slug: `coords-test-${suffix}`,
      name: `Coords test ${suffix}`,
    }).returning();
    tenantId = tenant!.id;
    const [section] = await db.insert(sectionsTable).values({
      tenantId, key: `explore-${suffix}`, title: "Okolica",
    }).returning();
    const [category] = await db.insert(categoriesTable).values({
      sectionId: section!.id, label: "POI", layout: "poi",
    }).returning();
    const [approvedItem] = await db.insert(itemsTable).values({
      categoryId: category!.id, title: "Approved", mapQuery: "Strunjan",
    }).returning();
    const [pendingItem] = await db.insert(itemsTable).values({
      categoryId: category!.id, title: "Pending", mapQuery: "Izola",
    }).returning();
    await db.insert(itemDistanceProposalsTable).values([
      { itemId: approvedItem!.id, tenantId, status: "approved", latitude: 45.528, longitude: 13.605, inputFingerprint: "a" },
      { itemId: pendingItem!.id, tenantId, status: "pending", latitude: 45.5, longitude: 13.6, inputFingerprint: "b" },
    ]);

    const tree = await buildTenantContent(tenant!, { visibleOnly: true });
    const items = tree.sections.flatMap((s) => s.categories).flatMap((c) => c.items);
    const approved = items.find((i) => i.id === approvedItem!.id);
    const pending = items.find((i) => i.id === pendingItem!.id);
    assert.equal(approved!.latitude, 45.528);
    assert.equal(approved!.longitude, 13.605);
    // Unapproved candidates must never leak to guests.
    assert.equal(pending!.latitude, null);
    assert.equal(pending!.longitude, null);
  } finally {
    if (tenantId) await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
  }
});
