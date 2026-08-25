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
import { applyTriesteCityRename } from "../lib/triesteCityRenameBackfill";

test("Trieste city rename changes only the exact scoped source title and self-disables", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tenantId = "";
  try {
    const [tenant] = await db
      .insert(tenantsTable)
      .values({ slug: `trieste-rename-${suffix}`, name: "Trieste rename test" })
      .returning();
    tenantId = tenant!.id;
    const [section] = await db
      .insert(sectionsTable)
      .values({ tenantId, key: "explore", title: "Okolica" })
      .returning();
    const [category] = await db
      .insert(categoriesTable)
      .values({
        sectionId: section!.id,
        key: "trips",
        label: "Izleti",
        layout: "poi",
      })
      .returning();
    const [item] = await db
      .insert(itemsTable)
      .values({
        categoryId: category!.id,
        title: "Trst — informacijska točka",
        body: "Existing body",
        phone: "+390403478312",
        open24: false,
        hoursJson: "[[540,1080]]",
        mapQuery: "Infopoint Trieste",
      })
      .returning();
    await db.insert(translationsTable).values([
      {
        model: "item",
        recordId: item!.id,
        field: "title",
        lang: "en",
        value: "Trieste — tourist information point",
      },
      {
        model: "item",
        recordId: item!.id,
        field: "title",
        lang: "de",
        value: "Triest — Touristeninformation",
      },
      {
        model: "item",
        recordId: item!.id,
        field: "title",
        lang: "it",
        value: "Trieste — punto informazioni",
      },
    ]);

    const target = {
      tenantId,
      sectionKey: "explore",
      categoryId: category!.id,
      categoryKey: "trips",
      itemId: item!.id,
      titleBefore: "Trst — informacijska točka",
      titleAfter: "Trst",
    };
    const first = await applyTriesteCityRename(target);
    assert.equal(first.outcome, "updated");

    const [after] = await db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.id, item!.id));
    assert.equal(after!.title, "Trst");
    assert.equal(after!.body, "Existing body");
    assert.equal(after!.phone, "+390403478312");
    assert.equal(after!.open24, false);
    assert.equal(after!.hoursJson, "[[540,1080]]");
    assert.equal(after!.mapQuery, "Infopoint Trieste");

    const titleTranslations = await db
      .select()
      .from(translationsTable)
      .where(eq(translationsTable.recordId, item!.id));
    assert.deepEqual(
      titleTranslations
        .map(({ lang, value, stale }) => ({ lang, value, stale }))
        .sort((a, b) => a.lang.localeCompare(b.lang)),
      [
        {
          lang: "de",
          value: "Triest — Touristeninformation",
          stale: false,
        },
        {
          lang: "en",
          value: "Trieste — tourist information point",
          stale: false,
        },
        {
          lang: "it",
          value: "Trieste — punto informazioni",
          stale: false,
        },
      ],
    );

    const second = await applyTriesteCityRename(target);
    assert.equal(second.outcome, "already-applied");
  } finally {
    if (tenantId) {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    }
  }
});

test("Trieste city rename skips a changed title and a moved item", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tenantId = "";
  try {
    const [tenant] = await db
      .insert(tenantsTable)
      .values({ slug: `trieste-skip-${suffix}`, name: "Trieste skip test" })
      .returning();
    tenantId = tenant!.id;
    const [section] = await db
      .insert(sectionsTable)
      .values({ tenantId, key: "explore", title: "Okolica" })
      .returning();
    const [trips] = await db
      .insert(categoriesTable)
      .values({ sectionId: section!.id, key: "trips", label: "Izleti" })
      .returning();
    const [other] = await db
      .insert(categoriesTable)
      .values({ sectionId: section!.id, key: "act", label: "Aktivnosti" })
      .returning();
    const [changed] = await db
      .insert(itemsTable)
      .values({ categoryId: trips!.id, title: "Host-edited title" })
      .returning();
    const target = {
      tenantId,
      sectionKey: "explore",
      categoryId: trips!.id,
      categoryKey: "trips",
      itemId: changed!.id,
      titleBefore: "Trst — informacijska točka",
      titleAfter: "Trst",
    };

    const changedResult = await applyTriesteCityRename(target);
    assert.equal(changedResult.outcome, "skipped");
    assert.match(changedResult.reason, /changed since approval/);

    await db
      .update(itemsTable)
      .set({
        title: "Trst — informacijska točka",
        categoryId: other!.id,
      })
      .where(eq(itemsTable.id, changed!.id));
    const movedResult = await applyTriesteCityRename(target);
    assert.equal(movedResult.outcome, "skipped");
    assert.match(movedResult.reason, /no longer exists/);
  } finally {
    if (tenantId) {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    }
  }
});