import test from "node:test";
import { File } from "@google-cloud/storage";
import assert from "node:assert/strict";
import { once } from "node:events";
import { eq, inArray } from "drizzle-orm";
import { db, tenantsTable, sectionsTable, categoriesTable, itemsTable, mediaTable,
  translationsTable, publishedSnapshotsTable, hostMembershipsTable, tenantAliasesTable,
  itemCategoryAttachmentsTable } from "@workspace/db";
import app from "../app";
import { objectStorageClient } from "../lib/objectStorage";
import { getUsedBytes, invalidateMediaUsage } from "../lib/mediaUsage";
import { gpxObjectFile } from "../routes/gpx";
import { seedDuplicateFixture, cleanupDuplicateFixture, assertDev } from "./fixtures/duplicate-project-fixture";

test("duplicate project: complete isolated unpublished copy, authorization, rollback and zero fixtures", async (t) => {
  assertDev();
  const f = await seedDuplicateFixture();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api`;
  const adminCookie = `__Host-s360_admin=${f.token}`;
  async function tree(id: string) {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, id));
    const sections = await db.select().from(sectionsTable).where(eq(sectionsTable.tenantId, id));
    const categories = sections.length ? await db.select().from(categoriesTable).where(inArray(categoriesTable.sectionId, sections.map(x => x.id))) : [];
    const items = categories.length ? await db.select().from(itemsTable).where(inArray(itemsTable.categoryId, categories.map(x => x.id))) : [];
    const itemIds = items.map(x => x.id);
    const media = items.length ? await db.select().from(mediaTable).where(inArray(mediaTable.itemId, itemIds)) : [];
    const sitePlans = await db.select().from(mediaTable).where(eq(mediaTable.tenantId, id));
    const translations = await db.select().from(translationsTable).where(inArray(translationsTable.recordId, [id, ...sections.map(x => x.id), ...categories.map(x => x.id), ...itemIds]));
    return { tenant, sections, categories, items, media, sitePlans, translations };
  }
  const copy = (slug: string, cookie = adminCookie) => fetch(`${base}/admin/tenants/${f.sourceId}/duplicate`, {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ name: "Synthetic destination", slug, copyContent: true }),
  });
  try {
    const before = await tree(f.sourceId);
    const response = await copy(`dup-${f.key}-ok`);
    const body = await response.json() as { tenant: { id: string } };
    assert.equal(response.status, 201, JSON.stringify(body));
    const id = body.tenant.id;
    const after = await tree(id);
    assert.deepEqual(await tree(f.sourceId), before, "source must remain byte-for-byte unchanged");
    for (const key of ["sections", "categories", "items", "media", "sitePlans", "translations"] as const) {
      assert.equal(after[key].length, before[key].length, key);
      assert.ok(after[key].every(row => !before[key].some(original => original.id === row.id)), `${key} IDs must be new`);
    }
    assert.equal(after.tenant.isPublished, false);
    assert.equal(after.tenant.isTemplate, false);
    assert.equal(after.tenant.managementMode, "concierge");
    assert.equal(after.tenant.renewsAt, null);
    assert.equal(after.tenant.rating, null);
    assert.equal(after.tenant.reviewsCount, null);
    assert.equal(after.tenant.theme, before.tenant.theme);
    assert.equal(after.tenant.wifiSsid, before.tenant.wifiSsid);
    assert.equal((await db.select().from(publishedSnapshotsTable).where(eq(publishedSnapshotsTable.tenantId, id))).length, 0);
    assert.equal((await db.select().from(hostMembershipsTable).where(eq(hostMembershipsTable.tenantId, id))).length, 0);
    assert.equal((await db.select().from(tenantAliasesTable).where(eq(tenantAliasesTable.tenantId, id))).length, 0);
    assert.equal((await fetch(`${base}/public/tenants/${after.tenant.slug}`)).status, 404);
    assert.deepEqual(after.items.find(x => x.eventSchedule)?.eventSchedule, before.items.find(x => x.eventSchedule)?.eventSchedule);
    assert.equal(after.items.find(x => x.price)?.price, "12.50");
    const oldTour = before.items.find(x => x.gpxRoute)!.gpxRoute!;
    const newTour = after.items.find(x => x.gpxRoute)!.gpxRoute!;
    assert.notEqual(newTour.fileId, oldTour.fileId);
    const [oldBytes] = await gpxObjectFile("development", f.sourceId, oldTour.fileId).download();
    const [newBytes] = await gpxObjectFile("development", id, newTour.fileId).download();
    assert.deepEqual(newBytes, oldBytes);
    invalidateMediaUsage();
    assert.equal(await getUsedBytes([after.tenant.slug]), await getUsedBytes([f.slug]), "all public + GPX bytes count against new quota");
    const targetPrefix = f.prefix.replace(f.slug, after.tenant.slug);
    const [originalFiles] = await objectStorageClient.bucket(f.bucketName).getFiles({ prefix: f.prefix });
    const [copyFiles] = await objectStorageClient.bucket(f.bucketName).getFiles({ prefix: targetPrefix });
    assert.equal(copyFiles.length, originalFiles.length);
    await copyFiles[0].delete();
    assert.equal((await originalFiles[0].exists())[0], true);
    await originalFiles[1].delete();
    assert.equal((await copyFiles[1].exists())[0], true);
    assert.equal((await copy(after.tenant.slug)).status, 409, "slug collision");
    assert.equal((await copy("admin")).status, 409, "reserved slug");
    const login = await fetch(`${base}/admin/host/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: f.hostEmail, password: f.password }),
    });
    assert.equal(login.status, 200);
    const hostCookie = /__Host-s360_host=[^;]+/.exec(login.headers.get("set-cookie") ?? "")?.[0];
    assert.ok(hostCookie);
    assert.equal((await copy(`dup-${f.key}-forbidden`, hostCookie)).status, 404);
    assert.equal((await fetch(`${base}/admin/tenants/${id}`, { headers: { cookie: hostCookie } })).status, 404);
    await db.update(tenantsTable).set({ managementMode: "concierge" }).where(eq(tenantsTable.id, f.sourceId));
    assert.ok([401, 403, 404].includes((await copy(`dup-${f.key}-forbidden2`, hostCookie)).status));
    // Actual endpoint + actual storage discovery; only a metadata size is
    // exaggerated to exercise admission without uploading gigabytes.
    const getMetadata = File.prototype.getMetadata;
    const metadataMock = t.mock.method(File.prototype, "getMetadata", async function(this: File, ...args: any[]) {
      const result = await (getMetadata as any).apply(this, args);
      if (this.name.startsWith(f.prefix)) result[0] = { ...result[0], size: "2000000001" };
      return result;
    });
    try {
      const quota = await copy(`dup-${f.key}-quota`);
      assert.equal(quota.status, 400);
      assert.match(await quota.text(), /kvota/);
      const [quotaFiles] = await objectStorageClient.bucket(f.bucketName).getFiles({ prefix: f.prefix.replace(f.slug, `dup-${f.key}-quota`) });
      assert.equal(quotaFiles.length, 0, "quota failure before file writes");
      assert.equal((await db.select().from(tenantsTable).where(eq(tenantsTable.slug, `dup-${f.key}-quota`))).length, 0);
    } finally { metadataMock.mock.restore(); }
    // Induce a late transactional failure AFTER file copies: foreign category attachment.
    await db.insert(itemCategoryAttachmentsTable).values({ itemId: before.items[0].id, categoryId: after.categories[0].id });
    const rollbackResponse = await copy(`dup-${f.key}-rollback`);
    assert.equal(rollbackResponse.status, 400);
    assert.equal((await db.select().from(tenantsTable).where(eq(tenantsTable.slug, `dup-${f.key}-rollback`))).length, 0);
    const [leftovers] = await objectStorageClient.bucket(f.bucketName).getFiles({ prefix: f.prefix.replace(f.slug, `dup-${f.key}-rollback`) });
    assert.equal(leftovers.length, 0, "failed copy leaves zero public objects");
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    const proof = await cleanupDuplicateFixture(f);
    assert.equal(proof.remainingTenants, 0);
    console.log("DUPLICATE_CLEANUP", JSON.stringify(proof));
  }
});