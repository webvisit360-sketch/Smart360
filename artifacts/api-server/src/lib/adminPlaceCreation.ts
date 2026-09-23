import { and, eq, isNull } from "drizzle-orm";
import {
  categoriesTable,
  creatorPlaceProposalsTable,
  creatorPlaceMaterializationsTable,
  creatorCanonicalPlacesTable,
  creatorProposalTranslationsTable,
  creatorRunsTable,
  creatorVerificationAttemptsTable,
  creatorVerificationCandidatesTable,
  db,
  itemDistanceProposalsTable,
  itemsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import { acquireNominatimTurn, computeRoadRoute } from "./distanceEngine";
import {
  CREATOR_MAX_QUEUE_DURATION_S,
  CreatorBulkApprovalError,
  assertNoLiveCreatorPlaceDuplicate, lockCreatorPlaceIdentity, normalizeCreatorProposalName,
  syncApprovedCreatorPlace,
} from "./creatorProposalLedger";

const USER_AGENT = "Smart360 guest guide (operator place search; admin contact via replit deployment)";
const HOST = "https://nominatim.openstreetmap.org";
const MAX_RESPONSE_BYTES = 256_000;
const ADMIN_PLACE_ROUTE_CONCURRENCY = 2;

type AdminPlaceSearchCandidateBase = ReturnType<typeof parsedPlace> extends infer T
  ? Exclude<T, null> & {
      straightLineDistanceM: number;
      duplicate: boolean;
      duplicateLabel: "že v vodniku" | null;
      duplicateMatch: PlaceDuplicateMatch | null;
    }
  : never;

export type AdminPlaceSearchCandidate = AdminPlaceSearchCandidateBase & {
  roadDistanceM: number | null;
  travelDurationS: number | null;
  routeStatus: "available" | "unavailable";
};

export class ItemDistanceError extends Error {
  constructor(message: string, readonly kind: "not-found" | "unprocessable" | "conflict") {
    super(message);
  }
}

export type PlaceDuplicateMatch = {
  kind: "item" | "pending" | "archived";
  id: string;
  categoryId: string | null;
  category: string | null;
  name: string;
  hidden: boolean;
};

export class AdminPlaceConflictError extends CreatorBulkApprovalError {
  constructor(readonly match: PlaceDuplicateMatch) {
    super(match.kind === "pending" ? "Ta kraj čaka v Kreatorjevi vrsti." : "Ta kraj je že v vodniku.");
  }
}

export function adminPlaceConflictResponse(error: AdminPlaceConflictError) {
  return { error: error.message, duplicateMatch: error.match };
}

export function recomputedCreatorRange(
  priorRange: string | null,
  durationMinutes: number,
): "practical" | "near" | "excursion" {
  return priorRange === "practical" ? "practical" : durationMinutes <= 20 ? "near" : "excursion";
}

type NominatimPlace = {
  osm_type?: unknown; osm_id?: unknown; lat?: unknown; lon?: unknown;
  name?: unknown; display_name?: unknown; class?: unknown; type?: unknown; addresstype?: unknown;
};

function finiteCoordinate(value: unknown, min: number, max: number): number | null {
  const number = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function parsedPlace(value: NominatimPlace) {
  const osmType = typeof value.osm_type === "string" ? value.osm_type : "";
  const osmId = typeof value.osm_id === "number" ? value.osm_id : Number(value.osm_id);
  const latitude = finiteCoordinate(value.lat, -90, 90);
  const longitude = finiteCoordinate(value.lon, -180, 180);
  const address = typeof value.display_name === "string" ? value.display_name.trim() : "";
  const name = (typeof value.name === "string" ? value.name : address.split(",")[0] ?? "").trim();
  if (!["node", "way", "relation"].includes(osmType) || !Number.isSafeInteger(osmId) ||
      latitude === null || longitude === null || !name || !address) return null;
  return {
    osmType, osmId, latitude, longitude, name, address,
    osmCategory: typeof value.class === "string" ? value.class : "place",
    osmFeatureType: typeof value.type === "string" ? value.type : "place",
    osmAddressType: typeof value.addresstype === "string" ? value.addresstype : "place",
  };
}

/**
 * Adds true OSRM route measurements to search candidates without turning a
 * routing outage into an empty search result. Calls are deliberately bounded;
 * identical coordinates in one response share the same routing request.
 */
export async function enrichAdminPlaceRoutes(
  origin: { latitude: number; longitude: number },
  candidates: AdminPlaceSearchCandidateBase[],
  options: {
    computeRoute?: typeof computeRoadRoute;
    concurrency?: number;
  } = {},
): Promise<AdminPlaceSearchCandidate[]> {
  const computeRoute = options.computeRoute ?? computeRoadRoute;
  const concurrency = Math.max(
    1,
    Math.min(
      candidates.length || 1,
      Math.trunc(options.concurrency ?? ADMIN_PLACE_ROUTE_CONCURRENCY),
    ),
  );
  const routes = new Map<string, Promise<Awaited<ReturnType<typeof computeRoadRoute>>>>();
  const results = new Array<AdminPlaceSearchCandidate>(candidates.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < candidates.length) {
      const index = nextIndex++;
      const candidate = candidates[index]!;
      const key = `${candidate.latitude},${candidate.longitude}`;
      let pendingRoute = routes.get(key);
      if (!pendingRoute) {
        pendingRoute = computeRoute(origin, candidate).catch(() => null);
        routes.set(key, pendingRoute);
      }
      const route = await pendingRoute;
      results[index] = {
        ...candidate,
        roadDistanceM: route ? Math.round(route.distanceMeters) : null,
        travelDurationS: route ? Math.round(route.durationMinutes * 60) : null,
        routeStatus: route ? "available" : "unavailable",
      };
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

export async function fetchAdminPlaceNominatim(
  path: "/search" | "/lookup",
  params: Record<string, string>,
  options: { fetchFn?: typeof fetch; throttle?: boolean; timeoutMs?: number; acquireTurn?: () => Promise<number> } = {},
) {
  if (options.throttle !== false) await (options.acquireTurn ?? acquireNominatimTurn)();
  const url = new URL(path, HOST);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  try {
    const response = await (options.fetchFn ?? fetch)(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error("Nominatim je vrnil prevelik odgovor.");
    }
    if (!response.body) throw new Error("Nominatim ni vrnil telesa odgovora.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Nominatim je vrnil prevelik odgovor.");
      }
      chunks.push(chunk.value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const payload = JSON.parse(new TextDecoder().decode(body)) as unknown;
    if (!Array.isArray(payload) || payload.length > 10) {
      throw new Error("Nominatim je vrnil neveljaven odgovor.");
    }
    return payload as NominatimPlace[];
  } finally {
    clearTimeout(timeout);
  }
}

async function context(categoryId: string) {
  const [row] = await db.select({
    categoryId: categoriesTable.id,
    tenantId: tenantsTable.id,
    latitude: tenantsTable.latitude,
    longitude: tenantsTable.longitude,
    sectionKey: sectionsTable.key,
  }).from(categoriesTable)
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .innerJoin(tenantsTable, eq(sectionsTable.tenantId, tenantsTable.id))
    .where(and(eq(categoriesTable.id, categoryId), isNull(categoriesTable.deletedAt)))
    .limit(1);
  if (!row) throw new CreatorBulkApprovalError("Kategorija ni najdena.");
  if (!["explore", "services"].includes(row.sectionKey)) {
    throw new CreatorBulkApprovalError("Iskanje krajev je dovoljeno samo v razdelku OKOLICA.");
  }
  if (row.latitude === null || row.longitude === null) {
    throw new CreatorBulkApprovalError("Namestitev nima potrjenega izhodišča.");
  }
  return { ...row, latitude: row.latitude, longitude: row.longitude } as typeof row & {
    latitude: number;
    longitude: number;
  };
}

function straightDistanceM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

type PlaceIdentity = { name: string; osmType: string | null; osmId: number | null; latitude: number | null; longitude: number | null };
type DuplicateRow = PlaceIdentity & { match: PlaceDuplicateMatch };

/** Names alone never prove place identity, even for a legacy item without
 * coordinates. An uncertain record must not hard-block creation. */
export function sameAdminPlace(a: PlaceIdentity, b: PlaceIdentity): boolean {
  if (a.osmType && a.osmId !== null && b.osmType && b.osmId !== null) {
    return a.osmType === b.osmType && a.osmId === b.osmId;
  }
  if (a.latitude !== null && a.longitude !== null && b.latitude !== null && b.longitude !== null) {
    if (a.latitude.toFixed(5) === b.latitude.toFixed(5) &&
      a.longitude.toFixed(5) === b.longitude.toFixed(5)) return true;
    // Operator pins and Nominatim centroids may differ slightly; never use
    // proximity to merge two separately verified OSM identities.
    return (!a.osmType || !b.osmType) &&
      normalizeCreatorProposalName(a.name) === normalizeCreatorProposalName(b.name) &&
      straightDistanceM(
        { latitude: a.latitude, longitude: a.longitude },
        { latitude: b.latitude, longitude: b.longitude },
      ) <= 40;
  }
  return false;
}

export function findAdminPlaceDuplicate(place: PlaceIdentity, rows: DuplicateRow[]): PlaceDuplicateMatch | null {
  return rows.find(row => row.match.kind === "item" && sameAdminPlace(place, row))?.match ??
    rows.find(row => row.match.kind === "pending" && sameAdminPlace(place, row))?.match ??
    rows.find(row => row.match.kind === "archived" && sameAdminPlace(place, row))?.match ?? null;
}

export async function adminPlaceDuplicateRows(tenantId: string, client: typeof db = db): Promise<DuplicateRow[]> {
  const proposals = await client.select({
    id: creatorPlaceProposalsTable.id, categoryId: creatorPlaceProposalsTable.categoryId,
    name: creatorPlaceProposalsTable.proposedName, status: creatorPlaceProposalsTable.status,
    osmType: creatorPlaceProposalsTable.osmType, osmId: creatorPlaceProposalsTable.osmId,
    latitude: creatorPlaceProposalsTable.latitude, longitude: creatorPlaceProposalsTable.longitude,
    label: categoriesTable.label, categoryVisible: categoriesTable.isVisible,
    categoryDeleted: categoriesTable.deletedAt, sectionVisible: sectionsTable.isVisible,
  }).from(creatorPlaceProposalsTable)
    .leftJoin(categoriesTable, eq(categoriesTable.id, creatorPlaceProposalsTable.categoryId))
    .leftJoin(sectionsTable, eq(sectionsTable.id, categoriesTable.sectionId))
    .where(and(eq(creatorPlaceProposalsTable.tenantId, tenantId),
      eq(creatorPlaceProposalsTable.status, "pending")));
  const items = await client.select({
    id: itemsTable.id, name: itemsTable.title, categoryId: categoriesTable.id,
    label: categoriesTable.label, categoryVisible: categoriesTable.isVisible,
    categoryDeleted: categoriesTable.deletedAt, sectionVisible: sectionsTable.isVisible,
    itemVisible: itemsTable.isVisible, itemDeleted: itemsTable.deletedAt,
    entityKey: creatorCanonicalPlacesTable.entityKey,
    latitude: creatorPlaceMaterializationsTable.latitude,
    longitude: creatorPlaceMaterializationsTable.longitude,
  }).from(itemsTable)
    .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .leftJoin(creatorCanonicalPlacesTable, eq(creatorCanonicalPlacesTable.itemId, itemsTable.id))
    .leftJoin(creatorPlaceMaterializationsTable, and(
      eq(creatorPlaceMaterializationsTable.itemId, itemsTable.id),
      eq(creatorPlaceMaterializationsTable.isActive, true)))
    .where(eq(sectionsTable.tenantId, tenantId));
  return [
    ...items.filter(row => row.name).map(row => {
      const osm = row.entityKey?.match(/^osm:(node|way|relation):(\d+)$/);
      return {
        name: row.name!, osmType: osm?.[1] ?? null, osmId: osm ? Number(osm[2]) : null,
        latitude: row.latitude, longitude: row.longitude,
        match: {
          kind: (row.itemDeleted || row.categoryDeleted ? "archived" : "item") as "archived" | "item",
          id: row.categoryDeleted ? row.categoryId : row.id,
          categoryId: row.categoryId, category: row.label, name: row.name!,
          hidden: !row.itemVisible || !row.categoryVisible || !row.sectionVisible,
        },
      };
    }),
    ...proposals.filter(row => row.latitude !== null || row.osmType !== null).map(row => ({
      name: row.name, osmType: row.osmType, osmId: row.osmId,
      latitude: row.latitude, longitude: row.longitude,
      match: {
        kind: "pending" as const, id: row.id, categoryId: row.categoryId,
        category: row.label, name: row.name,
        hidden: !row.categoryVisible || !row.sectionVisible || Boolean(row.categoryDeleted),
      },
    })),
  ];
}

export async function adminPlaceDuplicateKeys(tenantId: string) {
  const rows = await adminPlaceDuplicateRows(tenantId);
  return {
    osm: new Set(rows.flatMap(row => row.osmType && row.osmId !== null ? [`${row.osmType}:${row.osmId}`] : [])),
    names: new Set(rows.map(row => normalizeCreatorProposalName(row.name))),
  };
}

export async function searchAdminPlaces(categoryId: string, query: string) {
  const ctx = await context(categoryId);
  const q = query.trim().replace(/\s+/g, " ");
  if (q.length < 2 || q.length > 160) throw new CreatorBulkApprovalError("Vnesite vsaj dva znaka.");
  const [rows, duplicates] = await Promise.all([
    fetchAdminPlaceNominatim("/search", { q, limit: "8", namedetails: "1" }),
    adminPlaceDuplicateRows(ctx.tenantId),
  ]);
  const candidates: AdminPlaceSearchCandidateBase[] = rows.flatMap((row) => {
    const place = parsedPlace(row);
    if (!place) return [];
    const duplicateMatch = findAdminPlaceDuplicate(place, duplicates);
    const duplicate = Boolean(duplicateMatch);
    return [{
      ...place,
      straightLineDistanceM: Math.round(straightDistanceM(ctx, place)),
      duplicate,
      duplicateLabel: duplicate ? "že v vodniku" as const : null,
      duplicateMatch,
    }];
  });
  const routedCandidates = await enrichAdminPlaceRoutes(ctx, candidates);
  return {
    originLatitude: ctx.latitude,
    originLongitude: ctx.longitude,
    candidates: routedCandidates,
  };
}

async function verifiedOsm(osmType: string, osmId: number) {
  const prefix = ({ node: "N", way: "W", relation: "R" } as Record<string, string>)[osmType];
  if (!prefix || !Number.isSafeInteger(osmId) || osmId <= 0) {
    throw new CreatorBulkApprovalError("Neveljavna identiteta OSM.");
  }
  const rows = await fetchAdminPlaceNominatim("/lookup", { osm_ids: `${prefix}${osmId}`, namedetails: "1" });
  const place = rows[0] ? parsedPlace(rows[0]) : null;
  if (!place || place.osmType !== osmType || place.osmId !== osmId) {
    throw new CreatorBulkApprovalError("Izbranega kraja ni bilo mogoče ponovno preveriti.");
  }
  return place;
}

export async function createAdminPlace(input: {
  categoryId: string; actorId: string;
  selection:
    | { mode: "nominatim"; osmType: string; osmId: number }
    | { mode: "manual"; name: string; locationText: string; latitude: number; longitude: number };
}) {
  const ctx = await context(input.categoryId);
  const place = input.selection.mode === "nominatim"
    ? await verifiedOsm(input.selection.osmType, input.selection.osmId)
    : {
        name: input.selection.name.trim(), address: input.selection.locationText.trim(),
        latitude: finiteCoordinate(input.selection.latitude, -90, 90),
        longitude: finiteCoordinate(input.selection.longitude, -180, 180),
        osmType: null, osmId: null, osmCategory: null, osmFeatureType: null, osmAddressType: null,
      };
  if (!place.name || !place.address || place.latitude === null || place.longitude === null) {
    throw new CreatorBulkApprovalError("Ime, opis lokacije in veljavna točka so obvezni.");
  }
  const existing = findAdminPlaceDuplicate(place, await adminPlaceDuplicateRows(ctx.tenantId));
  if (existing) throw new AdminPlaceConflictError(existing);
  const route = await computeRoadRoute(ctx, place as { latitude: number; longitude: number });
  if (!route) throw new CreatorBulkApprovalError("Cestne razdalje ni bilo mogoče izračunati.");
  const roadDistanceM = Math.round(route.distanceMeters);
  const durationS = Math.round(route.durationMinutes * 60);
  const straightLineDistanceM = Math.round(straightDistanceM(ctx, place as { latitude: number; longitude: number }));
  if (durationS > CREATOR_MAX_QUEUE_DURATION_S) {
    throw new CreatorBulkApprovalError("Kraj je oddaljen več kot 90 minut vožnje.");
  }
  const normalizedName = normalizeCreatorProposalName(place.name);
  const entityKey = place.osmType && place.osmId !== null
    ? `osm:${place.osmType}:${place.osmId}`
    : `coordinates:${place.latitude.toFixed(5)}:${place.longitude.toFixed(5)}`;
  const result = await db.transaction(async (tx) => {
    await lockCreatorPlaceIdentity(tx, ctx.tenantId, entityKey, normalizedName);
    const lockedMatch = findAdminPlaceDuplicate(place, await adminPlaceDuplicateRows(ctx.tenantId, tx as typeof db));
    if (lockedMatch) throw new AdminPlaceConflictError(lockedMatch);
    const now = new Date();
    const [run] = await tx.insert(creatorRunsTable).values({
      tenantId: ctx.tenantId, status: "completed",
      originLatitude: ctx.latitude, originLongitude: ctx.longitude,
      reportJson: JSON.stringify({ source: "operator-place-search" }),
      completedAt: now,
    }).returning();
    const manual = input.selection.mode === "manual";
    const [proposal] = await tx.insert(creatorPlaceProposalsTable).values({
      tenantId: ctx.tenantId, runId: run.id, categoryId: input.categoryId,
      proposedName: place.name, normalizedName, originalQuery: place.name,
      confirmedQuery: manual ? "operator-map-pin" : place.name,
      confirmationMethod: manual ? "operator_coordinates" : "exact",
      coordinateConfirmedBy: manual ? input.actorId : null,
      coordinateConfirmedAt: manual ? now : null,
      contentReady: true, status: "approved", reviewedBy: input.actorId, reviewedAt: now,
      inclusionReason: "dodal operater prek iskanja",
      resolvedName: manual ? null : place.name,
      resolvedAddress: manual ? null : place.address,
      operatorAddress: manual ? place.address : null,
      osmType: place.osmType, osmId: place.osmId, osmCategory: place.osmCategory,
      osmFeatureType: place.osmFeatureType, osmAddressType: place.osmAddressType,
      latitude: place.latitude, longitude: place.longitude,
      straightLineDistanceM,
      roadDistanceM, travelDurationS: durationS,
      range: route.durationMinutes <= 20 ? "near" : "excursion",
    }).returning();
    await assertNoLiveCreatorPlaceDuplicate(tx, {
      tenantId: ctx.tenantId,
      entityKey,
      normalizedName,
      currentProposalId: proposal.id,
      currentCreatedAt: proposal.createdAt,
    });
    if (!manual) {
      const [attempt] = await tx.insert(creatorVerificationAttemptsTable).values({
        proposalId: proposal.id,
        attemptNumber: 1,
        query: place.name,
        verdict: "resolved",
      }).returning({ id: creatorVerificationAttemptsTable.id });
      await tx.insert(creatorVerificationCandidatesTable).values({
        attemptId: attempt.id,
        candidatePosition: 0,
        osmType: place.osmType,
        osmId: place.osmId,
        osmCategory: place.osmCategory,
        osmFeatureType: place.osmFeatureType,
        osmAddressType: place.osmAddressType,
        resolvedName: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        straightLineDistanceM,
        selected: true,
      });
    }
    await tx.insert(creatorProposalTranslationsTable).values(
      ["sl", "en", "de", "it"].map((language) => ({
        proposalId: proposal.id, language, name: place.name, description: "",
      })),
    );
    await syncApprovedCreatorPlace(tx, proposal);
    return proposal;
  });
  return result;
}

export async function getItemCreatorStatus(itemId: string) {
  const [item] = await db.select({ distanceMeters: itemsTable.distanceMeters })
    .from(itemsTable)
    .where(and(eq(itemsTable.id, itemId), isNull(itemsTable.deletedAt)))
    .limit(1);
  if (!item) throw new CreatorBulkApprovalError("Vnos ni najden.");
  const [row] = await db.select({
    latitude: creatorPlaceMaterializationsTable.latitude,
    longitude: creatorPlaceMaterializationsTable.longitude,
    roadDistanceM: creatorPlaceProposalsTable.roadDistanceM,
    travelDurationS: creatorPlaceProposalsTable.travelDurationS,
    range: creatorPlaceProposalsTable.range,
  }).from(creatorPlaceMaterializationsTable)
    .innerJoin(
      creatorPlaceProposalsTable,
      eq(creatorPlaceProposalsTable.id, creatorPlaceMaterializationsTable.proposalId),
    )
    .where(and(
      eq(creatorPlaceMaterializationsTable.itemId, itemId),
      eq(creatorPlaceMaterializationsTable.isActive, true),
    ))
    .limit(1);
  return {
    activeMaterialization: Boolean(row),
    latitude: row?.latitude ?? null,
    longitude: row?.longitude ?? null,
    distanceMeters: item.distanceMeters,
    roadDistanceM: row?.roadDistanceM ?? null,
    travelDurationS: row?.travelDurationS ?? null,
    range: row?.range ?? null,
  };
}

export async function recomputeItemDistance(itemId: string) {
  const [row] = await db.select({
    materializationId: creatorPlaceMaterializationsTable.id,
    proposalId: creatorPlaceMaterializationsTable.proposalId,
    latitude: creatorPlaceMaterializationsTable.latitude,
    longitude: creatorPlaceMaterializationsTable.longitude,
    originLatitude: tenantsTable.latitude,
    originLongitude: tenantsTable.longitude,
    range: creatorPlaceProposalsTable.range,
  }).from(creatorPlaceMaterializationsTable)
    .innerJoin(tenantsTable, eq(tenantsTable.id, creatorPlaceMaterializationsTable.tenantId))
    .innerJoin(creatorPlaceProposalsTable, eq(creatorPlaceProposalsTable.id, creatorPlaceMaterializationsTable.proposalId))
    .innerJoin(itemsTable, eq(itemsTable.id, creatorPlaceMaterializationsTable.itemId))
    .where(and(
      eq(creatorPlaceMaterializationsTable.itemId, itemId),
      eq(creatorPlaceMaterializationsTable.isActive, true),
      isNull(itemsTable.deletedAt),
    ))
    .limit(1);
  if (!row) throw new ItemDistanceError("Vnos nima aktivne materializacije s koordinatami.", "not-found");
  if (row.originLatitude === null || row.originLongitude === null) {
    throw new ItemDistanceError("Namestitev nima potrjenega izhodišča.", "not-found");
  }
  const route = await computeRoadRoute(
    { latitude: row.originLatitude, longitude: row.originLongitude },
    { latitude: row.latitude, longitude: row.longitude },
  );
  if (!route) throw new ItemDistanceError("Cestne razdalje ni bilo mogoče izračunati.", "unprocessable");
  const roadDistanceM = Math.round(route.distanceMeters);
  const travelDurationS = Math.round(route.durationMinutes * 60);
  // Practical is a Creator classification (nearest candidates per practical
  // category), not a duration bucket. A distance refresh must retain it.
  const range = recomputedCreatorRange(row.range, route.durationMinutes);
  await db.transaction(async (tx) => {
    // Keep the same lock order as ordinary item PATCH: item first, then its
    // active Creator projection. This avoids an item/materialization deadlock.
    const [lockedItem] = await tx.select({ id: itemsTable.id })
      .from(itemsTable)
      .where(and(eq(itemsTable.id, itemId), isNull(itemsTable.deletedAt)))
      .for("update")
      .limit(1);
    if (!lockedItem) {
      throw new ItemDistanceError("Vnos se je med preračunom spremenil. Poskusite znova.", "conflict");
    }
    const [current] = await tx.select({
      latitude: creatorPlaceMaterializationsTable.latitude,
      longitude: creatorPlaceMaterializationsTable.longitude,
      originLatitude: tenantsTable.latitude,
      originLongitude: tenantsTable.longitude,
    }).from(creatorPlaceMaterializationsTable)
      .innerJoin(tenantsTable, eq(tenantsTable.id, creatorPlaceMaterializationsTable.tenantId))
      .where(and(
        eq(creatorPlaceMaterializationsTable.id, row.materializationId),
        eq(creatorPlaceMaterializationsTable.itemId, itemId),
        eq(creatorPlaceMaterializationsTable.isActive, true),
      ))
      .for("update")
      .limit(1);
    if (!current ||
      current.latitude !== row.latitude || current.longitude !== row.longitude ||
      current.originLatitude !== row.originLatitude || current.originLongitude !== row.originLongitude) {
      throw new ItemDistanceError("Aktivna materializacija ali izhodišče se je med preračunom spremenilo. Poskusite znova.", "conflict");
    }
    const duration = `${Math.round(travelDurationS / 60)} min`;
    await tx.update(itemsTable).set({ distanceMeters: roadDistanceM, duration })
      .where(eq(itemsTable.id, itemId));
    await tx.update(itemDistanceProposalsTable).set({
      distanceMeters: roadDistanceM,
      durationMinutes: travelDurationS / 60,
      updatedAt: new Date(),
    }).where(and(
      eq(itemDistanceProposalsTable.itemId, itemId),
      eq(itemDistanceProposalsTable.status, "approved"),
    ));
    await tx.update(creatorPlaceProposalsTable).set({
      roadDistanceM,
      travelDurationS,
      range,
      updatedAt: new Date(),
    }).where(eq(creatorPlaceProposalsTable.id, row.proposalId));
    await tx.update(creatorPlaceMaterializationsTable).set({
      roadDistanceM,
      travelDurationS,
      range,
      updatedAt: new Date(),
    }).where(eq(creatorPlaceMaterializationsTable.id, row.materializationId));
  });
  return getItemCreatorStatus(itemId);
}