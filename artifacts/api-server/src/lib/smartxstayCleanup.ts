import { and, eq, sql } from "drizzle-orm";
import { db, tenantsTable, itemsTable, sectionsTable, categoriesTable, translationsTable,
  smartxstayImportSourcesTable as sources, smartxstayImportRunsTable as runs, publishedSnapshotsTable, changelogTable } from "@workspace/db";
import { cleanupImportedBody } from "./smartxstayCleanupText";
import { importedItemState, contentHash } from "./smartxstayFingerprint";

type Approval = { id: string; token: string; legacyApproved: boolean };
type Change = ReturnType<typeof cleanupImportedBody> & { field: string; lang: string };
export type CleanupEntry = { id: string; title: string; status: string; reason: string; legacy: boolean; token: string; changes: Change[] };
type Receipt = { hash: string; at: string; legacyApproved: boolean };
type Checkpoint = { contentHashes?: Record<string, string>; cleanupReceipts?: Record<string, Receipt>; [key: string]: unknown };
// Snapshot IDs are immutable published references. Never modify a published entry,
// even if the mutable draft currently hides it or has moved it elsewhere.
function snapshotIds(value: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach(x => snapshotIds(x, ids));
  else if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.id === "string") ids.add(row.id);
    Object.values(row).forEach(x => snapshotIds(x, ids));
  }
  return ids;
}

export async function cleanupSmartxstayDrafts(tenantId: string, approvals?: Approval[]) {
  return db.transaction(async tx => {
    const [tenant] = await tx.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).for("update");
    if (!tenant) throw new Error("Nastanitev ne obstaja.");
    const allRuns = await tx.select().from(runs).where(eq(runs.tenantId, tenantId)).for("update");
    if (allRuns.some(r => ["preparing", "importing"].includes(r.status))) throw new Error("Najprej zaključite ali prekličite aktivni uvoz.");
    const [snapshot] = await tx.select().from(publishedSnapshotsTable).where(eq(publishedSnapshotsTable.tenantId, tenantId));
    const published = snapshotIds(snapshot?.content);
    const tracked = await tx.select({ source: sources, item: itemsTable, category: categoriesTable, section: sectionsTable }).from(sources)
      .innerJoin(itemsTable, eq(itemsTable.id, sources.itemId))
      .innerJoin(categoriesTable, eq(categoriesTable.id, itemsTable.categoryId))
      .innerJoin(sectionsTable, eq(sectionsTable.id, categoriesTable.sectionId))
      .where(and(eq(sources.tenantId, tenantId), eq(sectionsTable.tenantId, tenantId)))
      .for("update");
    const entries: CleanupEntry[] = [];
    for (const { source, item, category, section } of tracked) {
      const run = allRuns.find(r => r.id === source.runId)!;
      const checkpoint = (run.checkpoint || {}) as Checkpoint;
      const baseline = checkpoint.contentHashes?.[item.id];
      const receipt = checkpoint.cleanupReceipts?.[item.id];
      const current = await importedItemState(tx, item);
      const row: CleanupEntry = { id: item.id, title: item.title || "(brez naslova)", status: "untouched", reason: "", legacy: !baseline && !receipt, token: "", changes: [] };
      entries.push(row);
      const skip = (reason: string) => { row.status = "skipped"; row.reason = reason; };
      if (published.has(item.id) || (tenant.isPublished && !snapshot)) { skip("Objavljen vnos — čiščenje je dovoljeno samo za neobjavljene osnutke."); continue; }
      if (item.deletedAt || category.deletedAt || section.deletedAt) { skip("Vnos ali njegova kategorija/sekcija je v košu."); continue; }
      if ((receipt && current.hash !== receipt.hash) || (!receipt && baseline && current.hash !== baseline)) {
        skip("Vsebina je bila po uvozu/čiščenju spremenjena; ohranjena brez posega."); continue;
      }
      if (receipt && current.hash === receipt.hash) { row.reason = "Že počiščeno."; continue; }
      const add = (body: string, lang: string, field: string) => {
        const result = cleanupImportedBody(body, lang, category.label, item.mapQuery);
        if (result.after !== body || result.warnings.length) row.changes.push({ ...result, field, lang });
      };
      if (item.body) add(item.body, "sl", "body");
      for (const translation of current.translations) if (translation.field === "body") add(translation.value, translation.lang, translation.id);
      row.token = contentHash({ hash: current.hash, category: category.label, changes: row.changes, baseline, receipt });
      if (!row.changes.some(c => c.before !== c.after)) { row.reason = "Ni varnih sprememb."; continue; }
      row.status = "ready";
      row.reason = row.legacy ? "Stari uvoz brez kontrolne vsote: obvezen ločen pregled in ročna odobritev." : "Kontrolna vsota se ujema z uvozom.";
      if (!approvals) continue;
      const approval = approvals.find(a => a.id === item.id);
      if (!approval) { skip("Ni izbran za čiščenje."); continue; }
      if (approval.token !== row.token) { skip("Vsebina se je po predogledu spremenila. Ponovno preglejte razlike."); continue; }
      if (row.legacy && !approval.legacyApproved) { skip("Manjka izrecna ročna odobritev starega uvoza."); continue; }
      for (const change of row.changes.filter(c => c.before !== c.after)) {
        if (change.field === "body") {
          await tx.update(itemsTable).set({ body: change.after }).where(eq(itemsTable.id, item.id));
          item.body = change.after;
        } else await tx.update(translationsTable).set({ value: change.after }).where(eq(translationsTable.id, change.field));
      }
      checkpoint.cleanupReceipts ??= {};
      checkpoint.cleanupReceipts[item.id] = { hash: (await importedItemState(tx, item)).hash, at: new Date().toISOString(), legacyApproved: row.legacy };
      // Preserve every unrelated checkpoint key; no schema or baseline rewrite.
      await tx.update(runs).set({ checkpoint }).where(eq(runs.id, run.id));
      run.checkpoint = checkpoint;
      row.status = "changed"; row.reason = "Osnutek počiščen; nič ni objavljeno.";
    }
    const counts = {
      changed: entries.filter(x => x.status === "changed").length,
      skipped: entries.filter(x => x.status === "skipped").length,
      untouched: entries.filter(x => x.status === "untouched").length,
      ready: entries.filter(x => x.status === "ready").length,
    };
    if (counts.changed) {
      await tx.update(tenantsTable).set({ hasUnpublishedChanges: true, operatorDraftPending: true }).where(eq(tenantsTable.id, tenantId));
      await tx.insert(changelogTable).values({ tenantId, action: "update", entity: "content", actorType: "owner", summary: `Čiščenje uvoženih osnutkov: ${counts.changed} vnosov` });
    }
    return { entries, ...counts };
  }, { isolationLevel: "serializable" });
}
