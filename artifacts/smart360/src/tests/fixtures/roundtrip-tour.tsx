/** Development-only: route JSON supplied exclusively by Playwright route interception. */
import React from "react";
import { createRoot } from "react-dom/client";
import { LivingGuideGpxRoute } from "../../pages/living-guide/living-guide-gpx";
import { LIVING_GUIDE_UI } from "../../pages/guest/i18n";
import type { GpxRoute } from "../../lib/gpx-route";

const style = document.createElement("style");
style.textContent = `
  :root { --tx:#121A14; --tx2:#66716A; --line:#E8EBE6; --card:#FFFFFF;
    --card2:#F4F6F2; --accent:#157347; --sans:Arial,system-ui,sans-serif; }
  * { box-sizing:border-box; }
  body { margin:0; padding:16px; background:var(--card2); color:var(--tx); font-family:var(--sans); }
  main { max-width:620px; margin:auto; }
  button,a { font-family:inherit; }
  .fixture-sheet { transform:translateY(0); padding:12px; background:var(--card); }
`;
document.head.appendChild(style);

async function render() {
  const response = await fetch("/__free-tour-test-route.json");
  if (!response.ok) throw new Error(`Test route fetch failed: ${response.status}`);
  const route = await response.json() as GpxRoute;
  if (route.version !== 1 || route.activity !== "hiking" || route.segments?.length !== 2 ||
      route.segments.some((segment) => segment.length !== 3)) {
    throw new Error("Expected the exact two-segment uploaded GPX route from the integration test");
  }
  // Observe the actual GeoJSON handed to MapLibre by the real component,
  // without substituting the map, its source, or any renderer implementation.
  const { Map } = await import("maplibre-gl");
  const addSource = Map.prototype.addSource;
  Map.prototype.addSource = function (...args) {
    const [id, source] = args;
    if (id === "gpx" && source.type === "geojson" && typeof source.data === "object") {
      (window as Window & { __roundtripDrawnLine?: unknown }).__roundtripDrawnLine =
        (source.data as { geometry?: { coordinates?: number[][][] } }).geometry?.coordinates;
    }
    return addSource.apply(this, args);
  };
  createRoot(document.getElementById("root")!).render(
    <main>
      <small>Razvojni preizkus · naložena sintetična GPX sled</small>
      <div className="fixture-sheet">
        <LivingGuideGpxRoute
          route={route}
          slug="roundtrip-fixture"
          itemId="roundtrip-route"
          heading="Moja pot &amp; hrib"
          variant="legacy"
          t={(key, variables) => {
            const entry = LIVING_GUIDE_UI[key as keyof typeof LIVING_GUIDE_UI];
            return (entry?.sl || key).replace(/\{(\w+)\}/g, (_, name: string) => String(variables?.[name] ?? ""));
          }}
        />
      </div>
    </main>,
  );
}

render().catch((error) => {
  document.getElementById("root")!.textContent = String(error);
  console.error(error);
});