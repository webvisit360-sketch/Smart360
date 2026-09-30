/**
 * In-process multipart integration against the production GPX handler.
 * Entirely in-memory session, storage, draft and published snapshot; no DB connection or accounts.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import type { db } from "@workspace/db";
import gpxRouter, { isBoundedGpxRoute, publishedGpxForItem, setGpxUploadDependenciesForTests } from "../routes/gpx";

// Runtime-only imports avoid pulling the browser's DOM typings into the API tsconfig.
const routeModule = "../../../smart360/src/lib/gpx-route.ts";
const projectionModule = "../../../smart360/src/lib/gpx-projection.ts";

test("multipart tek is stored only as canonical running and survives a guest snapshot projection", async (t) => {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
    return t.skip("Fixture dependency injection is development-only");
  }
  const tenantId = randomUUID(), itemId = randomUUID();
  let savedRoute: unknown;
  const objects = new Map<string, Buffer>();
  const database = {
    select: () => ({ from: () => ({ innerJoin: () => ({ innerJoin: () => ({
      where: async () => [{ tenantId }],
    }) }) }) }),
    update: () => ({ set: ({ gpxRoute }: { gpxRoute: unknown }) => ({
      where: () => ({ returning: async () => { savedRoute = gpxRoute; return [{ id: itemId }]; } }),
    }) }),
  } as unknown as Pick<typeof db, "select" | "update">;
  setGpxUploadDependenciesForTests({
    database,
    objectFile: ((_env: string, _tenantId: string, fileId: string) => ({
      save: async (bytes: Buffer) => { objects.set(fileId, Buffer.from(bytes)); },
      delete: async () => { objects.delete(fileId); },
    })) as unknown as typeof import("../routes/gpx").gpxObjectFile,
  });
  t.after(() => setGpxUploadDependenciesForTests(null));
  const app = express();
  // Fake host actor only; no authentication request or account provisioning.
  app.use((req, _res, next) => {
    req.actor = { kind: "host", hostUserId: randomUUID(), tenantId, requestIp: "127.0.0.1" };
    next();
  });
  app.use(gpxRouter);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1"><trk><trkseg>
    <trkpt lat="46" lon="14"><ele>100</ele></trkpt>
    <trkpt lat="46" lon="14.01"><ele>120</ele></trkpt>
    <trkpt lat="46" lon="14.02"><ele>115</ele></trkpt>
    </trkseg><trkseg>
    <trkpt lat="46.01" lon="14.03"><ele>200</ele></trkpt>
    <trkpt lat="46.01" lon="14.04"><ele>205</ele></trkpt>
    </trkseg></trk></gpx>`;
  const bytes = Buffer.from(xml);
  const form = new FormData();
  form.append("file", new Blob([bytes]), "tek.gpx");
  form.append("activity", "tek");
  const response = await fetch(`http://127.0.0.1:${address.port}/admin/items/${itemId}/gpx`, {
    method: "POST", body: form,
  });
  assert.equal(response.status, 200, await response.clone().text());
  const route: unknown = await response.json();
  assert.ok(isBoundedGpxRoute(route));
  assert.equal(route.activity, "running");
  assert.equal(route.ascentM, 25);
  assert.equal(route.durationMinutes, Number(((route.distanceKm / 10 + 25 / 600) * 60).toFixed(2)));
  assert.deepEqual(savedRoute, route, "in-memory draft receives canonical route");
  assert.deepEqual(objects.get(route.fileId), bytes, "original bytes passed unchanged to in-memory object storage");

  const snapshot = {
    languages: { sl: { tree: {
      sections: [{ isVisible: true, deletedAt: null, categories: [
        { isVisible: true, deletedAt: null, items: [
          { id: itemId, isVisible: true, deletedAt: null, gpxRoute: savedRoute },
        ] },
      ] }],
    }, ui: {}, plurals: {} } },
    guestAccess: { orderPassword: null },
  } as unknown as Parameters<typeof publishedGpxForItem>[0];
  const published = publishedGpxForItem(snapshot, itemId, route.fileId);
  assert.equal(published?.activity, "running");
  assert.equal(published.durationMinutes, route.durationMinutes);
  const [{ boundedSegments, boundedProfile }, { projectRoutePosition }] = await Promise.all([
    import(routeModule), import(projectionModule),
  ]);
  assert.deepEqual(boundedSegments(published).map((s: number[][]) => s.length), [3, 2]);
  assert.equal(boundedProfile(published).filter((p: { segment: number }) => p.segment === -1).length, 1);
  const position = projectRoutePosition(boundedSegments(published), published.profile,
    { lat: 46.01, lon: 14.04 });
  assert.equal(position?.segment, 1);
});