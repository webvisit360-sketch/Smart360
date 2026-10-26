import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db, tenantsTable, sectionsTable, categoriesTable, itemsTable, translationsTable, mediaTable,
  publishedSnapshotsTable, smartxstayImportRunsTable as runs, smartxstayImportSourcesTable as sources } from "@workspace/db";
import { cleanupImportedBody } from "../lib/smartxstayCleanupText";
import { importedItemState } from "../lib/smartxstayFingerprint";
import { cleanupSmartxstayDrafts } from "../lib/smartxstayCleanup";

const prodnik = JSON.parse(readFileSync(new URL("./fixtures/smartxstay-prodnik.json", import.meta.url), "utf8"));
test("exact Prodnik copy: category, Slovenian hours, gaps; CID address is conservatively retained; idempotent", () => {
  const result = cleanupImportedBody(prodnik.body, "sl", prodnik.category, prodnik.mapQuery);
  assert.doesNotMatch(result.after, /Restaurant|Monday|AM|PM/);
  assert.match(result.after, /Ponedeljek: zaprto/);
  assert.match(result.after, /Sobota: 09.00–22.00/);
  assert.match(result.after, /Juvanje 1/);
  assert.match(result.after, /href="http:\/\/www.prodnik.com\/"/);
  assert.equal(result.warnings.length, 1);
  assert.equal(cleanupImportedBody(result.after, "sl", prodnik.category, prodnik.mapQuery).after, result.after);
});
test("remove only verified address lines, preserve other prose/links and English hours", () => {
  const html = '<p>Restaurant</p><p>Naslov</p><p>Juvanje 1</p><p>3333 Ljubno</p><p>Monday: 12:00 AM – 12:00 PM</p><p><a href="/keep"><strong>Keep</strong></a></p>';
  const result = cleanupImportedBody(html, "sl", "Kulinarika", "Juvanje 1, 3333 Ljubno");
  assert.doesNotMatch(result.after, /Naslov|Juvanje/);
  assert.match(result.after, /Ponedeljek: 00.00–12.00/);
  assert.match(result.after, /<a href="\/keep"><strong>Keep<\/strong><\/a>/);
  assert.match(cleanupImportedBody(html, "en", "Kulinarika", null).after, /Monday: 12:00 AM/);
  assert.match(cleanupImportedBody("<p>Restaurant review</p>", "sl", "Kulinarika", null).after, /Restaurant review/);
});

test("draft cleanup: immutable checksum, legacy approval, concurrent-edit token, publication exclusion and repeat=0", async () => {
  const [tenant] = await db.insert(tenantsTable).values({ slug: `cleanup-fixture-${randomUUID()}`, name: "Synthetic cleanup test" }).returning();
  const ids: string[] = [];
  try {
    const [section] = await db.insert(sectionsTable).values({ tenantId: tenant.id, key: "explore", title: "Okolica" }).returning();
    const [category] = await db.insert(categoriesTable).values({ sectionId: section.id, label: "Kulinarika" }).returning();
    const [run] = await db.insert(runs).values({ tenantId: tenant.id, sourceUrl: "https://app.smartxstay.com/gen/s/synthetic", status: "completed" }).returning();
    const hashes: Record<string, string> = {};
    const add = async (label: string, legacy = false) => {
      const [item] = await db.insert(itemsTable).values({ categoryId: category.id, title: label, body: prodnik.body, mapQuery: prodnik.mapQuery }).returning();
      ids.push(item.id);
      await db.insert(sources).values({ tenantId: tenant.id, runId: run.id, sourceGuideId: "synthetic", sourceItemId: item.id, sourceUrl: run.sourceUrl, itemId: item.id });
      if (!legacy) hashes[item.id] = (await importedItemState(db, item)).hash;
      return item;
    };
    const normal = await add("unchanged");
    const edited = await add("edited");
    const legacy = await add("legacy", true);
    const published = await add("published");
    const stale = await add("edited-after-preview", true);
    const translated = await add("translated", true);
    await db.insert(translationsTable).values({ model: "item", recordId: translated.id, field: "body", lang: "en", value: "<p>Monday: Closed</p><p></p><p></p>" });
    await db.update(runs).set({ checkpoint: { contentHashes: hashes, preservedKey: "keep" } }).where(eq(runs.id, run.id));
    await db.update(itemsTable).set({ body: "<p>Operator's curated copy</p>" }).where(eq(itemsTable.id, edited.id));
    await db.insert(publishedSnapshotsTable).values({ tenantId: tenant.id, content: { languages: { sl: { tree: { sections: [{ categories: [{ items: [{ id: published.id, body: prodnik.body }] }] }] } } } } });
    const preview = await cleanupSmartxstayDrafts(tenant.id);
    assert.equal(preview.entries.find(e => e.id === edited.id)?.status, "skipped");
    assert.equal(preview.entries.find(e => e.id === published.id)?.status, "skipped");
    assert.equal(preview.entries.find(e => e.id === legacy.id)?.legacy, true);
    assert.equal((await db.select().from(itemsTable).where(eq(itemsTable.id, normal.id)))[0].body, prodnik.body, "preview is read-only");
    await db.update(itemsTable).set({ title: "Changed after preview" }).where(eq(itemsTable.id, stale.id));
    const approvals = preview.entries.filter(e => e.status === "ready").map(e => ({ id: e.id, token: e.token, legacyApproved: e.id !== legacy.id }));
    const applied = await cleanupSmartxstayDrafts(tenant.id, approvals);
    assert.equal(applied.changed, 2);
    assert.equal(applied.entries.find(e => e.id === legacy.id)?.status, "skipped");
    assert.match(applied.entries.find(e => e.id === stale.id)!.reason, /po predogledu/);
    const legacyPreview = await cleanupSmartxstayDrafts(tenant.id);
    const row = legacyPreview.entries.find(e => e.id === legacy.id)!;
    assert.equal((await cleanupSmartxstayDrafts(tenant.id, [{ id: legacy.id, token: row.token, legacyApproved: true }])).changed, 1);
    assert.equal((await cleanupSmartxstayDrafts(tenant.id, approvals)).changed, 0);
    const stored = (await db.select().from(runs).where(eq(runs.id, run.id)))[0].checkpoint as any;
    assert.deepEqual(stored.contentHashes, hashes);
    assert.equal(stored.preservedKey, "keep");
    assert.equal((await db.select().from(itemsTable).where(eq(itemsTable.id, published.id)))[0].body, prodnik.body);
    assert.equal((await db.select().from(translationsTable).where(eq(translationsTable.recordId, translated.id)))[0].value, "<p>Monday: Closed</p><p></p>");
    // A post-cleanup edit must never be accepted as a fresh legacy entry.
    await db.update(itemsTable).set({ title: "Manually edited later" }).where(eq(itemsTable.id, normal.id));
    assert.equal((await cleanupSmartxstayDrafts(tenant.id)).entries.find(e => e.id === normal.id)?.status, "skipped");
  } finally {
    for (const id of ids) await db.delete(translationsTable).where(eq(translationsTable.recordId, id));
    await db.delete(sources).where(eq(sources.tenantId, tenant.id));
    await db.delete(runs).where(eq(runs.tenantId, tenant.id));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
    assert.equal((await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenant.id))).length, 0);
  }
});
