import { and, eq, sql } from "drizzle-orm";
import { db, tenantsTable, itemsTable, sectionsTable, categoriesTable, translationsTable,
  smartxstayImportSourcesTable as sources, smartxstayImportRunsTable as runs, changelogTable } from "@workspace/db";
import { cleanupImportedBody, restoredAddressBody } from "./smartxstayCleanupText";
import { importedItemState, contentHash } from "./smartxstayFingerprint";

type Approval = { id: string; token: string; legacyApproved: boolean; keepAddressFields?: string[] };
type Change = ReturnType<typeof cleanupImportedBody> & { field: string; lang: string; afterKeepingAddress: string };
export type CleanupEntry = { id: string; title: string; status: string; reason: string; legacy: boolean; token: string; changes: Change[] };
type Receipt = { hash: string; at: string; legacyApproved: boolean; history?: Change[][]; addressesRestored?: string[] };
type Checkpoint = { contentHashes?: Record<string, string>; cleanupReceipts?: Record<string, Receipt>; [key: string]: unknown };

export async function cleanupSmartxstayDrafts(tenantId: string, approvals?: Approval[], restoreAddresses = false) {
  return db.transaction(async tx => {
    const [tenant] = await tx.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).for("update");
    if (!tenant) throw new Error("Nastanitev ne obstaja.");
    const allRuns = await tx.select().from(runs).where(eq(runs.tenantId, tenantId)).for("update");
    if (allRuns.some(r => ["preparing", "importing"].includes(r.status))) throw new Error("Najprej zaključite ali prekličite aktivni uvoz.");
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
      if (item.deletedAt || category.deletedAt || section.deletedAt) { skip("Vnos ali njegova kategorija/sekcija je v košu."); continue; }
      if (restoreAddresses) {
        if (!receipt?.history?.length) { row.reason = "Ni shranjenega dokaza za obnovo naslova."; continue; }
        let conflict = false;
        for (const batch of receipt.history) for (const change of batch) {
          const restored = restoredAddressBody(change);
          const evidenceKey = contentHash(change);
          if (!restored || receipt.addressesRestored?.includes(evidenceKey)) continue;
          const body = change.field === "body" ? item.body : current.translations.find(t => t.id === change.field && t.field === "body")?.value;
          if (body === restored) continue;
          if (body !== change.after) { conflict = true; continue; }
          row.changes.push({ ...change, before: body, after: restored, afterKeepingAddress: restored,
            operations: ["Vrnjen naslov brez oznake Naslov"], warnings: [] });
        }
        if (conflict) { skip("Besedilo se ne ujema z dokazom čiščenja; potreben je ročni pregled, nič ni prepisano."); continue; }
        if (!row.changes.length) { row.reason = "Ni naslovov za obnovo."; continue; }
        for (const change of row.changes) {
          if (change.field === "body") {
            await tx.update(itemsTable).set({ body: change.after }).where(eq(itemsTable.id, item.id));
            item.body = change.after;
          } else await tx.update(translationsTable).set({ value: change.after }).where(eq(translationsTable.id, change.field));
        }
        receipt.addressesRestored = [...new Set([...(receipt.addressesRestored ?? []),
          ...receipt.history.flat().filter(c => restoredAddressBody(c) !== null).map(c => contentHash(c))])];
        receipt.hash = (await importedItemState(tx, item)).hash;
        await tx.update(runs).set({ checkpoint }).where(eq(runs.id, run.id));
        run.checkpoint = checkpoint;
        row.status = "changed"; row.reason = "Naslov vrnjen v osnutek — za goste velja po ponovni objavi.";
        continue;
      }
      if ((receipt && current.hash !== receipt.hash) || (!receipt && baseline && current.hash !== baseline)) {
        skip("Vsebina je bila po uvozu/čiščenju spremenjena; ohranjena brez posega."); continue;
      }
      const add = (body: string, lang: string, field: string) => {
        const result = cleanupImportedBody(body, lang, category.label, item.mapQuery);
        if (result.after !== body || result.warnings.length) row.changes.push({ ...result, field, lang,
          afterKeepingAddress: cleanupImportedBody(body, lang, category.label, item.mapQuery, false).after });
      };
      if (item.body) add(item.body, "sl", "body");
      for (const translation of current.translations) if (translation.field === "body") add(translation.value, translation.lang, translation.id);
      row.token = contentHash({ hash: current.hash, category: category.label, changes: row.changes, baseline, receipt });
      if (!row.changes.some(c => c.before !== c.after)) { row.reason = "Ni varnih sprememb."; continue; }
      row.status = "ready";
      row.reason = row.legacy ? "Stari uvoz brez kontrolne vsote: preglejte razlike pred potrditvijo." : "Kontrolna vsota se ujema z uvozom.";
      if (!approvals) continue;
      const approval = approvals.find(a => a.id === item.id);
      if (!approval) { skip("Ni izbran za čiščenje."); continue; }
      if (approval.token !== row.token) { skip("Vsebina se je po predogledu spremenila. Ponovno preglejte razlike."); continue; }
      if (row.legacy && !approval.legacyApproved) { skip("Manjka izrecna ročna odobritev starega uvoza."); continue; }
      row.changes = row.changes.map(c => approval.keepAddressFields?.includes(c.field) ? {
        ...c, after: c.afterKeepingAddress,
        operations: c.operations.filter(op => !/naslov/i.test(op)), warnings: [],
      } : c);
      const appliedChanges = row.changes.filter(c => c.before !== c.after);
      if (!appliedChanges.length) { row.status = "untouched"; row.reason = "Ni izbranih sprememb."; continue; }
      for (const change of appliedChanges) {
        if (change.field === "body") {
          await tx.update(itemsTable).set({ body: change.after }).where(eq(itemsTable.id, item.id));
          item.body = change.after;
        } else await tx.update(translationsTable).set({ value: change.after }).where(eq(translationsTable.id, change.field));
      }
      checkpoint.cleanupReceipts ??= {};
      checkpoint.cleanupReceipts[item.id] = { hash: (await importedItemState(tx, item)).hash, at: new Date().toISOString(), legacyApproved: row.legacy,
        history: [...(receipt?.history ?? []), appliedChanges] };
      // Preserve every unrelated checkpoint key; no schema or baseline rewrite.
      await tx.update(runs).set({ checkpoint }).where(eq(runs.id, run.id));
      run.checkpoint = checkpoint;
      row.status = "changed"; row.reason = "Spremembe so v osnutku — za goste veljajo po ponovni objavi.";
    }
    const counts = {
      changed: entries.filter(x => x.status === "changed").length,
      skipped: entries.filter(x => x.status === "skipped").length,
      untouched: entries.filter(x => x.status === "untouched").length,
      ready: entries.filter(x => x.status === "ready").length,
    };
    if (counts.changed) {
      await tx.update(tenantsTable).set({ hasUnpublishedChanges: true, operatorDraftPending: true }).where(eq(tenantsTable.id, tenantId));
      await tx.insert(changelogTable).values({ tenantId, action: "update", entity: "content", actorType: "owner", summary: `${restoreAddresses ? "Obnova naslovov" : "Čiščenje uvoženih osnutkov"}: ${counts.changed} vnosov` });
    }
    return { entries, ...counts };
  }, { isolationLevel: "serializable" });
}
