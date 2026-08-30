import { acquireNominatimTurn, type FetchFn } from "./distanceEngine";

export const CREATOR_EDITORIAL_RADIUS_KM = 15;
export const CREATOR_DEFAULT_HARD_CEILING_KM = 120;

export type CreatorSieveCandidate = {
  osmType: string;
  osmId: number;
  className: string;
  type: string;
  addresstype: string;
  returnedName: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

export type CreatorSieveResult =
  | { verdict: "resolved"; candidate: CreatorSieveCandidate; outsideEditorialRadius: boolean }
  | { verdict: "refused"; rule: string; candidates: CreatorSieveCandidate[] };

type RawResult = {
  osm_type?: unknown; osm_id?: unknown; category?: unknown; type?: unknown;
  addresstype?: unknown; name?: unknown; display_name?: unknown;
  lat?: unknown; lon?: unknown; namedetails?: unknown; importance?: unknown;
  address?: unknown;
};

const BLOCKED_CLASSES = new Set(["boundary", "place", "highway"]);
const BLOCKED_ADDRESS_TYPES = new Set([
  "administrative", "borough", "city", "city_block", "country", "county",
  "district", "hamlet", "municipality", "postcode", "quarter", "road",
  "state", "state_district", "suburb", "town", "village",
]);

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("sl")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function namesOf(raw: RawResult): string[] {
  const details = raw.namedetails && typeof raw.namedetails === "object"
    ? Object.values(raw.namedetails as Record<string, unknown>).filter((v): v is string => typeof v === "string")
    : [];
  const direct = typeof raw.name === "string" && raw.name
    ? raw.name
    : typeof raw.display_name === "string" ? raw.display_name.split(",")[0]!.trim() : "";
  return [direct, ...details].filter(Boolean);
}

const GENERIC_TYPE_WORDS: Record<string, string> = {
  waterfall: "slap",
  cave: "jama",
  castle: "grad",
  museum: "muzej",
  church: "cerkev",
  lake: "jezero",
  gorge: "soteska",
  alpine_pasture: "planina",
};

function matchesName(query: string, raw: RawResult): boolean {
  const normalizedQuery = normalizeName(query);
  const candidateNames = namesOf(raw).map(normalizeName);
  if (candidateNames.includes(normalizedQuery)) return true;
  let queryTokens = normalizedQuery.split(" ");
  const genericWord = GENERIC_TYPE_WORDS[String(raw.type ?? "")];
  if (genericWord && queryTokens[0] === genericWord) queryTokens = queryTokens.slice(1);
  else if (genericWord && queryTokens.at(-1) === genericWord) queryTokens = queryTokens.slice(0, -1);
  if (candidateNames.includes(queryTokens.join(" "))) return true;

  const address = raw.address && typeof raw.address === "object"
    ? raw.address as Record<string, unknown>
    : {};
  const addressTokens = new Set(
    ["village", "town", "municipality", "county"].flatMap((key) =>
      typeof address[key] === "string" ? normalizeName(address[key]).split(" ") : []),
  );
  return candidateNames.some((candidateName) => {
    const remaining = [...queryTokens];
    for (const token of candidateName.split(" ")) {
      const index = remaining.indexOf(token);
      if (index < 0) return false;
      remaining.splice(index, 1);
    }
    return remaining.length > 0 && remaining.every((token) => addressTokens.has(token));
  });
}

export async function runCreatorSieve(
  name: string,
  origin: { latitude: number; longitude: number },
  options: { hardCeilingKm?: number; fetchFn?: FetchFn } = {},
): Promise<CreatorSieveResult> {
  const hardCeilingKm = options.hardCeilingKm ?? CREATOR_DEFAULT_HARD_CEILING_KM;
  const fetchFn = options.fetchFn ?? fetch;
  const latDelta = CREATOR_EDITORIAL_RADIUS_KM / 111.32;
  const lonDelta = CREATOR_EDITORIAL_RADIUS_KM /
    (111.32 * Math.cos(origin.latitude * Math.PI / 180));
  const fetchResults = async (query: string): Promise<unknown> => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "10");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("layer", "poi,natural,manmade");
    url.searchParams.set("viewbox", [
      origin.longitude - lonDelta, origin.latitude + latDelta,
      origin.longitude + lonDelta, origin.latitude - latDelta,
    ].join(","));
    url.searchParams.set("bounded", "0");
    url.searchParams.set("q", query);
    await acquireNominatimTurn();
    const response = await fetchFn(url, {
      headers: { "User-Agent": "Smart360 Creator sieve (admin contact via replit deployment)" },
    });
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    return response.json();
  };

  let matchedQuery = name;
  let data = await fetchResults(name);
  if (!Array.isArray(data) || data.length === 0) {
    const shortened = name.replace(/\s+(?:na|pod|pri)\s+\S+(?:\s+\S+)*$/iu, "").trim();
    if (shortened !== name) {
      matchedQuery = shortened;
      data = await fetchResults(shortened);
    }
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { verdict: "refused", rule: "no-results", candidates: [] };
  }

  const structurallyAllowed: Array<{ raw: RawResult; candidate: CreatorSieveCandidate; importance: number }> = [];
  let sawBlocked = false;
  let sawMissingClassification = false;
  let sawNameMismatch = false;
  let sawBeyondCeiling = false;
  const allParsed: CreatorSieveCandidate[] = [];

  for (const raw of data as RawResult[]) {
    const latitude = typeof raw.lat === "string" ? Number(raw.lat) : NaN;
    const longitude = typeof raw.lon === "string" ? Number(raw.lon) : NaN;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const category =
      typeof raw.category === "string" && raw.category ? raw.category : null;
    const addressType =
      typeof raw.addresstype === "string" && raw.addresstype
        ? raw.addresstype
        : null;
    const candidate: CreatorSieveCandidate = {
      osmType: String(raw.osm_type ?? ""),
      osmId: Number(raw.osm_id),
      className: category ?? "",
      type: String(raw.type ?? ""),
      addresstype: addressType ?? "",
      returnedName: namesOf(raw)[0] ?? "",
      latitude, longitude,
      distanceKm: haversineKm(origin.latitude, origin.longitude, latitude, longitude),
    };
    allParsed.push(candidate);
    if (!category || !addressType) {
      sawMissingClassification = true;
      continue;
    }
    if (BLOCKED_CLASSES.has(candidate.className) || BLOCKED_ADDRESS_TYPES.has(candidate.addresstype)) {
      sawBlocked = true;
      continue;
    }
    if (!matchesName(matchedQuery, raw)) {
      sawNameMismatch = true;
      continue;
    }
    if (candidate.distanceKm > hardCeilingKm) {
      sawBeyondCeiling = true;
      continue;
    }
    structurallyAllowed.push({
      raw,
      candidate,
      importance: typeof raw.importance === "number" ? raw.importance : 0,
    });
  }

  if (structurallyAllowed.length === 0) {
    const rule = sawMissingClassification ? "missing-classification"
      : sawBeyondCeiling ? "hard-ceiling"
      : sawNameMismatch ? "name-mismatch"
      : sawBlocked ? "blocked-class-or-addresstype"
      : "no-usable-result";
    return { verdict: "refused", rule, candidates: allParsed };
  }

  structurallyAllowed.sort((a, b) =>
    b.importance - a.importance || a.candidate.distanceKm - b.candidate.distanceKm);
  const best = structurallyAllowed[0]!;
  const equallyPlausible = structurallyAllowed.filter((entry) =>
    entry !== best &&
    entry.importance === best.importance &&
    entry.candidate.className === best.candidate.className &&
    entry.candidate.type === best.candidate.type);
  if (equallyPlausible.length > 0) {
    return {
      verdict: "refused",
      rule: "equally-plausible",
      candidates: [best, ...equallyPlausible].map((entry) => entry.candidate),
    };
  }
  return {
    verdict: "resolved",
    candidate: best.candidate,
    outsideEditorialRadius: best.candidate.distanceKm > CREATOR_EDITORIAL_RADIUS_KM,
  };
}