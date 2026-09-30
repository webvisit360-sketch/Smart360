/**
 * Development/browser-test fixture only. Mounts the real guest GPX component
 * with a synthetic planned route; no tenant data, API writes, or authentication.
 * This HTML entry is not included in the production Vite build.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { LivingGuideGpxRoute } from "../../pages/living-guide/living-guide-gpx";
import { LIVING_GUIDE_UI, type UiLanguage } from "../../pages/guest/i18n";
import type { GpxRoute } from "../../lib/gpx-route";

const lang = (new URLSearchParams(location.search).get("lang") || "sl") as UiLanguage;
// Fixture-only activity override; never reads or modifies a tenant route.
const requestedActivity = new URLSearchParams(location.search).get("activity");
const activity = requestedActivity === "running" || requestedActivity === "cycling" ? requestedActivity : "hiking";
const route = {
  fileId: "browser-test-only",
  filename: "planned-test-route.gpx",
  activity,
  distanceKm: 0.38,
  ascentM: 10,
  descentM: 10,
  minElevationM: 5,
  maxElevationM: 15,
  durationMinutes: Number((60 * (0.38 / (activity === "running" ? 10 : 5) + 10 / 600)).toFixed(2)),
  segments: [[
    { lat: 45.536, lon: 13.66 },
    { lat: 45.537, lon: 13.66 },
    { lat: 45.538, lon: 13.661 },
    { lat: 45.539, lon: 13.662 },
  ]],
  profile: [
    { segment: 0, distanceKm: 0, elevationM: 5 },
    { segment: 0, distanceKm: 0.1112, elevationM: 9 },
    { segment: 0, distanceKm: 0.2467, elevationM: 15 },
    { segment: 0, distanceKm: 0.3822, elevationM: 5 },
  ],
} as unknown as GpxRoute;

const style = document.createElement("style");
style.textContent = `
  :root { --tx:#121A14; --tx2:#66716A; --line:#E8EBE6; --card:#FFFFFF;
    --card2:#F4F6F2; --accent:#157347; --sans:Arial,system-ui,sans-serif; }
  * { box-sizing:border-box; }
  body { margin:0; padding:16px; background:var(--card2); color:var(--tx); font-family:var(--sans); }
  main { max-width:620px; margin:auto; }
  button,a { font-family:inherit; }
  .fixture-sheet { transform:translateY(0); max-height:90vh; overflow:auto; padding:12px; background:var(--card); }
`;
document.head.appendChild(style);

createRoot(document.getElementById("root")!).render(
  <main>
    <small>Razvojni preizkus · sintetična načrtovana pot</small>
    <div className="fixture-sheet">
      <LivingGuideGpxRoute
        route={route}
        slug="tour-browser-fixture"
        itemId="synthetic-route"
        heading="Obalna testna pot"
        variant="legacy"
        t={(key, variables) => {
          const entry = LIVING_GUIDE_UI[key as keyof typeof LIVING_GUIDE_UI];
          return (entry?.[lang] || entry?.sl || key).replace(/\{(\w+)\}/g, (_, name: string) => String(variables?.[name] ?? ""));
        }}
      />
    </div>
  </main>,
);