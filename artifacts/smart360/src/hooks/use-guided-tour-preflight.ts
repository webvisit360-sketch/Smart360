import { useEffect, useRef, useState } from "react";
import { guidedPreflight, type PreflightFix } from "../lib/guided-tour-preflight";

/** An idle guided route owns a fresh watch; ordinary map positions never authorize Start. */
export function useGuidedTourPreflight(segments: [number, number][][], enabled: boolean) {
  const [sample, setSample] = useState<{ segments: typeof segments; fix: PreflightFix | null; error: "denied" | "unsupported" | null } | null>(null);
  const latest = useRef(sample);
  const running = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  useEffect(() => {
    latest.current = null;
    setSample(null);
    running.current = enabled;
    if (!enabled) return;
    let alive = true;
    const publish = (fix: PreflightFix | null, error: "denied" | "unsupported" | null = null) => {
      if (!alive) return;
      const value = { segments, fix, error };
      latest.current = value;
      setSample(value);
    };
    if (!navigator.geolocation) { publish(null, "unsupported"); return () => { alive = false; running.current = false; }; }
    let watch: number;
    try { watch = navigator.geolocation.watchPosition(
      p => publish({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      e => publish(null, e.code === 1 ? "denied" : null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    ); } catch {
      publish(null, "unsupported");
      running.current = false;
      return () => { alive = false; latest.current = null; };
    }
    return () => { alive = false; running.current = false; latest.current = null; navigator.geolocation.clearWatch(watch); };
  }, [segments, enabled]);
  const current = enabled && sample?.segments === segments ? sample : null;
  const state = guidedPreflight(segments, current?.fix ?? null, current?.error);
  return {
    ...state,
    position: state.status === "near" || state.status === "far" ? current?.fix ?? null : null,
    canStart: () => enabledRef.current && running.current && latest.current?.segments === segments &&
      guidedPreflight(segments, latest.current.fix, latest.current.error).status === "near",
  };
}