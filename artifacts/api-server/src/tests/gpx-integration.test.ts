import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { eq } from "drizzle-orm";
import { db, tenantsTable, sectionsTable, categoriesTable, itemsTable, publishedSnapshotsTable, hostUsersTable, hostMembershipsTable } from "@workspace/db";
import app from "../app";
import { gpxAttachmentHeader, gpxEnvironment, gpxObjectFile, isBoundedGpxRoute, publishedGpxForItem } from "../routes/gpx";
import { readPublishedContent, replacePublishedSnapshot } from "../lib/publishedSnapshots";
import { hashPassword } from "../lib/hostAuth";

const original = Buffer.from('<?xml version="1.0"?><gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="46.12" lon="14.21"><ele>200</ele></trkpt><trkpt lat="46.13" lon="14.22"><ele>205</ele></trkpt></trkseg></trk></gpx>');

test("published GPX remains byte-identical across draft replacement and deletion; rejects foreign tenant/environment", async (t) => {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw new Error("Fixture writes forbidden in production");
  if (!process.env.DATABASE_URL || !process.env.PRIVATE_OBJECT_DIR) return t.skip("Development DB/private object storage unavailable");
  const stamp = randomUUID();
  const tenants: string[] = [];
  const objects: Array<ReturnType<typeof gpxObjectFile>> = [];
  const password = `gpx-fixture-${stamp}`;
  const [host] = await db.insert(hostUsersTable).values({
    email: `gpx-${stamp}@example.test`, passwordHash: await hashPassword(password),
  }).returning();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const base = `http://127.0.0.1:${addr.port}/api`;
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const object of objects) await object.delete({ ignoreNotFound: true });
    for (const tenantId of tenants) await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    await db.delete(hostUsersTable).where(eq(hostUsersTable.id, host.id));
  });
  async function fixture(name: string) {
    const [tenant] = await db.insert(tenantsTable).values({
      slug: `gpx-${name}-${stamp}`, name: `GPX fixture ${name}`, isPublished: true,
    }).returning();
    tenants.push(tenant.id);
    const [section] = await db.insert(sectionsTable).values({ tenantId: tenant.id, key: "explore", title: "Explore" }).returning();
    const [category] = await db.insert(categoriesTable).values({ sectionId: section.id, label: "Trails" }).returning();
    const [item] = await db.insert(itemsTable).values({ categoryId: category.id, title: "Trail" }).returning();
    await replacePublishedSnapshot(tenant);
    return { tenant, item };
  }
  const a = await fixture("a");
  const b = await fixture("b");
  await db.insert(hostMembershipsTable).values({ hostUserId: host.id, tenantId: a.tenant.id });
  const login = await fetch(`${base}/admin/host/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: host.email, password }),
  });
  assert.equal(login.status, 200);
  const hostCookie = /__Host-s360_host=[^;]+/.exec(login.headers.get("set-cookie") ?? "")?.[0];
  assert.ok(hostCookie);
  const guest = (fileId: string, slug = a.tenant.slug, itemId = a.item.id) =>
    fetch(`${base}/public/tenants/${slug}/items/${itemId}/gpx/${fileId}`);
  const upload = (itemId: string, bytes: Buffer, filename = "route.gpx") => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type: "application/gpx+xml" }), filename);
    form.append("activity", "hiking");
    return fetch(`${base}/admin/items/${itemId}/gpx`, {
      method: "POST", headers: { cookie: hostCookie }, body: form,
    });
  };
  const forbidden = new FormData();
  forbidden.append("file", new Blob([new Uint8Array(original)]), "route.gpx");
  forbidden.append("activity", "cycling");
  assert.equal((await fetch(`${base}/admin/items/${b.item.id}/gpx`, {
    method: "POST", headers: { cookie: hostCookie }, body: forbidden,
  })).status, 404, "host must not upload to another tenant");
  assert.equal((await fetch(`${base}/admin/items/${a.item.id}`, {
    method: "PATCH", headers: { cookie: hostCookie, "content-type": "application/json" },
    body: JSON.stringify({ gpxRoute: { fileId: randomUUID() } }),
  })).status, 400, "ordinary item patch cannot forge a route");
  const invalidActivity = new FormData();
  invalidActivity.append("file", new Blob([new Uint8Array(original)]), "route.gpx");
  invalidActivity.append("activity", "running");
  const invalidResponse = await fetch(`${base}/admin/items/${a.item.id}/gpx`, {
    method: "POST", headers: { cookie: hostCookie }, body: invalidActivity,
  });
  assert.equal(invalidResponse.status, 400);
  assert.match((await invalidResponse.json() as { error: string }).error, /dejavnost/);
  const oversized = new FormData();
  oversized.append("file", new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]), "huge.gpx");
  oversized.append("activity", "hiking");
  const oversizedResponse = await fetch(`${base}/admin/items/${a.item.id}/gpx`, {
    method: "POST", headers: { cookie: hostCookie }, body: oversized,
  });
  assert.equal(oversizedResponse.status, 413);
  assert.match((await oversizedResponse.json() as { error: string }).error, /presega omejitev/);
  const firstResponse = await upload(a.item.id, original, "Pot čez gozd.gpx");
  assert.equal(firstResponse.status, 200, await firstResponse.clone().text());
  const first = await firstResponse.json();
  assert.ok(isBoundedGpxRoute(first));
  assert.equal(first.filename, "Pot čez gozd.gpx");
  objects.push(gpxObjectFile(gpxEnvironment(), a.tenant.id, first.fileId));
  assert.equal((await guest(first.fileId)).status, 404, "draft upload must not leak");
  await replacePublishedSnapshot(a.tenant);
  const firstDownload = await guest(first.fileId);
  assert.equal(firstDownload.headers.get("content-disposition"), gpxAttachmentHeader(first.filename));
  assert.deepEqual(Buffer.from(await firstDownload.arrayBuffer()), original);
  assert.equal((await guest(first.fileId, b.tenant.slug)).status, 404);
  assert.equal((await guest(first.fileId, a.tenant.slug, b.item.id)).status, 404);

  const changed = Buffer.concat([original, Buffer.from("\n")]);
  const secondResponse = await upload(a.item.id, changed);
  assert.equal(secondResponse.status, 200);
  const second = await secondResponse.json();
  assert.ok(isBoundedGpxRoute(second));
  objects.push(gpxObjectFile(gpxEnvironment(), a.tenant.id, second.fileId));
  assert.equal((await guest(second.fileId)).status, 404, "replacement waits for publication");
  assert.deepEqual(Buffer.from(await (await guest(first.fileId)).arrayBuffer()), original);
  await replacePublishedSnapshot(a.tenant);
  assert.equal((await guest(first.fileId)).status, 404, "old file loses access on replacement publication");
  assert.deepEqual(Buffer.from(await (await guest(second.fileId)).arrayBuffer()), changed);
  const deleted = await fetch(`${base}/admin/items/${a.item.id}/gpx`, {
    method: "DELETE", headers: { cookie: hostCookie },
  });
  assert.equal(deleted.status, 204);
  assert.deepEqual(Buffer.from(await (await guest(second.fileId)).arrayBuffer()), changed,
    "deleting draft must not remove published original");
  await replacePublishedSnapshot(a.tenant);
  assert.equal((await guest(second.fileId)).status, 404);

  // A mismatched environment in a published snapshot must never resolve
  // into another environment's private object partition.
  const snapshot = await readPublishedContent(a.tenant.id);
  const fake = structuredClone(snapshot);
  const item = fake.languages.sl!.tree.sections[0]!.categories[0]!.items[0]!;
  item.gpxRoute = { ...second, environment: "production" };
  assert.equal(publishedGpxForItem(fake, a.item.id, second.fileId)?.environment, "production");
  await db.update(publishedSnapshotsTable).set({ content: fake as unknown as Record<string, unknown> })
    .where(eq(publishedSnapshotsTable.tenantId, a.tenant.id));
  assert.equal((await guest(second.fileId)).status, 404);
});

test("untrusted snapshot route rejects oversized geometry and malformed metadata", () => {
  const valid = {
    version: 1, fileId: randomUUID(), filename: "route.gpx", environment: "development",
    byteSize: original.length, sha256: createHash("sha256").update(original).digest("hex"),
    activity: "cycling", segments: [[{ lat: 46, lon: 14 }, { lat: 46.1, lon: 14.1 }]], profile: [{ distanceKm: 0, elevationM: null, segment: 0 }],
    distanceKm: 0, ascentM: null, descentM: null, minElevationM: null, maxElevationM: null, durationMinutes: null,
  };
  assert.equal(isBoundedGpxRoute(valid), true);
  assert.equal(isBoundedGpxRoute({ ...valid, segments: [] }), false);
  assert.equal(isBoundedGpxRoute({ ...valid, segments: [[{ lat: 46, lon: 14 }]] }), false);
  assert.equal(isBoundedGpxRoute({ ...valid, segments: Array.from({ length: 101 }, () => []) }), false);
  assert.equal(isBoundedGpxRoute({ ...valid, segments: Array.from({ length: 3 }, () =>
    Array.from({ length: 134 }, () => ({ lat: 46, lon: 14 }))) }), false);
  assert.equal(isBoundedGpxRoute({ ...valid, segments: [Array.from({ length: 401 }, () => ({ lat: 46, lon: 14 }))] }), false);
  assert.equal(isBoundedGpxRoute({ ...valid, profile: Array.from({ length: 301 }, () => ({ distanceKm: 0, elevationM: null, segment: 0 })) }), false);
  assert.equal(isBoundedGpxRoute({ ...valid, byteSize: 5242881 }), false);
  assert.equal(isBoundedGpxRoute({ ...valid, segments: [[{ lat: 91, lon: 14 }]] }), false);
  assert.equal(isBoundedGpxRoute({ ...valid, segments: [[{ lat: 46, lon: 14, notes: "x".repeat(65536) }, { lat: 46, lon: 14 }]] }), false);
  assert.equal(isBoundedGpxRoute({ ...valid, extra: "x".repeat(65536) }), false);
  assert.equal(isBoundedGpxRoute({ ...valid, filename: "\ud800.gpx" }), false);
  assert.match(gpxAttachmentHeader("Pot čez gozd.gpx"), /filename="route.gpx"; filename\*=UTF-8''Pot%20%C4%8Dez%20gozd.gpx/);
});