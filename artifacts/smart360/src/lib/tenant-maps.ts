export type TenantMapsIntent = "search" | "directions";

type TenantLocation = {
  mapUrl?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  mapQuery?: unknown;
  address?: unknown;
};

function nonBlankString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeExplicitUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function googleMapsUrl(destination: string, intent: TenantMapsIntent): string {
  if (intent === "directions") {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
}

export function resolveTenantMapsUrl(
  tenant: TenantLocation | null | undefined,
  intent: TenantMapsIntent = "search",
): string | null {
  if (!tenant) return null;

  const explicitUrl = nonBlankString(tenant.mapUrl);
  if (explicitUrl) {
    // A configured but unsafe URL blocks lower-priority fallbacks.
    return safeExplicitUrl(explicitUrl);
  }

  const hasLatitude =
    tenant.latitude !== null && tenant.latitude !== undefined;
  const hasLongitude =
    tenant.longitude !== null && tenant.longitude !== undefined;
  if (hasLatitude || hasLongitude) {
    if (
      typeof tenant.latitude !== "number" ||
      typeof tenant.longitude !== "number" ||
      !Number.isFinite(tenant.latitude) ||
      !Number.isFinite(tenant.longitude) ||
      tenant.latitude < -90 ||
      tenant.latitude > 90 ||
      tenant.longitude < -180 ||
      tenant.longitude > 180
    ) {
      // Never hide invalid/partial coordinates behind an address fallback.
      return null;
    }
    return googleMapsUrl(
      `${tenant.latitude},${tenant.longitude}`,
      intent,
    );
  }

  // mapQuery is the existing manually authored address/search fallback.
  const fallback =
    nonBlankString(tenant.mapQuery) ?? nonBlankString(tenant.address);
  return fallback ? googleMapsUrl(fallback, intent) : null;
}

export function openExternalMapsUrl(
  url: string,
  opener: (
    url?: string | URL,
    target?: string,
    features?: string,
  ) => Window | null = window.open.bind(window),
): Window | null {
  return opener(url, "_blank", "noopener,noreferrer");
}