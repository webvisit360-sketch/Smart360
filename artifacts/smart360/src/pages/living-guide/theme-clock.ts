import { useEffect, useState } from "react";

export const LIVING_THEMES = ["jutro", "dan", "vecer", "noc"] as const;

export type LivingTheme = (typeof LIVING_THEMES)[number];

export function isLivingTheme(value: string | null): value is LivingTheme {
  return value !== null && LIVING_THEMES.includes(value as LivingTheme);
}

/**
 * The guest's local clock is the only source of truth.
 * 00:00–04:59 is night — the prototype's h < 10 branch was explicitly rejected.
 */
export function livingThemeForHour(hour: number): LivingTheme {
  if (hour >= 5 && hour < 10) return "jutro";
  if (hour >= 10 && hour < 17) return "dan";
  if (hour >= 17 && hour < 21) return "vecer";
  return "noc";
}

export function currentLivingTheme(now = new Date()): LivingTheme {
  return livingThemeForHour(now.getHours());
}

function millisecondsToNextBoundary(now: Date): number {
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

export function useLivingTheme(override?: LivingTheme): LivingTheme {
  const [automaticTheme, setAutomaticTheme] = useState(currentLivingTheme);

  useEffect(() => {
    if (override) return;

    let timeoutId = 0;
    const syncAndSchedule = () => {
      const now = new Date();
      setAutomaticTheme(currentLivingTheme(now));
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(syncAndSchedule, millisecondsToNextBoundary(now));
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
  }, [override]);

  return override ?? automaticTheme;
}
