import type { FetchFn } from "./distanceEngine";
import {
  CREATOR_GENERIC_TYPE_WORDS,
  type CreatorSieveCandidate,
} from "./creatorSieve";

export const CREATOR_NEAR_RING_ENVELOPE_KM = 35;
export const CREATOR_NEAR_RING_EDGE_BAND_KM = 5;
export const CREATOR_NEAR_RING_MATCH_THRESHOLD = 2 / 3;
export const CREATOR_NEAR_RING_MATCH_MARGIN = 0.15;

const catalogueCache = new Map<string, {
  originKey: string;
  candidates: CreatorNearRingCandidate[];
}>();

const TRANSIENT_OVERPASS_STATUSES = new Set([429, 502, 503, 504]);
const OVERPASS_RETRY_DELAY_MS = 3_000;
const OVERPASS_REQUEST_SPACING_MS = 1_500;
const TOURISM_VALUES = [
  "attraction", "artwork", "viewpoint", "museum", "gallery", "theme_park", "zoo", "aquarium",
] as const;
const AMENITY_VALUES = ["place_of_worship", "monastery", "museum", "theatre", "arts_centre"] as const;
const LEISURE_VALUES = ["park", "nature_reserve", "garden"] as const;
const NATURAL_VALUES = ["peak", "waterfall", "cave_entrance", "spring", "water", "cliff"] as const;
const MAN_MADE_VALUES = ["tower", "lighthouse"] as const;
const LANDUSE_VALUES = ["winter_sports"] as const;

type OverpassElement = {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, unknown>;
};

export type CreatorNearRingCandidate = CreatorSieveCandidate & {
  aliases: string[];
  isSettlement: boolean;
};

export type CreatorNearRingAttempt = {
  operation: string;
  query: string;
  attempt: number;
  status: number | null;
  durationMs: number;
  rawCount: number;
  filteredCount: number;
  error: string | null;
};

export type CreatorNearRingAttemptCallback = (attempt: CreatorNearRingAttempt) => void;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("sl").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function featureType(tags: Record<string, unknown>): { className: string; type: string; isSettlement: boolean } | null {
  if (typeof tags.tourism === "string" && (TOURISM_VALUES as readonly string[]).includes(tags.tourism)) {
    return { className: "tourism", type: tags.tourism, isSettlement: false };
  }
  if (typeof tags.amenity === "string" && (AMENITY_VALUES as readonly string[]).includes(tags.amenity)) {
    return { className: "amenity", type: tags.amenity, isSettlement: false };
  }
  if (typeof tags.leisure === "string" && (LEISURE_VALUES as readonly string[]).includes(tags.leisure)) {
    return { className: "leisure", type: tags.leisure, isSettlement: false };
  }
  if (typeof tags.natural === "string" && (NATURAL_VALUES as readonly string[]).includes(tags.natural)) {
    return { className: "natural", type: tags.natural, isSettlement: false };
  }
  if (typeof tags.man_made === "string" && (MAN_MADE_VALUES as readonly string[]).includes(tags.man_made)) {
    return { className: "man_made", type: tags.man_made, isSettlement: false };
  }
  if (typeof tags.landuse === "string" && (LANDUSE_VALUES as readonly string[]).includes(tags.landuse)) {
    return { className: "landuse", type: tags.landuse, isSettlement: false };
  }
  if (typeof tags.historic === "string") {
    return { className: "historic", type: tags.historic, isSettlement: false };
  }
  if (tags.type === "route" && typeof tags.route === "string" &&
    ["hiking", "bicycle", "foot", "ski"].includes(tags.route)) {
    return { className: "route", type: tags.route, isSettlement: false };
  }
  if (tags.boundary === "protected_area") {
    return { className: "boundary", type: "protected_area", isSettlement: false };
  }
  if (typeof tags.place === "string" && ["city", "town", "village", "hamlet"].includes(tags.place)) {
    return { className: "settlement", type: tags.place, isSettlement: true };
  }
  return null;
}

function boundingBox(origin: { latitude: number; longitude: number }): string {
  const latitudeDelta = CREATOR_NEAR_RING_ENVELOPE_KM / 111.32;
  const longitudeDelta = CREATOR_NEAR_RING_ENVELOPE_KM /
    (111.32 * Math.max(0.01, Math.cos(origin.latitude * Math.PI / 180)));
  return [
    origin.latitude - latitudeDelta,
    origin.longitude - longitudeDelta,
    origin.latitude + latitudeDelta,
    origin.longitude + longitudeDelta,
  ].map((coordinate) => coordinate.toFixed(6)).join(",");
}

function valuePattern(values: readonly string[]): string {
  return `^(${values.join("|")})$`;
}

function queriesFor(origin: { latitude: number; longitude: number }): Array<{
  operation: string;
  query: string;
}> {
  const box = `(${boundingBox(origin)})`;
  const query = (selectors: string) => `[out:json][timeout:45];(${selectors});out center tags;`;
  return [
    {
      operation: "settlements",
      query: query(`
nwr${box}[place~"^(city|town|village|hamlet)$"][name];
`),
    },
    {
      operation: "tourism-historic",
      query: query(`
nwr${box}[tourism~"${valuePattern(TOURISM_VALUES)}"][name];
nwr${box}[historic][name];
`),
    },
    {
      operation: "amenity-leisure",
      query: query(`
nwr${box}[amenity~"${valuePattern(AMENITY_VALUES)}"][name];
nwr${box}[leisure~"${valuePattern(LEISURE_VALUES)}"][name];
`),
    },
    {
      operation: "natural-landmarks-routes",
      query: query(`
nwr${box}[natural~"${valuePattern(NATURAL_VALUES)}"][name];
nwr${box}[man_made~"${valuePattern(MAN_MADE_VALUES)}"][name];
nwr${box}[landuse~"${valuePattern(LANDUSE_VALUES)}"][name];
nwr${box}[boundary=protected_area][name];
relation${box}[type=route][route~"^(hiking|bicycle|foot|ski)$"][name];
`),
    },
  ];
}

function candidatesFromElements(
  elements: OverpassElement[],
  origin: { latitude: number; longitude: number },
): CreatorNearRingCandidate[] {
  return elements.flatMap((element) => {
    const tags = element.tags ?? {};
    const name = typeof tags.name === "string" ? tags.name.trim() : "";
    const latitude = Number(element.lat ?? element.center?.lat);
    const longitude = Number(element.lon ?? element.center?.lon);
    const id = Number(element.id);
    if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(id)) return [];
    const classification = featureType(tags);
    if (!classification || tags.highway || tags.boundary === "administrative") return [];
    const distanceKm = haversineKm(origin.latitude, origin.longitude, latitude, longitude);
    if (distanceKm > CREATOR_NEAR_RING_ENVELOPE_KM) return [];
    const aliases = Object.entries(tags)
      .filter(([key, value]) => key === "alt_name" || key.startsWith("name:"))
      .flatMap(([, value]) => typeof value === "string" ? value.split(";").map((alias) => alias.trim()).filter(Boolean) : []);
    return [{
      osmType: String(element.type ?? ""),
      osmId: id,
      className: classification.className,
      type: classification.type,
      addresstype: classification.className,
      returnedName: name,
      displayName: name,
      latitude,
      longitude,
      distanceKm,
      aliases,
      isSettlement: classification.isSettlement,
    }];
  });
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function runOverpassQuery(
  operation: string,
  query: string,
  origin: { latitude: number; longitude: number },
  fetchFn: FetchFn,
  onAttempt?: CreatorNearRingAttemptCallback,
): Promise<CreatorNearRingCandidate[]> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetchFn("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "Smart360 Creator near-ring enumeration (admin contact via replit deployment)",
        },
        body: new URLSearchParams({ data: query }),
      });
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      onAttempt?.({
        operation, query, attempt, status: null, durationMs: Date.now() - startedAt,
        rawCount: 0, filteredCount: 0, error,
      });
      if (attempt === 1) {
        await sleep(OVERPASS_RETRY_DELAY_MS);
        continue;
      }
      throw cause;
    }
    if (!response.ok) {
      const error = `Overpass ${response.status}`;
      onAttempt?.({
        operation, query, attempt, status: response.status, durationMs: Date.now() - startedAt,
        rawCount: 0, filteredCount: 0, error,
      });
      if (attempt === 1 && TRANSIENT_OVERPASS_STATUSES.has(response.status)) {
        await sleep(OVERPASS_RETRY_DELAY_MS);
        continue;
      }
      throw new Error(error);
    }
    try {
      const payload = await response.json() as { elements?: unknown };
      if (!Array.isArray(payload.elements)) throw new Error("Overpass returned an invalid response.");
      const elements = payload.elements as OverpassElement[];
      const candidates = candidatesFromElements(elements, origin);
      onAttempt?.({
        operation, query, attempt, status: response.status, durationMs: Date.now() - startedAt,
        rawCount: elements.length, filteredCount: candidates.length, error: null,
      });
      return candidates;
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      onAttempt?.({
        operation, query, attempt, status: response.status, durationMs: Date.now() - startedAt,
        rawCount: 0, filteredCount: 0, error,
      });
      throw cause;
    }
  }
  throw new Error("Overpass retry exhausted.");
}

export async function enumerateCreatorNearRing(
  origin: { latitude: number; longitude: number },
  fetchFn: FetchFn = fetch,
  onAttempt?: CreatorNearRingAttemptCallback,
): Promise<CreatorNearRingCandidate[]> {
  const batches: CreatorNearRingCandidate[][] = [];
  const failures: string[] = [];
  for (const [index, { operation, query }] of queriesFor(origin).entries()) {
    if (index > 0 && fetchFn === fetch) await sleep(OVERPASS_REQUEST_SPACING_MS);
    try {
      batches.push(await runOverpassQuery(operation, query, origin, fetchFn, onAttempt));
    } catch (error) {
      failures.push(`${operation}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (batches.length === 0) {
    throw new Error(`All Overpass catalogue requests failed: ${failures.join("; ")}`);
  }
  const merged = new Map<string, CreatorNearRingCandidate>();
  for (const candidate of batches.flat()) {
    const key = `${candidate.osmType}:${candidate.osmId}`;
    if (!merged.has(key)) merged.set(key, candidate);
  }
  return [...merged.values()];
}

export async function getCachedCreatorNearRing(
  tenantId: string,
  origin: { latitude: number; longitude: number },
  fetchFn: FetchFn = fetch,
  onAttempt?: CreatorNearRingAttemptCallback,
): Promise<CreatorNearRingCandidate[]> {
  const originKey = `${origin.latitude},${origin.longitude}`;
  const cached = catalogueCache.get(tenantId);
  if (cached?.originKey === originKey) return cached.candidates;
  const attempts: CreatorNearRingAttempt[] = [];
  const candidates = await enumerateCreatorNearRing(origin, fetchFn, (attempt) => {
    attempts.push(attempt);
    onAttempt?.(attempt);
  });
  const finalAttempts = [...new Map(
    attempts.map((attempt) => [attempt.operation, attempt]),
  ).values()];
  if (finalAttempts.every((attempt) => attempt.error === null)) {
    catalogueCache.set(tenantId, { originKey, candidates });
  }
  return candidates;
}

export function clearCreatorNearRingCacheForTests(): void {
  catalogueCache.clear();
}

export function deriveNearestSurroundingSettlementNames(
  candidates: CreatorNearRingCandidate[],
  limit = 16,
): Set<string> {
  const ordered = candidates.filter((candidate) => candidate.isSettlement)
    .sort((a, b) =>
      a.distanceKm - b.distanceKm ||
      normalize(a.returnedName).localeCompare(normalize(b.returnedName), "sl") ||
      a.osmType.localeCompare(b.osmType) ||
      a.osmId - b.osmId);
  const names = new Set<string>();
  const normalizedNames = new Set<string>();
  for (const candidate of ordered) {
    const normalizedName = normalize(candidate.returnedName);
    if (!normalizedName || normalizedNames.has(normalizedName)) continue;
    normalizedNames.add(normalizedName);
    names.add(candidate.returnedName);
    if (names.size >= limit) break;
  }
  return names;
}

function isExplicitSettlementProposal(name: string): boolean {
  return /\b(mesto|mestno|vas|vasica|naselje|settlement|city|town|village|hamlet)\b/iu.test(name);
}

function strippedNames(name: string, osmType: string): string[] {
  const normalized = normalize(name).split(" ")
    .filter((token) => !["v", "na", "pri", "pod"].includes(token)).join(" ");
  const values = new Set([normalized]);
  if (["city", "town", "village", "hamlet"].includes(osmType)) {
    for (const settlementWord of ["mesto", "vas", "vasica", "naselje"]) {
      if (normalized.startsWith(`${settlementWord} `)) {
        values.add(normalized.slice(settlementWord.length + 1));
      }
    }
  }
  for (const entry of CREATOR_GENERIC_TYPE_WORDS) {
    if (!entry.osmTypes.includes(osmType)) continue;
    for (const phrase of entry.words) {
      const generic = normalize(phrase);
      if (normalized.startsWith(`${generic} `)) values.add(normalized.slice(generic.length + 1));
      if (normalized.endsWith(` ${generic}`)) values.add(normalized.slice(0, -(generic.length + 1)));
    }
  }
  return [...values];
}

/**
 * Tolerance is safe only inside the bounded enumeration: compatible generic
 * phrases are stripped with OSM-type corroboration, then one missing/extra
 * token is allowed. Ambiguity always returns null.
 */
export function matchUniqueCreatorNearRingCandidate(
  proposedName: string,
  candidates: CreatorNearRingCandidate[],
): CreatorNearRingCandidate | null {
  const scored = candidates.flatMap((candidate) => {
    if (candidate.isSettlement && !isExplicitSettlementProposal(proposedName)) return [];
    const normalizedProposal = normalize(proposedName);
    const proposalGenericTypes = CREATOR_GENERIC_TYPE_WORDS.filter((entry) =>
      entry.words.some((phrase) => {
        const generic = normalize(phrase);
        return normalizedProposal === generic ||
          normalizedProposal.startsWith(`${generic} `) ||
          normalizedProposal.endsWith(` ${generic}`);
      }),
    );
    if (
      proposalGenericTypes.length > 0 &&
      !proposalGenericTypes.some((entry) => entry.osmTypes.includes(candidate.type))
    ) return [];
    const proposed = strippedNames(proposedName, candidate.type);
    const candidateNames = [candidate.returnedName, ...candidate.aliases]
      .flatMap((name) => strippedNames(name, candidate.type));
    let score = 0;
    for (const left of proposed) {
      for (const right of candidateNames) {
        if (left === right) {
          score = 1;
          continue;
        }
        const a = new Set(left.split(" "));
        const b = new Set(right.split(" "));
        const shared = [...a].filter((token) => b.has(token)).length;
        const tolerant = shared >= (Math.min(a.size, b.size) === 1 ? 1 : 2) &&
          shared >= Math.min(a.size, b.size) - 1 &&
          Math.max(a.size, b.size) - shared <= 1;
        if (tolerant) score = Math.max(score, shared / Math.max(a.size, b.size));
      }
    }
    return score > 0 ? [{ candidate, score }] : [];
  });
  scored.sort((a, b) => b.score - a.score);
  const passing = scored.filter(({ score }) => score >= CREATOR_NEAR_RING_MATCH_THRESHOLD);
  if (passing.length !== 1) return null;
  const top = scored[0]!;
  const second = scored[1];
  if (second && top.score - second.score < CREATOR_NEAR_RING_MATCH_MARGIN) return null;
  return top.candidate;
}