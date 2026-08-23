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