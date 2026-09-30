/**
 * Development-only round trip: browser's pure GPX exporter -> multipart upload
 * through the real host gate/handler/storage -> disposable published snapshot.
 * Never uses an owner account, schema initializer, or production publication.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { writeFile } from "node:fs/promises";
import express from "express";
import pinoHttp from "pino-http";
import { eq } from "drizzle-orm";
import {
  db, tenantsTable, sectionsTable, categoriesTable, itemsTable,
  hostUsersTable, hostMembershipsTable, changelogTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { createAdminGateForTests } from "../lib/actorGate";
import gpxRouter, { gpxAttachmentHeader, gpxEnvironment, gpxObjectFile, isBoundedGpxRoute, publishedGpxForItem } from "../routes/gpx";
import { readPublishedContent, replacePublishedSnapshot } from "../lib/publishedSnapshots";

// Dynamic import keeps the server's rootDir restricted to its own source tree.
const exportModule = "../../../smart360/src/lib/live-tour-export.ts";
const tourModule = "../../../smart360/src/lib/live-tour.ts";
const routeModule = "../../../smart360/src/lib/gpx-route.ts";
const projectionModule = "../../../smart360/src/lib/gpx-projection.ts";

test("free tour GPX export uploads into a disposable development entry and renders/downloads from its snapshot", async (t) => {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Free-tour integration fixture writes forbidden in production");
  }
  if (!process.env.DATABASE_URL || !process.env.PRIVATE_OBJECT_DIR) {
    return t.skip("Development DB/private object storage unavailable");
  }
  const [{ tourGpx }, { startTour, distanceMeters }, { boundedSegments, boundedProfile },
    { projectRoutePosition }] = await Promise.all([
    import(exportModule), import(tourModule), import(routeModule), import(projectionModule),
  ]);
  const marker = randomUUID();
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `free-tour-roundtrip-${marker}`, name: "Disposable free tour GPX", isPublished: true,
  }).returning();
  let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
  const fileIds: string[] = [];
  let hostId: string | undefined;
  t.after(async () => {
    const activeServer = server;
    if (activeServer) await new Promise<void>((resolve) => activeServer.close(() => resolve()));
    // Only objects returned by this test's own upload are eligible for deletion.
    for (const fileId of fileIds) {
      const object = gpxObjectFile("development", tenant.id, fileId);
      await object.delete({ ignoreNotFound: true });
      assert.equal((await object.exists())[0], false, "test-owned GPX object must be removed");
    }
    await db.delete(changelogTable).where(eq(changelogTable.tenantId, tenant.id));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
    if (hostId) await db.delete(hostUsersTable).where(eq(hostUsersTable.id, hostId));
    assert.equal((await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.id, tenant.id))).length, 0);
    if (hostId) assert.equal((await db.select({ id: hostUsersTable.id }).from(hostUsersTable)
      .where(eq(hostUsersTable.id, hostId))).length, 0);
    console.log(`free-tour GPX cleanup verified: tenants=1, hostUsers=${hostId ? 1 : 0}, storedObjects=${fileIds.length}; leftovers=0`);
  });
  const [host] = await db.insert(hostUsersTable).values({
    email: `free-tour-${marker}@example.invalid`,
  }).returning();
  hostId = host.id;
  await db.insert(hostMembershipsTable).values({ hostUserId: host.id, tenantId: tenant.id });
  const [section] = await db.insert(sectionsTable).values({
    tenantId: tenant.id, key: "explore", title: "Explore",
  }).returning();
  const [category] = await db.insert(categoriesTable).values({ sectionId: section.id, label: "Trails" }).returning();
  const [item] = await db.insert(itemsTable).values({ categoryId: category.id, title: "Free tour upload" }).returning();
  await replacePublishedSnapshot(tenant); // Fixture-only initial snapshot, never application publish endpoint.

  const app = express();
  app.use(pinoHttp({ logger }));
  app.use(createAdminGateForTests({
    kind: "host", hostUserId: host.id, tenantId: tenant.id, requestIp: "127.0.0.1",
  }));
  app.use(gpxRouter);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  // A retained client track with a real recording gap, elevation changes and
  // timestamped fixes. No test request sends these guest positions to the API
  // except via the explicitly exported GPX file attached to the host entry.
  const started = Date.parse("2025-06-01T08:00:00Z");
  const state = startTour(started);
  state.points = [
    { lat: 46.05, lon: 14.5, accuracy: 5, timestamp: started + 1000, altitude: 200 },
    { lat: 46.0505, lon: 14.5005, accuracy: 5, timestamp: started + 11000, altitude: 212 },
    { lat: 46.051, lon: 14.501, accuracy: 5, timestamp: started + 21000, altitude: 209 },
    { lat: 46.06, lon: 14.52, accuracy: 5, timestamp: started + 121000, altitude: 250 },
    { lat: 46.0605, lon: 14.5205, accuracy: 5, timestamp: started + 131000, altitude: 254 },
    { lat: 46.061, lon: 14.521, accuracy: 5, timestamp: started + 141000, altitude: 248 },
  ];
  state.segmentStarts = [0, 3];
  const filename = "Moja pot.gpx";
  const bytes = Buffer.from(tourGpx(state, "Moja pot & hrib"), "utf8");
  assert.equal((bytes.toString().match(/<trkseg>/g) ?? []).length, 2);
  assert.equal((bytes.toString().match(/<ele>/g) ?? []).length, 6);
  assert.equal((bytes.toString().match(/<time>/g) ?? []).length, 6);
  assert.ok(bytes.toString().includes("<name>Moja pot &amp; hrib</name>"));
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: "application/gpx+xml" }), filename);
  form.append("activity", "hiking");
  const upload = await fetch(`${base}/admin/items/${item.id}/gpx`, { method: "POST", body: form });
  assert.equal(upload.status, 200, await upload.clone().text());
  const route: unknown = await upload.json();
  assert.ok(isBoundedGpxRoute(route), "real upload response must satisfy the bounded shared GPX route shape");
  fileIds.push(route.fileId);
  assert.equal(route.environment, gpxEnvironment());
  assert.equal(route.filename, filename);
  assert.equal(route.byteSize, bytes.length);
  assert.equal(route.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(route.activity, "hiking");
  assert.deepEqual(route.segments, [
    state.points.slice(0, 3).map(({ lat, lon }: { lat: number; lon: number }) => ({ lat, lon })),
    state.points.slice(3).map(({ lat, lon }: { lat: number; lon: number }) => ({ lat, lon })),
  ]);
  assert.equal(route.profile.length, 6);
  assert.deepEqual(route.profile.map((point) => point.segment), [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(route.profile.map((point) => point.elevationM), [200, 212, 209, 250, 254, 248]);
  assert.equal(route.ascentM, 16);
  assert.equal(route.descentM, 9);
  assert.equal(route.minElevationM, 200);
  assert.equal(route.maxElevationM, 254);
  const distanceKm = (
    distanceMeters(state.points[0], state.points[1]) + distanceMeters(state.points[1], state.points[2]) +
    distanceMeters(state.points[3], state.points[4]) + distanceMeters(state.points[4], state.points[5])
  ) / 1000;
  assert.ok(Math.abs(route.distanceKm - distanceKm) < 0.00002, "distance excludes gap between segments");
  assert.equal(route.durationMinutes, Number(((route.distanceKm / 5 + 16 / 600) * 60).toFixed(2)));
  const [saved] = await db.select({ gpxRoute: itemsTable.gpxRoute }).from(itemsTable).where(eq(itemsTable.id, item.id));
  assert.deepEqual(saved?.gpxRoute, route, "host upload persisted derived route on the disposable entry");
  const downloadUrl = `${base}/public/tenants/${tenant.slug}/items/${item.id}/gpx/${route.fileId}`;
  assert.equal((await fetch(downloadUrl)).status, 404, "draft GPX not available through public snapshot");

  await replacePublishedSnapshot(tenant); // Only this disposable tenant gets a test snapshot.
  const snapshot = await readPublishedContent(tenant.id);
  const published = publishedGpxForItem(snapshot, item.id, route.fileId);
  assert.deepEqual(published, route);
  const snapshotItem = snapshot.languages.sl?.tree.sections.flatMap((s) => s.categories)
    .flatMap((c) => c.items).find((entry) => entry.id === item.id);
  assert.deepEqual(snapshotItem?.gpxRoute, route, "guest snapshot carries uploaded route");
  const geometry = boundedSegments(published!);
  const profile = boundedProfile(published!);
  assert.deepEqual(geometry.map((segment: Array<[number, number]>) => segment.length), [3, 3]);
  assert.equal(profile.filter((point: { segment: number }) => point.segment === -1).length, 1, "chart has a gap between segments");
  const projected = projectRoutePosition(geometry, published!.profile, state.points[4]);
  assert.equal(projected?.segment, 1);
  assert.ok(projected && projected.perpendicularM < 1, "shared map locates a fix on the second segment");
  const download = await fetch(downloadUrl);
  assert.equal(download.status, 200, await download.clone().text());
  assert.equal(download.headers.get("content-disposition"), gpxAttachmentHeader(filename));
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes, "download preserves exact client-exported bytes");
  // Opt-in browser evidence: only the synthetic test-owned uploaded response,
  // never a real tenant snapshot or original/private storage bytes.
  if (process.env.FREE_TOUR_ROUTE_OUTPUT) {
    await writeFile(process.env.FREE_TOUR_ROUTE_OUTPUT, JSON.stringify(route), { mode: 0o600 });
  }
  console.log("free-tour GPX roundtrip: client export -> multipart admin handler -> private storage -> item stats -> disposable snapshot -> shared map/profile -> public download; segments=2, points=6, elevationSamples=6, timestampTags=6, objects=1");
});