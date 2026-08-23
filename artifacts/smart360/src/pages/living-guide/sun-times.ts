/**
 * Real-sun theme boundaries (prototype parity: `sunTimes`, `themeForSun`).
 *
 * NOAA solar calculator algorithm (Meeus). Verified to the minute against the
 * prototype's reference table for Izola (45.5126898, 13.6339282):
 *   21.6.  dawn 04:38  sunrise 05:16  sunset 20:57  dusk 21:35
 *   21.12. dawn 07:08  sunrise 07:42  sunset 16:24  dusk 16:58
 *
 * All math works on absolute instants (Date), so the guest's device timezone
 * and DST are handled automatically when the times are compared or displayed.
 * Polar day/night (sun never crosses the horizon) returns null — callers must
 * fall back to the fixed-hour clock.
 */

import type { LivingTheme } from "./theme-clock";

export interface SunTimes {
  /** Civil dawn — sun 6° below the horizon, morning. */
  dawn: Date;
  /** Sunrise — upper limb touches the horizon (zenith 90.833°). */
  sunrise: Date;
  /** Sunset — upper limb leaves the horizon. */
  sunset: Date;
  /** Civil dusk — sun 6° below the horizon, evening. */
  dusk: Date;
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const MINUTE_MS = 60_000;

function julianCent(dateMs: number): number {
  const jd = dateMs / 86_400_000 + 2_440_587.5;
  return (jd - 2_451_545) / 36_525;
}

function geomMeanLongSun(t: number): number {
  const l0 = 280.46646 + t * (36000.76983 + t * 0.0003032);
  return ((l0 % 360) + 360) % 360;
}

function geomMeanAnomSun(t: number): number {
  return 357.52911 + t * (35999.05029 - 0.0001537 * t);
}

function eccentEarthOrbit(t: number): number {
  return 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
}

function sunApparentLong(t: number): number {
  const m = RAD * geomMeanAnomSun(t);
  const center =
    Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m) * 0.000289;
  const trueLong = geomMeanLongSun(t) + center;
  const omega = 125.04 - 1934.136 * t;
  return trueLong - 0.00569 - 0.00478 * Math.sin(RAD * omega);
}

function obliqCorrected(t: number): number {
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const e0 = 23 + (26 + seconds / 60) / 60;
  const omega = 125.04 - 1934.136 * t;
  return e0 + 0.00256 * Math.cos(RAD * omega);
}

function sunDeclination(t: number): number {
  const e = RAD * obliqCorrected(t);
  const lambda = RAD * sunApparentLong(t);
  return DEG * Math.asin(Math.sin(e) * Math.sin(lambda));
}

/** Equation of time in minutes. */
function equationOfTime(t: number): number {
  const epsilon = RAD * obliqCorrected(t);
  const l0 = RAD * geomMeanLongSun(t);
  const e = eccentEarthOrbit(t);
  const m = RAD * geomMeanAnomSun(t);
  const y = Math.tan(epsilon / 2) ** 2;
  const eTime =
    y * Math.sin(2 * l0) -
    2 * e * Math.sin(m) +
    4 * e * y * Math.sin(m) * Math.cos(2 * l0) -
    0.5 * y * y * Math.sin(4 * l0) -
    1.25 * e * e * Math.sin(2 * m);
  return DEG * eTime * 4;
}

/** Hour angle in degrees, or null when the sun never reaches the zenith. */
function hourAngle(lat: number, decl: number, zenith: number): number | null {
  const latR = RAD * lat;
  const dR = RAD * decl;
  const cosH =
    Math.cos(RAD * zenith) / (Math.cos(latR) * Math.cos(dR)) -
    Math.tan(latR) * Math.tan(dR);
  if (!Number.isFinite(cosH) || cosH > 1 || cosH < -1) return null;
  return DEG * Math.acos(cosH);
}

export function isUsableCoordinates(
  latitude: unknown,
  longitude: unknown,
): latitude is number {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

/**
 * Sun times for the UTC day containing `date`.
 * Returns null for polar day/night or unusable coordinates — never throws.
 */
export function sunTimes(
  date: Date,
  lat: number,
  lng: number,
): SunTimes | null {
  if (!isUsableCoordinates(lat, lng) || Number.isNaN(date.getTime())) {
    return null;
  }

  const midnightUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );

  const timeFor = (zenith: number, isRise: boolean): Date | null => {
    // First guess: solar noon ignoring the equation of time; one refinement
    // pass recomputes declination/eqtime at the event itself (NOAA method).
    let minutes = 720 - 4 * lng;
    for (let pass = 0; pass < 2; pass++) {
      const t = julianCent(midnightUtc + minutes * MINUTE_MS);
      const decl = sunDeclination(t);
      const ha = hourAngle(lat, decl, zenith);
      if (ha === null) return null;
      minutes = 720 - 4 * (lng + (isRise ? ha : -ha)) - equationOfTime(t);
    }
    return new Date(midnightUtc + minutes * MINUTE_MS);
  };

  const dawn = timeFor(96, true);
  const sunrise = timeFor(90.833, true);
  const sunset = timeFor(90.833, false);
  const dusk = timeFor(96, false);
  if (!dawn || !sunrise || !sunset || !dusk) return null;
  return { dawn, sunrise, sunset, dusk };
}

const JUTRO_AFTER_SUNRISE_MIN = 90;
const VECER_BEFORE_SUNSET_MIN = 90;

/**
 * noc = dusk → dawn · jutro = dawn → sunrise + 90 min ·
 * dan = sunrise + 90 min → sunset − 90 min · vecer = sunset − 90 min → dusk.
 */
export function themeForSun(now: Date, times: SunTimes): LivingTheme {
  if (now < times.dawn) return "noc";
  if (now.getTime() < times.sunrise.getTime() + JUTRO_AFTER_SUNRISE_MIN * MINUTE_MS) {
    return "jutro";
  }
  if (now.getTime() < times.sunset.getTime() - VECER_BEFORE_SUNSET_MIN * MINUTE_MS) {
    return "dan";
  }
  if (now < times.dusk) return "vecer";
  return "noc";
}

/** The four theme-change instants of a computed day, in order. */
export function sunBoundaries(times: SunTimes): Date[] {
  return [
    times.dawn,
    new Date(times.sunrise.getTime() + JUTRO_AFTER_SUNRISE_MIN * MINUTE_MS),
    new Date(times.sunset.getTime() - VECER_BEFORE_SUNSET_MIN * MINUTE_MS),
    times.dusk,
  ];
}

export interface SunWindow {
  /** Theme in force at `now`. */
  theme: LivingTheme;
  /** Milliseconds until the next theme change (≥ 1 s). */
  nextBoundaryMs: number;
}

const DAY_MS = 86_400_000;
const BOUNDARY_THEMES: readonly LivingTheme[] = ["jutro", "dan", "vecer", "noc"];

/**
 * The single source of truth for the sun-driven theme AND its scheduling.
 *
 * `sunTimes` works on UTC calendar days, but a guest's local day straddles a
 * UTC-day seam (e.g. local 06:00 in UTC+9 is still the PREVIOUS UTC date, so
 * that morning's dawn belongs to the "next" UTC day's computation). Merging
 * the boundaries of the previous, current, and next UTC day and picking the
 * interval containing `now` is seam-proof at every longitude — theme = the
 * last boundary at or before `now`, next wake-up = the first one after it.
 *
 * Returns null for polar day/night or unusable coordinates (fixed-hour
 * fallback applies). Never throws.
 */
export function resolveSunWindow(
  now: Date,
  lat: number,
  lng: number,
): SunWindow | null {
  const boundaries: { at: number; theme: LivingTheme }[] = [];
  for (const offset of [-DAY_MS, 0, DAY_MS]) {
    const times = sunTimes(new Date(now.getTime() + offset), lat, lng);
    if (times === null) return null;
    sunBoundaries(times).forEach((boundary, i) => {
      boundaries.push({ at: boundary.getTime(), theme: BOUNDARY_THEMES[i]! });
    });
  }
  boundaries.sort((a, b) => a.at - b.at);

  let theme: LivingTheme = "noc"; // before the earliest dawn in the window
  let next: number | null = null;
  for (const boundary of boundaries) {
    if (boundary.at <= now.getTime()) {
      theme = boundary.theme;
    } else {
      next = boundary.at;
      break;
    }
  }
  // `next` can only be null if `now` is after every boundary of the NEXT UTC
  // day — impossible by construction, but fall back safely rather than trust it.
  if (next === null) return null;
  return { theme, nextBoundaryMs: Math.max(1_000, next - now.getTime()) };
}

/**
 * Milliseconds until the next sun boundary after `now`, or null when the sun
 * position is unusable (polar day/night) and the fixed-hour clock must rule.
 */
export function millisecondsToNextSunBoundary(
  now: Date,
  lat: number,
  lng: number,
): number | null {
  return resolveSunWindow(now, lat, lng)?.nextBoundaryMs ?? null;
}
