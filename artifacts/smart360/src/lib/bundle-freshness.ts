/**
 * Stale-bundle self-recovery. Guests keep the guide open for a week; a device
 * that loaded the app before a publish keeps running the ENTIRE old frontend
 * bundle — old bugs "reproduce" on that device even though the fix is live.
 *
 * The build stamps __BUILD_ID__ into the bundle and emits the same id into
 * /version.json. This hook compares the two while the app is visible and,
 * on mismatch, reloads ONCE, silently — but only when it cannot cost the
 * guest anything:
 *   - never while an order flow or the sign-in sheet is open, and never
 *     while a message draft is typed (activity registry + focused-input
 *     check);
 *   - navigation is URL-driven, so the reload restores the guest's place;
 *   - a sessionStorage marker prevents reload loops: each new build id gets
 *     exactly one automatic reload attempt per tab.
 */
import { useEffect } from "react";

declare const __BUILD_ID__: string;

const activities = new Set<string>();

/** Mark a guest flow (open order sheet, sign-in, typed draft) as reload-unsafe. */
export function beginGuestActivity(tag: string): void {
  activities.add(tag);
}

export function endGuestActivity(tag: string): void {
  activities.delete(tag);
}

function hasTypedInput(): boolean {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement) {
    if (["checkbox", "radio", "button", "submit", "range"].includes(el.type)) return false;
    return el.value.trim().length > 0;
  }
  if (el instanceof HTMLTextAreaElement) return el.value.trim().length > 0;
  if (el instanceof HTMLElement && el.isContentEditable) {
    return (el.textContent ?? "").trim().length > 0;
  }
  return false;
}

export function isReloadSafe(): boolean {
  return activities.size === 0 && !hasTypedInput();
}

/** Pure reload decision — unit-tested. */
export function shouldReload(opts: {
  current: string;
  latest: string | null | undefined;
  alreadyReloadedFor: string | null;
  safe: boolean;
}): boolean {
  const { current, latest, alreadyReloadedFor, safe } = opts;
  if (!latest || typeof latest !== "string") return false;
  if (latest === current) return false;
  // Loop guard: one automatic reload per new build id. If the server still
  // hands out the old bundle after that, stay put instead of flickering.
  if (alreadyReloadedFor === latest) return false;
  return safe;
}

const RELOADED_KEY = "lg-bundle-reload";
const CHECK_INTERVAL_MS = 5 * 60_000;
const PENDING_RETRY_MS = 30_000;
const INITIAL_DELAY_MS = 10_000;

export function useBundleFreshness(): void {
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let disposed = false;
    let retryTimer: number | undefined;

    const attempt = (latest: string) => {
      if (disposed) return;
      let already: string | null = null;
      try {
        already = sessionStorage.getItem(RELOADED_KEY);
      } catch {
        /* storage blocked — the loop guard degrades to "don't reload" below */
        already = latest;
      }
      if (
        shouldReload({
          current: __BUILD_ID__,
          latest,
          alreadyReloadedFor: already,
          safe: isReloadSafe(),
        })
      ) {
        try {
          sessionStorage.setItem(RELOADED_KEY, latest);
        } catch {
          return; // cannot record the guard — do not risk a loop
        }
        window.location.reload();
        return;
      }
      // Outdated but unsafe right now (order open / draft typed): retry soon.
      if (latest !== __BUILD_ID__ && already !== latest) {
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => attempt(latest), PENDING_RETRY_MS);
      }
    };

    const check = async () => {
      if (disposed || document.visibilityState !== "visible") return;
      try {
        const base = import.meta.env.BASE_URL ?? "/";
        const res = await fetch(`${base}version.json`, { cache: "no-store" });
        if (!res.ok) return; // dev server / old deploy without version.json
        const data: unknown = await res.json().catch(() => null);
        const latest =
          data && typeof data === "object" && typeof (data as { buildId?: unknown }).buildId === "string"
            ? (data as { buildId: string }).buildId
            : null;
        if (latest) attempt(latest);
      } catch {
        /* offline — never bother the guest */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const initial = window.setTimeout(() => void check(), INITIAL_DELAY_MS);
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      disposed = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);
}
