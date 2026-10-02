import { randomUUID, randomBytes, createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { db, tenantsTable, sectionsTable, categoriesTable, itemsTable, mediaTable,
  translationsTable, pluralFormsTable, itemCategoryAttachmentsTable, adminUsersTable,
  adminSessionsTable, hostUsersTable, hostMembershipsTable, tenantSlugReservationsTable, changelogTable } from "@workspace/db";
import { ObjectStorageService, objectStorageClient } from "../../lib/objectStorage";
import { gpxObjectFile } from "../../routes/gpx";
import { parseGpx } from "../../lib/gpxParser";
import { hashPassword } from "../../lib/hostAuth";
import { replacePublishedSnapshot } from "../../lib/publishedSnapshots";
import { cleanupIncompleteCopy } from "../../lib/tenantCopyRecovery";

export function assertDev() {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw new Error("Development fixture only");
}
export async function seedDuplicateFixture() {
  assertDev();
  const key = randomUUID().slice(0, 8);
  const slug = `duplicate-fixture-${key}`;
  const token = randomBytes(32).toString("base64url");
  const [admin] = await db.insert(adminUsersTable).values({ email: `duplicate-${key}@example.test`, displayName: "Temporary duplication test" }).returning();
  const [session] = await db.insert(adminSessionsTable).values({
    tokenHash: createHash("sha256").update(token).digest("hex"), userAgent: `duplicate-fixture-${key}`,
    expiresAt: new Date(Date.now() + 3600_000),
  }).returning();
  const password = randomBytes(24).toString("base64url");
  const [host] = await db.insert(hostUsersTable).values({ email: `duplicate-host-${key}@example.test`, passwordHash: await hashPassword(password) }).returning();
  const [tenant] = await db.insert(tenantsTable).values({
    slug, name: `TEST podvajanje ${key}`, isPublished: true, managementMode: "self_service",
    isTemplate: true, rating: "4.8", reviewsCount: "100", renewsAt: new Date("2030-01-01"),
    wifiSsid: "Synthetic WiFi", wifiPass: "synthetic-only", theme: "poteg",
  }).returning();
  await db.insert(hostMembershipsTable).values({ tenantId: tenant.id, hostUserId: host.id });
  const [section] = await db.insert(sectionsTable).values({ tenantId: tenant.id, key: "stay", title: "Sintetična sekcija", groupOrder: ["custom"] }).returning();
  const categories = await db.insert(categoriesTable).values([
    { sectionId: section.id, key: "custom-a", label: "Termini", layout: "text" },
    { sectionId: section.id, key: "custom-b", label: "Ture", layout: "text" },
  ]).returning();
  const original = Buffer.from('<gpx version="1.1"><trk><trkseg><trkpt lat="46.12" lon="14.21"><ele>200</ele></trkpt><trkpt lat="46.13" lon="14.22"><ele>205</ele></trkpt></trkseg></trk></gpx>');
  const fileId = randomUUID();
  await gpxObjectFile("development", tenant.id, fileId).save(original, { resumable: false });
  const items = await db.insert(itemsTable).values([
    { categoryId: categories[0].id, title: "Sintetični dogodek", body: "<p>Opis dogodka</p>", price: "12.50", priceUnit: "oseba", eventSchedule: { type: "weekly", days: ["mon"], timeFrom: "10:00", timeTo: "11:00" } },
    { categoryId: categories[1].id, title: "Sintetična tura", body: "Opis ture", gpxRoute: {
      ...parseGpx(original, "hiking"), version: 1, fileId, filename: "synthetic.gpx", environment: "development",
      byteSize: original.length, sha256: createHash("sha256").update(original).digest("hex"), activity: "hiking",
    } },
  ]).returning();
  await db.insert(itemCategoryAttachmentsTable).values({ itemId: items[0].id, categoryId: categories[1].id });
  const path = new ObjectStorageService().getPublicObjectSearchPaths()[0].replace(/^\/|\/$/g, "").split("/");
  const bucketName = path.shift()!;
  const prefix = `${path.join("/")}/media/${slug}/`;
  const image = await sharp({ create: { width: 320, height: 200, channels: 3, background: "#157347" } }).jpeg().toBuffer();
  for (const name of ["first.jpg", "second.jpg"]) for (const width of ["620", "1400"]) {
    await objectStorageClient.bucket(bucketName).file(`${prefix}${width}/${name}`).save(image, { resumable: false, metadata: { contentType: "image/jpeg" } });
  }
  await db.insert(mediaTable).values([
    { itemId: items[0].id, url: `/api/storage/img/${slug}/first.jpg` },
    { itemId: items[1].id, url: `/api/storage/img/${slug}/second.jpg` },
    { tenantId: tenant.id, itemId: null, purpose: "site-plan", url: `/api/storage/img/${slug}/first.jpg` },
  ]);
  await db.update(tenantsTable).set({ heroUrl: `/api/storage/img/${slug}/first.jpg` }).where(eq(tenantsTable.id, tenant.id));
  const refs = [{ model: "tenant", id: tenant.id, field: "subtitle" }, { model: "section", id: section.id, field: "title" },
    ...categories.map(row => ({ model: "category", id: row.id, field: "label" })),
    ...items.map(row => ({ model: "item", id: row.id, field: "body" })),
    { model: "ui", id: tenant.id, field: "UI.test" }];
  await db.insert(translationsTable).values(refs.flatMap(ref => ["en", "de", "it"].map(lang => ({
    model: ref.model, recordId: ref.id, field: ref.field, lang, value: `${lang} synthetic text`,
  }))));
  await db.insert(pluralFormsTable).values({ tenantId: tenant.id, lang: "sl", key: "custom", form: "other", value: "{n} testov" });
  await replacePublishedSnapshot(tenant);
  return { key, slug, sourceId: tenant.id, adminId: admin.id, sessionId: session.id, token,
    hostId: host.id, hostEmail: host.email, password, bucketName, prefix, sourceFileId: fileId };
}
export type DuplicateFixture = Awaited<ReturnType<typeof seedDuplicateFixture>>;
export async function cleanupDuplicateFixture(f: DuplicateFixture) {
  assertDev();
  const all = await db.select().from(tenantsTable);
  const tenants = all.filter(t => t.id === f.sourceId || t.copiedFromTenantId === f.sourceId || t.slug.startsWith(`dup-${f.key}`));
  for (const tenant of tenants) {
    if (tenant.copyState === "copying") {
      await cleanupIncompleteCopy(tenant.id);
      continue;
    }
    const sections = await db.select().from(sectionsTable).where(eq(sectionsTable.tenantId, tenant.id));
    const categories = sections.length ? await db.select().from(categoriesTable).where(inArray(categoriesTable.sectionId, sections.map(r => r.id))) : [];
    const items = categories.length ? await db.select().from(itemsTable).where(inArray(itemsTable.categoryId, categories.map(r => r.id))) : [];
    await db.delete(translationsTable).where(inArray(translationsTable.recordId, [tenant.id, ...sections.map(r => r.id), ...categories.map(r => r.id), ...items.map(r => r.id)]));
    for (const item of items) if (item.gpxRoute) await gpxObjectFile("development", tenant.id, item.gpxRoute.fileId).delete({ ignoreNotFound: true });
    await db.delete(tenantSlugReservationsTable).where(eq(tenantSlugReservationsTable.tenantId, tenant.id));
    await db.delete(changelogTable).where(eq(changelogTable.tenantId, tenant.id));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
  }
  const [files] = await objectStorageClient.bucket(f.bucketName).getFiles({ prefix: f.prefix.split("/media/")[0] + "/media/" });
  const owned = files.filter(file => {
    const part = file.name.split("/media/")[1]?.split("/")[0];
    return part === f.slug || part?.startsWith(`dup-${f.key}`);
  });
  for (const file of owned) await file.delete({ ignoreNotFound: true });
  await db.delete(hostUsersTable).where(eq(hostUsersTable.id, f.hostId));
  await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, f.sessionId));
  await db.delete(adminUsersTable).where(eq(adminUsersTable.id, f.adminId));
  const remaining = (await db.select().from(tenantsTable)).filter(t => t.id === f.sourceId || t.copiedFromTenantId === f.sourceId || t.slug.startsWith(`dup-${f.key}`));
  if (remaining.length) throw new Error("Synthetic tenants remain after cleanup");
  const remainingAdmins = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, f.adminId));
  const remainingSessions = await db.select().from(adminSessionsTable).where(eq(adminSessionsTable.id, f.sessionId));
  const remainingHosts = await db.select().from(hostUsersTable).where(eq(hostUsersTable.id, f.hostId));
  const [publicAfter] = await objectStorageClient.bucket(f.bucketName).getFiles({ prefix: f.prefix.split("/media/")[0] + "/media/" });
  const remainingFiles = publicAfter.filter(file => {
    const part = file.name.split("/media/")[1]?.split("/")[0];
    return part === f.slug || part?.startsWith(`dup-${f.key}`);
  });
  let remainingGpx = 0;
  for (const tenant of tenants) {
    const sample = gpxObjectFile("development", tenant.id, f.sourceFileId);
    const [privateAfter] = await sample.bucket.getFiles({ prefix: sample.name.slice(0, sample.name.lastIndexOf("/") + 1) });
    remainingGpx += privateAfter.length;
  }
  if (remainingAdmins.length + remainingSessions.length + remainingHosts.length + remainingFiles.length + remainingGpx) throw new Error("Synthetic account or files remain");
  return { remainingTenants: remaining.length, remainingAdmins: remainingAdmins.length, remainingSessions: remainingSessions.length,
    remainingHosts: remainingHosts.length, remainingPublicFiles: remainingFiles.length, remainingGpx, removedPublicFiles: owned.length };
}