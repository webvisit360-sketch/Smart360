export type MapsCoordinates = { lat: number; lng: number };

/** True for text that is a destination URL, not an address search query. */
export function isLikelyUrl(text: string | null | undefined): boolean {
  return typeof text === "string" && /^https?:\/\//i.test(text.trim());
}

function validCoordinates(lat: number, lng: number): MapsCoordinates | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Reads coordinates Google embeds in full Maps URLs. Short URLs are accepted
 * destinations but cannot be expanded here, so intentionally return null.
 */
export function extractCoordsFromGoogleMapsUrl(
  value: string | null | undefined,
): MapsCoordinates | null {
  if (!isLikelyUrl(value)) return null;

  let url: URL;
  try {
    url = new URL(value!.trim());
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  const isGoogleMaps =
    hostname === "google.com" ||
    hostname.endsWith(".google.com") ||
    hostname === "maps.app.goo.gl" ||
    hostname === "goo.gl";
  if (!isGoogleMaps) return null;

  // The place marker is more precise than the viewport centre.
  const place = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(value!);
  if (place) return validCoordinates(Number(place[1]), Number(place[2]));

  const centre = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(value!);
  if (centre) return validCoordinates(Number(centre[1]), Number(centre[2]));
  return null;
}