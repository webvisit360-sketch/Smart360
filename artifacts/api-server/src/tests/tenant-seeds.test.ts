import test from "node:test";
import assert from "node:assert/strict";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  categoriesTable,
  db,
  itemsTable,
  sectionsTable,
  tenantsTable,
  translationsTable,
} from "@workspace/db";
import {
  ensureTenantSkeleton,
  MELI_PU_SKELETON,
  seedTenantContent,
} from "../lib/tenantSeeds";

const EXPECTED_SECTION_KEYS = ["stay", "offer", "explore", "services"];
const EXPECTED_CATEGORY_KEYS = [
  "welcome", "apart", "loc", "park", "gate", "equip", "check", "wifi", "house", "pool",
  "sup", "scooter", "fitness", "grill", "boat", "ferry", "games", "oil", "ice",
  "breakfast", "culinary", "night", "pizza", "act", "hike", "bike", "beach", "culture",
  "nature", "trips", "events",
  "shops", "bakery", "gas", "atm", "pharm", "hosp",
];

test("new tenant receives the complete four-language Meli Pu skeleton and is deleted", async () => {
  const slug = `seed-parity-${crypto.randomUUID()}`;
  const [tenant] = await db
    .insert(tenantsTable)
    .values({ slug, name: "Throwaway seed parity", tenantType: "apartmaji", guestUiMode: "living-guide" })
    .returning({ id: tenantsTable.id });

  try {
    await seedTenantContent(tenant!.id, "apartmaji");

    const sections = await db
      .select({
        id: sectionsTable.id,
        key: sectionsTable.key,
        title: sectionsTable.title,
        icon: sectionsTable.icon,
        position: sectionsTable.position,
      })
      .from(sectionsTable)
      .where(eq(sectionsTable.tenantId, tenant!.id))
      .orderBy(asc(sectionsTable.position));
    assert.deepEqual(sections.map((section) => section.key), EXPECTED_SECTION_KEYS);
    assert.deepEqual(
      sections.map(({ key, title, icon, position }) => ({ key, title, icon, position })),
      MELI_PU_SKELETON.map((section, position) => ({
        key: section.key,
        title: section.names.sl,
        icon: section.icon,
        position,
      })),
    );

    const categories = await db
      .select({
        id: categoriesTable.id,
        sectionId: categoriesTable.sectionId,
        key: categoriesTable.key,
        label: categoriesTable.label,
        icon: categoriesTable.icon,
        layout: categoriesTable.layout,
        group: categoriesTable.exploreGroup,
        position: categoriesTable.position,
      })
      .from(categoriesTable)
      .where(inArray(categoriesTable.sectionId, sections.map((section) => section.id)))
      .orderBy(asc(categoriesTable.position));
    assert.equal(categories.length, 37);
    assert.deepEqual(
      new Set(categories.map((category) => category.key)),
      new Set(EXPECTED_CATEGORY_KEYS),
    );

    for (const [sectionPosition, sectionSeed] of MELI_PU_SKELETON.entries()) {
      const section = sections[sectionPosition]!;
      const rows = categories
        .filter((category) => category.sectionId === section.id)
        .sort((a, b) => a.position - b.position);
      assert.deepEqual(
        rows.map(({ key, label, icon, layout, group, position }) => ({
          key, label, icon, layout, group, position,
        })),
        sectionSeed.categories.map((category, position) => ({
          key: category.key,
          label: category.names.sl,
          icon: category.icon,
          layout: category.layout,
          group: category.group,
          position,
        })),
      );
    }

    const nodeIds = [...sections.map((section) => section.id), ...categories.map((category) => category.id)];
    const translations = await db
      .select({
        model: translationsTable.model,
        recordId: translationsTable.recordId,
        field: translationsTable.field,
        lang: translationsTable.lang,
        value: translationsTable.value,
      })
      .from(translationsTable)
      .where(inArray(translationsTable.recordId, nodeIds));
    assert.equal(translations.length, (4 + 37) * 3);
    for (const sectionSeed of MELI_PU_SKELETON) {
      const section = sections.find((row) => row.key === sectionSeed.key)!;
      for (const lang of ["en", "de", "it"] as const) {
        assert.ok(translations.some((row) =>
          row.model === "section"
          && row.recordId === section.id
          && row.field === "title"
          && row.lang === lang
          && row.value === sectionSeed.names[lang]));
      }
      for (const categorySeed of sectionSeed.categories) {
        const category = categories.find((row) =>
          row.sectionId === section.id && row.key === categorySeed.key)!;
        for (const lang of ["en", "de", "it"] as const) {
          assert.ok(translations.some((row) =>
            row.model === "category"
            && row.recordId === category.id
            && row.field === "label"
            && row.lang === lang
            && row.value === categorySeed.names[lang]));
        }
      }
    }

    const rerun = await ensureTenantSkeleton(tenant!.id, "apartmaji");
    assert.deepEqual(rerun, {
      tenantId: tenant!.id,
      addedSections: 0,
      addedCategories: 0,
      addedTranslations: 0,
    });
  } finally {
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
  }

  const [deleted] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));
  assert.equal(deleted, undefined, "throwaway tenant must be deleted");
});

test("additive sync appends missing rows without changing existing rows or content", async () => {
  const [tenant] = await db
    .insert(tenantsTable)
    .values({
      slug: `seed-additive-${crypto.randomUUID()}`,
      name: "Throwaway additive seed",
      tenantType: "kamp",
      guestUiMode: "living-guide",
    })
    .returning({ id: tenantsTable.id });

  try {
    const [section] = await db
      .insert(sectionsTable)
      .values({
        tenantId: tenant!.id,
        key: "stay",
        title: "Hostov naslov",
        icon: "custom",
        position: 42,
        isVisible: false,
      })
      .returning({ id: sectionsTable.id });
    const [category] = await db
      .insert(categoriesTable)
      .values({
        sectionId: section!.id,
        key: "welcome",
        label: "Hostov pozdrav",
        icon: "custom",
        layout: "text",
        exploreGroup: "prakticno",
        position: 17,
        isVisible: false,
      })
      .returning({ id: categoriesTable.id });
    const [item] = await db
      .insert(itemsTable)
      .values({ categoryId: category!.id, title: "Nedotakljiva vsebina", position: 9 })
      .returning({ id: itemsTable.id });
    await db.insert(translationsTable).values({
      model: "category",
      recordId: category!.id,
      field: "label",
      lang: "en",
      value: "Host translation",
    });

    const result = await ensureTenantSkeleton(tenant!.id, "kamp");
    assert.deepEqual(result, {
      tenantId: tenant!.id,
      addedSections: 3,
      addedCategories: 36,
      addedTranslations: (3 + 36) * 3,
    });

    const [preservedSection] = await db
      .select()
      .from(sectionsTable)
      .where(eq(sectionsTable.id, section!.id));
    assert.equal(preservedSection!.title, "Hostov naslov");
    assert.equal(preservedSection!.icon, "custom");
    assert.equal(preservedSection!.position, 42);
    assert.equal(preservedSection!.isVisible, false);

    const [preservedCategory] = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, category!.id));
    assert.equal(preservedCategory!.label, "Hostov pozdrav");
    assert.equal(preservedCategory!.icon, "custom");
    assert.equal(preservedCategory!.exploreGroup, "prakticno");
    assert.equal(preservedCategory!.position, 17);
    assert.equal(preservedCategory!.isVisible, false);

    const [preservedItem] = await db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.id, item!.id));
    assert.equal(preservedItem!.title, "Nedotakljiva vsebina");
    assert.equal(preservedItem!.position, 9);
    const [preservedTranslation] = await db
      .select()
      .from(translationsTable)
      .where(and(
        eq(translationsTable.recordId, category!.id),
        eq(translationsTable.lang, "en"),
      ));
    assert.equal(preservedTranslation!.value, "Host translation");

    const rerun = await ensureTenantSkeleton(tenant!.id, "kamp");
    assert.equal(rerun.addedSections, 0);
    assert.equal(rerun.addedCategories, 0);
    assert.equal(rerun.addedTranslations, 0);
  } finally {
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
  }
});