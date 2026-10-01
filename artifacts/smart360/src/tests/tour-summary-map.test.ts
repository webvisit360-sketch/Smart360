import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { captureTourMap, prepareTourMapSegments, TOUR_MAP_ATTRIBUTION } from "../lib/tour-summary-map";

const points = [{ lat: 46.05, lon: 14.50 }, { lat: 46.06, lon: 14.52 }];

test("geometry preserves segment gaps and splits invalid fixes without joining them", () => {
  assert.deepEqual(prepareTourMapSegments([
    [points[0]!, { lat: NaN, lon: 14 }, points[1]!],
    [{ lat: 46.08, lon: 14.53 }, { lat: 46.09, lon: 14.54 }],
    [{ lat: 91, lon: 0 }, { lat: 0, lon: Infinity }],
  ]).map(run => run.length), [1, 1, 2]);
});

test("antimeridian uses a nearby world copy rather than nearly 360 degrees", () => {
  const runs = prepareTourMapSegments([
    [{ lat: 10, lon: 179.8 }, { lat: 11, lon: -179.8 }],
    [{ lat: 12, lon: -179.9 }],
  ]);
  const longs = runs.flat().map(p => p[0]);
  assert.ok(Math.max(...longs) - Math.min(...longs) < 0.5);
  assert.equal(runs.length, 2);
  assert.deepEqual(prepareTourMapSegments([[{ lat: 1, lon: -5 }]]), [[[-5, 1]]]);
});

test("non-browser invocation fails safely", async () => {
  assert.equal(await captureTourMap({ segments: [points], width: 1080, height: 600 }), null);
});

// Isolated browser/MapLibre doubles exercise failure/cleanup branches. Actual
// OpenFreeMap WebGL/CORS acceptance is separately verified in a real browser.
function harness(options: {
  offline?: boolean; error?: boolean; geography?: boolean; taint?: boolean;
  noBlob?: boolean; tinyCanvas?: boolean; stall?: boolean; timeout?: boolean;
} = {}) {
  const listeners: Record<string, () => void> = {};
  const browserListeners = new Set<string>();
  const removed: string[] = [];
  const calls: Record<string, any> = {};
  let timer: (() => void) | undefined;
  const ctx = {
    drawImage: (...args: unknown[]) => { calls.drawImage = args; },
    getImageData: () => { if (options.taint) throw new Error("SecurityError"); },
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {},
    fillText: (letter: string) => { (calls.pins ??= []).push(letter); },
  };
  const output = {
    width: 0, height: 0,
    getContext: () => ctx,
    toBlob: (callback: (blob: unknown) => void) => callback(options.noBlob ? null : { size: 100, type: "image/png" }),
  };
  class FakeMap {
    constructor(config: unknown) {
      calls.config = config;
      queueMicrotask(() => {
        if (options.timeout) { timer?.(); return; }
        if (options.stall) return;
        if (options.error) { listeners.error?.(); return; }
        listeners.load?.();
        listeners.idle?.();
      });
    }
    on(name: string, callback: () => void) { listeners[name] = callback; }
    remove() { removed.push("map"); }
    addSource(name: string, source: unknown) { calls.source = { name, source }; }
    addLayer(layer: unknown) { calls.layer = layer; }
    areTilesLoaded() { return true; }
    getStyle() { return { sources: { openmaptiles: { type: "vector" }, "tour-summary-route": { type: "geojson" } } }; }
    queryRenderedFeatures() { return [{ source: options.geography === false ? "tour-summary-route" : "openmaptiles" }]; }
    getCanvas() { return { width: options.tinyCanvas ? 540 : 1080, height: 600 }; }
    project() { return { x: 200, y: 150 }; }
  }
  const module = { exports: {} as { captureTourMap: typeof captureTourMap } };
  const source = readFileSync(new URL("../lib/tour-summary-map.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require: (id: string) => {
      if (id === "./map-provider") return { OPENFREEMAP_STYLE_URL: "https://tiles.openfreemap.org/styles/liberty" };
      if (id.includes("?worker&url")) return { default: "/assets/bundled-worker.js" };
      if (id === "maplibre-gl") return { Map: FakeMap, setWorkerUrl: (url: string) => { calls.worker = url; } };
      throw new Error(`Unexpected dependency ${id}`);
    },
    queueMicrotask,
    navigator: { onLine: !options.offline },
    window: {
      addEventListener: (name: string) => browserListeners.add(name),
      removeEventListener: (name: string) => browserListeners.delete(name),
    },
    document: {
      body: { appendChild() {} },
      createElement: (tag: string) => tag === "canvas" ? output : {
        style: {}, setAttribute() {}, remove: () => removed.push("container"),
      },
    },
    setTimeout: (fn: () => void) => { timer = fn; return 1; },
    clearTimeout: () => { timer = undefined; },
  });
  return { capture: module.exports.captureTourMap, removed, calls, browserListeners };
}

test("real-provider configuration, 2x native buffer, segments and PNG validation", async () => {
  const h = harness();
  const result = await h.capture({ segments: [points, [...points]], width: 1080, height: 600 });
  assert.equal(result?.attribution, TOUR_MAP_ATTRIBUTION);
  assert.equal(result?.canvas.width, 1080);
  assert.equal(h.calls.config.style, "https://tiles.openfreemap.org/styles/liberty");
  assert.equal(h.calls.config.pixelRatio, 2);
  assert.equal(h.calls.config.canvasContextAttributes.preserveDrawingBuffer, true);
  assert.equal(h.calls.worker, "/assets/bundled-worker.js");
  assert.equal(h.calls.source.source.data.geometry.coordinates.length, 2);
  assert.equal(h.calls.layer.paint["line-color"], "#157347");
  assert.deepEqual(h.calls.pins, ["S", "C"]);
  assert.equal(h.calls.drawImage.length, 3, "must copy native pixels without scaled dimensions");
  assert.deepEqual(h.removed, ["map", "container"]);
  assert.equal(h.browserListeners.size, 0);
});

for (const [name, options] of Object.entries({
  "tile error": { error: true },
  "blank style with route but no actual geography": { geography: false },
  "tainted canvas": { taint: true },
  "PNG encode failure": { noBlob: true },
  "undersized buffer": { tinyCanvas: true },
  "finite deadline": { timeout: true },
})) {
  test(`${name} returns null and releases map and DOM`, async () => {
    const h = harness(options);
    assert.equal(await h.capture({ segments: [points], width: 1080, height: 600 }), null);
    assert.deepEqual(h.removed, ["map", "container"]);
    assert.equal(h.browserListeners.size, 0);
  });
}

test("offline, aborted, invalid sizes and empty geometry never start a map", async () => {
  const h = harness({ offline: true });
  assert.equal(await h.capture({ segments: [points], width: 1080, height: 600 }), null);
  assert.equal(h.calls.config, undefined);
  const online = harness();
  const controller = new AbortController();
  controller.abort();
  for (const overrides of [
    { width: 540 }, { height: 0 }, { width: Infinity }, { width: 1080.5 },
    { width: 8192, height: 8192 }, { segments: [] }, { signal: controller.signal },
  ]) {
    assert.equal(await online.capture({ segments: [points], width: 1080, height: 600, ...overrides }), null);
  }
  assert.equal(online.calls.config, undefined);
});

test("mid-render abort resolves null and cleans up", async () => {
  const h = harness({ stall: true });
  const controller = new AbortController();
  const promise = h.capture({ segments: [points], width: 1080, height: 600, signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  assert.equal(await promise, null);
  assert.deepEqual(h.removed, ["map", "container"]);
  assert.equal(h.browserListeners.size, 0);
});

test("abort during imports cannot create a late map", async () => {
  const h = harness();
  const controller = new AbortController();
  const promise = h.capture({ segments: [points], width: 1080, height: 600, signal: controller.signal });
  controller.abort();
  assert.equal(await promise, null);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.config, undefined);
  assert.equal(h.browserListeners.size, 0);
});