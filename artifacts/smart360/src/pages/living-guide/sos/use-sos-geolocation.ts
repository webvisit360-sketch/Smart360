import { useCallback, useEffect, useRef, useState } from "react";
import { toFix, type SosErrorKind, type SosFix } from "./sos-model";

/** Minimal subset of the Geolocation API, injectable for the DEV fixture. */
export interface SosGeolocationSource {
  watchPosition(
    ok: (p: GeolocationPosition) => void,
    err?: (e: GeolocationPositionError) => void,
    opts?: PositionOptions,
  ): number;
  clearWatch(id: number): void;
}

/**
 * Watches the device position while mounted. Position stays in memory only:
 * never sent, stored or logged. The watch is cleared on unmount/retry.
 */
export function useSosGeolocation(source?: SosGeolocationSource | null) {
  const [fix, setFix] = useState<SosFix | null>(null);
  const [error, setError] = useState<SosErrorKind | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [attempt, setAttempt] = useState(0);
  const srcRef = useRef(source);
  srcRef.current = source;

  useEffect(() => {
    // null = explicitly unavailable; undefined = use the real navigator API.
    const geo: SosGeolocationSource | null | undefined =
      srcRef.current === undefined
        ? typeof navigator !== "undefined"
          ? navigator.geolocation
          : undefined
        : srcRef.current;
    if (!geo) {
      setError("unsupported");
      return;
    }
    let alive = true;
    let id: number | null = null;
    try {
      id = geo.watchPosition(
        (p) => {
          if (!alive) return;
          const f = toFix(p);
          if (f) {
            setFix(f);
            setError(null);
          }
        },
        (e) => {
          if (!alive) return;
          setError(
            e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable",
          );
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
      );
    } catch {
      setError("unavailable");
    }
    return () => {
      alive = false;
      if (id != null) {
        try {
          geo.clearWatch(id);
        } catch {
          /* ignore */
        }
      }
    };
  }, [attempt]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setFix(null);
    setAttempt((a) => a + 1);
  }, []);

  return { fix, error, now, retry };
}
