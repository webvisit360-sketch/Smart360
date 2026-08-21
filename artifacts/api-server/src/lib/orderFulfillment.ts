/**
 * Fulfilment snapshot extraction for Living Guide orders.
 *
 * Contract:
 * - Inspects ONLY the item's authored text fields: body, noteText, bullets.
 * - Strips HTML markup before scanning.
 * - Looks for an explicit delivery/pickup keyword in the supported languages
 *   (Slovenian, English, Italian, German).
 * - Returns the FIRST paragraph/sentence/bullet that contains such a keyword.
 * - If no authored sentence is found, returns the neutral default:
 *     'Prevzem pri gostitelju.'
 * - NEVER infers delivery from distance, producerNote, price, or any computed value.
 * - producerNote is a producer description, NOT a fulfilment promise — never used here.
 *
 * This is a pure function with no I/O — easy to unit-test.
 */

/** Default fulfilment text when no explicit delivery sentence is found. */
export const DEFAULT_FULFILLMENT = "Prevzem pri gostitelju.";

/**
 * Explicit delivery/pickup keywords in the four supported languages.
 * Matched case-insensitively against plain text extracted from authored fields.
 *
 * Slovenian: prevzem, dostava/dostavimo, prinesemo/prinese, pri gostitelju
 * English:   pickup, pick up, pick-up, delivery, deliver, collect, collection
 * Italian:   ritiro, consegna, ritirare, ritiro, spedizione
 * German:    abholung, abholen, lieferung, liefern, zustellung
 */
const DELIVERY_KEYWORDS: readonly RegExp[] = [
  // Slovenian
  /\bprevzem/i,
  /\bdostav/i,       // dostava, dostavimo, dostavlja
  /\bprinese/i,      // prinesemo, prinesem, prinese
  /\bpri\s+gostitelj/i, // already in default, but honour if explicitly authored
  // English
  /\bpick[\s-]?up\b/i,
  /\bdelivery\b/i,
  /\bdeliver\b/i,
  /\bcollect/i,
  // Italian
  /\britiro\b/i,
  /\bconsegna\b/i,
  /\bspedizione\b/i,
  // German
  /\babholun/i,      // Abholung, abholungen
  /\babholen\b/i,
  /\blieferun/i,     // Lieferung
  /\bliefern\b/i,
  /\bzustellun/i,    // Zustellung
];

/**
 * Strip HTML tags and decode basic HTML entities from a string.
 * Used to scan authored rich-text fields as plain text.
 */
export function stripMarkup(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")           // remove all tags
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, " ")            // collapse whitespace
    .trim();
}

/**
 * Split plain text into candidate sentences/paragraphs for keyword matching.
 * Splits on sentence terminators, newlines, and semicolons.
 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Return true if the plain-text string contains at least one delivery keyword.
 */
export function hasDeliveryKeyword(text: string): boolean {
  return DELIVERY_KEYWORDS.some((re) => re.test(text));
}

/**
 * Extract a fulfilment sentence from the item's authored text fields.
 *
 * Priority order: body paragraphs → noteText paragraphs → bullets (joined).
 *
 * Returns the FIRST sentence/paragraph that contains a delivery keyword,
 * or DEFAULT_FULFILLMENT if none is found.
 *
 * @param body      Item body (may contain HTML)
 * @param noteText  Item noteText (may contain HTML)
 * @param bullets   Item bullets array (plain text)
 */
export function extractFulfillmentSentence(
  body: string | null | undefined,
  noteText: string | null | undefined,
  bullets: string[] | null | undefined,
): string {
  // Collect candidate plain-text segments from authored fields only
  const candidates: string[] = [];

  if (body) {
    const plain = stripMarkup(body);
    candidates.push(...splitSentences(plain));
  }

  if (noteText) {
    const plain = stripMarkup(noteText);
    candidates.push(...splitSentences(plain));
  }

  if (bullets && bullets.length > 0) {
    for (const bullet of bullets) {
      const plain = stripMarkup(bullet).trim();
      if (plain.length > 0) candidates.push(plain);
    }
  }

  for (const candidate of candidates) {
    if (hasDeliveryKeyword(candidate)) {
      // Return the sentence trimmed but otherwise as authored
      return candidate.endsWith(".")
        ? candidate
        : candidate + ".";
    }
  }

  return DEFAULT_FULFILLMENT;
}
