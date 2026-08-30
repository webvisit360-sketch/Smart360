import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  categoriesTable,
  db,
  geocodeCacheTable,
  geocodeThrottleTable,
  itemDistanceProposalsTable,
  itemsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import { extractCoordsFromGoogleMapsUrl, isLikelyUrl } from "./maps-link";

export type FetchFn = typeof fetch;
type ResolvedLocation = {
  source: "link" | "coordinates" | "geocoded";
  confidence: "high" | "low";
  latitude: number;
  longitude: number;
  resolvedAddress: string | null;
  geocodeQuery: string | null;
};

const NOMINATIM_USER_AGENT =
  "Smart360 guest guide (distance review; admin contact via replit deployment)";
// Avoid piling up lock-waiting transactions within one process; the database
// singleton row below provides the deployment-wide guarantee.
let nominatimQueue: Promise<void> = Promise.resolve();
const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function normalizedQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Returns milliseconds spent queued/throttled. Existing callers may ignore it. */
export async function acquireNominatimTurn(): Promise<number> {
  const startedAt = Date.now();
  const turn = nominatimQueue.then(async () => {
    await db.transaction(async (tx) => {
      await tx.insert(geocodeThrottleTable).values({ id: 1 }).onConflictDoNothing();
      const [lease] = await tx
        .select()
        .from(geocodeThrottleTable)
        .where(eq(geocodeThrottleTable.id, 1))
        .for("update");
      const wait = 1000 - (Date.now() - (lease?.lastRequestAt?.getTime() ?? 0));
      if (wait > 0) await sleep(wait);
      await tx
        .update(geocodeThrottleTable)
        .set({ lastRequestAt: new Date() })
        .where(eq(geocodeThrottleTable.id, 1));
    });
  });
  nominatimQueue = turn.catch(() => undefined);
  await turn;
  return Date.now() - startedAt;
}

async function geocode(
  query: string,
  fetchFn: FetchFn,
): Promise<ResolvedLocation | null> {
  const [cached] = await db
    .select()
    .from(geocodeCacheTable)
    .where(eq(geocodeCacheTable.query, query));
  if (cached) {
    return cached.ok && cached.latitude !== null && cached.longitude !== null
      ? {
          source: "geocoded",
          confidence: "low",
          latitude: cached.latitude,
          longitude: cached.longitude,
          resolvedAddress: cached.displayName,
          geocodeQuery: query,
        }
      : null;
  }

  await acquireNominatimTurn();
  let data: unknown;
  try {
    const response = await fetchFn(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { "User-Agent": NOMINATIM_USER_AGENT } },
    );
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    data = await response.json();
  } catch {
    // Network failures are not negative geocoding results: retrying them later
    // is appropriate, unlike an explicit empty Nominatim response.
    return null;
  }
  const first = Array.isArray(data) ? data[0] : null;
  const latitude = first && typeof first.lat === "string" ? Number(first.lat) : NaN;
  const longitude = first && typeof first.lon === "string" ? Number(first.lon) : NaN;
  const ok = Number.isFinite(latitude) && Number.isFinite(longitude);
  const displayName = first && typeof first.display_name === "string"
    ? first.display_name
    : null;
  await db
    .insert(geocodeCacheTable)
    .values({
      query,
      latitude: ok ? latitude : null,
      longitude: ok ? longitude : null,
      displayName,
      ok,
    })
    .onConflictDoNothing();
  return ok
    ? {
        source: "geocoded",
        confidence: "low",
        latitude,
        longitude,
        resolvedAddress: displayName,
        geocodeQuery: query,
      }
    : null;
}

export async function resolveItemLocation(
  item: { mapQuery: string | null },
  options: { fetchFn?: FetchFn } = {},
): Promise<{ location: ResolvedLocation | null; error: string | null }> {
  const mapQuery = item.mapQuery?.trim();
  if (!mapQuery) return { location: null, error: "Vnos nima lokacije." };
  if (isLikelyUrl(mapQuery)) {
    const coords = extractCoordsFromGoogleMapsUrl(mapQuery);
    if (!coords) {
      return {
        location: null,
        error: "Povezave ni mogoče prebrati — prilepite polno Google Maps povezavo.",
      };
    }
    return {
      location: {
        source: "link",
        confidence: "high",
        latitude: coords.lat,
        longitude: coords.lng,
        resolvedAddress: null,
        geocodeQuery: null,
      },
      error: null,
    };
  }
  const location = await geocode(normalizedQuery(mapQuery), options.fetchFn ?? fetch);
  return {
    location,
    error: location ? null : "Naslova ni bilo mogoče razrešiti.",
  };
}

export async function computeRoadRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  fetchFn: FetchFn = fetch,
): Promise<{ distanceMeters: number; durationMinutes: number } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchFn(
      `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=false`,
      { signal: controller.signal },
    );
    if (!response.ok) return null;
    const payload = await response.json() as {
      routes?: Array<{ distance?: unknown; duration?: unknown }>;
    };
    const route = payload.routes?.[0];
    if (
      !route ||
      typeof route.distance !== "number" ||
      typeof route.duration !== "number" ||
      !Number.isFinite(route.distance) ||
      !Number.isFinite(route.duration)
    ) return null;
    return {
      distanceMeters: route.distance,
      durationMinutes: route.duration / 60,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function distanceInputFingerprint(
  origin: { latitude: number; longitude: number },
  item: { mapQuery: string | null },
): string {
  return createHash("sha256")
    .update(JSON.stringify([origin.latitude, origin.longitude, item.mapQuery?.trim() ?? null]))
    .digest("hex");
}

export async function runDistanceComputation(
  tenantId: string,
  { limit = 20, fetchFn = fetch, retryFailed = false }: { limit?: number; fetchFn?: FetchFn; retryFailed?: boolean } = {},
): Promise<{
  processed: number;
  remaining: number;
  counts: Record<"link" | "coordinates" | "geocoded" | "failed" | "manual" | "pending" | "approved" | "skipped", number>;
}> {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant || tenant.latitude === null || tenant.longitude === null) {
    throw new Error("Namestitev nima shranjene Google Maps povezave.");
  }
  const origin = { latitude: tenant.latitude, longitude: tenant.longitude };
  const rows = await db
    .select({ item: itemsTable, proposal: itemDistanceProposalsTable })
    .from(itemsTable)
    .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .leftJoin(itemDistanceProposalsTable, eq(itemDistanceProposalsTable.itemId, itemsTable.id))
    .where(and(eq(sectionsTable.tenantId, tenantId), eq(categoriesTable.layout, "poi"), isNull(itemsTable.deletedAt)));
  const counts = { link: 0, coordinates: 0, geocoded: 0, failed: 0, manual: 0, pending: 0, approved: 0, skipped: 0 };
  const eligible = rows.filter(({ item, proposal }) => {
    if (item.distanceMeters !== null) { counts.manual++; return false; }
    const fingerprint = distanceInputFingerprint(origin, item);
    if (proposal?.inputFingerprint === fingerprint && (!retryFailed || proposal.status !== "failed")) {
      if (proposal.status === "failed") counts.failed++;
      else counts.skipped++;
      return false;
    }
    return true;
  });
  for (const row of eligible.slice(0, Math.max(1, Math.min(limit, 100)))) {
    const fingerprint = distanceInputFingerprint(origin, row.item);
    const resolved = await resolveItemLocation(row.item, { fetchFn });
    let values: Record<string, unknown>;
    if (!resolved.location) {
      counts.failed++;
      values = { status: "failed", source: null, confidence: null, latitude: null, longitude: null, distanceMeters: null, durationMinutes: null, resolvedAddress: null, geocodeQuery: null, inputFingerprint: fingerprint, error: resolved.error };
    } else {
      const route = await computeRoadRoute(origin, resolved.location, fetchFn);
      if (!route) {
        counts.failed++;
        values = { status: "failed", source: resolved.location.source, confidence: resolved.location.confidence, latitude: resolved.location.latitude, longitude: resolved.location.longitude, distanceMeters: null, durationMinutes: null, resolvedAddress: resolved.location.resolvedAddress, geocodeQuery: resolved.location.geocodeQuery, inputFingerprint: fingerprint, error: "Cestne razdalje ni bilo mogoče izračunati." };
      } else {
        counts[resolved.location.source]++;
        counts.pending++;
        values = { status: "pending", ...resolved.location, ...route, inputFingerprint: fingerprint, error: null };
      }
    }
    await db.insert(itemDistanceProposalsTable).values({ itemId: row.item.id, tenantId, ...values } as typeof itemDistanceProposalsTable.$inferInsert)
      .onConflictDoUpdate({ target: itemDistanceProposalsTable.itemId, set: values });
  }
  return { processed: Math.min(eligible.length, Math.max(1, Math.min(limit, 100))), remaining: Math.max(0, eligible.length - Math.max(1, Math.min(limit, 100))), counts };
}

/** Shared approval guard: an already manual item is never overwritten. */
export async function approveDistanceProposal(rowId: string): Promise<number> {
  const [row] = await db
    .select({ proposal: itemDistanceProposalsTable, item: itemsTable })
    .from(itemDistanceProposalsTable)
    .innerJoin(itemsTable, eq(itemsTable.id, itemDistanceProposalsTable.itemId))
    .where(eq(itemDistanceProposalsTable.id, rowId));
  if (!row || row.proposal.distanceMeters === null) {
    throw new Error("Predloga ni mogoče potrditi.");
  }
  if (row.item.distanceMeters !== null) {
    throw new Error("Ročno vnesena razdalja ima prednost.");
  }
  await db.transaction(async (tx) => {
    const updated = await tx.update(itemsTable).set({ distanceMeters: row.proposal.distanceMeters })
      .where(and(eq(itemsTable.id, row.item.id), isNull(itemsTable.distanceMeters))).returning({ id: itemsTable.id });
    if (updated.length === 0) throw new Error("Ročno vnesena razdalja ima prednost.");
    await tx.update(itemDistanceProposalsTable).set({ status: "approved" }).where(eq(itemDistanceProposalsTable.id, rowId));
  });
  return row.proposal.distanceMeters;
}

/**
 * Undo a review decision (approve, edit, or skip): clears the item's stored
 * distance and returns the proposal to pending so the host can decide again.
 * Proposals without a computed distance go back to failed instead of pending.
 */
export async function revertDistanceProposal(rowId: string): Promise<void> {
  const [row] = await db
    .select({ proposal: itemDistanceProposalsTable, item: itemsTable })
    .from(itemDistanceProposalsTable)
    .innerJoin(itemsTable, eq(itemsTable.id, itemDistanceProposalsTable.itemId))
    .where(eq(itemDistanceProposalsTable.id, rowId));
  if (!row) throw new Error("Predlog ni najden.");
  const nextStatus = row.proposal.distanceMeters !== null ? "pending" : "failed";
  await db.transaction(async (tx) => {
    await tx.update(itemsTable).set({ distanceMeters: null }).where(eq(itemsTable.id, row.item.id));
    await tx
      .update(itemDistanceProposalsTable)
      .set({ status: nextStatus })
      .where(eq(itemDistanceProposalsTable.id, rowId));
  });
}