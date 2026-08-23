export function isLikelyUrl(value: string | null | undefined): boolean {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

/** Uses a pasted HTTPS destination directly, otherwise creates a Maps search. */
export function mapsHrefForQuery(value: string | null | undefined, intent: "search" | "directions" = "search"): string | null {
  const query = value?.trim();
  if (!query) return null;
  if (isLikelyUrl(query)) {
    try {
      const url = new URL(query);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }
  return intent === "directions"
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Every query/hash parameter Google Maps uses to express a route: modern
 * (destination, origin, travelmode) and legacy (daddr, saddr, dirflg).
 */
const NAVIGATION_PARAMS = ["destination", "travelmode", "daddr", "saddr", "origin", "dirflg"];

/**
 * Accepts a pasted link only when it is a valid HTTPS URL that cannot start
 * navigation: any Maps directions form — a /dir path segment (raw or
 * percent-encoded), any navigation parameter in the query string or the
 * legacy #! hash — is rejected so the caller falls back to the named search
 * or coordinates. Deliberately a broad reject-list rather than a strict
 * place-URL whitelist: hosts commonly paste opaque maps.app.goo.gl share
 * links, which a whitelist would wrongly refuse.
 */
export function sanitizePastedMapsUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  let decodedPath = url.pathname;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    /* keep the raw path; the encoded form is checked as-is below */
  }
  if (decodedPath.toLowerCase().split("/").includes("dir")) return null;
  for (const key of url.searchParams.keys()) {
    if (NAVIGATION_PARAMS.includes(key.toLowerCase())) return null;
  }
  const hash = url.hash.toLowerCase();
  if (hash.includes("/dir") || NAVIGATION_PARAMS.some((p) => hash.includes(`${p}=`))) return null;
  return url.toString();
}

/**
 * Administrative fragments a guest-facing search must never contain — long
 * geocoder display names full of "Upravna enota … / Unità amministrativa …"
 * routinely make Google return nothing or the wrong place.
 */
const ADDRESS_NOISE = /upravna enota|unit\u00e0 amministrativa|amministrativ/i;
/** Standalone house number segment ("3", "1A") as Nominatim emits it. */
const STANDALONE_HOUSE_NUMBER = /^\d{1,3}\s?[a-z]?$/i;
const POSTCODE = /^\d{4,6}$/;

function cleanAddressPart(part: string): string {
  // Bilingual duplicates keep only the first name; settlement tags drop.
  return part
    .split(" / ")[0]!
    .replace(/\s*\(naselje\)\s*$/i, "")
    .trim();
}

/**
 * Compress a geocoder display name ("Pretorska palača, 3, Titov trg / Piazza
 * Tito, Olmo, Koper / Capodistria (naselje), Koper / Capodistria, Upravna
 * enota Koper / Unità amministrativa Capodistria, 6000, Slovenija") into the
 * short query Google reliably resolves: "<title>, <street + number>,
 * <city>, <country>" — no administrative units, no bilingual duplicates, no
 * postcodes. When the parsed address is uncertain the result degrades to
 * "<title>, <city-ish>, <country>". Exported for tests.
 */
export function shortMapsQuery(
  title: string | null | undefined,
  displayName: string,
): string {
  const raw = displayName.split(",").map((p) => p.trim()).filter(Boolean);
  // Nominatim emits the house number as its own segment BEFORE the road:
  // "…, 3, Titov trg, …" → street "Titov trg 3".
  let street: string | null = null;
  const rest: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const part = raw[i]!;
    const next = raw[i + 1];
    if (
      street === null &&
      i > 0 &&
      STANDALONE_HOUSE_NUMBER.test(part) &&
      next &&
      !STANDALONE_HOUSE_NUMBER.test(next) &&
      !POSTCODE.test(next)
    ) {
      street = `${cleanAddressPart(next)} ${part}`;
      i++;
      continue;
    }
    rest.push(part);
  }
  const seen = new Set<string>();
  const parts = rest
    .map(cleanAddressPart)
    .filter((p) => p && !ADDRESS_NOISE.test(p) && !POSTCODE.test(p))
    .filter((p) => {
      const key = p.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const lead = title?.trim() || parts[0] || displayName.trim();
  const leadParts = new Set(
    lead.toLowerCase().split(",").map((s) => s.trim()),
  );
  const picked: string[] = [];
  const pick = (p: string | null | undefined) => {
    if (!p) return;
    const key = p.toLowerCase();
    if (leadParts.has(key)) return;
    if (picked.some((x) => x.toLowerCase() === key)) return;
    picked.push(p);
  };
  if (parts.length <= 3 && !street) {
    // Already short — keep every meaningful part.
    for (const p of parts) pick(p);
  } else {
    pick(street);
    if (parts.length >= 3) pick(parts[parts.length - 2]); // city-ish
    pick(parts[parts.length - 1]); // country
  }
  let query = [lead, ...picked].join(", ");
  if (query.length > 130) {
    const fallback: string[] = [];
    const pickFb = (p: string | undefined) => {
      if (!p) return;
      const key = p.toLowerCase();
      if (leadParts.has(key)) return;
      if (fallback.some((x) => x.toLowerCase() === key)) return;
      fallback.push(p);
    };
    pickFb(parts[parts.length - 2]);
    pickFb(parts[parts.length - 1]);
    query = [lead, ...fallback].join(", ");
  }
  return query;
}

/**
 * Maps action for an item-level POI. Must open the PLACE, never navigation:
 * a directions URL starts turn-by-turn routing from the guest's current
 * position (a guest browsing from home would see a cross-country route).
 *
 * Priority (owner-approved, 2026-08-23):
 * 1. the host's pasted HTTPS place link, untouched;
 * 2. a NAMED search from owner-approved data — the item title plus a SHORT
 *    form of the approved review address (see shortMapsQuery) — so Google
 *    shows the venue page (name, photos, hours) instead of a bare pin;
 * 3. approved review coordinates only as the last resort, in the labelled
 *    q=lat,lng(name) form so the pin at least carries the item name;
 * 4. a plain-text Maps search of the host-typed query.
 *
 * A "directions" intent is deliberately impossible here — item POIs are
 * informational, not the property navigation action. A pasted link that is
 * rejected (directions, HTTP, malformed) falls through to the named search /
 * coordinates; if none exist the action is hidden rather than risked.
 */
export function itemMapsHref(
  item:
    | {
        title?: string | null;
        mapQuery?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        resolvedAddress?: string | null;
      }
    | null
    | undefined,
): string | null {
  if (!item) return null;
  const query = item.mapQuery?.trim();
  const queryIsUrl = Boolean(query && isLikelyUrl(query));
  if (query && queryIsUrl) {
    const safe = sanitizePastedMapsUrl(query);
    if (safe) return safe;
  }
  const title = item.title?.trim();
  const address = item.resolvedAddress?.trim();
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shortMapsQuery(title, address))}`;
  }
  if (
    typeof item.latitude === "number" &&
    Number.isFinite(item.latitude) &&
    typeof item.longitude === "number" &&
    Number.isFinite(item.longitude)
  ) {
    if (title) {
      // Parentheses delimit the pin label, so encode any inside the title.
      const label = encodeURIComponent(title)
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29");
      return `https://maps.google.com/?q=${item.latitude},${item.longitude}(${label})`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;
  }
  // A rejected pasted link must not leak into a text search (searching a raw
  // URL string is meaningless) — with nothing else the action stays hidden.
  if (queryIsUrl) return null;
  return mapsHrefForQuery(query);
}