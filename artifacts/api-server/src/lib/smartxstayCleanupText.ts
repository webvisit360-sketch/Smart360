import { load } from "cheerio";
import { normalizedName } from "./smartxstayParse";

const blank = String.raw`<p\b[^>]*>(?:\s|&nbsp;|&#160;|&#x0*a0;|<br\s*\/?>)*<\/p>`;
export function collapseEmptyParagraphs(html: string): string {
  return html.replace(new RegExp(`(${blank})(?:\\s*${blank})+`, "gi"), "$1")
    .replace(/(<br\s*\/?>)(\s*<br\s*\/?>)(?:\s*<br\s*\/?>)+/gi, "$1$2")
    .replace(/(<\/p>)(\s*<br\s*\/?>)(?:\s*<br\s*\/?>)+/gi, "$1$2");
}

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const slovene = ["Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota", "Nedelja"];
function hours(line: string): string | null {
  const match = line.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):\s*(.*)$/i);
  if (!match) return null;
  const time = String.raw`(1[0-2]|[1-9])(?::([0-5]\d))?\s*(AM|PM)`;
  const range = match[2].match(new RegExp(`^${time}\\s*[-–—]\\s*${time}$`, "i"));
  let value: string;
  if (/^closed$/i.test(match[2])) value = "zaprto";
  else if (range) {
    const convert = (h: string, m: string, period: string) =>
      `${String(Number(h) % 12 + (/pm/i.test(period) ? 12 : 0)).padStart(2, "0")}.${m || "00"}`;
    value = `${convert(range[1], range[2], range[3])}–${convert(range[4], range[5], range[6])}`;
  } else return null;
  return `${slovene[weekdays.findIndex(x => x.toLowerCase() === match[1].toLowerCase())]}: ${value}`;
}

function ownAddress(mapQuery: string | null): string {
  if (!mapQuery) return "";
  if (!/^https?:/i.test(mapQuery)) return mapQuery;
  try {
    const url = new URL(mapQuery);
    const q = url.searchParams.get("query") || url.searchParams.get("q") || "";
    return /^(?:place_id:|[-\d.]+,\s*[-\d.]+$)/.test(q) ? "" : q;
  } catch { return ""; }
}
const normalizedAddress = (s: string) => normalizedName(s).replace(/[^\p{L}\p{N}]/gu, "");
const countries = /^(?:slovenija|slovenia|slovenien|hrvatska|croatia|avstrija|austria|italija|italy|italia)$/i;
function postalAddress(lines: string[]): boolean {
  const text = lines.join(", ");
  // Require a street/locality with house number AND postal code with place.
  // Anchored grammar deliberately rejects prose and opening-hours text.
  return /^[\p{L}][\p{L}\s.'’/-]{1,80}\s+\d{1,4}[a-z]?\s*,?\s+(?:SI[- ]?)?\d{4,5}\s+[\p{L}][\p{L}\s.'’/-]{1,80}(?:,\s*[\p{L}\s]+)?$/iu.test(text);
}
const labelGroups = [
  ["restaurant", "restavracija", "restavracije", "restaurants", "kulinarika"],
  ["bar", "bari", "bars", "kulinarika"],
  ["pizzeria", "pizzerias", "picerija", "picerije", "kulinarika"],
];

/** Conservative, line-local edits: never fetch/guess an address or rewrite other prose. */
export function cleanupImportedBody(body: string, lang: string, category: string, mapQuery: string | null) {
  const operations: string[] = [], warnings: string[] = [];
  // Preserve authored HTML byte-for-byte outside the changed logical lines.
  const parts = body.split(/(<br\s*\/?>|<\/p>)/gi);
  const lines = parts.map((html, index) => ({
    index, html,
    text: load(html, null, false).text().replace(/\s+/gu, " ").trim(),
  })).filter(x => x.index % 2 === 0 && x.text);
  const replace = (index: number, value: string) => {
    const opening = parts[index].match(/^\s*<p\b[^>]*>/i)?.[0] || "";
    parts[index] = opening + value;
  };
  const first = lines[0];
  if (first && !/<a\b/i.test(first.html) && (
    normalizedName(first.text) === normalizedName(category) ||
    labelGroups.some(group => group.includes(normalizedName(first.text)) && group.includes(normalizedName(category)))
  )) {
    replace(first.index, ""); operations.push("Odstranjena podvojena začetna oznaka kategorije");
  }
  const addressIndex = lines.findIndex(x => /^naslov:?$/i.test(x.text));
  if (addressIndex >= 0) {
    const address = ownAddress(mapQuery);
    let matched = false;
    for (let count = 1; count <= 3 && addressIndex + count < lines.length; count++) {
      const candidates = lines.slice(addressIndex + 1, addressIndex + count + 1);
      if (candidates.some(x => /<a\b/i.test(x.html)) || !postalAddress(candidates.map(x => x.text))) continue;
      // Include a separate country line, but never swallow the next prose line.
      const next = lines[addressIndex + count + 1];
      if (count < 3 && next && countries.test(next.text)) candidates.push(next);
      [lines[addressIndex], ...candidates].forEach(x => replace(x.index, ""));
      operations.push("preveri naslov");
      warnings.push("Preveri naslov: predlagana odstranitev poštnega bloka; potreben je pregled in potrditev tega vnosa.");
      matched = true; break;
    }
    for (let count = 1; count <= 3 && addressIndex + count < lines.length; count++) {
      if (matched) break;
      const candidates = lines.slice(addressIndex + 1, addressIndex + count + 1);
      if (address && normalizedAddress(candidates.map(x => x.text).join(" ")) === normalizedAddress(address)) {
        [lines[addressIndex], ...candidates].forEach(x => replace(x.index, ""));
        operations.push("Odstranjena oznaka Naslov in potrjeno podvojen naslov");
        matched = true; break;
      }
    }
    if (!matched) warnings.push("Naslov ohranjen: ujemanja z lastnim naslovom/zemljevidom ni mogoče dokazati.");
  }
  if (lang === "sl") for (const line of lines) {
    if (/<a\b/i.test(line.html)) continue;
    const converted = hours(line.text);
    if (converted !== null) {
      replace(line.index, converted);
      if (!operations.includes("Slovenski dnevi in 24-urni delovni čas")) operations.push("Slovenski dnevi in 24-urni delovni čas");
    }
  }
  let after = parts.join("");
  const compact = collapseEmptyParagraphs(after);
  if (compact !== after) operations.push("Združeni zaporedni prazni odstavki");
  after = compact;
  return { before: body, after, operations, warnings };
}
