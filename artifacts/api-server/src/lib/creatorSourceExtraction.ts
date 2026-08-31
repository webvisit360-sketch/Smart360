import sanitizeHtml from "sanitize-html";
import { normalizeCreatorProposalName } from "./creatorProposalLedger";

export type DeterministicSourceFact = {
  placeName: string;
  settlement: string | null;
  categoryKey: "act" | "trips" | "food" | "hike" | "sights";
};

const GENERIC_LABELS = new Set([
  "domov", "več", "preberi več", "več o tem", "nazaj", "naprej", "meni",
  "iskanje", "kontakt", "kontakti", "novice", "dogodki", "prireditve",
  "občina", "turizem", "znamenitosti", "izleti", "aktivnosti", "doživetja",
  "nastanitve", "kulinarika", "slovenščina", "english", "deutsch", "italiano",
  "facebook", "instagram", "youtube", "piškotki", "zasebnost",
  "seznam gora", "na vrh", "o projektu", "pohodništvo", "kolesarjenje",
  "naravne znamenitosti",
  "adrenalinski park", "klemenča jama in strelovec",
  "krajinski park golte in alpski vrt",
  "krajinska parka logarska dolina in robanov kot",
  "naravni parki logarska dolina robanov kot",
  "savinjska dolina z okolico",
].map(normalizeCreatorProposalName));

function isMetadataOrEditorialNoise(value: string): boolean {
  return (
    /^\d{2,4}\s*m$/iu.test(value) ||
    /^(?:\d+\s*h(?:\s*\d+\s*min)?|\d+\s*min)$/iu.test(value) ||
    /^(?:(?:zelo|delno)\s+)?(?:lahka|zahtevna|nezahtevna)\s+.*(?:pot|steza)$/iu.test(value) ||
    /^(?:ponedeljek|torek|sreda|četrtek|petek|sobota|nedelja)\b/iu.test(value) ||
    /^slapom\b/iu.test(value) ||
    /^upravljanje\b/iu.test(value) ||
    /\bzdravst\w*\s+dom\b/iu.test(value) ||
    /\b(?:razstava|koncert|orkester|festival|predstava|prireditev|dogodek|delavnica)\b/iu.test(value)
  );
}

function cleanText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryFor(name: string, href: string): DeterministicSourceFact["categoryKey"] {
  const haystack = `${name} ${href}`.toLocaleLowerCase("sl");
  if (/\b(gostil|restavr|okrepčeval|kmetij|kulinar|hrana|pijača|hotel|kamp|koča|dom)\b/u.test(haystack)) return "food";
  if (/\b(pohod|pot |pot$|gora|vrh|planin|koles|smrekovec|travnik|koča)\b/u.test(haystack)) return "hike";
  if (/\b(smuč|rafting|kajak|šport|aktiv|doživet|kopali|ribolov)\b/u.test(haystack)) return "act";
  if (/\b(cerkev|muzej|grad|dvorec|spomenik|slap|jama|park|vrt|dolina|soteska|izvir|stolp|znamenit)\b/u.test(haystack)) return "sights";
  return "trips";
}

function sourceSettlement(label: string): string | null {
  for (const settlement of ["Ljubno ob Savinji", "Luče", "Solčava", "Gornji Grad", "Nazarje", "Rečica ob Savinji", "Mozirje"]) {
    if (label.includes(settlement) || (settlement === "Ljubno ob Savinji" && label.includes("Ljubno"))) return settlement;
  }
  return null;
}

/** Deterministic, model-free extraction from explicit links in the exact page
 * snapshot. It intentionally prefers false negatives over navigation noise. */
export function extractCreatorSourceFacts(input: {
  sourceLabel: string;
  sourceKind: string;
  sourceUrl: string;
  rawContent: string;
}): DeterministicSourceFact[] {
  if (!input.rawContent) return [];
  const source = new URL(input.sourceUrl);
  const facts = new Map<string, DeterministicSourceFact>();
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of input.rawContent.matchAll(anchorPattern)) {
    const attrs = match[1] ?? "";
    const hrefMatch = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    if (!hrefMatch) continue;
    const hrefValue = hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? "";
    let href: URL;
    try {
      href = new URL(hrefValue, source);
    } catch {
      continue;
    }
    if (href.protocol !== "https:" || href.origin !== source.origin) continue;
    const placeName = cleanText(match[2] ?? "")
      .replace(/\s*\(\s*\d{2,4}\s*m\s*\)\s*$/iu, "")
      .replace(/[\s,;:]+$/u, "");
    const normalized = normalizeCreatorProposalName(placeName);
    if (
      placeName.length < 3 || placeName.length > 100 ||
      GENERIC_LABELS.has(normalized) ||
      normalized === normalizeCreatorProposalName(input.sourceLabel.replace(/^Občina\s+/u, "")) ||
      normalized === normalizeCreatorProposalName(input.sourceLabel) ||
      isMetadataOrEditorialNoise(placeName) ||
      /^(več|preberi|poglej|klik|www\.|https?:|e-pošta|telefon)/iu.test(placeName) ||
      /^[\d\s.,:+/-]+$/.test(placeName)
    ) continue;

    const path = href.pathname.toLocaleLowerCase("sl");
    const structuredPath = input.sourceKind === "hiking-index"
      ? /\/(?:gora|izlet)\//.test(path)
      : /\/(?:znamenit|izlet|dozivet|doživet|aktiv|narav|kultur|kulinar|gostil|restavr|pohod|koles|muzej|cerkev|grad|slap|park|dolina|soteska|kamp|nastanit)/u.test(path);
    const placeWords = /\b(slap|jama|grad|cerkev|muzej|park|dolina|soteska|izvir|vrh|gora|koča|dom|kmetija|kamp|smrekovec|travnik)\b/iu.test(placeName);
    if (!structuredPath && !placeWords) continue;

    const fact: DeterministicSourceFact = {
      placeName,
      settlement: sourceSettlement(input.sourceLabel),
      categoryKey: categoryFor(placeName, href.href),
    };
    facts.set(normalized, fact);
  }
  return [...facts.values()].sort((a, b) => a.placeName.localeCompare(b.placeName, "sl"));
}