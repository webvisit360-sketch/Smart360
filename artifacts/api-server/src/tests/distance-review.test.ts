import assert from "node:assert/strict";
import test from "node:test";
import { distanceInputFingerprint, resolveItemLocation } from "../lib/distanceEngine";
import { extractCoordsFromGoogleMapsUrl } from "../lib/maps-link";
import { approveDistanceProposal, runDistanceComputation } from "../lib/distanceEngine";
import { db, categoriesTable, geocodeCacheTable, itemDistanceProposalsTable, itemsTable, sectionsTable, tenantsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

test("Google Maps extraction prefers place coordinates to map centre", () => {
  assert.deepEqual(
    extractCoordsFromGoogleMapsUrl("https://www.google.com/maps/place/x/@45.1,13.1,12z/data=!3d45.55!4d13.66"),
    { lat: 45.55, lng: 13.66 },
  );
  assert.deepEqual(
    extractCoordsFromGoogleMapsUrl("https://www.google.com/maps/@45.1,13.1,12z"),
    { lat: 45.1, lng: 13.1 },
  );
  assert.equal(extractCoordsFromGoogleMapsUrl("https://www.google.com/maps/place/x"), null);
  assert.equal(extractCoordsFromGoogleMapsUrl("https://maps.app.goo.gl/abc"), null);
});

test("URL-valued mapQuery is never passed to a geocoder", async () => {
  let calls = 0;
  const result = await resolveItemLocation(
    { mapQuery: "https://maps.app.goo.gl/unexpandable" },
    { fetchFn: (async () => { calls++; throw new Error("must not fetch"); }) as typeof fetch },
  );
  assert.equal(calls, 0);
  assert.equal(result.location, null);
  assert.equal(result.error, "Povezave ni mogoče prebrati — prilepite polno Google Maps povezavo.");
});

test("link location is resolved locally without fetch", async () => {
  let calls = 0;
  const result = await resolveItemLocation(
    { mapQuery: "https://www.google.com/maps/place/x/data=!3d45.5!4d13.6" },
    { fetchFn: (async () => { calls++; throw new Error("must not fetch"); }) as typeof fetch },
  );
  assert.equal(calls, 0);
  assert.deepEqual(result.location && { source: result.location.source, latitude: result.location.latitude, longitude: result.location.longitude }, { source: "link", latitude: 45.5, longitude: 13.6 });
});

test("fingerprint is stable for unchanged inputs and changes for changed inputs", () => {
  const origin = { latitude: 45.5, longitude: 13.6 };
  const same = { mapQuery: "Mestni trg 1" };
  assert.equal(distanceInputFingerprint(origin, same), distanceInputFingerprint(origin, same));
  assert.notEqual(distanceInputFingerprint(origin, same), distanceInputFingerprint(origin, { mapQuery: "Mestni trg 2" }));
  assert.notEqual(distanceInputFingerprint(origin, same), distanceInputFingerprint({ latitude: 45.6, longitude: 13.6 }, same));
});

test("concurrent uncached geocodes start at least one second apart", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const queries = [`Throttle A ${suffix}`, `Throttle B ${suffix}`];
  const starts: number[] = [];
  const fakeFetch = (async () => {
    starts.push(Date.now());
    return { ok: true, json: async () => [{ lat: "45.5", lon: "13.6", display_name: "Test" }] };
  }) as unknown as typeof fetch;
  try {
    await Promise.all(queries.map((mapQuery) => resolveItemLocation({ mapQuery }, { fetchFn: fakeFetch })));
    assert.equal(starts.length, 2);
    assert.ok(starts[1]! - starts[0]! >= 950, `Nominatim starts were only ${starts[1]! - starts[0]!}ms apart`);
  } finally {
    await db.delete(geocodeCacheTable).where(inArray(geocodeCacheTable.query, queries));
  }
});

test("DB pipeline keeps proposals private, approves explicitly, and preserves manual values", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tenantId = "";
  try {
    const [tenant] = await db.insert(tenantsTable).values({
      slug: `distance-test-${suffix}`, name: `Distance test ${suffix}`,
      latitude: 45.5, longitude: 13.6,
    }).returning();
    tenantId = tenant!.id;
    const [section] = await db.insert(sectionsTable).values({ tenantId, key: `distance-${suffix}`, title: "Test" }).returning();
    const [category] = await db.insert(categoriesTable).values({ sectionId: section!.id, label: "POI", layout: "poi" }).returning();
    const [pendingItem] = await db.insert(itemsTable).values({ categoryId: category!.id, title: `Pending ${suffix}`, mapQuery: "https://www.google.com/maps/place/x/data=!3d45.51!4d13.61" }).returning();
    const [manualItem] = await db.insert(itemsTable).values({ categoryId: category!.id, title: `Manual ${suffix}`, mapQuery: "https://www.google.com/maps/place/x/data=!3d45.52!4d13.62", distanceMeters: 777 }).returning();
    const fakeFetch = (async (url: string) => ({
      ok: true,
      json: async () => url.includes("router.project-osrm.org") ? { routes: [{ distance: 1234, duration: 600 }] } : [],
    })) as typeof fetch;
    const result = await runDistanceComputation(tenantId, { limit: 20, fetchFn: fakeFetch });
    assert.equal(result.processed, 1);
    assert.equal(result.counts.manual, 1);
    const [pendingProposal] = await db.select().from(itemDistanceProposalsTable).where(eq(itemDistanceProposalsTable.itemId, pendingItem!.id));
    assert.equal(pendingProposal!.status, "pending");
    const [beforeApproval] = await db.select().from(itemsTable).where(eq(itemsTable.id, pendingItem!.id));
    assert.equal(beforeApproval!.distanceMeters, null);
    await approveDistanceProposal(pendingProposal!.id);
    const [afterApproval] = await db.select().from(itemsTable).where(eq(itemsTable.id, pendingItem!.id));
    assert.equal(afterApproval!.distanceMeters, 1234);
    const manualProposals = await db.select().from(itemDistanceProposalsTable).where(eq(itemDistanceProposalsTable.itemId, manualItem!.id));
    assert.equal(manualProposals.length, 0);
    const [stale] = await db.insert(itemDistanceProposalsTable).values({ itemId: manualItem!.id, tenantId, inputFingerprint: "stale", status: "pending", distanceMeters: 123 }).returning();
    await assert.rejects(() => approveDistanceProposal(stale!.id), /Ročno vnesena/);
  } finally {
    if (tenantId) await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
  }
});