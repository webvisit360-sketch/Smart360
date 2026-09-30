import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LIVING_GUIDE_UI } from "../pages/guest/i18n";
import { FreeTourAscent, FreeTourIntro, FreeTourOmitted, formatAscent, isTourRecordingEnabled, recordedProfileData } from "../pages/living-guide/living-guide-free-tour-view";


const sl = (key: string, v?: Record<string, string | number>) => {
  let s = (LIVING_GUIDE_UI as Record<string, { sl: string }>)[key]?.sl ?? key;
  for (const [k, x] of Object.entries(v ?? {})) s = s.replace(`{${k}}`, String(x));
  return s;
};
const noop = () => undefined;

test("free tour keys exist in all four languages", () => {
  const keys = Object.keys(LIVING_GUIDE_UI).filter((k) => k.startsWith("UI.lg.freeTour."));
  assert.ok(keys.length >= 9);
  for (const k of keys) for (const l of ["sl", "en", "de", "it"] as const) assert.ok((LIVING_GUIDE_UI as any)[k][l]);
  assert.equal(sl("UI.lg.freeTour.title"), "Posnemi svojo turo");
  assert.match(sl("UI.lg.freeTour.ascent"), /GPS, približno/);
});

test("flag is default off and published-true only", () => {
  assert.equal(isTourRecordingEnabled(null), false);
  assert.equal(isTourRecordingEnabled({}), false);
  assert.equal(isTourRecordingEnabled({ tourRecordingEnabled: "true" }), false);
  assert.equal(isTourRecordingEnabled({ tourRecordingEnabled: false }), false);
  assert.equal(isTourRecordingEnabled({ tourRecordingEnabled: true }), true);
});

test("intro renders three activities, selected running state and privacy", () => {
  const m = renderToStaticMarkup(createElement(FreeTourIntro, { t: sl, activity: "cycling", onActivity: noop, onStart: noop }));
  assert.match(m, /data-testid="radio-free-activity-cycling"[^>]*checked=""/);
  assert.match(m, /Kolesarjenje/);
  assert.match(m, /Pohodništvo/);
  assert.match(m, /Tek/);
  const running = renderToStaticMarkup(createElement(FreeTourIntro, { t: sl, activity: "running", onActivity: noop, onStart: noop }));
  assert.match(running, /data-testid="radio-free-activity-running"[^>]*checked=""/);
  for (const [lang, label] of Object.entries({ sl: "Tek", en: "Running", de: "Laufen", it: "Corsa" })) {
    assert.equal((LIVING_GUIDE_UI as any)["UI.lg.gpx.running"][lang], label);
  }
  assert.match(m, /data-testid="button-free-tour-start"/);
  assert.match(m, /data-testid="text-free-tour-privacy"/);
});

test("ascent label is approximate; missing metric renders unavailable", () => {
  assert.match(renderToStaticMarkup(createElement(FreeTourAscent, { t: sl, ascentM: 123.6 })), /124 m/);
  assert.match(renderToStaticMarkup(createElement(FreeTourAscent, { t: sl, ascentM: undefined })), /Ni podatka/);
  assert.equal(formatAscent(-3, "x"), "0 m");
});

test("omitted segments are disclosed, never silent", () => {
  assert.equal(renderToStaticMarkup(createElement(FreeTourOmitted, { t: sl, count: 0 })), "");
  const m = renderToStaticMarkup(createElement(FreeTourOmitted, { t: sl, count: 3 }));
  assert.match(m, /data-testid="text-free-tour-omitted"/);
  assert.match(m, /izpuščenih 3/);
});

test("recorded profile inserts a gap at segment starts and accumulates distance", () => {
  const pts = [{ lat: 46, lon: 14, altitude: 400 }, { lat: 46.001, lon: 14, altitude: 405 }, { lat: 46.002, lon: 14, altitude: null }, { lat: 46.003, lon: 14, altitude: 410 }];
  const d = recordedProfileData(pts, [2]);
  assert.equal(d.length, 5);
  assert.equal(d[2]!.elevationM, null);
  assert.ok(Math.abs(d.at(-1)!.distanceKm - 0.333) < 0.01);
});

test("free result panel hides planned legend; GPX default keeps it", async () => {
  const { LiveTourPanel } = await import("../pages/living-guide/living-guide-live-tour");
  const metrics = { movingMs: 1000, pausedMs: 0, elapsedMs: 1000, distanceM: 10 };
  const base = { t: sl, status: "finished" as const, metrics, pointCount: 2, wakeStatus: "idle" as const, platform: "other" as const, geoError: null, exporting: null, exportError: false, onStart: noop, onPause: noop, onResume: noop, onFinish: noop, onReset: noop, onFullscreen: noop, onDownloadImage: noop, onDownloadGpx: noop };
  const free = renderToStaticMarkup(createElement(LiveTourPanel, { ...base, hasPlannedRoute: false }));
  assert.doesNotMatch(free, /s360-tour-key--planned/);
  assert.doesNotMatch(free, new RegExp(sl("UI.lg.liveTour.planned")));
  assert.match(free, /s360-tour-key--recorded/);
  assert.match(renderToStaticMarkup(createElement(LiveTourPanel, base)), /s360-tour-key--planned/);
});

test("gpx CSS anchors MapLibre markers (start/end/me) to the map origin", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../pages/living-guide/living-guide-gpx.css", import.meta.url), "utf8");
  const rule = css.match(/\.s360-gpx-map \.maplibregl-marker\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /position:\s*absolute/);
  assert.match(rule, /top:\s*0/);
  assert.match(rule, /left:\s*0/);
});
