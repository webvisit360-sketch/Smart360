import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, tenantsTable, smartxstayImportRunsTable as runs, smartxstayImportSourcesTable as sources, translationsTable, sectionsTable, categoriesTable, changelogTable } from "@workspace/db";
import { startSmartxstayImport, stepSmartxstayImport } from "../lib/smartxstayImport";
import { fixtureIO } from "./helpers/smartxstay-step-worker";
import sharp from "sharp";
import { storePhotoVariants, deletePhotoVariants, IMG_WIDTHS } from "../routes/storage";
import { ObjectStorageService, importObjectStorageClient } from "../lib/objectStorage";

test("request-owned import survives a NEW PROCESS for EVERY step; cancellation, cleanup retry, fencing and deduplication", { timeout: 180000 }, async () => {
  const [tenant] = await db.insert(tenantsTable).values({ slug: `import-resume-${randomUUID()}`, name: "Synthetic resumable import" }).returning();
  const get = async (id: string) => (await db.select().from(runs).where(eq(runs.id, id)))[0];
  try {
    const id = await startSmartxstayImport(tenant.id, "https://app.smartxstay.com/gen/s/fixture");
    assert.deepEqual((await get(id)).report, { entries: 0, sections: 0, categories: 0, images: 0, bytes: 0, sourceBytes: 0, languages: {}, groups: {}, skipped: [] });
    await assert.rejects(startSmartxstayImport(tenant.id, "https://app.smartxstay.com/gen/s/fixture"), /že poteka/);
    let steps = 0;
    while ((await get(id)).status !== "completed" && steps++ < 16) {
      await promisify(execFile)(process.execPath, ["--import", "tsx/esm", "src/tests/helpers/smartxstay-step-worker.ts", "--worker", id, tenant.id], { timeout: 25000 });
      assert.ok(Number(((await get(id)).report as any).sourceBytes) > 0);
    }
    const done = await get(id);
    assert.equal(done.status, "completed");
    assert.equal((done.report as any).entries, 2);
    assert.equal((done.report as any).images, 1);
    console.log(`NEW PROCESS per step: ${steps} requests, completed, sourceBytes=${(done.report as any).sourceBytes}, entries=2, images=1`);
    const second = await startSmartxstayImport(tenant.id, "https://app.smartxstay.com/gen/s/fixture");
    for (let i = 0; i < 12 && (await get(second)).status !== "completed"; i++) await stepSmartxstayImport(second, tenant.id, false, fixtureIO);
    assert.equal((await get(second)).status, "completed");
    assert.equal(((await get(second)).report as any).entries, 0);
    const [referenced] = await db.insert(runs).values({ tenantId: tenant.id, sourceUrl: "https://app.smartxstay.com/gen/s/fixture", status: "importing", objectManifest: done.objectManifest }).returning();
    await stepSmartxstayImport(referenced.id, tenant.id, true, { ...fixtureIO, remove: async () => { assert.fail("Referenced draft image must not be deleted"); } });
    await stepSmartxstayImport(referenced.id, tenant.id, false, fixtureIO);
    assert.equal((await get(referenced.id)).status, "failed");

    const [stuck] = await db.insert(runs).values({ tenantId: tenant.id, sourceUrl: "https://app.smartxstay.com/gen/s/fixture", status: "importing", objectManifest: [{ slug: tenant.slug, name: "partial.jpg" }] }).returning();
    await assert.rejects(stepSmartxstayImport(stuck.id, tenant.id, false, fixtureIO), /Stari/);
    await assert.rejects(stepSmartxstayImport(stuck.id, randomUUID(), true, fixtureIO), /ne obstaja/);
    await assert.rejects(stepSmartxstayImport(stuck.id, tenant.id, true, { ...fixtureIO, remove: async () => { throw new Error("synthetic storage unavailable"); } }), /storage unavailable/);
    assert.equal((await get(stuck.id)).status, "importing");
    assert.equal(((await get(stuck.id)).objectManifest as any[]).length, 1);
    const removed: string[] = [];
    await stepSmartxstayImport(stuck.id, tenant.id, false, { ...fixtureIO, remove: async (_, name) => { removed.push(name); } });
    await stepSmartxstayImport(stuck.id, tenant.id, false, fixtureIO);
    assert.deepEqual(removed, ["partial.jpg"]);
    assert.equal((await get(stuck.id)).status, "failed");
    assert.deepEqual((await get(stuck.id)).objectManifest, []);
    const retry = await startSmartxstayImport(tenant.id, "https://app.smartxstay.com/gen/s/fixture");
    let unblock!: () => void;
    let entered!: () => void;
    const entry = new Promise<void>(r => { entered = r; });
    const blocked = new Promise<void>(r => { unblock = r; });
    const worker = stepSmartxstayImport(retry, tenant.id, false, { ...fixtureIO, fetch: async (...args) => { entered(); await blocked; return fixtureIO.fetch(...args); } });
    await entry;
    try {
      assert.deepEqual(await stepSmartxstayImport(retry, tenant.id, false, fixtureIO), { busy: true });
      assert.deepEqual(await stepSmartxstayImport(retry, tenant.id, true, fixtureIO), { busy: true });
    } finally { unblock(); await worker; }
    await stepSmartxstayImport(retry, tenant.id, true, fixtureIO);
    assert.equal((await get(retry)).status, "failed");
    console.log("Synthetic legacy cancellation: failed cleanup retained manifest; retry cleaned; active index released; concurrent worker/cancel fenced.");
  } finally {
    const items = await db.select().from(sources).where(eq(sources.tenantId, tenant.id));
    const sections = await db.select().from(sectionsTable).where(eq(sectionsTable.tenantId, tenant.id));
    const cats = sections.length ? await db.select().from(categoriesTable).where(inArray(categoriesTable.sectionId, sections.map(s => s.id))) : [];
    const ids = [...items.map(i => i.itemId!).filter(Boolean), ...sections.map(s => s.id), ...cats.map(c => c.id)];
    if (ids.length) await db.delete(translationsTable).where(inArray(translationsTable.recordId, ids));
    await db.delete(sources).where(eq(sources.tenantId, tenant.id));
    await db.delete(runs).where(eq(runs.tenantId, tenant.id));
    await db.delete(changelogTable).where(eq(changelogTable.tenantId, tenant.id));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
  }
});

test("real object storage: legacy manifest cancellation deletes both exact variants and frees the index", { timeout: 90000 }, async () => {
  const [tenant] = await db.insert(tenantsTable).values({ slug: `import-storage-${randomUUID()}`, name: "Synthetic storage cleanup" }).returning();
  const name = `smartxstay-${randomUUID()}.jpg`;
  const path = new ObjectStorageService().getPublicObjectSearchPaths()[0].replace(/^\/+/, "").split("/");
  const bucket = path.shift()!;
  const files = IMG_WIDTHS.map(w => importObjectStorageClient.bucket(bucket).file(`${path.join("/")}/media/${tenant.slug}/${w}/${name}`));
  try {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "blue" } }).png().toBuffer();
    await storePhotoVariants(tenant.slug, name, png, true);
    for (const file of files) assert.equal((await file.exists())[0], true);
    const [run] = await db.insert(runs).values({ tenantId: tenant.id, sourceUrl: "https://app.smartxstay.com/gen/s/fixture", status: "importing", objectManifest: [{ slug: tenant.slug, name }] }).returning();
    await stepSmartxstayImport(run.id, tenant.id, true);
    await stepSmartxstayImport(run.id, tenant.id);
    assert.equal((await db.select().from(runs).where(eq(runs.id, run.id)))[0].status, "failed");
    for (const file of files) assert.equal((await file.exists())[0], false);
    await startSmartxstayImport(tenant.id, "https://app.smartxstay.com/gen/s/fixture");
    console.log("REAL storage: 2 variants existed, cancellation removed both, new import accepted.");
  } finally {
    await deletePhotoVariants(tenant.slug, name, undefined, true);
    await db.delete(runs).where(eq(runs.tenantId, tenant.id));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
  }
});
