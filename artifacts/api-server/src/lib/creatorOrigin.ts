import {
  expandGoogleMapsShortLink,
  GoogleMapsParseError,
  GoogleMapsRedirectError,
  parseGoogleMapsLocationUrlOrThrow,
} from "./maps-link";

export { GoogleMapsParseError, GoogleMapsRedirectError };

export type ResolvedCreatorOrigin = Awaited<ReturnType<typeof resolveCreatorOrigin>>;

/**
 * Resolves the submitted URL on the server. This is deliberately shared by
 * preview and confirmation: preview has no persistence side effects, while a
 * confirmation never trusts coordinates or an address displayed by a browser.
 */
export async function resolveCreatorOrigin(mapUrl: string): Promise<{
  lat: number;
  lng: number;
  name: string | null;
  placeId: string | null;
  source: "search" | "place";
  expandedUrl: string;
  nominatimDisplayName: string;
  referenceSource: "nominatim";
}> {
  const originalUrl = mapUrl.trim();
  let isShortLink = false;
  try {
    const original = new URL(originalUrl);
    isShortLink =
      original.hostname === "maps.app.goo.gl" ||
      (original.hostname === "goo.gl" &&
        (original.pathname === "/maps" || original.pathname.startsWith("/maps/")));
  } catch {
    // The strict parser below returns the user-facing invalid URL error.
  }
  const expandedUrl = isShortLink
    ? await expandGoogleMapsShortLink(originalUrl)
    : originalUrl;
  const parsed = parseGoogleMapsLocationUrlOrThrow(expandedUrl);
  const reverseUrl = new URL("https://nominatim.openstreetmap.org/reverse");
  reverseUrl.searchParams.set("format", "jsonv2");
  reverseUrl.searchParams.set("lat", String(parsed.lat));
  reverseUrl.searchParams.set("lon", String(parsed.lng));
  reverseUrl.searchParams.set("zoom", "18");
  reverseUrl.searchParams.set("addressdetails", "1");
  const response = await fetch(reverseUrl, {
    headers: {
      "User-Agent": "Smart360 Creator origin confirmation (admin contact via replit deployment)",
    },
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const data = (await response.json()) as { display_name?: unknown };
  const nominatimDisplayName =
    typeof data.display_name === "string" ? data.display_name : null;
  if (!nominatimDisplayName) {
    throw new Error("Nominatim ni vrnil bližnje znane točke.");
  }
  return {
    ...parsed,
    expandedUrl,
    nominatimDisplayName,
    referenceSource: "nominatim",
  };
}