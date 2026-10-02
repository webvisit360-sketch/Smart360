import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  DETAIL_FALLBACK_ASPECT,
  galleryImageLoading,
  stableMediaAspect,
  calculateLivingGuideHeroLayout,
  calculateLivingGuideUniformGalleryLayout,
  DETAIL_PHOTO_REVEAL_RATIO,
} from "../pages/living-guide/living-guide-hero-layout";

test("detail crop is independent of viewport height and preserves iPhone reference", () => {
  const imageAspects = [7952 / 5304, 2851 / 3801, 4284 / 5712, 4284 / 5712];
  const reference = calculateLivingGuideUniformGalleryLayout({ containerWidth: 390, viewportHeight: 844, imageAspects })!;
  assert.equal(reference.heroHeight, 520);
  assert.ok(Math.abs(390 * DETAIL_PHOTO_REVEAL_RATIO - 406) < 1e-9);
  for (const width of [390, 412]) {
    const gallery = (viewportHeight: number) => calculateLivingGuideUniformGalleryLayout({ containerWidth: width, viewportHeight, imageAspects })!;
    assert.deepEqual(gallery(650), gallery(915));
    assert.ok(Math.abs(gallery(915).heroHeight / width - reference.heroHeight / 390) < .002);
    for (const imageAspect of [.3, .75, 1.5, 2.5]) {
      const layout = (viewportHeight: number) => calculateLivingGuideHeroLayout({ containerWidth: width, viewportHeight, imageAspect });
      assert.deepEqual(layout(650), layout(915));
    }
  }
});

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