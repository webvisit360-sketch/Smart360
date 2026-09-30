import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LIVING_GUIDE_UI } from "../pages/guest/i18n";
import { LiveTourOverlay, LiveTourPanel, LiveTourWakeNotice, formatTourDuration, tourGeoErrorKey, tourSegments, type LiveTourPanelProps } from "../pages/living-guide/living-guide-live-tour";

const sl = (key: string) => (LIVING_GUIDE_UI as Record<string, { sl: string }>)[key]?.sl ?? key;
const metrics = { movingMs: 3_725_000, pausedMs: 65_000, elapsedMs: 3_790_000, distanceM: 12_345 };
const noop = () => undefined;
const base: LiveTourPanelProps = { t: sl, status: null, metrics, pointCount: 3, wakeStatus: "idle", platform: "other", geoError: null, exporting: null, exportError: false, onStart: noop, onPause: noop, onResume: noop, onFinish: noop, onReset: noop, onFullscreen: noop, onDownloadImage: noop, onDownloadGpx: noop };
const render = (p: Partial<LiveTourPanelProps>) => renderToStaticMarkup(createElement(LiveTourPanel, { ...base, ...p }));

test("live tour keys exist in all four languages", () => {
  for (const [key, v] of Object.entries(LIVING_GUIDE_UI)) if (key.startsWith("UI.lg.liveTour.")) for (const l of ["sl", "en", "de", "it"] as const) assert.ok((v as Record<string, string>)[l]);
});

test("idle shows start + privacy", () => {
  const m = render({});
  assert.match(m, /data-testid="button-tour-start"/);
  assert.match(m, /Začni turo/);
  assert.match(m, /samo na tej napravi/);
});

test("wake held shows exact muted text; unavailable shows platform card without links", () => {
  assert.match(renderToStaticMarkup(createElement(LiveTourWakeNotice, { wakeStatus: "held", platform: "ios", t: sl })), /Zaslon ostaja med turo buden\./);
  const ios = renderToStaticMarkup(createElement(LiveTourWakeNotice, { wakeStatus: "unavailable", platform: "ios", t: sl }));
  assert.match(ios, /Samodejno zaklepanje → Nikoli/);
  assert.doesNotMatch(ios, /<a /);
  assert.match(renderToStaticMarkup(createElement(LiveTourWakeNotice, { wakeStatus: "unavailable", platform: "android", t: sl })), /Časovna omejitev zaslona/);
  assert.match(renderToStaticMarkup(createElement(LiveTourWakeNotice, { wakeStatus: "unavailable", platform: "other", t: sl })), /card-tour-wake-other/);
});

test("live panel: timer, pause/resume, background warning, geo mapping", () => {
  const m = render({ status: "moving", wakeStatus: "held", geoError: "geo-denied" });
  assert.match(m, /1:02:05/);
  assert.match(m, /button-tour-pause/);
  assert.match(m, /text-tour-background/);
  assert.match(m, /Dostop do lokacije je zavrnjen/);
  assert.match(render({ status: "manual-paused" }), /button-tour-resume/);
  assert.equal(tourGeoErrorKey("weird"), "UI.lg.gpx.geo.unavailable");
});

test("result keeps numbers, exports and visible export error", () => {
  const m = render({ status: "finished", exportError: true });
  assert.match(m, /12,35 km/);
  assert.match(m, /button-tour-download-image/);
  assert.match(m, /button-tour-download-gpx/);
  assert.match(m, /status-tour-export-error/);
  assert.match(m, /button-tour-reset/);
});

test("fullscreen overlay renders net and paused time", () => {
  const m = renderToStaticMarkup(createElement(LiveTourOverlay, { metrics, status: "auto-paused", t: sl }));
  assert.match(m, /1:02:05/);
  assert.match(m, /01:05/);
  assert.equal(formatTourDuration(-5), "00:00");
});

test("fullscreen keeps wake feedback visible, including platform instructions", () => {
  const held = renderToStaticMarkup(createElement(LiveTourOverlay, { metrics, status: "moving", t: sl, wakeStatus: "held" }));
  assert.match(held, /Zaslon ostaja med turo buden/);
  const absent = renderToStaticMarkup(createElement(LiveTourOverlay, { metrics, status: "moving", t: sl, wakeStatus: "unavailable", platform: "ios" }));
  assert.match(absent, /Samodejno zaklepanje/);
});

test("recorded path splits at segmentStarts and never bridges gaps", () => {
  const pts = [0, 1, 2, 3, 4].map((i) => ({ lat: 45 + i, lon: 13 + i }));
  assert.deepEqual(tourSegments(pts, [0, 2, 4]), [[[13, 45], [14, 46]], [[15, 47], [16, 48]], [[17, 49]]]);
  assert.deepEqual(tourSegments(pts.slice(0, 2), undefined), [[[13, 45], [14, 46]]]);
  assert.deepEqual(tourSegments([], [0]), []);
});

test("schematic label localized", () => {
  assert.equal(sl("UI.lg.liveTour.schematic"), "Shematski prikaz poti · ni zemljevid");
});

test("fullscreen portal CSS carries CGP tokens and global map sizing", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../pages/living-guide/living-guide-gpx.css", import.meta.url), "utf8");
  assert.match(css, /\.s360-gpx-full \{[^}]*--tx: #121A14/);
  assert.match(css, /\.s360-gpx-full \.s360-gpx-map/);
  const tsx = readFileSync(new URL("../pages/living-guide/living-guide-gpx.tsx", import.meta.url), "utf8");
  assert.match(tsx, /MultiLineString", coordinates: coords/);
  assert.match(tsx, /schematic: t\("UI.lg.liveTour.schematic"\)/);
});
