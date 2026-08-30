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
  for (const key of ["tourism", "natural", "historic", "amenity", "leisure", "man_made", "protected_area"]) {
    if (typeof tags[key] === "string") return { className: key, type: tags[key], isSettlement: false };
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

export async function enumerateCreatorNearRing(
  origin: { latitude: number; longitude: number },
  fetchFn: FetchFn = fetch,
): Promise<CreatorNearRingCandidate[]> {
  const around = `(around:${CREATOR_NEAR_RING_ENVELOPE_KM * 1000},${origin.latitude},${origin.longitude})`;
  const query = `[out:json][timeout:25];(
nwr${around}[tourism][name];
nwr${around}[natural][name];
nwr${around}[man_made][name];
nwr${around}[historic][name];
nwr${around}[leisure][name];
nwr${around}[amenity][name];
nwr${around}[boundary=protected_area][name];
relation${around}[type=route][route~"^(hiking|bicycle|foot|ski)$"][name];
nwr${around}[place~"^(city|town|village|hamlet)$"][name];
);out center tags;`;
  const response = await fetchFn("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "Smart360 Creator near-ring enumeration (admin contact via replit deployment)",
    },
    body: new URLSearchParams({ data: query }),
  });
  if (!response.ok) throw new Error(`Overpass ${response.status}`);
  const payload = await response.json() as { elements?: unknown };
  if (!Array.isArray(payload.elements)) throw new Error("Overpass returned an invalid response.");
  return (payload.elements as OverpassElement[]).flatMap((element) => {
    const tags = element.tags ?? {};
    const name = typeof tags.name === "string" ? tags.name.trim() : "";
    const latitude = Number(element.lat ?? element.center?.lat);
    const longitude = Number(element.lon ?? element.center?.lon);
    const id = Number(element.id);
    if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(id)) return [];
    const classification = featureType(tags);
    if (!classification || tags.highway || tags.boundary === "administrative") return [];
    const aliases = Object.entries(tags)
      .filter(([key, value]) => key === "alt_name" || key.startsWith("name:"))
      .flatMap(([, value]) => typeof value === "string" ? value.split(";").map((name) => name.trim()).filter(Boolean) : []);
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
      distanceKm: haversineKm(origin.latitude, origin.longitude, latitude, longitude),
      aliases,
      isSettlement: classification.isSettlement,
    }];
  });
}

export async function getCachedCreatorNearRing(
  tenantId: string,
  origin: { latitude: number; longitude: number },
  fetchFn: FetchFn = fetch,
): Promise<CreatorNearRingCandidate[]> {
  const originKey = `${origin.latitude},${origin.longitude}`;
  const cached = catalogueCache.get(tenantId);
  if (cached?.originKey === originKey) return cached.candidates;
  const candidates = await enumerateCreatorNearRing(origin, fetchFn);
  catalogueCache.set(tenantId, { originKey, candidates });
  return candidates;
}

export function clearCreatorNearRingCacheForTests(): void {
  catalogueCache.clear();
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