import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import {
  categoriesTable,
  db,
  itemsTable,
  sectionsTable,
  tenantsTable,
  translationsTable,
} from "@workspace/db";
import {
  applyMeliPuDescriptionBackfill,
  type DescriptionLedgerEntry,
} from "../lib/meliPuDescriptionBackfillCore";

test("description backfill writes only empty scoped values and is idempotent", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tenantId = "";
  try {
    const [tenant] = await db
      .insert(tenantsTable)
      .values({ slug: `description-backfill-${suffix}`, name: "Description test" })
      .returning();
    tenantId = tenant!.id;
    const [section] = await db
      .insert(sectionsTable)
      .values({ tenantId, key: "explore", title: "Okolica" })
      .returning();
    const [nature, hike] = await db
      .insert(categoriesTable)
      .values([
        { sectionId: section!.id, key: "nature", label: "Naravna dediščina" },
        { sectionId: section!.id, key: "hike", label: "Pohodništvo" },
      ])
      .returning();
    const [target, duplicate, populated] = await db
      .insert(itemsTable)
      .values([
        {
          categoryId: nature!.id,
          title: "Mesečev zaliv",
          body: "   ",
          phone: "+38640111222",
          mapQuery: "Protected map query",
          bullets: ["Protected bullet"],
        },
        { categoryId: hike!.id, title: "Mesečev zaliv" },
        {
          categoryId: nature!.id,
          title: "Strunjanski križ",
          body: "Host-written source",
        },
      ])
      .returning();
    await db.insert(translationsTable).values([
      {
        model: "item",
        recordId: target!.id,
        field: "body",
        lang: "en",
        value: "",
        stale: true,
      },
      {
        model: "item",
        recordId: target!.id,
        field: "body",
        lang: "de",
        value: "Host-written German",
      },
      {
        model: "item",
        recordId: target!.id,
        field: "title",
        lang: "it",
        value: "Titolo protetto",
      },
    ]);

    const ledger: DescriptionLedgerEntry[] = [
      {
        itemId: target!.id,
        categoryId: nature!.id,
        categoryKey: "nature",
        name: "Mesečev zaliv",
        sl: "Slovenski opis.",
        en: "English description.",
        de: "Deutsche Beschreibung.",
        it: "Descrizione italiana.",
      },
      {
        itemId: populated!.id,
        categoryId: nature!.id,
        categoryKey: "nature",
        name: "Strunjanski križ",
        sl: "Ne sme prepisati.",
        en: "Must not write.",
        de: "Darf nicht schreiben.",
        it: "Non deve scrivere.",
      },
    ];

    const first = await applyMeliPuDescriptionBackfill(
      tenantId,
      "explore",
      ledger,
    );
    assert.equal(first.updated, 1);
    assert.equal(first.skipped, 1);
    assert.deepEqual(first.report[0]!.languagesWritten, ["sl", "en", "it"]);
    assert.match(first.report[0]!.reason, /existing non-empty translations/);
    assert.match(first.report[1]!.reason, /already populated/);

    const [afterTarget, afterDuplicate, afterPopulated] = await Promise.all([
      db.select().from(itemsTable).where(eq(itemsTable.id, target!.id)).then((r) => r[0]),
      db.select().from(itemsTable).where(eq(itemsTable.id, duplicate!.id)).then((r) => r[0]),
      db.select().from(itemsTable).where(eq(itemsTable.id, populated!.id)).then((r) => r[0]),
    ]);
    assert.equal(afterTarget!.body, "Slovenski opis.");
    assert.equal(afterTarget!.phone, "+38640111222");
    assert.equal(afterTarget!.mapQuery, "Protected map query");
    assert.deepEqual(afterTarget!.bullets, ["Protected bullet"]);
    assert.equal(afterDuplicate!.body, null);
    assert.equal(afterPopulated!.body, "Host-written source");

    const translations = await db
      .select({
        field: translationsTable.field,
        lang: translationsTable.lang,
        value: translationsTable.value,
        stale: translationsTable.stale,
      })
      .from(translationsTable)
      .where(eq(translationsTable.recordId, target!.id));
    assert.deepEqual(
      translations.sort((a, b) =>
        `${a.field}/${a.lang}`.localeCompare(`${b.field}/${b.lang}`),
      ),
      [
        { field: "body", lang: "de", value: "Host-written German", stale: false },
        { field: "body", lang: "en", value: "English description.", stale: false },
        { field: "body", lang: "it", value: "Descrizione italiana.", stale: false },
        { field: "title", lang: "it", value: "Titolo protetto", stale: false },
      ],
    );

    const second = await applyMeliPuDescriptionBackfill(
      tenantId,
      "explore",
      ledger,
    );
    assert.equal(second.updated, 0);
    assert.equal(second.skipped, 2);
    const bodyTranslationCount = await db
      .select({ id: translationsTable.id })
      .from(translationsTable)
      .where(
        and(
          eq(translationsTable.recordId, target!.id),
          eq(translationsTable.field, "body"),
        ),
      );
    assert.equal(bodyTranslationCount.length, 3);
  } finally {
    if (tenantId) {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    }
  }
});

test("description backfill skips renamed, moved, and wrong-category targets", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tenantId = "";
  try {
    const [tenant] = await db
      .insert(tenantsTable)
      .values({ slug: `description-scope-${suffix}`, name: "Description scope" })
      .returning();
    tenantId = tenant!.id;
    const [section] = await db
      .insert(sectionsTable)
      .values({ tenantId, key: "explore", title: "Okolica" })
      .returning();
    const [nature, hike] = await db
      .insert(categoriesTable)
      .values([
        { sectionId: section!.id, key: "nature", label: "Narava" },
        { sectionId: section!.id, key: "hike", label: "Pohodništvo" },
      ])
      .returning();
    const [renamed, moved, wrongCategory] = await db
      .insert(itemsTable)
      .values([
        { categoryId: nature!.id, title: "Host-renamed" },
        { categoryId: hike!.id, title: "Moved item" },
        { categoryId: nature!.id, title: "Wrong category signature" },
      ])
      .returning();
    const makeEntry = (
      itemId: string,
      categoryId: string,
      categoryKey: string,
      name: string,
    ): DescriptionLedgerEntry => ({
      itemId,
      categoryId,
      categoryKey,
      name,
      sl: "Opis.",
      en: "Description.",
      de: "Beschreibung.",
      it: "Descrizione.",
    });
    const result = await applyMeliPuDescriptionBackfill(tenantId, "explore", [
      makeEntry(renamed!.id, nature!.id, "nature", "Original title"),
      makeEntry(moved!.id, nature!.id, "nature", "Moved item"),
      makeEntry(wrongCategory!.id, nature!.id, "hike", "Wrong category signature"),
    ]);
    assert.equal(result.updated, 0);
    assert.equal(result.skipped, 3);
    assert.ok(result.report.every((row) => row.languagesWritten.length === 0));
    assert.ok(result.report.every((row) => /signature/.test(row.reason)));

    const writtenTranslations = await db
      .select({ recordId: translationsTable.recordId })
      .from(translationsTable)
      .where(eq(translationsTable.field, "body"));
    assert.equal(
      writtenTranslations.filter((row) =>
        [renamed!.id, moved!.id, wrongCategory!.id].includes(row.recordId),
      ).length,
      0,
    );
  } finally {
    if (tenantId) {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    }
  }
});