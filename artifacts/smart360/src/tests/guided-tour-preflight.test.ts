import assert from "node:assert/strict";
import test from "node:test";
import { guidedPreflight, guidedSummaryEligible, formatGuidedDistance, GUIDED_COPY } from "../lib/guided-tour-preflight";
import { nearestRouteGeometry, projectRoutePosition } from "../lib/gpx-projection";
import { SOS_DICT } from "../pages/living-guide/sos/sos-i18n";

const segments: [number, number][][] = [[[-0.01, 0], [0.01, 0]]];
const fix = (m: number, accuracy = 10) => ({ lat: m / 111195, lon: 0, accuracy });
test("guided preflight waits for valid GPS, rejects poor accuracy and denied permission", () => {
  assert.equal(guidedPreflight(segments, null).status, "waiting");
  for (const accuracy of [100.01, -1, NaN, Infinity]) assert.equal(guidedPreflight(segments, fix(10, accuracy)).status, "waiting");
  assert.equal(guidedPreflight(segments, fix(10, 100)).status, "near");
  assert.equal(guidedPreflight(segments, fix(10), "denied").status, "denied");
  assert.equal(guidedPreflight(segments, null, "unsupported").status, "unsupported");
  assert.equal(guidedPreflight([], fix(0)).status, "waiting");
  assert.equal(guidedPreflight(segments, { lat: NaN, lon: 0, accuracy: 1 }).status, "waiting");
});
test("nearest route distance updates both ways with inclusive 250m boundary", () => {
  for (const [distance, status] of [[76000, "far"], [250.01, "far"], [250, "near"], [249.99, "near"], [500, "far"]] as const) {
    const result = guidedPreflight(segments, fix(distance));
    assert.equal(result.status, status);
    assert.ok(Math.abs(result.distanceM! - distance) < 1e-6);
  }
});
test("preflight projects onto segment middle without elevation or progress distance and never bridges gaps", () => {
  assert.equal(nearestRouteGeometry(segments, fix(0))?.perpendicularM, 0);
  assert.equal(projectRoutePosition(segments, [], fix(0)), null);
  assert.equal(guidedPreflight(segments, fix(200)).status, "near");
  const gap: [number, number][][] = [[[-1, 0], [-0.1, 0]], [[0.1, 0], [1, 0]]];
  assert.equal(guidedPreflight(gap, fix(0)).status, "far");
});
test("all four languages format meters below 1km, one decimal km otherwise, and provide notices/OS hints", () => {
  for (const lang of ["sl", "en", "de", "it"] as const) {
    assert.equal(formatGuidedDistance(999, lang), "999 m");
    assert.equal(formatGuidedDistance(250, lang), "250 m");
    assert.match(formatGuidedDistance(1000, lang), /^1[.,]0 km$/);
    assert.match(formatGuidedDistance(76123, lang), /^76[.,]1 km$/);
    assert.ok(GUIDED_COPY[lang].waiting);
    assert.ok(GUIDED_COPY[lang].short);
    assert.ok(GUIDED_COPY[lang].far("76.1 km").includes("76.1 km"));
    for (const os of ["ios", "android", "desktop"] as const) assert.ok(SOS_DICT[lang].os[os].length);
  }
});
test("short guided tour summary boundary is strictly below 50m", () => {
  for (const m of [0, 49, 49.999]) assert.equal(guidedSummaryEligible(m), false);
  for (const m of [50, 50.001, 1000]) assert.equal(guidedSummaryEligible(m), true);
});