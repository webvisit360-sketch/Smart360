import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createInitialRouteStyleFallback, OFFLINE_ROUTE_STYLE } from "../pages/living-guide/living-guide-map-fallback";

test("failed initial style uses one local v8 neutral surface without any provider or tile requests", () => {
  const styles: unknown[] = [];
  const recover = createInitialRouteStyleFallback({
    getStyle: () => undefined,
    setStyle: (style, options) => { styles.push(style); assert.equal(options.diff, false); },
  });
  assert.equal(recover(), true);
  assert.equal(recover(), false, "repeated style errors must not reset the recording layers");
  assert.deepEqual(styles, [OFFLINE_ROUTE_STYLE]);
  assert.equal(OFFLINE_ROUTE_STYLE.version, 8);
  assert.deepEqual(OFFLINE_ROUTE_STYLE.sources, {});
  assert.equal(OFFLINE_ROUTE_STYLE.layers[0].type, "background");
  assert.doesNotMatch(JSON.stringify(OFFLINE_ROUTE_STYLE), /https?:|tiles|glyphs|sprite/);
});

test("ordinary tile/sprite errors never replace a parsed provider or cached style", () => {
  let replacements = 0;
  const recover = createInitialRouteStyleFallback({
    getStyle: () => ({ version: 8, sources: { basemap: { type: "vector", tiles: ["https://example.test/{z}/{x}/{y}.pbf"] } }, layers: [] }),
    setStyle: () => { replacements++; },
  });
  assert.equal(recover(), false);
  assert.equal(recover(), false);
  assert.equal(replacements, 0);
});

test("route and recording initialize on style readiness idempotently, independently of tile loading", () => {
  const source = readFileSync(new URL("../pages/living-guide/living-guide-gpx.tsx", import.meta.url), "utf8");
  assert.match(source, /style: OPENFREEMAP_STYLE_URL/);
  assert.match(source, /if \(allowOfflineStyle\) map\.on\("style\.load", initializeRouteLayers\)/);
  assert.match(source, /if \(disposed \|\| routeLayersInitialized\) return/);
  assert.match(source, /if \(!map\.getSource\("gpx"\)\) map\.addSource/);
  assert.match(source, /if \(!map\.getSource\("tour"\)\) map\.addSource/);
  assert.match(source, /setLoaded\(true\)/);
  assert.match(source, /allowOfflineStyle=\{lg\}/, "legacy never receives the offline-style behavior");
});