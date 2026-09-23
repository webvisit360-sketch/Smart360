export const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export const OPENFREEMAP_ATTRIBUTION_LINKS = [
  { href: "https://openfreemap.org/", label: "OpenFreeMap" },
  { href: "https://openmaptiles.org/", label: "© OpenMapTiles" },
  { href: "https://www.openstreetmap.org/copyright", label: "© OpenStreetMap contributors" },
] as const;

// Keep uncommitted manual-coordinate drafts out of MapLibre. Invalid input
// stays untouched in the form so the field validator can explain the error.
export function pinPlacementMapCenter(
  latitude: string,
  longitude: string,
  origin?: { latitude: number; longitude: number },
): { latitude: number; longitude: number } {
  const safeCoordinate = (draft: string, fallback: number, limit: number) => {
    const trimmed = draft.trim();
    const parsed = Number(trimmed);
    return trimmed && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)
      && Number.isFinite(parsed) && Math.abs(parsed) <= limit
      ? parsed
      : fallback;
  };
  const originLatitude = origin?.latitude;
  const originLongitude = origin?.longitude;
  const fallbackLat = originLatitude !== undefined && Number.isFinite(originLatitude) && Math.abs(originLatitude) <= 90 ? originLatitude : 46.25;
  const fallbackLng = originLongitude !== undefined && Number.isFinite(originLongitude) && Math.abs(originLongitude) <= 180 ? originLongitude : 14.9;
  return {
    latitude: safeCoordinate(latitude, fallbackLat, 90),
    longitude: safeCoordinate(longitude, fallbackLng, 180),
  };
}