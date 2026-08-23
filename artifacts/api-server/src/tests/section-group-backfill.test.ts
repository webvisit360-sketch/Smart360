import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  db,
  categoriesTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import {
  applySectionGroupBackfill,
  SECTION_GROUP_LEDGER,
} from "../lib/sectionGroupBackfill";

test("section-group backfill applies once, matches stable keys, ignores other sections' groups", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tenantId = "";
  try {
    const [tenant] = await db.insert(tenantsTable).values({
      slug: `sgb-test-${suffix}`,
      name: `SGB test ${suffix}`,
    }).returning();
    tenantId = tenant!.id;
    const [stay] = await db.insert(sectionsTable).values({
      tenantId, key: "stay", title: "Vaša nastanitev",
    }).returning();
    const [offer] = await db.insert(sectionsTable).values({
      tenantId, key: "offer", title: "Ponudba",
    }).returning();
    // A NON-default group in a different section (Okolica) must NOT disable
    // the stay/offer backfill — the guard is scoped to stay/offer only.
    const [explore] = await db.insert(sectionsTable).values({
      tenantId, key: "explore", title: "Okolica",
    }).returning();
    await db.insert(categoriesTable).values({
      sectionId: explore!.id, key: "hike", label: "Pohodi", layout: "poi",
      exploreGroup: "nature_trails",
    });

    // Label carries stray whitespace — key matching must not care.
    const [pool] = await db.insert(categoriesTable).values({
      sectionId: stay!.id, key: "pool", label: " Bazen ", layout: "text",
    }).returning();
    const [sup] = await db.insert(categoriesTable).values({
      sectionId: offer!.id, key: "sup", label: "SUP deska", layout: "text",
    }).returning();
    // Repurposed since the ledger was written: the stable key changed.
    const [repurposed] = await db.insert(categoriesTable).values({
      sectionId: offer!.id, key: "kayak", label: "Kajak", layout: "text",
    }).returning();
    const [untouched] = await db.insert(categoriesTable).values({
      sectionId: stay!.id, key: "spa", label: "Savna", layout: "text",
    }).returning();
    // Moved OUT of stay/offer since the ledger was written (id and key intact,
    // group still default): must be treated as gone, never regrouped.
    const [moved] = await db.insert(categoriesTable).values({
      sectionId: explore!.id, key: "boat", label: "Čoln", layout: "text",
    }).returning();

    const ledger = [
      { categoryId: pool!.id, key: "pool", group: "vase_bivanje" },
      { categoryId: sup!.id, key: "sup", group: "najem" },
      { categoryId: repurposed!.id, key: "scooter", group: "najem" },
      { categoryId: "00000000-0000-0000-0000-000000000000", key: "ghost", group: "prakticno" },
      { categoryId: moved!.id, key: "boat", group: "izleti_prevozi" },
    ];

    const first = await applySectionGroupBackfill(tenantId, ["stay", "offer"], ledger);
    assert.equal(first.applied, true);
    assert.equal(first.updated, 2);
    assert.equal(first.skipped, 3);
    assert.equal(first.report.length, 5);
    const poolRow = first.report.find((r) => r.key === "pool")!;
    assert.equal(poolRow.outcome, "updated");
    assert.equal(poolRow.groupBefore, "experiences");
    assert.equal(poolRow.groupAfter, "vase_bivanje");
    const scooterRow = first.report.find((r) => r.key === "scooter")!;
    assert.equal(scooterRow.outcome, "skipped");
    assert.match(scooterRow.reason, /repurposed/);
    const ghostRow = first.report.find((r) => r.key === "ghost")!;
    assert.equal(ghostRow.outcome, "skipped");
    assert.match(ghostRow.reason, /no longer exists/);
    const movedRow = first.report.find((r) => r.key === "boat")!;
    assert.equal(movedRow.outcome, "skipped");
    assert.match(movedRow.reason, /no longer exists/);
    const [movedAfter] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, moved!.id));
    assert.equal(movedAfter!.exploreGroup, "experiences");

    const [supAfter] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, sup!.id));
    assert.equal(supAfter!.exploreGroup, "najem");
    const [repurposedAfter] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, repurposed!.id));
    assert.equal(repurposedAfter!.exploreGroup, "experiences");
    const [untouchedAfter] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, untouched!.id));
    assert.equal(untouchedAfter!.exploreGroup, "experiences");

    // A later host edit must never be overwritten: rerun is a permanent no-op.
    await db.update(categoriesTable).set({ exploreGroup: "prihod_dostop" }).where(eq(categoriesTable.id, untouched!.id));
    const second = await applySectionGroupBackfill(tenantId, ["stay", "offer"], ledger);
    assert.equal(second.applied, false);
    assert.equal(second.updated, 0);
    assert.equal(second.report.length, 0);
    const [poolFinal] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, pool!.id));
    assert.equal(poolFinal!.exploreGroup, "vase_bivanje");
  } finally {
    if (tenantId) await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
  }
});

test("real section-group ledger stays consistent with the approved mapping", () => {
  const offerGroups = new Set(["najem", "izleti_prevozi", "domaci_izdelki", "pri_hisi"]);
  const stayGroups = new Set(["vase_bivanje", "prihod_dostop", "prakticno"]);
  assert.equal(SECTION_GROUP_LEDGER.length, 19);
  const keys = new Set<string>();
  const ids = new Set<string>();
  for (const entry of SECTION_GROUP_LEDGER) {
    assert.ok(
      offerGroups.has(entry.group) || stayGroups.has(entry.group),
      `${entry.key}: ${entry.group}`,
    );
    assert.ok(entry.key.length > 0, `empty key for ${entry.categoryId}`);
    keys.add(entry.key);
    ids.add(entry.categoryId);
  }
  assert.equal(keys.size, 19, "ledger keys must be unique");
  assert.equal(ids.size, 19, "ledger category ids must be unique");
});
