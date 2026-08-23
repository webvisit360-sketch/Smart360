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

test("explore-group backfill applies once, matches stable keys, and never reruns", async () => {
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
    // Label carries stray whitespace — key matching must not care.
    const [food] = await db.insert(categoriesTable).values({
      sectionId: section!.id, key: "breakfast", label: " Zajtrk ", layout: "poi",
    }).returning();
    // Repurposed since the ledger was written: the stable key changed.
    const [repurposed] = await db.insert(categoriesTable).values({
      sectionId: section!.id, key: "boats", label: "Izposoja čolnov", layout: "poi",
    }).returning();
    const [untouched] = await db.insert(categoriesTable).values({
      sectionId: section!.id, key: "trips", label: "Izleti", layout: "poi",
    }).returning();

    const ledger = [
      { categoryId: food!.id, key: "breakfast", exploreGroup: "food_drink" },
      { categoryId: repurposed!.id, key: "shops", exploreGroup: "services" },
      { categoryId: "00000000-0000-0000-0000-000000000000", key: "ghost", exploreGroup: "sights" },
    ];

    const first = await applyExploreGroupBackfill(tenantId, ledger);
    assert.equal(first.applied, true);
    assert.equal(first.updated, 1);
    assert.equal(first.skipped, 2);
    // The report must account for EVERY ledger row with before/after states.
    assert.equal(first.report.length, 3);
    const breakfastRow = first.report.find((r) => r.key === "breakfast")!;
    assert.equal(breakfastRow.outcome, "updated");
    assert.equal(breakfastRow.groupBefore, "experiences");
    assert.equal(breakfastRow.groupAfter, "food_drink");
    const shopsRow = first.report.find((r) => r.key === "shops")!;
    assert.equal(shopsRow.outcome, "skipped");
    assert.match(shopsRow.reason, /repurposed/);
    const ghostRow = first.report.find((r) => r.key === "ghost")!;
    assert.equal(ghostRow.outcome, "skipped");
    assert.match(ghostRow.reason, /no longer exists/);

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
    assert.equal(second.report.length, 0);
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

test("real ledger rows stay consistent with the approved groups and carry keys", () => {
  const allowed = new Set(["food_drink", "nature_trails", "sights", "services"]);
  assert.equal(EXPLORE_GROUP_LEDGER.length, 15);
  const keys = new Set<string>();
  for (const entry of EXPLORE_GROUP_LEDGER) {
    assert.ok(allowed.has(entry.exploreGroup), `${entry.key}: ${entry.exploreGroup}`);
    assert.ok(entry.key.length > 0, `empty key for ${entry.categoryId}`);
    keys.add(entry.key);
  }
  assert.equal(keys.size, 15, "ledger keys must be unique");
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
      { itemId: approvedItem!.id, tenantId, status: "approved", latitude: 45.528, longitude: 13.605, resolvedAddress: "Strunjan 148, 6320 Portorož", inputFingerprint: "a" },
      { itemId: pendingItem!.id, tenantId, status: "pending", latitude: 45.5, longitude: 13.6, resolvedAddress: "Izola, Slovenija", inputFingerprint: "b" },
    ]);

    const tree = await buildTenantContent(tenant!, { visibleOnly: true });
    const items = tree.sections.flatMap((s) => s.categories).flatMap((c) => c.items);
    const approved = items.find((i) => i.id === approvedItem!.id);
    const pending = items.find((i) => i.id === pendingItem!.id);
    assert.equal(approved!.latitude, 45.528);
    assert.equal(approved!.longitude, 13.605);
    assert.equal(approved!.resolvedAddress, "Strunjan 148, 6320 Portorož");
    // Unapproved candidates must never leak to guests.
    assert.equal(pending!.latitude, null);
    assert.equal(pending!.longitude, null);
    assert.equal(pending!.resolvedAddress, null);
  } finally {
    if (tenantId) await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
  }
});
