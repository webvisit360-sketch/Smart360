import assert from "node:assert/strict";
import test from "node:test";
import {
  DETAIL_FALLBACK_ASPECT,
  stableMediaAspect,
} from "../pages/living-guide/living-guide-hero-layout";

test("hero aspect uses stored media dimensions", () => {
  assert.deepEqual(stableMediaAspect(1400, 1750), {
    aspect: 0.8,
    source: "payload",
  });
});

test("hero aspect keeps a fixed fallback when dimensions are unavailable", () => {
  for (const dimensions of [
    [null, null],
    [undefined, undefined],
    [0, 1200],
    [1200, 0],
    [-1, 1200],
    ["bad", 1200],
  ] as const) {
    assert.deepEqual(stableMediaAspect(...dimensions), {
      aspect: DETAIL_FALLBACK_ASPECT,
      source: "fallback",
    });
  }
});