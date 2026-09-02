export const CREATOR_SHARED_CATEGORY_KEYS = [
  "welcome", "apart", "loc", "park", "gate", "equip", "check", "wifi", "house", "pool",
  "sup", "scooter", "fitness", "grill", "boat", "ferry", "games", "oil", "ice",
  "breakfast", "culinary", "night", "pizza", "act", "hike", "bike", "beach", "culture",
  "nature", "trips", "events",
  "shops", "bakery", "gas", "atm", "pharm", "hosp",
] as const;

export type CreatorSharedCategory = typeof CREATOR_SHARED_CATEGORY_KEYS[number];

const LEGACY_FALLBACKS: Record<string, CreatorSharedCategory> = {
  act: "act",
  food: "culinary",
  hike: "hike",
  sights: "culture",
  trips: "trips",
};

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/\p{M}/gu, "")
  .toLocaleLowerCase("sl");

/**
 * Deterministic category assignment shared by model grounding, HTML extraction
 * and the audited Gril remap. Specific categories win before broad fallbacks.
 */
export function classifyCreatorSharedCategory(input: {
  name: string;
  context?: string | null;
  suggestedCategory?: string | null;
}): CreatorSharedCategory {
  const text = normalize(`${input.name}\n${input.context ?? ""}`);

  if (/\b(bankomat\w*|atm)\b/u.test(text)) return "atm";
  if (/\b(lekarn\w*|pharmacy|farmacia)\b/u.test(text)) return "pharm";
  if (/\b(bolnisnica|zdravstveni dom|health centre|hospital|ambulanta|urgenca)\b/u.test(text)) return "hosp";
  if (/\b(bencinsk\w*|crpalk\w*|petrol|gorivo|fuel station)\b/u.test(text)) return "gas";
  if (/\b(pekarn\w*|bakery|panificio)\b/u.test(text)) return "bakery";
  if (/\b(trgovin\w*|market|supermarket|shop|mercator|spar|tus|hofer|lidl)\b/u.test(text)) return "shops";

  if (/\b(zajtrk|breakfast|fruhstuck|colazione)\b/u.test(text)) return "breakfast";
  if (/\b(picerija|pizzeria|pizza)\b/u.test(text)) return "pizza";
  if (/\b(nocni klub|night club|nightlife|diskoteka|disco|bar\b|pub\b)\b/u.test(text)) return "night";
  // Mountain huts are trail infrastructure even when their evidence mentions food.
  if (/\b(planinski dom|planinska koca|koca|zavetisce|bivak)\b/u.test(text)) return "hike";
  if (/\b(gostiln\w*|gostisc\w*|restavracij\w*|restaurant|okrepcevalnic\w*|kavarn\w*|cafe|kulinar\w*|hrana|kosil\w*|izletnisk\w+ kmetij\w*|domac\w+ kuhinj\w*)\b/u.test(text)) return "culinary";

  if (/\b(festival|prireditev|dogodek|koncert|razstava|sejem|delavnica|maraton|bal\b|orkester|predstava)\b/u.test(text)) return "events";
  if (/\b(plaza|beach|kopalisce|kopalna obala)\b/u.test(text)) return "beach";
  if (/\b(koles\w*|cycling|cycle|bike|biking|mtb)\b/u.test(text)) return "bike";
  if (/\b(rafting|kajak|kayak|kanu|zipline|adrenalinski park|funpark|smuc|paragliding|padalstvo|ribolov|jahanje|sport|dozivetje|vzletisce|pristajalisce)\b/u.test(text)) return "act";
  if (/\b(planinsk|pohod|gora|vrh|hrib|bivak|koca|zavetisce|planina|travnik|pespot|pes pot|ucna pot|tematska pot|sprehajalna pot)\b/u.test(text)) return "hike";
  if (/^gornji grad$/u.test(normalize(input.name).trim())) return "trips";
  if (/\b(muzej|cerkev|kapela|katedrala|grad\b|dvorec|spomenik|galerija|knjiznica|kulturn|arheolog|etnograf|dediscina|samostan|sakral)\b/u.test(text)) return "culture";
  if (/\b(slap|jama|dolina|soteska|izvir|jezero|ribnik|reka|savinja|waterway|river|naravni park|krajinski park|naravni rezervat|naravna vrednota|botanicni vrt|arboretum|gaj\b|mokrisce|votlina)\b/u.test(text)) return "nature";

  if (/\b(sup\b|stand up paddle)\b/u.test(text)) return "sup";
  if (/\b(skiro|scooter)\b/u.test(text)) return "scooter";
  if (/\b(fitnes|fitness|gym)\b/u.test(text)) return "fitness";
  if (/\b(zar|grill|barbecue|bbq)\b/u.test(text)) return "grill";
  if (/\b(coln|boat|barka|plovilo)\b/u.test(text)) return "boat";
  if (/\b(trajekt|ferry)\b/u.test(text)) return "ferry";
  if (/\b(igralnica|druzabne igre|board games|otrosko igrisce)\b/u.test(text)) return "games";
  if (/\b(oljcno olje|olive oil|oljarna)\b/u.test(text)) return "oil";
  if (/\b(ledomat|ice machine|ice maker)\b/u.test(text)) return "ice";
  if (/\b(bazen|pool|aquapark|vodni park)\b/u.test(text)) return "pool";
  if (/\b(parkirisce|parking)\b/u.test(text)) return "park";
  if (/\b(wi-?fi|wireless internet)\b/u.test(text)) return "wifi";

  const suggested = input.suggestedCategory ?? "";
  if ((CREATOR_SHARED_CATEGORY_KEYS as readonly string[]).includes(suggested)) {
    return suggested as CreatorSharedCategory;
  }
  return LEGACY_FALLBACKS[suggested] ?? "trips";
}

/** One-time legacy-bucket refinement. Broad old buckets stay authoritative
 * unless the proposal name gives a deterministic reason to use a new subtype. */
export function remapLegacyCreatorCategory(input: {
  name: string;
  legacyCategory: string;
}): CreatorSharedCategory {
  const classified = classifyCreatorSharedCategory({
    name: input.name,
    suggestedCategory: input.legacyCategory,
  });
  switch (input.legacyCategory) {
    case "food":
      return (["breakfast", "culinary", "night", "pizza"] as const).includes(classified as never)
        ? classified
        : "culinary";
    case "hike":
      return (["bike", "hike", "nature"] as const).includes(classified as never)
        ? classified
        : "hike";
    case "sights":
      return (["culture", "events", "hike", "nature"] as const).includes(classified as never)
        ? classified
        : "culture";
    case "trips":
      return "trips";
    case "act":
      return (["act", "bike", "culture", "events", "fitness", "games", "nature"] as const)
        .includes(classified as never)
        ? classified
        : "act";
    default:
      return (CREATOR_SHARED_CATEGORY_KEYS as readonly string[]).includes(input.legacyCategory)
        ? input.legacyCategory as CreatorSharedCategory
        : classified;
  }
}
