/**
 * DEV-ONLY SOS fixture. Renders the real SosView with SIMULATED geolocation
 * (never touches navigator.geolocation).
 *   /__sos-fixture?state=active|poor|acquiring|denied|stale|unsupported&lang=sl|en|de|it&coords=0|1&os=ios|android|desktop&view=card
 */
import { useMemo, useState } from "react";
import { SosCard, SosMapButton, SosView } from "./SosView";
import type { SosGeolocationSource } from "./use-sos-geolocation";
import type { SosTenant } from "./sos-model";
import { LivingGuideSprite } from "../LivingGuideSprite";

const TENANT: SosTenant = { name: "Turizem Drobež", latitude: 46.373381, longitude: 14.810827, address: "Ter 35, 3333 Ljubno ob Savinji" };
const POS = { lat: 46.35812, lon: 14.83294 };

function fakeSource(state: string): SosGeolocationSource | null {
  if (state === "unsupported") return null;
  return {
    watchPosition(ok, err) {
      const emit = (accuracy: number, ageMs: number) =>
        ok({ coords: { latitude: POS.lat, longitude: POS.lon, altitude: 612, accuracy, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() - ageMs } as unknown as GeolocationPosition);
      if (state === "denied") setTimeout(() => err?.({ code: 1, message: "denied" } as GeolocationPositionError), 0);
      else if (state === "poor") setTimeout(() => emit(140, 0), 0);
      else if (state === "stale") setTimeout(() => emit(8, 45_000), 0);
      else if (state === "active") setTimeout(() => emit(8, 3_000), 0);
      return 1;
    },
    clearWatch() {},
  };
}

export default function LivingGuideSosFixture() {
  const q = useMemo(() => new URLSearchParams(window.location.search), []);
  const state = q.get("state") ?? "active";
  const lang = q.get("lang") ?? "sl";
  const tenant = q.get("coords") === "0" ? { ...TENANT, latitude: null, longitude: null } : TENANT;
  const os = (q.get("os") as "ios" | "android" | "desktop" | null) ?? undefined;
  const [open, setOpen] = useState(q.get("view") !== "card");
  const source = useMemo(() => fakeSource(state), [state]);
  return (
    <div style={{ minHeight: "100dvh", background: "#0B1220", padding: 16 }}>
      <LivingGuideSprite />
      <div style={{ maxWidth: 390, margin: "0 auto" }}>
        <SosCard lang={lang} onOpen={() => setOpen(true)} />
        <SosMapButton lang={lang} onOpen={() => setOpen(true)} />
      </div>
      {open && <SosView tenant={tenant} lang={lang} onClose={() => setOpen(false)} geolocation={source} osOverride={os} />}
    </div>
  );
}

