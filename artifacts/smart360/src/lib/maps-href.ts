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
 * Accepts a pasted link only when it is a valid HTTPS URL that cannot start
 * navigation: any Maps directions form (a /dir path segment, a destination or
 * travelmode parameter) is rejected so the caller falls back to coordinates.
 */
export function sanitizePastedMapsUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const segments = url.pathname.toLowerCase().split("/");
  if (segments.includes("dir")) return null;
  if (url.searchParams.has("destination") || url.searchParams.has("travelmode")) return null;
  return url.toString();
}

/**
 * Maps action for an item-level POI. Must open the PLACE, never navigation:
 * a directions URL starts turn-by-turn routing from the guest's current
 * position (a guest browsing from home would see a cross-country route).
 *
 * Priority: the host's pasted HTTPS place link > approved review coordinates >
 * a plain-text Maps search. A "directions" intent is deliberately impossible
 * here — item POIs are informational, not the property navigation action.
 * A pasted link that is rejected (directions, HTTP, malformed) falls through
 * to coordinates; if none exist the action is hidden rather than risked.
 */
export function itemMapsHref(
  item:
    | {
        mapQuery?: string | null;
        latitude?: number | null;
        longitude?: number | null;
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
  if (
    typeof item.latitude === "number" &&
    Number.isFinite(item.latitude) &&
    typeof item.longitude === "number" &&
    Number.isFinite(item.longitude)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;
  }
  // A rejected pasted link must not leak into a text search (searching a raw
  // URL string is meaningless) — with no coordinates the action stays hidden.
  if (queryIsUrl) return null;
  return mapsHrefForQuery(query);
}