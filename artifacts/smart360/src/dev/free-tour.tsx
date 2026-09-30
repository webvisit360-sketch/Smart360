/**
 * DEV-ONLY deterministic fixture for free tour recording: /free-tour.html
 * Replaces geolocation with a scripted loop near Bled (1 fix/s, rising
 * altitude) and stubs Wake Lock. No network besides OpenFreeMap tiles.
 * ?speed=N accelerates ticks; ?deny=1 simulates permission denied.
 */
import { createRoot } from "react-dom/client";
import { LIVING_GUIDE_UI } from "../pages/guest/i18n";
import { LivingGuideSprite } from "../pages/living-guide/LivingGuideSprite";
import { FreeTourRecorder } from "../pages/living-guide/living-guide-free-tour";
import "../pages/living-guide/living-guide-tokens.css";
import "../pages/living-guide/living-guide-guest.css";

const params = new URLSearchParams(location.search);
const lang = (params.get("lang") ?? "sl") as "sl" | "en" | "de" | "it";
const speed = Math.max(1, Number(params.get("speed") ?? 1));
const t = (key: string, vars?: Record<string, string | number>) => {
  let s = (LIVING_GUIDE_UI as Record<string, Record<string, string>>)[key]?.[lang] ?? key;
  for (const [k, v] of Object.entries(vars ?? {})) s = s.replace(`{${k}}`, String(v));
  return s;
};
const CENTER: [number, number] = [14.1146, 46.3683];
let tick = 0;
const watchers = new Map<number, number>();
let nextId = 1;
const fix = () => {
  tick += 1;
  const a = tick / 60;
  return {
    coords: { latitude: CENTER[1] + 0.004 * Math.sin(a), longitude: CENTER[0] + 0.006 * (1 - Math.cos(a)), accuracy: 6, altitude: 475 + 40 * Math.sin(a / 2), altitudeAccuracy: 5, heading: null, speed: 2 },
    timestamp: Date.now(),
  };
};
if (!params.has("externalGps")) Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
  watchPosition(ok: (p: unknown) => void, err?: (e: unknown) => void) {
    const id = nextId++;
    if (params.get("deny") === "1") { setTimeout(() => err?.({ code: 1, message: "denied" }), 50); return id; }
    watchers.set(id, window.setInterval(() => ok(fix()), 1000 / speed));
    return id;
  },
  clearWatch(id: number) { clearInterval(watchers.get(id)); watchers.delete(id); },
  getCurrentPosition(ok: (p: unknown) => void) { ok(fix()); },
} });
if (!params.has("externalGps")) Object.defineProperty(navigator, "wakeLock", { configurable: true, value: {
  request: async () => ({ released: false, release: async () => undefined, addEventListener: () => undefined }),
} });

document.body.setAttribute("data-t", params.get("theme") ?? "dan");
document.body.style.margin = "0";

function Fixture() {
  return (
    <div className="lg2-app notranslate" data-living-guide data-living-guide-app data-screen="explore" translate="no" data-testid="fixture-free-tour" style={{ boxSizing: "border-box", width: "100%", maxWidth: 430, height: "auto", margin: "0 auto", padding: 16, minHeight: "100dvh", overflow: "visible" }}>
      <LivingGuideSprite />
      <FreeTourRecorder slug="dev-fixture" t={t} center={CENTER} />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
