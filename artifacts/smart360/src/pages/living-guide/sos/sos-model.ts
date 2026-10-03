/**
 * Pure SOS location model. No I/O, no network, no logging.
 * Position data must never leave the device.
 */
export type { GuideLanguage as SosLang } from "@workspace/guide-languages";
import type { GuideLanguage as SosLang } from "@workspace/guide-languages";

export interface SosTenant {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}

export interface SosFix {
  lat: number;
  lon: number;
  /** metres; null = unknown (never coerce to 0) */
  altitude: number | null;
  /** metres, radius of 68% confidence */
  accuracy: number;
  /** epoch ms */
  timestamp: number;
}

/** Accuracy at/below this (metres) is "reasonable" for reading to 112. */
export const SOS_ACCURACY_THRESHOLD_M = 50;
/** A fix older than this (ms) is no longer "active". */
export const SOS_FRESH_MS = 30_000;

export type SosErrorKind = "denied" | "unavailable" | "timeout" | "unsupported";

export type SosStatus =
  | { kind: "denied" }
  | { kind: "unsupported" }
  | { kind: "acquiring"; errored: boolean }
  | { kind: "poor"; fix: SosFix }
  | { kind: "stale"; fix: SosFix }
  | { kind: "active"; fix: SosFix };

export function isValidCoords(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" && typeof lon === "number" &&
    Number.isFinite(lat) && Number.isFinite(lon) &&
    Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}

export function tenantHasCoords(t: SosTenant | null | undefined): t is SosTenant & { latitude: number; longitude: number } {
  return !!t && isValidCoords(t.latitude, t.longitude);
}

/** Normalise a raw GeolocationPosition-like object; returns null for invalid data. */
export function toFix(p: {
  coords: { latitude: number; longitude: number; altitude?: number | null; accuracy: number };
  timestamp: number;
}): SosFix | null {
  const { latitude, longitude, altitude, accuracy } = p.coords;
  if (!isValidCoords(latitude, longitude)) return null;
  if (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0) return null;
  return {
    lat: latitude,
    lon: longitude,
    altitude: typeof altitude === "number" && Number.isFinite(altitude) ? altitude : null,
    accuracy,
    timestamp: Number.isFinite(p.timestamp) ? p.timestamp : Date.now(),
  };
}

export function sosStatus(fix: SosFix | null, error: SosErrorKind | null, now: number): SosStatus {
  if (error === "denied") return { kind: "denied" };
  if (error === "unsupported") return { kind: "unsupported" };
  if (!fix) return { kind: "acquiring", errored: error != null };
  if (fix.accuracy > SOS_ACCURACY_THRESHOLD_M) return { kind: "poor", fix };
  if (error || now - fix.timestamp > SOS_FRESH_MS) return { kind: "stale", fix };
  return { kind: "active", fix };
}

export function hemi(value: number, axis: "lat" | "lon"): string {
  if (axis === "lat") return value < 0 ? "S" : "N";
  return value < 0 ? "W" : "E";
}

/** "N 46.35812°" (5 decimals). -0 treated as 0/N/E. */
export function formatDecimal(value: number, axis: "lat" | "lon", decimals = 5): string {
  const v = Object.is(value, -0) ? 0 : value;
  const abs = Math.abs(v).toFixed(decimals);
  const signNeg = v < 0 && Number(abs) !== 0;
  return `${hemi(signNeg ? -1 : 1, axis)} ${abs}°`;
}

/** Truncated representation for poor accuracy: "N 46.358…°" */
export function formatDecimalRough(value: number, axis: "lat" | "lon"): string {
  const abs = Math.trunc(Math.abs(value) * 1000) / 1000;
  return `${hemi(value, axis)} ${abs.toFixed(3)}…°`;
}

/** 46°21'29" N — rounds to whole seconds with carry into minutes/degrees. */
export function toDms(value: number, axis: "lat" | "lon"): string {
  const total = Math.round(Math.abs(value) * 3600);
  const d = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const h = total === 0 ? hemi(1, axis) : hemi(value, axis);
  return `${d}°${m}'${s}" ${h}`;
}

export function formatDmsPair(lat: number, lon: number): string {
  return `${toDms(lat, "lat")} · ${toDms(lon, "lon")}`;
}

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a → b, degrees 0..360. */
export function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export type Cardinal = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
const CARDINALS: Cardinal[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export function cardinal(bearing: number): Cardinal {
  return CARDINALS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

export function formatDistance(m: number, lang: SosLang): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  const km = m < 10_000 ? (m / 1000).toFixed(1) : String(Math.round(m / 1000));
  return `${lang === "en" ? km : km.replace(".", ",")} km`;
}

/** Plain text for clipboard: "N 46.35812, E 14.83294 (±8 m)" */
export function copyText(fix: SosFix): string {
  const la = formatDecimal(fix.lat, "lat").replace("°", "");
  const lo = formatDecimal(fix.lon, "lon").replace("°", "");
  return `${la}, ${lo} (±${Math.round(fix.accuracy)} m)`;
}

/** Standard maps URL string only — never fetched by the app. */
export function mapsUrl(fix: SosFix): string {
  return `https://www.google.com/maps/search/?api=1&query=${fix.lat.toFixed(5)},${fix.lon.toFixed(5)}`;
}

export function shareText(fix: SosFix): string {
  return `${copyText(fix)}\n${mapsUrl(fix)}`;
}

/** ASCII-only bilingual draft. Optional measurements are omitted when unknown. */
export function smsText(fix: Pick<SosFix, "lat" | "lon"> & { altitude?: number | null; accuracy?: number | null }): string {
  const la = formatDecimal(fix.lat, "lat").replace("°", "");
  const lo = formatDecimal(fix.lon, "lon").replace("°", "");
  const accuracy = typeof fix.accuracy === "number" && Number.isFinite(fix.accuracy) && fix.accuracy >= 0
    ? ` (+/-${Math.round(fix.accuracy)} m)` : "";
  const altitude = typeof fix.altitude === "number" && Number.isFinite(fix.altitude)
    ? `, visina/alt ${Math.round(fix.altitude)} m` : "";
  return `SOS - potrebujem pomoc / I need help. Lokacija/Location: ${la}, ${lo}${accuracy}${altitude}.`;
}

/** Opens the device's SMS composer only; the user must send the draft manually. */
export function smsUrl(fix: Parameters<typeof smsText>[0], os: "ios" | "android" | "desktop"): string {
  return `sms:112${os === "ios" ? "&" : "?"}body=${encodeURIComponent(smsText(fix))}`;
}

export function ageSeconds(fix: SosFix, now: number): number {
  return Math.max(0, Math.round((now - fix.timestamp) / 1000));
}

export function detectOs(ua: string, maxTouchPoints = 0): "ios" | "android" | "desktop" {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh|MacIntel/i.test(ua) && (/Mobile/i.test(ua) || maxTouchPoints > 1))) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}
