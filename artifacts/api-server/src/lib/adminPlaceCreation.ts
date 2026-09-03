import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  categoriesTable,
  creatorPlaceProposalsTable,
  creatorProposalTranslationsTable,
  creatorRunsTable,
  creatorVerificationAttemptsTable,
  creatorVerificationCandidatesTable,
  db,
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

export async function adminPlaceDuplicateKeys(tenantId: string) {
  const proposals = await db.select({
    osmType: creatorPlaceProposalsTable.osmType,
    osmId: creatorPlaceProposalsTable.osmId,
    normalizedName: creatorPlaceProposalsTable.normalizedName,
  }).from(creatorPlaceProposalsTable).where(and(
    eq(creatorPlaceProposalsTable.tenantId, tenantId),
    eq(creatorPlaceProposalsTable.contentReady, true),
    inArray(creatorPlaceProposalsTable.status, ["pending", "approved"]),
  ));
  const items = await db.select({ title: itemsTable.title })
    .from(itemsTable)
    .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(and(eq(sectionsTable.tenantId, tenantId), isNull(itemsTable.deletedAt)));
  return {
    osm: new Set(proposals.flatMap((row) => row.osmType && row.osmId !== null ? [`${row.osmType}:${row.osmId}`] : [])),
    names: new Set([
      ...proposals.map((row) => row.normalizedName),
      ...items.flatMap((row) => row.title ? [normalizeCreatorProposalName(row.title)] : []),
    ]),
  };
}

export async function searchAdminPlaces(categoryId: string, query: string) {
  const ctx = await context(categoryId);
  const q = query.trim().replace(/\s+/g, " ");
  if (q.length < 2 || q.length > 160) throw new CreatorBulkApprovalError("Vnesite vsaj dva znaka.");
  const [rows, duplicates] = await Promise.all([
    fetchAdminPlaceNominatim("/search", { q, limit: "8", namedetails: "1" }),
    adminPlaceDuplicateKeys(ctx.tenantId),
  ]);
  const candidates = rows.flatMap((row) => {
    const place = parsedPlace(row);
    if (!place) return [];
    const duplicate = duplicates.osm.has(`${place.osmType}:${place.osmId}`) ||
      duplicates.names.has(normalizeCreatorProposalName(place.name));
    return [{
      ...place,
      straightLineDistanceM: Math.round(straightDistanceM(ctx, place)),
      duplicate,
      duplicateLabel: duplicate ? "že v vodniku" as const : null,
    }];
  });
  return { originLatitude: ctx.latitude, originLongitude: ctx.longitude, candidates };
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