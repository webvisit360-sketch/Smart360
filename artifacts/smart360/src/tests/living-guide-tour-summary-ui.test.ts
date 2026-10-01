import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SUMMARY_COPY, TourSummaryShare, shareTourFile, summaryLang } from "../pages/living-guide/living-guide-tour-summary";

const EMOJI = /\p{Extended_Pictographic}/u;

test("summary copy is complete in all four languages without emoji", () => {
  const keys = Object.keys(SUMMARY_COPY.sl).sort();
  for (const lang of ["sl", "en", "de", "it"] as const) {
    assert.deepEqual(Object.keys(SUMMARY_COPY[lang]).sort(), keys);
    for (const v of Object.values(SUMMARY_COPY[lang])) { assert.ok(v.trim()); assert.ok(!EMOJI.test(v)); }
  }
  assert.equal(SUMMARY_COPY.sl.share, "Deli turo");
  assert.equal(summaryLang("fr"), "sl");
});

test("finished summary renders skeleton (no HTML lookalike) before blob is ready", () => {
  const html = renderToStaticMarkup(createElement(TourSummaryShare, {
    state: { startedAt: 1, status: "finished", points: [] } as any, metrics: {}, plannedSegments: [],
    tourName: "Moja tura", tenantName: "Meli Pu", lang: "de", onDownloadGpx: () => {},
  }));
  assert.match(html, /status-tour-summary-loading/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /Tour teilen/);
  assert.match(html, /disabled=""[^>]*data-testid="button-tour-share"/);
});

test("share falls back to download when canShare(files) is false", async () => {
  const g = globalThis as any;
  const clicks: string[] = [];
  const nav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { share: async () => { throw new Error("must not share"); }, canShare: () => false } });
  const prevDoc = g.document;
  g.document = { createElement: () => ({ click() { clicks.push(this.download); }, remove() {} }), body: { appendChild() {} } };
  const origCreate = URL.createObjectURL; URL.createObjectURL = () => "blob:x"; URL.revokeObjectURL = () => {};
  try {
    const file = new File([new Uint8Array([1])], "tura.png", { type: "image/png" });
    assert.equal(await shareTourFile(file, "t"), "fallback");
    assert.deepEqual(clicks, ["tura.png"]);
  } finally {
    URL.createObjectURL = origCreate; g.document = prevDoc;
    if (nav) Object.defineProperty(globalThis, "navigator", nav);
  }
});

test("share uses Web Share files when supported and treats AbortError as cancel", async () => {
  const nav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let shared: any = null;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { share: async (d: any) => { shared = d; }, canShare: (d: any) => Array.isArray(d.files) } });
  const file = new File([new Uint8Array([1])], "tura.png", { type: "image/png" });
  try {
    assert.equal(await shareTourFile(file, "Moja tura"), "shared");
    assert.equal(shared.files[0], file);
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { share: async () => { const e = new Error("x"); e.name = "AbortError"; throw e; }, canShare: () => true } });
    assert.equal(await shareTourFile(file, "x"), "cancelled");
  } finally { if (nav) Object.defineProperty(globalThis, "navigator", nav); }
});

test("share falls back (no throw) when canShare itself throws", async () => {
  const g = globalThis as any;
  const nav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { share: async () => {}, canShare: () => { throw new TypeError("bad"); } } });
  const clicks: string[] = []; const prevDoc = g.document; const oc = URL.createObjectURL;
  g.document = { createElement: () => ({ click() { clicks.push(this.download); }, remove() {} }), body: { appendChild() {} } };
  URL.createObjectURL = () => "blob:y"; URL.revokeObjectURL = () => {};
  try {
    assert.equal(await shareTourFile(new File([new Uint8Array([2])], "x.png"), "t"), "fallback");
    assert.deepEqual(clicks, ["x.png"]);
  } finally { URL.createObjectURL = oc; g.document = prevDoc; if (nav) Object.defineProperty(globalThis, "navigator", nav); }
});

test("planned GeoJSON converts to composer lat/lon/ele objects", async () => {
  const { plannedFromLonLat } = await import("../pages/living-guide/living-guide-tour-summary");
  assert.deepEqual(plannedFromLonLat([[[14.5, 46.05, 300], [14.6, 46.1]]]), [[{ lat: 46.05, lon: 14.5, ele: 300 }, { lat: 46.1, lon: 14.6, ele: null }]]);
});

test("finished panel with summary replaces old stats/privacy with kicker + heading", async () => {
  const { LiveTourPanel } = await import("../pages/living-guide/living-guide-live-tour");
  const noop = () => {};
  const html = renderToStaticMarkup(createElement(LiveTourPanel, {
    t: (k: string) => k, status: "finished", metrics: { movingMs: 1, pausedMs: 0, elapsedMs: 1, distanceM: 1 }, pointCount: 2,
    wakeStatus: "idle", platform: "other", geoError: null, exporting: null, exportError: false,
    onStart: noop, onPause: noop, onResume: noop, onFinish: noop, onReset: noop, onFullscreen: noop, onDownloadImage: noop, onDownloadGpx: noop,
    summary: { state: { startedAt: 1, status: "finished", points: [] } as any, plannedSegments: [], tourName: "x", tenantName: "y", lang: "it" },
  }));
  assert.match(html, /Tour completato/); assert.match(html, /Il tuo riepilogo/);
  assert.doesNotMatch(html, /text-tour-privacy|UI\.lg\.liveTour\.summaryTitle|UI\.lg\.liveTour\.net/);
  assert.match(html, /button-tour-reset/);
});
