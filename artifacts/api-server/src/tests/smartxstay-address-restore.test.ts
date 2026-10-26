import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, tenantsTable, sectionsTable, categoriesTable, itemsTable, translationsTable,
  publishedSnapshotsTable, smartxstayImportRunsTable as runs, smartxstayImportSourcesTable as sources } from "@workspace/db";
import { cleanupSmartxstayDrafts } from "../lib/smartxstayCleanup";
import { restoredAddressBody, removeAddressLabel } from "../lib/smartxstayCleanupText";

const prodnik = JSON.parse(readFileSync(new URL("./fixtures/smartxstay-prodnik-cleanup-evidence.json", import.meta.url), "utf8"));
test("Prodnik evidence restores only the address at its original position, keeps hours and links", () => {
  const restored = restoredAddressBody(prodnik.change)!;
  assert.match(restored, /Juvanje 1, 3333 Ljubno ob Savinji, Slovenija/);
  assert.doesNotMatch(restored, /Naslov|Restaurant|Monday|AM|PM/);
  assert.match(restored, /Ponedeljek: zaprto/);
  assert.match(restored, /Sobota: 09.00–22.00/);
  assert.ok(restored.indexOf("Juvanje") < restored.indexOf("Delovni čas"));
  assert.equal(restored.slice(restored.indexOf("Delovni čas")), prodnik.body.slice(prodnik.body.indexOf("Delovni čas")));
  assert.equal(removeAddressLabel("<p>Naslov ceste je nov.</p><p>Juvanje 1</p>"), "<p>Naslov ceste je nov.</p><p>Juvanje 1</p>");
  assert.equal(restoredAddressBody({ ...prodnik.change, operations: ["Vrnjen naslov"] }), null);
});

test("operator address restore: real evidence copies, translation, edit conflict, trash, immutable snapshot, repeat zero", async () => {
  // Optional read-only production evidence export exercises all affected copies in DEV.
  const copies = process.env.ADDRESS_RESTORE_EVIDENCE
    ? JSON.parse(readFileSync(process.env.ADDRESS_RESTORE_EVIDENCE, "utf8")) : [prodnik];
  const [tenant] = await db.insert(tenantsTable).values({ slug: `restore-fixture-${randomUUID()}`, name: "Synthetic restore test" }).returning();
  const itemIds: string[] = [];
  try {
    const [section] = await db.insert(sectionsTable).values({ tenantId: tenant.id, key: "explore", title: "Okolica" }).returning();
    const [category] = await db.insert(categoriesTable).values({ sectionId: section.id, label: "Kulinarika" }).returning();
    const [run] = await db.insert(runs).values({ tenantId: tenant.id, sourceUrl: "https://app.smartxstay.com/gen/s/synthetic", status: "completed" }).returning();
    const receipts: Record<string, unknown> = {};
    const add = async (title: string, body: string, changes: unknown[], deletedAt: Date | null = null) => {
      const [item] = await db.insert(itemsTable).values({ categoryId: category.id, title, body, deletedAt }).returning();
      itemIds.push(item.id);
      await db.insert(sources).values({ tenantId: tenant.id, runId: run.id, sourceGuideId: "synthetic", sourceItemId: item.id, sourceUrl: run.sourceUrl, itemId: item.id });
      receipts[item.id] = { hash: "old-hash", at: "2026-10-26", legacyApproved: true, history: [changes] };
      return item;
    };
    const copied: {id: string; expected: string}[] = [];
    for (const copy of copies) {
      const item = await add(copy.title, copy.body, [copy.change]);
      copied.push({ id: item.id, expected: restoredAddressBody(copy.change)! });
    }
    const conflict = await add("edited", prodnik.body + "<p>New host prose</p>", [prodnik.change]);
    const trash = await add("trashed", prodnik.body, [prodnik.change], new Date());
    const translated = await add("translated", "<p>Unchanged body</p>", []);
    const [translation] = await db.insert(translationsTable).values({ model: "item", recordId: translated.id, field: "body", lang: "en", value: prodnik.body }).returning();
    receipts[translated.id] = { hash: "old", at: "", legacyApproved: true, history: [[{ ...prodnik.change, field: translation.id, lang: "en" }]] };
    await db.update(runs).set({ checkpoint: { cleanupReceipts: receipts, unrelated: "keep" } }).where(eq(runs.id, run.id));
    await db.insert(publishedSnapshotsTable).values({ tenantId: tenant.id, content: { items: copies } });
    const snapshot = JSON.stringify(await db.select().from(publishedSnapshotsTable).where(eq(publishedSnapshotsTable.tenantId, tenant.id)));
    const result = await cleanupSmartxstayDrafts(tenant.id, [], true);
    assert.equal(result.changed, copies.length + 1);
    for (const item of copied) assert.equal((await db.select().from(itemsTable).where(eq(itemsTable.id, item.id)))[0].body, item.expected);
    assert.equal(result.entries.find(e => e.id === conflict.id)?.status, "skipped");
    assert.equal(result.entries.find(e => e.id === trash.id)?.status, "skipped");
    assert.equal((await db.select().from(itemsTable).where(eq(itemsTable.id, conflict.id)))[0].body, conflict.body);
    assert.equal((await db.select().from(translationsTable).where(eq(translationsTable.id, translation.id)))[0].value, restoredAddressBody(prodnik.change));
    assert.equal((await cleanupSmartxstayDrafts(tenant.id, [], true)).changed, 0);
    assert.equal(JSON.stringify(await db.select().from(publishedSnapshotsTable).where(eq(publishedSnapshotsTable.tenantId, tenant.id))), snapshot);
    console.log(`DEV copies restored: ${copies.length}; additional translation: 1; repeat: 0; published snapshot unchanged`);
  } finally {
    for (const id of itemIds) await db.delete(translationsTable).where(eq(translationsTable.recordId, id));
    await db.delete(sources).where(eq(sources.tenantId, tenant.id));
    await db.delete(runs).where(eq(runs.tenantId, tenant.id));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
    assert.equal((await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenant.id))).length, 0);
    console.log("Temporary restore tenant: 0");
  }
});
