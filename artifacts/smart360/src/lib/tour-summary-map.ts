import type { Map as MapLibreMap } from "maplibre-gl";
import { OPENFREEMAP_STYLE_URL } from "./map-provider";

export const TOUR_MAP_ATTRIBUTION = "© OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors";
const CAPTURE_TIMEOUT_MS = 20_000;
const ROUTE_SOURCE = "tour-summary-route";
type Point = { lat: number; lon: number };
type Coordinate = [number, number];
type CaptureInput = { segments: Point[][]; width: number; height: number; signal?: AbortSignal };
type CaptureResult = { canvas: HTMLCanvasElement; attribution: string } | null;

/** Split at invalid fixes, preserve gaps, and use the smallest longitude interval. */
export function prepareTourMapSegments(segments: Point[][]): Coordinate[][] {
  const runs: Coordinate[][] = [];
  for (const segment of segments) {
    let run: Coordinate[] = [];
    for (const point of segment) {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)
        || Math.abs(point.lat) > 85.051129 || Math.abs(point.lon) > 180) {
        if (run.length) runs.push(run);
        run = [];
      } else {
        run.push([point.lon, point.lat]);
      }
    }
    if (run.length) runs.push(run);
  }
  const longitudes = runs.flat().map(p => (p[0] + 360) % 360).sort((a, b) => a - b);
  if (!longitudes.length) return [];
  let gap = -1, west = longitudes[0]!;
  for (let i = 0; i < longitudes.length; i++) {
    const next = longitudes[(i + 1) % longitudes.length]!;
    const size = next + (i === longitudes.length - 1 ? 360 : 0) - longitudes[i]!;
    if (size > gap) { gap = size; west = next; }
  }
  // Keep the world copy near [-180, 180] rather than needlessly centering at 360°.
  const shift = west > 180 ? -360 : 0;
  return runs.map(run => run.map(([lon, lat]) => {
    const normalized = (lon + 360) % 360;
    return [normalized + (normalized < west ? 360 : 0) + shift, lat];
  }));
}

/**
 * On-device, disposable WebGL snapshot. Only the shared provider's normal
 * style/tile/sprite/glyph requests leave the browser; GeoJSON stays in the worker.
 * Null explicitly tells the compositor to use its schematic fallback.
 */
export async function captureTourMap(input: CaptureInput): Promise<CaptureResult> {
  const { width, height, signal } = input;
  if (typeof document === "undefined" || signal?.aborted
    || (typeof navigator !== "undefined" && navigator.onLine === false)
    || !Number.isInteger(width) || !Number.isInteger(height)
    || width < 1080 || height < 1 || width > 8192 || height > 8192
    || width * height > 24_000_000) return null;
  const segments = prepareTourMapSegments(input.segments);
  const points = segments.flat();
  if (!points.length) return null;

  return new Promise<CaptureResult>((resolve) => {
    let map: MapLibreMap | undefined;
    let container: HTMLDivElement | undefined;
    let settled = false;
    let routeReady = false;
    const finish = (result: CaptureResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      window.removeEventListener("offline", abort);
      try { map?.remove(); } catch { /* Still release the DOM on context loss. */ }
      container?.remove();
      resolve(result);
    };
    const abort = () => finish(null);
    const timeout = setTimeout(abort, CAPTURE_TIMEOUT_MS);
    signal?.addEventListener("abort", abort, { once: true });
    window.addEventListener("offline", abort, { once: true });

    // Imports are inside the bounded operation too. Never create a map if an
    // import finishes after abort/timeout, and do not alter existing map views.
    void Promise.all([
      import("maplibre-gl"),
      import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"),
    ]).then(([{ Map, setWorkerUrl }, { default: workerUrl }]) => {
      if (settled) return;
      setWorkerUrl(workerUrl);
      container = document.createElement("div");
      container.setAttribute("aria-hidden", "true");
      // Not display:none: WebGL must lay out and render at native export pixels.
      // Ceil allows odd dimensions; the final copy crops at most one pixel.
      container.style.cssText = `position:fixed;left:-20000px;top:0;width:${Math.ceil(width / 2)}px;height:${Math.ceil(height / 2)}px;pointer-events:none;`;
      document.body.appendChild(container);
      let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
      for (const [lon, lat] of points) {
        west = Math.min(west, lon); east = Math.max(east, lon);
        south = Math.min(south, lat); north = Math.max(north, lat);
      }
      map = new Map({
        container,
        style: OPENFREEMAP_STYLE_URL,
        bounds: [[west, south], [east, north]],
        fitBoundsOptions: { padding: Math.min(width / 2, height / 2) * 0.12, maxZoom: 16, duration: 0 },
        interactive: false,
        attributionControl: false,
        renderWorldCopies: true,
        pixelRatio: 2,
        fadeDuration: 0,
        canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
      });
      const activeMap = map;
      activeMap.on("error", abort);
      activeMap.on("webglcontextlost", abort);
      activeMap.on("load", () => {
        if (settled) return;
        try {
          activeMap.addSource(ROUTE_SOURCE, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "MultiLineString", coordinates: segments.filter(run => run.length > 1) },
            },
          });
          activeMap.addLayer({
            id: ROUTE_SOURCE,
            type: "line",
            source: ROUTE_SOURCE,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#157347", "line-width": 3.5 },
          });
          routeReady = true;
        } catch { finish(null); }
      });
      activeMap.on("idle", () => {
        if (settled || !routeReady) return;
        try {
          if (!activeMap.areTilesLoaded()) return;
          // A loaded style, background, or our own route is NOT proof of a map.
          // Require visible provider geometry from a loaded real vector source.
          const sources = activeMap.getStyle().sources;
          const geography = activeMap.queryRenderedFeatures().some(feature =>
            feature.source !== ROUTE_SOURCE && sources[feature.source]?.type === "vector");
          if (!geography) return finish(null);
          const rendered = activeMap.getCanvas();
          if (rendered.width < width || rendered.height < height) return finish(null);
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return finish(null);
          // Native-resolution copy, not CSS-size capture enlarged afterwards.
          ctx.drawImage(rendered, 0, 0);
          const start = activeMap.project(points[0]!);
          const end = activeMap.project(points[points.length - 1]!);
          const radius = 19;
          const close = Math.hypot(start.x - end.x, start.y - end.y) * 2 < radius * 2.5;
          const pin = (point: { x: number; y: number }, letter: string, color: string, dx: number) => {
            const x = point.x * 2 + dx, y = point.y * 2;
            if (dx) {
              ctx.beginPath(); ctx.moveTo(point.x * 2, y); ctx.lineTo(x, y);
              ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
            }
            ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = color; ctx.fill();
            ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.stroke();
            ctx.font = "700 22px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillStyle = "#ffffff"; ctx.fillText(letter, x, y + 1);
          };
          pin(start, "S", "#157347", close ? -radius * 1.15 : 0);
          pin(end, "C", "#c0392b", close ? radius * 1.15 : 0);
          // Reading catches origin taint. Also require actual PNG encoding, not
          // merely a canvas object whose later export would throw or be empty.
          ctx.getImageData(0, 0, 1, 1);
          canvas.toBlob(blob => {
            if (!blob || !blob.size || blob.type !== "image/png") return finish(null);
            finish({ canvas, attribution: TOUR_MAP_ATTRIBUTION });
          }, "image/png");
        } catch { finish(null); }
      });
    }).catch(() => finish(null));
  });
}