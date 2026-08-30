import { acquireNominatimTurn, type FetchFn } from "./distanceEngine";

export const CREATOR_DEFAULT_HARD_CEILING_KM = 120;

export type CreatorSieveCandidate = {
  osmType: string;
  osmId: number;
  className: string;
  type: string;
  addresstype: string;
  returnedName: string;
  displayName: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

export type CreatorConfirmationMethod =
  | "exact"
  | "generic_type"
  | "address_token"
  | "shortened_query";

export type CreatorSieveAttemptEvidence = {
  attemptNumber: 1 | 2;
  query: string;
  verdict: "resolved" | "refused";
  refusalRule: string | null;
  candidates: Array<{
    osmType: string | null;
    osmId: number | null;
    osmCategory: string | null;
    osmFeatureType: string | null;
    osmAddressType: string | null;
    resolvedName: string | null;
    latitude: number | null;
    longitude: number | null;
    straightLineDistanceM: number | null;
    selected: boolean;
  }>;
};

export type CreatorSieveResult =
  | {
    verdict: "resolved";
    candidate: CreatorSieveCandidate;
    originalQuery: string;
    confirmedQuery: string;
    confirmationMethod: CreatorConfirmationMethod;
    attempts: CreatorSieveAttemptEvidence[];
  }
  | {
    verdict: "refused";
    rule: string;
    candidates: CreatorSieveCandidate[];
    originalQuery: string;
    confirmedQuery: null;
    confirmationMethod: null;
    attempts: CreatorSieveAttemptEvidence[];
  };

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

export const CREATOR_GENERIC_TYPE_WORDS: ReadonlyArray<{
  words: readonly string[];
  osmTypes: readonly string[];
}> = [
  { words: ["slap", "slapovi"], osmTypes: ["waterfall"] },
  { words: ["jama"], osmTypes: ["cave", "cave_entrance"] },
  { words: ["grad"], osmTypes: ["castle"] },
  { words: ["cerkev"], osmTypes: ["church", "place_of_worship"] },
  { words: ["planina"], osmTypes: ["alpine_pasture"] },
  { words: ["jezero"], osmTypes: ["lake"] },
  { words: ["koča", "dom"], osmTypes: ["alpine_hut"] },
  { words: ["muzej"], osmTypes: ["museum"] },
  { words: ["soteska"], osmTypes: ["gorge"] },
  { words: ["izvir"], osmTypes: ["spring"] },
];

function matchesName(query: string, raw: RawResult): Exclude<CreatorConfirmationMethod, "shortened_query"> | null {
  const normalizedQuery = normalizeName(query);
  const candidateNames = namesOf(raw).map(normalizeName);
  if (candidateNames.includes(normalizedQuery)) return "exact";
  let queryTokens = normalizedQuery.split(" ");
  const genericWords = CREATOR_GENERIC_TYPE_WORDS.find((entry) =>
    entry.osmTypes.includes(String(raw.type ?? "")),
  )?.words;
  if (genericWords?.includes(queryTokens[0]!)) queryTokens = queryTokens.slice(1);
  else if (genericWords?.includes(queryTokens.at(-1)!)) queryTokens = queryTokens.slice(0, -1);
  if (candidateNames.includes(queryTokens.join(" "))) return "generic_type";

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
  }) ? "address_token" : null;
}

async function runCreatorSieveInternal(
  name: string,
  origin: { latitude: number; longitude: number },
  options: { hardCeilingKm?: number; fetchFn?: FetchFn; omitLayerForHarness?: boolean; onNominatimWait?: (milliseconds: number) => void; fallbackQuery?: string } = {},
): Promise<CreatorSieveResult> {
  const hardCeilingKm = options.hardCeilingKm ?? CREATOR_DEFAULT_HARD_CEILING_KM;
  const fetchFn = options.fetchFn ?? fetch;
  // Nominatim treats an unbounded viewbox as a ranking hint.  This is not an
  // editorial radius; existence is only rejected at the 120km hard ceiling.
  const latDelta = hardCeilingKm / 111.32;
  const lonDelta = hardCeilingKm /
    (111.32 * Math.cos(origin.latitude * Math.PI / 180));
  const fetched: Array<{ query: string; data: unknown }> = [];
  const fetchResults = async (query: string): Promise<unknown> => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "10");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("addressdetails", "1");
    if (!options.omitLayerForHarness) {
      url.searchParams.set("layer", "poi,natural,manmade");
    }
    url.searchParams.set("viewbox", [
      origin.longitude - lonDelta, origin.latitude + latDelta,
      origin.longitude + lonDelta, origin.latitude - latDelta,
    ].join(","));
    url.searchParams.set("bounded", "0");
    url.searchParams.set("q", query);
    options.onNominatimWait?.(await acquireNominatimTurn());
    const response = await fetchFn(url, {
      headers: { "User-Agent": "Smart360 Creator sieve (admin contact via replit deployment)" },
    });
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    return response.json();
  };

  let matchedQuery = name;
  let data = await fetchResults(name);
  fetched.push({ query: name, data });
  if (!Array.isArray(data) || data.length === 0) {
    const retryQuery = options.fallbackQuery?.trim()
      || name.replace(/\s+(?:na|pod|pri)\s+\S+(?:\s+\S+)*$/iu, "").trim();
    if (retryQuery !== name) {
      matchedQuery = retryQuery;
      data = await fetchResults(retryQuery);
      fetched.push({ query: retryQuery, data });
    }
  }
  const evidenceCandidates = (rawData: unknown): CreatorSieveAttemptEvidence["candidates"] =>
    Array.isArray(rawData) ? (rawData as RawResult[]).map((raw) => {
      const latitude = typeof raw.lat === "string" && Number.isFinite(Number(raw.lat)) ? Number(raw.lat) : null;
      const longitude = typeof raw.lon === "string" && Number.isFinite(Number(raw.lon)) ? Number(raw.lon) : null;
      const osmId = Number(raw.osm_id);
      return {
        osmType: typeof raw.osm_type === "string" && raw.osm_type ? raw.osm_type : null,
        osmId: Number.isFinite(osmId) ? osmId : null,
        osmCategory: typeof raw.category === "string" && raw.category ? raw.category : null,
        osmFeatureType: typeof raw.type === "string" && raw.type ? raw.type : null,
        osmAddressType: typeof raw.addresstype === "string" && raw.addresstype ? raw.addresstype : null,
        resolvedName: namesOf(raw)[0] ?? null,
        latitude,
        longitude,
        straightLineDistanceM: latitude !== null && longitude !== null
          ? haversineKm(origin.latitude, origin.longitude, latitude, longitude) * 1000
          : null,
        selected: false,
      };
    }) : [];
  const attempts = (
    finalVerdict: "resolved" | "refused",
    finalRule: string | null,
    selected: CreatorSieveCandidate | null = null,
  ): CreatorSieveAttemptEvidence[] => fetched.map((entry, index) => {
    const isFinal = index === fetched.length - 1;
    const candidates = evidenceCandidates(entry.data);
    if (isFinal && selected) {
      const selectedCandidate = candidates.find((candidate) =>
        candidate.osmType === selected.osmType && candidate.osmId === selected.osmId);
      if (selectedCandidate) selectedCandidate.selected = true;
    }
    return {
      attemptNumber: (index + 1) as 1 | 2,
      query: entry.query,
      verdict: isFinal ? finalVerdict : "refused",
      refusalRule: isFinal ? finalRule : "no-results",
      candidates,
    };
  });
  if (!Array.isArray(data) || data.length === 0) {
    return {
      verdict: "refused",
      rule: "no-results",
      candidates: [],
      originalQuery: name,
      confirmedQuery: null,
      confirmationMethod: null,
      attempts: attempts("refused", "no-results"),
    };
  }

  const structurallyAllowed: Array<{
    raw: RawResult;
    candidate: CreatorSieveCandidate;
    importance: number;
    confirmationMethod: Exclude<CreatorConfirmationMethod, "shortened_query">;
  }> = [];
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
      displayName: typeof raw.display_name === "string" ? raw.display_name : "",
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
    // An explicit C1 lookup hint affects retrieval only; identity matching
    // remains anchored to the plain proposed name. Step B's built-in shortened
    // retry keeps its established shortened-name matching behavior.
    const confirmationMethod = matchesName(options.fallbackQuery ? name : matchedQuery, raw);
    if (!confirmationMethod) {
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
      confirmationMethod,
    });
  }

  if (structurallyAllowed.length === 0) {
    const rule = sawMissingClassification ? "missing-classification"
      : sawBeyondCeiling ? "hard-ceiling"
      : sawNameMismatch ? "name-mismatch"
      : sawBlocked ? "blocked-class-or-addresstype"
      : "no-usable-result";
    return {
      verdict: "refused",
      rule,
      candidates: allParsed,
      originalQuery: name,
      confirmedQuery: null,
      confirmationMethod: null,
      attempts: attempts("refused", rule),
    };
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
      originalQuery: name,
      confirmedQuery: null,
      confirmationMethod: null,
      attempts: attempts("refused", "equally-plausible"),
    };
  }
  return {
    verdict: "resolved",
    candidate: best.candidate,
    originalQuery: name,
    confirmedQuery: matchedQuery,
    confirmationMethod: matchedQuery !== name ? "shortened_query" : best.confirmationMethod,
    attempts: attempts("resolved", null, best.candidate),
  };
}

export function runCreatorSieve(
  name: string,
  origin: { latitude: number; longitude: number },
  options: { hardCeilingKm?: number; fetchFn?: FetchFn; onNominatimWait?: (milliseconds: number) => void; fallbackQuery?: string } = {},
): Promise<CreatorSieveResult> {
  return runCreatorSieveInternal(name, origin, options);
}

/** Test harness only: production callers cannot omit the Nominatim layer filter. */
export function runCreatorSieveClassificationHarness(
  name: string,
  origin: { latitude: number; longitude: number },
  options: { hardCeilingKm?: number; fetchFn?: FetchFn; onNominatimWait?: (milliseconds: number) => void } = {},
): Promise<CreatorSieveResult> {
  return runCreatorSieveInternal(name, origin, {
    ...options,
    omitLayerForHarness: true,
  });
}