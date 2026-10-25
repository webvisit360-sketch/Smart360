import { RULE_ICON_CATALOG } from "./rule-catalog-data";
import { normalizeTileLabel } from "./tile-catalog";

export { RULE_ICON_CATALOG };
export type RuleIconEntry = (typeof RULE_ICON_CATALOG)[number];
export type RuleIconId = RuleIconEntry["id"];
export const RULE_DEFAULT_ICON_ID = "rule:privzeto-pravilo";
export const RULE_DEFAULT_ICON = RULE_ICON_CATALOG.find((entry) => entry.id === RULE_DEFAULT_ICON_ID)!;

type RuleCandidate = { entry: RuleIconEntry; words: string[]; length: number };

// Rule matching is scoped to RULE_ICON_CATALOG only, so category-tile matching
// (matchTileCatalog) is unaffected by rule stems and vice versa.
const RULE_MATCHES: RuleCandidate[] = RULE_ICON_CATALOG.flatMap((entry) =>
  entry.stems.map((stem) => {
    const words = normalizeTileLabel(stem).split(" ").filter(Boolean);
    return { entry, words, length: Math.max(...words.map((word) => word.length)) };
  }).filter((candidate) => candidate.words.length > 0),
);

const WHOLE_WORD_STEMS = new Set(
  ["wc", "pes", "psi", "pet", "dog", "pas", "eau", "feu", "žar", "kind", "départ",
    "voda", "vode", "vodo", "vodu", "vodom"].map(normalizeTileLabel),
);
// Catalogue's curated ambiguous stems remain whole words regardless of length.
function wordMatches(stem: string, word: string): boolean {
  return stem.length < 4 || WHOLE_WORD_STEMS.has(stem) ? word === stem : word.startsWith(stem);
}

/** Strict word-prefix policy (longest stem, then matched-word count, then
 * catalogue order). No fuzzy matching, no interior substrings. */
export function matchRuleIcon(text: string): { entry: RuleIconEntry; fallback: boolean } {
  const words = normalizeTileLabel(text ?? "").split(" ").filter(Boolean);
  let winner: RuleIconEntry | undefined;
  let longest = 0, matchedWords = 0;
  for (const candidate of RULE_MATCHES) {
    const unused = new Set(words.map((_, index) => index));
    const matches = candidate.words.every((stem) => {
      const index = [...unused].find((i) => wordMatches(stem, words[i]));
      if (index === undefined) return false;
      unused.delete(index);
      return true;
    });
    if (!matches) continue;
    if (candidate.length > longest || (candidate.length === longest && candidate.words.length > matchedWords)) {
      winner = candidate.entry; longest = candidate.length; matchedWords = candidate.words.length;
    }
  }
  return winner ? { entry: winner, fallback: false } : { entry: RULE_DEFAULT_ICON, fallback: true };
}

/** Bullet texts a guest sees as rule cards: explicit bullets win, otherwise a
 * body made only of list lines or a single <ul>. Canonical for the guest
 * shell (which passes its DOMPurify sanitizer) and the server audit (bodies are
 * already sanitized on save). */
export function ruleBulletTexts(
  item: { bullets?: unknown; body?: unknown } | null | undefined,
  sanitize: (html: string) => string = (html) => html,
): string[] {
  const explicit = Array.isArray(item?.bullets)
    ? item!.bullets.filter((b): b is string => typeof b === "string" && !!b.trim()).map((b) => b.trim())
    : [];
  if (explicit.length) return explicit;
  const body = typeof item?.body === "string" ? item.body.trim() : "";
  if (!body) return [];
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const marker = /^(?:[-*•]|\d+[.)])\s+/;
  if (lines.length && lines.every((line) => marker.test(line))) return lines.map((line) => line.replace(marker, "").trim());
  const sanitized = sanitize(body);
  if (!/^<ul(?:\s[^>]*)?>[\s\S]*<\/ul>$/i.test(sanitized)) return [];
  return Array.from(sanitized.matchAll(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi))
    .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
}
