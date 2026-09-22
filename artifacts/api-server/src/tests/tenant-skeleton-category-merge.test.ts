import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import {
  categoriesTable,
  db,
  itemsTable,
  sectionsTable,
  tenantsTable,
  translationsTable,
} from "@workspace/db";
import { alignTenantSkeleton } from "../lib/tenantSkeletonAlignment";
import {
  ensureTenantPublication,
  previewPublication,
  readPublishedContent,
} from "../lib/publishedSnapshots";
import { seedTenantContent } from "../lib/tenantSeeds";

test("real development DB: duplicate Hišni red merges losslessly, stays isolated, and is idempotent", async (context) => {
  if (process.env["NODE_ENV"] === "production") throw new Error("Alignment fixture is forbidden in production");
  if (!process.env["DATABASE_URL"]) {
    context.skip("development database is unavailable");
    return;
  }
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  try {
    await db.insert(tenantsTable).values([
      {
        id: tenantId,
        slug: `alignment-house-rules-${tenantId}`,
        name: "Disposable duplicate house rules",
        tenantType: "apartmaji",
        isPublished: true,
        languages: ["sl", "en"],
      },
      {
        id: otherTenantId,
        slug: `alignment-house-rules-other-${otherTenantId}`,
        name: "Disposable isolated tenant",
        tenantType: "apartmaji",
        isPublished: true,
        languages: ["sl", "en"],
      },
    ]);
    await seedTenantContent(tenantId, "apartmaji");
    await seedTenantContent(otherTenantId, "apartmaji");
    const [stay] = await db.select().from(sectionsTable).where(and(
      eq(sectionsTable.tenantId, tenantId),
      eq(sectionsTable.key, "stay"),
    ));
    const [keeper] = await db.select().from(categoriesTable).where(and(
      eq(categoriesTable.sectionId, stay!.id),
      eq(categoriesTable.key, "house"),
    ));
    const [fallbackCategory] = await db.select().from(categoriesTable).where(and(
      eq(categoriesTable.sectionId, stay!.id),
      eq(categoriesTable.key, "loc"),
    ));
    await db.update(categoriesTable).set({
      key: "legacy-location",
      label: "  LOKACIJA ",
    }).where(eq(categoriesTable.id, fallbackCategory!.id));
    const [renamedPool] = await db.select().from(categoriesTable).where(and(
      eq(categoriesTable.sectionId, stay!.id),
      eq(categoriesTable.key, "pool"),
    ));
    await db.update(categoriesTable).set({
      label: "Vodna zabava",
      icon: "host-pool-icon",
      layout: "host-pool-layout",
      position: 77,
    }).where(eq(categoriesTable.id, renamedPool!.id));
    const [unrelatedCanonicalName] = await db.insert(categoriesTable).values({
      sectionId: stay!.id,
      key: "host-bazen",
      label: "Bazen",
      icon: "host-icon",
      layout: "host-layout",
      position: 78,
    }).returning();
    const [customWifi] = await db.select().from(categoriesTable).where(and(
      eq(categoriesTable.sectionId, stay!.id),
      eq(categoriesTable.key, "wifi"),
    ));
    await db.update(categoriesTable).set({
      label: "Internet po meri",
      icon: "host-wifi-icon",
      layout: "host-wifi-layout",
      position: 79,
    }).where(eq(categoriesTable.id, customWifi!.id));
    const [duplicate] = await db.insert(categoriesTable).values({
      sectionId: stay!.id,
      key: "rules",
      label: "  HIŠNI   RED ",
      icon: "rules",
      layout: "rules",
      position: 50,
    }).returning();
    await db.update(translationsTable).set({
      value: "Original keeper wording",
      stale: true,
    }).where(and(
      eq(translationsTable.model, "category"),
      eq(translationsTable.recordId, keeper!.id),
      eq(translationsTable.field, "label"),
      eq(translationsTable.lang, "en"),
    ));
    const [customSection] = await db.insert(sectionsTable).values({
      tenantId,
      key: "host-custom-section",
      title: "Gostiteljev razdelek",
      position: 90,
    }).returning();
    const [customFirst, customSecond, emptyFirst, emptySecond] = await db.insert(categoriesTable).values([
      {
        sectionId: customSection!.id, key: "custom-a", label: " Posebna   pravila ",
        position: 4,
      },
      {
        sectionId: customSection!.id, key: "custom-b", label: "POSEBNA PRAVILA",
        position: 7,
      },
      {
        sectionId: customSection!.id, key: "empty-a", label: " Prazna dvojica ",
        position: 10,
      },
      {
        sectionId: customSection!.id, key: "empty-b", label: "PRAZNA   DVOJICA",
        position: 11,
      },
    ]).returning();
    const [keeperItem, duplicateItem, archivedDuplicateItem] = await db.insert(itemsTable).values([
      { categoryId: keeper!.id, title: "Mir po 22. uri", body: "Obstoječe pravilo" },
      { categoryId: duplicate!.id, title: "Brez kajenja", body: "Novo pravilo" },
      {
        categoryId: duplicate!.id,
        title: "Arhivirano pravilo",
        body: "Ohrani tudi arhivirano vsebino",
        deletedAt: new Date(),
      },
    ]).returning();
    const [customFirstItem, customSecondItem] = await db.insert(itemsTable).values([
      { categoryId: customFirst!.id, title: "Prvo posebno pravilo" },
      { categoryId: customSecond!.id, title: "Drugo posebno pravilo" },
    ]).returning();
    await db.insert(translationsTable).values([
      {
        model: "category", recordId: duplicate!.id, field: "label", lang: "en",
        value: "Rules from duplicate", stale: true,
      },
      {
        model: "category", recordId: duplicate!.id, field: "label", lang: "de",
        value: "Regeln aus Duplikat", stale: false,
      },
      {
        model: "item", recordId: duplicateItem!.id, field: "body", lang: "en",
        value: "No smoking", stale: false,
      },
      {
        model: "item", recordId: archivedDuplicateItem!.id, field: "body", lang: "en",
        value: "Archived rule retained", stale: false,
      },
      {
        model: "category", recordId: customFirst!.id, field: "label", lang: "en",
        value: "First custom translation", stale: false,
      },
      {
        model: "category", recordId: customSecond!.id, field: "label", lang: "en",
        value: "Conflicting custom translation", stale: true,
      },
    ]);
    await ensureTenantPublication(tenantId);
    await ensureTenantPublication(otherTenantId);
    const snapshotBefore = structuredClone(await readPublishedContent(tenantId));
    const otherSnapshotBefore = structuredClone(await readPublishedContent(otherTenantId));
    const otherSectionIds = (await db.select({ id: sectionsTable.id }).from(sectionsTable)
      .where(eq(sectionsTable.tenantId, otherTenantId))).map((row) => row.id);
    const otherDraftBefore = await db.select().from(categoriesTable)
      .where(inArray(categoriesTable.sectionId, otherSectionIds));

    const result = await alignTenantSkeleton(tenantId);
    assert.ok(result);
    assert.equal(result.categoryMerges.length, 3);
    const houseMerge = result.categoryMerges.find((merge) => merge.removedCategoryId === duplicate!.id)!;
    assert.equal(houseMerge.keptCategoryId, keeper!.id);
    assert.match(houseMerge.summary, /^Združena kategorija /);
    const customMerge = result.categoryMerges.find((merge) => merge.removedCategoryId === customSecond!.id)!;
    assert.equal(customMerge.keptCategoryId, customFirst!.id, "unknown age falls back to section position");
    assert.match(customMerge.summary, /Zanesljivega podatka o starosti ni/);
    const emptyMerge = result.categoryMerges.find((merge) => merge.removedCategoryId === emptySecond!.id)!;
    assert.equal(emptyMerge.keptCategoryId, emptyFirst!.id);
    const activeLocationRows = await db.select().from(categoriesTable).where(and(
      eq(categoriesTable.sectionId, stay!.id),
      eq(categoriesTable.key, "loc"),
    ));
    assert.equal(activeLocationRows.length, 1, "normalized-name fallback adopts instead of inserting");
    assert.equal(activeLocationRows[0]!.id, fallbackCategory!.id);
    assert.equal(activeLocationRows[0]!.label, "  LOKACIJA ", "fallback adoption preserves the host label");
    const [poolAfter, unrelatedAfter, wifiAfter] = await Promise.all([
      db.select().from(categoriesTable).where(eq(categoriesTable.id, renamedPool!.id)).then((rows) => rows[0]),
      db.select().from(categoriesTable).where(eq(categoriesTable.id, unrelatedCanonicalName!.id)).then((rows) => rows[0]),
      db.select().from(categoriesTable).where(eq(categoriesTable.id, customWifi!.id)).then((rows) => rows[0]),
    ]);
    assert.deepEqual(
      { label: poolAfter!.label, icon: poolAfter!.icon, layout: poolAfter!.layout, position: poolAfter!.position, deletedAt: poolAfter!.deletedAt },
      { label: "Vodna zabava", icon: "host-pool-icon", layout: "host-pool-layout", position: 77, deletedAt: null },
    );
    assert.equal(unrelatedAfter!.deletedAt, null, "canonical seed name is not merged into differently named keyed row");
    assert.deepEqual(
      { label: wifiAfter!.label, icon: wifiAfter!.icon, layout: wifiAfter!.layout, position: wifiAfter!.position },
      { label: "Internet po meri", icon: "host-wifi-icon", layout: "host-wifi-layout", position: 79 },
      "unrelated Stay metadata remains host-owned",
    );

    const allFixtureItems = await db.select().from(itemsTable)
      .where(inArray(itemsTable.id, [keeperItem!.id, duplicateItem!.id, archivedDuplicateItem!.id]));
    assert.equal(allFixtureItems.length, 3);
    assert.ok(allFixtureItems.every((item) => item.categoryId === keeper!.id));
    assert.equal(allFixtureItems.find((item) => item.id === archivedDuplicateItem!.id)?.deletedAt instanceof Date, true);
    const customItems = await db.select().from(itemsTable)
      .where(inArray(itemsTable.id, [customFirstItem!.id, customSecondItem!.id]));
    assert.equal(customItems.length, 2);
    assert.ok(customItems.every((item) => item.categoryId === customFirst!.id));
    const movedTranslations = await db.select().from(translationsTable).where(and(
      eq(translationsTable.model, "category"),
      eq(translationsTable.recordId, keeper!.id),
    ));
    assert.ok(movedTranslations.some((row) =>
      row.lang === "en" && row.value === "Rules from duplicate" && row.stale &&
      row.field === `label.__merged__.${duplicate!.id}`));
    assert.ok(movedTranslations.some((row) =>
      row.lang === "en" && row.value === "Original keeper wording" && row.stale &&
      row.field === "label"));
    const customTranslations = await db.select().from(translationsTable).where(and(
      eq(translationsTable.model, "category"),
      eq(translationsTable.recordId, customFirst!.id),
    ));
    assert.ok(customTranslations.some((row) => row.value === "First custom translation"));
    assert.ok(customTranslations.some((row) =>
      row.value === "Conflicting custom translation" &&
      row.stale &&
      row.field === `label.__merged__.${customSecond!.id}`));
    assert.ok(movedTranslations.some((row) =>
      row.lang === "de" && row.value === "Regeln aus Duplikat" &&
      row.field === `label.__merged__.${duplicate!.id}`));
    assert.equal((await db.select().from(translationsTable)
      .where(inArray(translationsTable.recordId, [duplicateItem!.id, archivedDuplicateItem!.id]))).length, 2);
    const [retiredDuplicate] = await db.select().from(categoriesTable)
      .where(eq(categoriesTable.id, duplicate!.id));
    assert.ok(retiredDuplicate!.deletedAt instanceof Date);

    assert.deepEqual(await readPublishedContent(tenantId), snapshotBefore);
    assert.deepEqual(await readPublishedContent(otherTenantId), otherSnapshotBefore);
    assert.deepEqual(
      await db.select().from(categoriesTable).where(inArray(categoriesTable.sectionId, otherSectionIds)),
      otherDraftBefore,
    );
    const preview = await previewPublication(tenantId);
    assert.ok(preview.removed.some((line) => line.includes("HIŠNI") || line.includes("Hišni red")));

    const replay = await alignTenantSkeleton(tenantId);
    assert.ok(replay);
    assert.equal(replay.changed, false);
    assert.deepEqual(replay.categoryMerges, []);
  } finally {
    await db.delete(tenantsTable).where(inArray(tenantsTable.id, [tenantId, otherTenantId]));
  }
});