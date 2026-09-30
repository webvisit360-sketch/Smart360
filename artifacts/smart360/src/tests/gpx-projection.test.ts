import assert from "node:assert/strict";
import test from "node:test";
import type { GpxRoute } from "../lib/gpx-route";
import { boundedProfile } from "../lib/gpx-route";
import { elevationAtDistance, OFF_ROUTE_M, projectRoutePosition } from "../lib/gpx-projection";
import { LIVING_GUIDE_UI } from "../pages/guest/i18n";

const profile = [
  { segment: 0, distanceKm: 10, elevationM: 100 },
  { segment: 0, distanceKm: 11, elevationM: 200 },
  { segment: 1, distanceKm: 11, elevationM: 300 },
  { segment: 1, distanceKm: 12, elevationM: 400 },
];

test("projects onto edge between vertices (not nearest vertex), maps to server profile and interpolates altitude", () => {
  const hit = projectRoutePosition([[[0, 0], [0.01, 0]]], profile, { lat: 0.002, lon: 0.0025 });
  assert.ok(hit);
  assert.ok(Math.abs(hit.distanceKm - 10.25) < 1e-5);
  assert.ok(Math.abs(elevationAtDistance(profile, hit.segment, hit.distanceKm)! - 125) < 1e-3);
  assert.ok(hit.perpendicularM > OFF_ROUTE_M);
  assert.equal(elevationAtDistance([{ segment: 0, distanceKm: 0, elevationM: null }, { segment: 0, distanceKm: 1, elevationM: 10 }], 0, .5), null);
});

test("150m off-route gate is strict; inaccurate fixes are gated upstream", () => {
  const near = projectRoutePosition([[[0, 0], [0.01, 0]]], profile, { lat: 149 / 111195, lon: .005 })!;
  const far = projectRoutePosition([[[0, 0], [0.01, 0]]], profile, { lat: 151 / 111195, lon: .005 })!;
  assert.ok(near.perpendicularM <= OFF_ROUTE_M);
  assert.ok(far.perpendicularM > OFF_ROUTE_M);
});

test("nearest segment wins; no artificial connecting edge or gap distance", () => {
  const hit = projectRoutePosition([[[0, 0], [.001, 0]], [[.02, 0], [.021, 0]]], profile, { lat: 0, lon: .01975 })!;
  assert.equal(hit.segment, 1);
  assert.equal(hit.distanceKm, 11);
  const middle = projectRoutePosition([[[0, 0], [.001, 0]], [[.02, 0], [.021, 0]]], profile, { lat: 0, lon: .01 })!;
  assert.ok(middle.perpendicularM > 900); // imaginary bridge would report zero
});

test("singleton, empty, malformed and profile-less routes", () => {
  assert.equal(projectRoutePosition([], profile, { lat: 0, lon: 0 }), null);
  assert.equal(projectRoutePosition([[]], profile, { lat: 0, lon: 0 }), null);
  assert.equal(projectRoutePosition([[[0, 0]]], profile, { lat: 0, lon: 0 })?.distanceKm, 10);
  assert.equal(projectRoutePosition([[[0, 0]]], [], { lat: 0, lon: 0 }), null);
  assert.equal(projectRoutePosition([[[0, 0]]], profile, { lat: NaN, lon: 0 }), null);
  assert.equal(projectRoutePosition([[[0, 0]]], [{ segment: 0, distanceKm: 3, elevationM: 1 }, { segment: 0, distanceKm: 2, elevationM: 2 }], { lat: 0, lon: 0 }), null);
});

test("bounded profile retains segment edges and null break even across large strides", () => {
  const points = [...Array.from({ length: 400 }, (_, i) => ({ distanceKm: i / 400, elevationM: i, segment: 0 })), { distanceKm: 1, elevationM: 2, segment: 1 }, { distanceKm: 2, elevationM: 3, segment: 1 }];
  const bounded = boundedProfile({ profile: points } as GpxRoute);
  assert.ok(bounded.some((p, i) => p.distanceKm === 1 && p.elevationM === null && bounded[i + 1]?.elevationM === 2));
  assert.ok(bounded.some(p => p.distanceKm === 399 / 400));
});

test("marker elevation follows the displayed downsampled line, not discarded peaks", () => {
  const points = Array.from({ length: 401 }, (_, i) => ({
    segment: 0, distanceKm: i / 100, elevationM: i === 1 ? 100 : 0,
  }));
  const displayed = boundedProfile({ profile: points } as GpxRoute);
  assert.ok(!displayed.some(p => p.distanceKm === .01));
  assert.equal(elevationAtDistance(points, 0, .01), 100);
  assert.equal(elevationAtDistance(displayed, 0, .01), 0);
});

test("remaining distance and off-route labels exist in all guest languages", () => {
  for (const key of ["UI.lg.gpx.remaining", "UI.lg.gpx.offRoute"] as const) {
    for (const language of ["sl", "en", "de", "it"] as const) {
      assert.ok(LIVING_GUIDE_UI[key][language]);
      if (key === "UI.lg.gpx.remaining") assert.match(LIVING_GUIDE_UI[key][language], /\{distance\}/);
    }
  }
});