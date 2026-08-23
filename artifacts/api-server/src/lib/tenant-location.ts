export class TenantLocationError extends Error {}

export function normalizeTenantMapUrl(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new TenantLocationError("Google Maps povezava ni veljaven URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new TenantLocationError("Google Maps povezava mora uporabljati HTTPS.");
  }
  return parsed.toString();
}

export function validateTenantCoordinatePair(
  latitude: number | null,
  longitude: number | null,
): string | null {
  if (latitude === null && longitude === null) return null;
  if (latitude === null || longitude === null) {
    return "Latitude in longitude morata biti vpisana skupaj.";
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return "Latitude mora biti število med -90 in 90.";
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return "Longitude mora biti število med -180 in 180.";
  }
  return null;
}