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
 * Maps action for an item-level POI. Must open the PLACE, never navigation:
 * a directions URL starts turn-by-turn routing from the guest's current
 * position (a guest browsing from home would see a cross-country route).
 *
 * Priority (owner-approved, 2026-08-23):
 * 1. the host's pasted HTTPS place link, untouched;
 * 2. a NAMED search from owner-approved data — "<item title>, <resolved
 *    address from the approved distance review>" — so Google shows the venue
 *    page (name, photos, hours) instead of a bare dropped pin;
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
    const named = title ? `${title}, ${address}` : address;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(named)}`;
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