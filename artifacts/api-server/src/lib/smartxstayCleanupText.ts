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

/** Remove only bare label lines; preserve every address byte and its position. */
export function removeAddressLabel(body: string): string {
  return body.split(/(<br\s*\/?>|<\/p>)/gi).map((part, index) => {
    if (index % 2 || !/^naslov:?$/i.test(load(part, null, false).text().trim()) || /<a\b/i.test(part)) return part;
    return part.match(/^\s*<p\b[^>]*>/i)?.[0] || "";
  }).join("");
}

export function restoredAddressBody(change: { after: string; afterKeepingAddress?: string; operations: string[] }): string | null {
  if (!change.operations.some(op => op === "preveri naslov" || op === "Odstranjena oznaka Naslov in potrjeno podvojen naslov")
    || !change.afterKeepingAddress || change.after === change.afterKeepingAddress) return null;
  // This evidence already contains every OTHER applied cleanup operation.
  return collapseEmptyParagraphs(removeAddressLabel(change.afterKeepingAddress));
}
const labelGroups = [
  ["restaurant", "restavracija", "restavracije", "restaurants", "kulinarika"],
  ["bar", "bari", "bars", "kulinarika"],
  ["pizzeria", "pizzerias", "picerija", "picerije", "kulinarika"],
];

/** Conservative, line-local edits: never fetch/guess an address or rewrite other prose. */
export function cleanupImportedBody(body: string, lang: string, category: string, _mapQuery: string | null, _removeAddress = true) {
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
  for (const line of lines) if (/^naslov:?$/i.test(line.text) && !/<a\b/i.test(line.html)) {
    replace(line.index, ""); operations.push("Odstranjena samo oznaka Naslov; naslov ohranjen");
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
