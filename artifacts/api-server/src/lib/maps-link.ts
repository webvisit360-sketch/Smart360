export type MapsCoordinates = { lat: number; lng: number };

export type ParsedGoogleMapsLocation = MapsCoordinates & {
  name: string | null;
  placeId: string | null;
  source: "search" | "place";
};

export type GoogleMapsRedirectErrorKind =
  | "invalid-url"
  | "disallowed-url"
  | "network"
  | "http"
  | "missing-location"
  | "too-many-redirects";

export class GoogleMapsRedirectError extends Error {
  constructor(
    public readonly kind: GoogleMapsRedirectErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "GoogleMapsRedirectError";
  }
}

export type GoogleMapsParseErrorKind =
  | "invalid-url"
  | "disallowed-url"
  | "unsupported-shape"
  | "place-missing-pin"
  | "viewport-only";

export class GoogleMapsParseError extends Error {
  constructor(
    public readonly kind: GoogleMapsParseErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "GoogleMapsParseError";
  }
}

/** True for text that is a destination URL, not an address search query. */
export function isLikelyUrl(text: string | null | undefined): boolean {
  return typeof text === "string" && /^https?:\/\//i.test(text.trim());
}

function validCoordinates(lat: number, lng: number): MapsCoordinates | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function decodeMapsPathPart(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value.replace(/\+/g, " ")).trim();
    return decoded || null;
  } catch {
    return null;
  }
}

export function isAllowedGoogleMapsUrl(value: string | URL): boolean {
  let url: URL;
  try {
    url = typeof value === "string" ? new URL(value) : value;
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;

  const hostname = url.hostname.toLowerCase();
  const path = url.pathname;
  if (hostname === "maps.app.goo.gl") return true;
  if (hostname === "goo.gl") return path === "/maps" || path.startsWith("/maps/");

  const isGoogleMapsHost =
    hostname === "google.com" || hostname.endsWith(".google.com");
  return isGoogleMapsHost && (path === "/maps" || path.startsWith("/maps/"));
}

/**
 * Parses only pin coordinates. Google Maps' @lat,lng pair is the viewport
 * centre and is deliberately never accepted as a fallback.
 */
export function parseGoogleMapsLocationUrl(
  value: string | null | undefined,
): ParsedGoogleMapsLocation | null {
  if (!isLikelyUrl(value)) return null;

  let url: URL;
  try {
    url = new URL(value!.trim());
  } catch {
    return null;
  }
  if (!isAllowedGoogleMapsUrl(url)) return null;

  const searchMatch = /^\/maps\/search\/([^/?#]+)/.exec(url.pathname);
  if (searchMatch) {
    const location = decodeMapsPathPart(searchMatch[1]!);
    const coordinates =
      location &&
      /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(location);
    if (!coordinates) return null;
    const valid = validCoordinates(Number(coordinates[1]), Number(coordinates[2]));
    return valid
      ? { ...valid, name: null, placeId: null, source: "search" }
      : null;
  }

  const placeMatch = /^\/maps\/place\/([^/?#]+)/.exec(url.pathname);
  if (!placeMatch) return null;
  const coordinates = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(
    `${url.pathname}${url.search}${url.hash}`,
  );
  if (!coordinates) return null;
  const valid = validCoordinates(Number(coordinates[1]), Number(coordinates[2]));
  if (!valid) return null;

  const placeIdMatch = /!16s([^!/?&#]+)/.exec(
    `${url.pathname}${url.search}${url.hash}`,
  );
  return {
    ...valid,
    name: decodeMapsPathPart(placeMatch[1]!),
    placeId: placeIdMatch ? decodeMapsPathPart(placeIdMatch[1]!) : null,
    source: "place",
  };
}

export function parseGoogleMapsLocationUrlOrThrow(
  value: string,
): ParsedGoogleMapsLocation {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new GoogleMapsParseError("invalid-url", "Google Maps povezava ni veljaven URL.");
  }
  if (!isAllowedGoogleMapsUrl(url)) {
    throw new GoogleMapsParseError(
      "disallowed-url",
      "Gostitelj povezave ni dovoljen. Uporabite google.com, poddomeno *.google.com, maps.app.goo.gl ali goo.gl/maps.",
    );
  }
  const parsed = parseGoogleMapsLocationUrl(value);
  if (parsed) return parsed;

  const hasViewport = /@-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,/.test(url.href);
  if (/^\/maps\/place\/[^/?#]+/.test(url.pathname)) {
    throw new GoogleMapsParseError(
      hasViewport ? "place-missing-pin" : "place-missing-pin",
      "Povezava vsebuje ime kraja, vendar nima koordinat izbrane točke (!3d/!4d). Prilepite drugo povezavo.",
    );
  }
  if (hasViewport) {
    throw new GoogleMapsParseError(
      "viewport-only",
      "Povezava vsebuje samo središče zemljevida (@), ne izbrane točke. Prilepite drugo povezavo.",
    );
  }
  throw new GoogleMapsParseError(
    "unsupported-shape",
    "Povezava ne vsebuje uporabne izbrane točke. Prilepite drugo Google Maps povezavo.",
  );
}

export async function expandGoogleMapsShortLink(
  value: string,
  options: {
    fetchFn?: typeof fetch;
    maxRedirects?: number;
  } = {},
): Promise<string> {
  let current: URL;
  try {
    current = new URL(value.trim());
  } catch {
    throw new GoogleMapsRedirectError("invalid-url", "Short link is not a valid URL.");
  }
  if (!isAllowedGoogleMapsUrl(current)) {
    throw new GoogleMapsRedirectError(
      "disallowed-url",
      "Short link is not an allowed Google Maps URL.",
    );
  }

  const fetchFn = options.fetchFn ?? fetch;
  const maxRedirects = options.maxRedirects ?? 3;
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    let response: Response;
    try {
      response = await fetchFn(current, { method: "GET", redirect: "manual" });
    } catch (error) {
      throw new GoogleMapsRedirectError(
        "network",
        `Google Maps short-link request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new GoogleMapsRedirectError(
          "missing-location",
          `Google Maps returned redirect ${response.status} without a Location header.`,
        );
      }
      if (redirectCount === maxRedirects) {
        throw new GoogleMapsRedirectError(
          "too-many-redirects",
          `Google Maps short link exceeded ${maxRedirects} redirects.`,
        );
      }
      const next = new URL(location, current);
      if (!isAllowedGoogleMapsUrl(next)) {
        throw new GoogleMapsRedirectError(
          "disallowed-url",
          `Google Maps short link redirected to disallowed host ${next.hostname}.`,
        );
      }
      current = next;
      continue;
    }

    if (!response.ok) {
      throw new GoogleMapsRedirectError(
        "http",
        `Google Maps short-link request returned HTTP ${response.status}.`,
      );
    }
    if (!isAllowedGoogleMapsUrl(current)) {
      throw new GoogleMapsRedirectError(
        "disallowed-url",
        "Expanded URL is not an allowed Google Maps URL.",
      );
    }
    return current.toString();
  }

  throw new GoogleMapsRedirectError(
    "too-many-redirects",
    `Google Maps short link exceeded ${maxRedirects} redirects.`,
  );
}

/** Reads only pin coordinates from a full Google Maps search/place URL. */
export function extractCoordsFromGoogleMapsUrl(
  value: string | null | undefined,
): MapsCoordinates | null {
  if (!isLikelyUrl(value)) return null;

  const parsed = parseGoogleMapsLocationUrl(value);
  return parsed ? { lat: parsed.lat, lng: parsed.lng } : null;
}