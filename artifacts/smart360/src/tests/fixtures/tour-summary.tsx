/**
 * DEV/browser-test fixture only (not in production build). Mounts the REAL shared
 * LiveTourPanel finished branch with a synthetic Ljubljana tour built by the real
 * tour engine. No tenant data, API, auth or DB. Query: ?mode=guided|free&lang=sl|en|de|it
 * &activity=hiking|running|cycling&kcal=1
 */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { LiveTourPanel } from "../../pages/living-guide/living-guide-live-tour";
import { LIVING_GUIDE_UI, type UiLanguage } from "../../pages/guest/i18n";
import { downloadTourGpx } from "../../lib/live-tour-export";
import { finishTour, recordTourPoint, startTour, tourMetrics, type TourActivity } from "../../lib/live-tour";
import "../../pages/living-guide/living-guide-gpx.css";
import "../../pages/living-guide/living-guide-tour-summary.css";

const q = new URLSearchParams(location.search);
const lang = (["sl", "en", "de", "it"].includes(q.get("lang") || "") ? q.get("lang") : "sl") as UiLanguage;
const act = q.get("activity");
const activity: TourActivity = act === "running" || act === "cycling" ? act : "hiking";
const guided = q.get("mode") !== "free";
const kcal = q.get("kcal") === "1";
const t = (key: string, vars?: Record<string, string | number>) => {
  let s = (LIVING_GUIDE_UI as Record<string, Record<string, string>>)[key]?.[lang] ?? key;
  for (const [k, v] of Object.entries(vars ?? {})) s = s.replace(`{${k}}`, String(v));
  return s;
};

// Ljubljana: Kongresni trg -> Ljubljana Castle loop, synthetic fixes every 6 s.
const t0 = Date.UTC(2026, 5, 14, 7, 30);
const path: Array<[number, number, number]> = [];
for (let i = 0; i <= 80; i++) {
  const a = (i / 80) * Math.PI * 1.6;
  path.push([46.0500 + 0.0035 * Math.sin(a), 14.5030 + 0.0060 * (1 - Math.cos(a)) / 2 + i * 0.00002, 296 + 70 * Math.sin(a / 1.6)]);
}
const speedStep = activity === "cycling" ? 2.5 : activity === "running" ? 4 : 6;
let state = startTour(t0, activity, kcal ? { weightKg: 72 } : {});
path.forEach(([lat, lon, altitude], i) => {
  state = recordTourPoint(state, { lat, lon, altitude, altitudeAccuracy: 4, accuracy: 4, timestamp: t0 + i * speedStep * 1000 });
});
const end = t0 + path.length * speedStep * 1000 + 60_000;
state = finishTour(state, end);
const metrics = tourMetrics(state, end);
const planned = [path.map(([lat, lon, ele]) => ({ lat, lon, ele }))];
const noPlanned: typeof planned = [];
(window as unknown as { __fixture: unknown }).__fixture = { state, metrics, lang, activity, guided, kcal };

function App() {
  const [gpx, setGpx] = useState<"gpx" | null>(null);
  const name = guided ? "Ljubljanski grad" : `${t("UI.lg.freeTour.routeName")} · ${t(`UI.lg.gpx.${activity}`)}`;
  return (
    <main data-testid="fixture-tour-summary">
      <LiveTourPanel
        t={t} status="finished" metrics={metrics} pointCount={state.points.length}
        wakeStatus="idle" platform="other" geoError={null} exporting={gpx} exportError={false}
        hasPlannedRoute={guided}
        onStart={() => {}} onPause={() => {}} onResume={() => {}} onFinish={() => {}} onReset={() => location.reload()}
        onFullscreen={() => {}} onDownloadImage={() => {}}
        onDownloadGpx={() => { setGpx("gpx"); try { downloadTourGpx(state, name); } finally { setGpx(null); } }}
        summary={{ state, plannedSegments: guided ? planned : noPlanned, tourName: name, tenantName: "Hiša Pod Gradom", lang }}
      />
    </main>
  );
}

const style = document.createElement("style");
style.textContent = `*{box-sizing:border-box} body{margin:0;padding:16px;background:#F4F6F2;color:#121A14;font-family:system-ui,sans-serif} main{max-width:620px;margin:auto;background:#fff;padding:12px;border-radius:16px}`;
document.head.appendChild(style);
createRoot(document.getElementById("root")!).render(<App />);
