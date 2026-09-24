import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  DETAIL_FALLBACK_ASPECT,
  galleryImageLoading,
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

test("gallery loads active and next/previous slides eagerly without fetching distant photos", async () => {
  assert.deepEqual(
    Array.from({ length: 5 }, (_, index) => galleryImageLoading(index, 0, true)),
    ["eager", "eager", "lazy", "lazy", "lazy"],
  );
  assert.deepEqual(
    Array.from({ length: 5 }, (_, index) => galleryImageLoading(index, 2, true)),
    ["lazy", "eager", "eager", "eager", "lazy"],
  );
  assert.deepEqual(
    Array.from({ length: 5 }, (_, index) => galleryImageLoading(index, 4, true)),
    ["lazy", "lazy", "lazy", "eager", "eager"],
  );
  assert.equal(galleryImageLoading(2, 0, false), "eager");
  const source = await readFile(new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url), "utf8");
  assert.match(source, /loading=\{galleryImageLoading\(index, activeIndex, layoutReady\)\}/);
});