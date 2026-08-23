import { useEffect, useState } from "react";

import { isUsableCoordinates, resolveSunWindow } from "./sun-times";

export const LIVING_THEMES = ["jutro", "dan", "vecer", "noc"] as const;

export type LivingTheme = (typeof LIVING_THEMES)[number];

export function isLivingTheme(value: string | null): value is LivingTheme {
  return value !== null && LIVING_THEMES.includes(value as LivingTheme);
}

/** Tenant coordinates as they arrive in the public payload (may be absent). */
export interface ThemeCoordinates {
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
}

/**
 * Fixed-hour fallback for tenants without coordinates and for polar
 * day/night, where the sun-based boundaries do not exist.
 * 00:00–04:59 is night — the prototype's h < 10 branch was explicitly rejected.
 */
export function livingThemeForHour(hour: number): LivingTheme {
  if (hour >= 5 && hour < 10) return "jutro";
  if (hour >= 10 && hour < 17) return "dan";
  if (hour >= 17 && hour < 21) return "vecer";
  return "noc";
}

/**
 * Theme for `now`. With usable tenant coordinates the REAL sun rules:
 * noc = dusk→dawn, jutro = dawn→sunrise+90 min, dan = sunrise+90→sunset−90,
 * vecer = sunset−90→dusk (civil dawn/dusk, NOAA computation in sun-times.ts).
 * Without coordinates — or in polar day/night — the fixed hours above apply.
 * Never throws: any sun-computation gap falls back to the wall clock.
 */
export function currentLivingTheme(
  now = new Date(),
  coords?: ThemeCoordinates,
): LivingTheme {
  if (coords && isUsableCoordinates(coords.latitude, coords.longitude)) {
    const window = resolveSunWindow(
      now,
      coords.latitude as number,
      coords.longitude as number,
    );
    if (window !== null) return window.theme;
  }
  return livingThemeForHour(now.getHours());
}

function millisecondsToNextFixedBoundary(now: Date): number {
  const next = new Date(now);
  next.setSeconds(0, 0);

  const hour = now.getHours();
  const nextHour = hour < 5 ? 5 : hour < 10 ? 10 : hour < 17 ? 17 : hour < 21 ? 21 : 29;

  if (nextHour >= 24) {
    next.setDate(next.getDate() + 1);
    next.setHours(nextHour - 24, 0, 0, 0);
  } else {
    next.setHours(nextHour, 0, 0, 0);
  }

  return Math.max(1_000, next.getTime() - now.getTime());
}

export function millisecondsToNextBoundary(
  now: Date,
  coords?: ThemeCoordinates,
): number {
  if (coords && isUsableCoordinates(coords.latitude, coords.longitude)) {
    const window = resolveSunWindow(
      now,
      coords.latitude as number,
      coords.longitude as number,
    );
    if (window !== null) return window.nextBoundaryMs;
  }
  return millisecondsToNextFixedBoundary(now);
}

/**
 * Re-evaluates on mount, when the tab becomes visible again, and exactly at
 * the next boundary — a guest holding the guide open at dusk sees it turn to
 * night without reopening.
 */
export function useLivingTheme(
  override?: LivingTheme,
  coords?: ThemeCoordinates,
): LivingTheme {
  const latitude = coords?.latitude ?? null;
  const longitude = coords?.longitude ?? null;

  const [automaticTheme, setAutomaticTheme] = useState(() =>
    currentLivingTheme(new Date(), { latitude, longitude }),
  );

  useEffect(() => {
    if (override) return;

    const at: ThemeCoordinates = { latitude, longitude };
    let timeoutId = 0;
    const syncAndSchedule = () => {
      const now = new Date();
      setAutomaticTheme(currentLivingTheme(now, at));
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(
        syncAndSchedule,
        millisecondsToNextBoundary(now, at),
      );
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncAndSchedule();
    };

    syncAndSchedule();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [override, latitude, longitude]);

  return override ?? automaticTheme;
}
