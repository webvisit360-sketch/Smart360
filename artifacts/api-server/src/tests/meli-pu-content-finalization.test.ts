import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  categoriesTable,
  db,
  itemsTable,
  sectionsTable,
  tenantsTable,
  translationsTable,
} from "@workspace/db";
import {
  applyMeliPuContentFinalization,
  type MeliPuContentFinalizationConfig,
} from "../lib/meliPuContentFinalizationBackfill";

test("Meli Pu finalization is scoped, complete and idempotent", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tenantId = "";
  try {
    const [tenant] = await db
      .insert(tenantsTable)
      .values({ slug: `meli-final-${suffix}`, name: "Meli finalization test" })
      .returning();
    tenantId = tenant!.id;
    const [section] = await db
      .insert(sectionsTable)
      .values({ tenantId, key: "explore", title: "Okolica" })
      .returning();
    const [activities, trips] = await db
      .insert(categoriesTable)
      .values([
        { sectionId: section!.id, key: "act", label: "Aktivnosti" },
        { sectionId: section!.id, key: "trips", label: "Izleti" },
      ])
      .returning();
    const [miramare, portopiccolo, trst] = await db
      .insert(itemsTable)
      .values([
        { categoryId: activities!.id, title: "Grad Miramare, Trst" },
        { categoryId: activities!.id, title: "Portopiccolo Sistiana" },
        {
          categoryId: trips!.id,
          title: "Trst",
          body: "City description",
          phone: "+390403478312",
          hoursJson:
            "[[540,1080],[540,1080],[540,1080],[540,1080],[540,1080],[540,1080],[540,1080]]",
          mapQuery: "Infopoint Trieste",
        },
      ])
      .returning();
    await db.insert(translationsTable).values([
      {
        model: "item",
        recordId: trst!.id,
        field: "title",
        lang: "en",
        value: "Trieste — tourist information point",
      },
      {
        model: "item",
        recordId: trst!.id,
        field: "title",
        lang: "de",
        value: "Triest — Touristeninformation",
      },
      {
        model: "item",
        recordId: trst!.id,
        field: "title",
        lang: "it",
        value: "Trieste — punto informazioni",
      },
    ]);

    const config: MeliPuContentFinalizationConfig = {
      duplicates: [
        {
          itemId: miramare!.id,
          categoryId: activities!.id,
          categoryKey: "act",
          title: "Grad Miramare, Trst",
        },
        {
          itemId: portopiccolo!.id,
          categoryId: activities!.id,
          categoryKey: "act",
          title: "Portopiccolo Sistiana",
        },
      ],
      trieste: {
        itemId: trst!.id,
        categoryId: trips!.id,
        categoryKey: "trips",
        title: "Trst",
        phoneBefore: "+390403478312",
        hoursBefore:
          "[[540,1080],[540,1080],[540,1080],[540,1080],[540,1080],[540,1080],[540,1080]]",
        mapBefore: "Infopoint Trieste",
        mapAfter: "Trieste, Piazza dell'Unità d'Italia",
        titles: {
          en: ["Trieste — tourist information point", "Trieste"],
          de: ["Triest — Touristeninformation", "Triest"],
          it: ["Trieste — punto informazioni", "Trieste"],
        },
      },
    };

    const first = await applyMeliPuContentFinalization(
      tenantId,
      "explore",
      config,
    );
    assert.equal(first.triesteOutcome, "updated");
    assert.deepEqual(first.duplicatesRemoved, [
      "Grad Miramare, Trst",
      "Portopiccolo Sistiana",
    ]);
    assert.deepEqual(first.duplicateSkips, []);

    const rows = await db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.categoryId, activities!.id));
    assert.ok(rows.every((row) => row.deletedAt));
    const [city] = await db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.id, trst!.id));
    assert.equal(city!.body, "City description");
    assert.equal(city!.phone, null);
    assert.equal(city!.hoursJson, null);
    assert.equal(city!.mapQuery, "Trieste, Piazza dell'Unità d'Italia");
    const titleValues = await db
      .select({ lang: translationsTable.lang, value: translationsTable.value })
      .from(translationsTable)
      .where(eq(translationsTable.recordId, trst!.id));
    assert.deepEqual(
      Object.fromEntries(titleValues.map(({ lang, value }) => [lang, value])),
      { en: "Trieste", de: "Triest", it: "Trieste" },
    );

    const second = await applyMeliPuContentFinalization(
      tenantId,
      "explore",
      config,
    );
    assert.equal(second.triesteOutcome, "already-applied");

    await db
      .update(itemsTable)
      .set({ open24: true })
      .where(eq(itemsTable.id, trst!.id));
    const hostEdited = await applyMeliPuContentFinalization(
      tenantId,
      "explore",
      config,
    );
    assert.equal(hostEdited.triesteOutcome, "skipped");
    const [afterHostEdit] = await db
      .select({ open24: itemsTable.open24 })
      .from(itemsTable)
      .where(eq(itemsTable.id, trst!.id));
    assert.equal(afterHostEdit!.open24, true);

    await db
      .update(itemsTable)
      .set({ categoryId: activities!.id, open24: false })
      .where(eq(itemsTable.id, trst!.id));
    const moved = await applyMeliPuContentFinalization(
      tenantId,
      "explore",
      config,
    );
    assert.equal(moved.triesteOutcome, "skipped");
  } finally {
    if (tenantId) {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    }
  }
});