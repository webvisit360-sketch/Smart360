import test from "node:test";
import assert from "node:assert/strict";
import { isSphericalPanorama } from "../lib/panorama-projection";

test("2:1 panorama is spherical with a two-percent aspect tolerance", () => {
  for (const [w, h] of [[8192, 4096], [4096, 2048], [4000, 2000], [3980, 2000]]) {
    assert.equal(isSphericalPanorama(w, h), true);
  }
});
test("partial and unknown panoramas stay flat; never infer coverage", () => {
  for (const [w, h] of [[8192, 2560], [3000, 700], [1000, 1000], [4100, 2000], [0, 0], [Infinity, 100], [-2, -1]]) {
    assert.equal(isSphericalPanorama(w, h), false);
  }
  assert.equal(isSphericalPanorama(undefined, undefined), false);
});
