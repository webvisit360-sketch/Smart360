import assert from "node:assert/strict";
import test from "node:test";

const formatterModulePath =
  "../../../smart360/src/pages/living-guide/living-guide-formatters.ts";
const {
  formatDistanceMeters,
  itemDistanceText,
  itemPriceText,
  itemSupportingText,
} = await import(formatterModulePath);
const heroLayoutModulePath =
  "../../../smart360/src/pages/living-guide/living-guide-hero-layout.ts";
const {
  calculateLivingGuideHeroLayout,
  mediaAspectFromDimensions,
  nearestGalleryIndex,
} = await import(heroLayoutModulePath);

test("keeps authored price text and adds the authored unit", () => {
  assert.equal(
    itemPriceText({ price: "12,50 €", priceUnit: "/ noč" }),
    "12,50 € / noč",
  );
  assert.equal(
    itemPriceText({ price: "Po dogovoru", priceUnit: null }),
    "Po dogovoru",
  );
  assert.equal(itemPriceText({ price: null, priceUnit: "dan" }), null);
});

test("formats structured metre distances at the kilometre boundary", () => {
  assert.equal(formatDistanceMeters(850), "850 m");
  assert.equal(formatDistanceMeters(1000), "1 km");
  assert.equal(formatDistanceMeters(1200), "1,2 km");
  assert.equal(formatDistanceMeters("2450"), "2,5 km");
});

test("admin distance preview handles blank, comma decimals, and invalid input", () => {
  // Blank / cleared field → no guest-facing preview.
  assert.equal(formatDistanceMeters(""), null);
  assert.equal(formatDistanceMeters("   "), null);
  // Comma decimals (Slovene locale) parse the same as points.
  assert.equal(formatDistanceMeters("1,2"), "1 m");
  assert.equal(formatDistanceMeters("1500,5"), "1,5 km");
  // Negative / non-numeric input yields no preview.
  assert.equal(formatDistanceMeters("-5"), null);
  assert.equal(formatDistanceMeters("abc"), null);
});

test("uses distanceMeters first and preserves authored legacy distance text", () => {
  assert.equal(
    itemDistanceText({ distanceMeters: 1200, distance: "8 km" }),
    "1,2 km",
  );
  assert.equal(itemDistanceText({ distance: "8,5 km" }), "8,5 km");
  assert.equal(itemDistanceText({}), null);
});

test("keeps a supplied distance first in POI supporting text", () => {
  assert.equal(
    itemSupportingText(
      { distanceMeters: 1200 },
      "Palmanova Designer Village",
      "closed · opens at 10:00",
    ),
    "1,2 km · Palmanova Designer Village · closed · opens at 10:00",
  );
  assert.equal(
    itemSupportingText({ distance: "850 m" }, null, "open · until 20:00"),
    "850 m · open · until 20:00",
  );
});

test("hero rule v5 uses natural full width through the 85 percent threshold", () => {
  const exactlyAtThreshold = calculateLivingGuideHeroLayout({
    containerWidth: 400,
    imageAspect: 400 / 680,
    viewportHeight: 800,
  });
  assert.deepEqual(exactlyAtThreshold, {
    branch: "full-bleed",
    naturalHeight: 680,
    thresholdHeight: 680,
    heroHeight: 680,
  });

  const wide = calculateLivingGuideHeroLayout({
    containerWidth: 400,
    imageAspect: 2.5,
    viewportHeight: 800,
  });
  assert.equal(wide?.branch, "full-bleed");
  assert.equal(wide?.heroHeight, 160);
});

test("hero rule v5 caps only images above 85 percent and uses 85 percent height", () => {
  const capped = calculateLivingGuideHeroLayout({
    containerWidth: 400,
    imageAspect: 0.5,
    viewportHeight: 800,
  });
  assert.equal(capped?.branch, "side-blur");
  assert.equal(capped?.naturalHeight, 800);
  assert.equal(capped?.thresholdHeight, 680);
  assert.equal(capped?.heroHeight, 680);
});

test("media aspect uses payload dimensions and rejects missing metadata", () => {
  assert.equal(mediaAspectFromDimensions(1400, 1750), 0.8);
  assert.equal(mediaAspectFromDimensions("900", "600"), 1.5);
  assert.equal(mediaAspectFromDimensions(null, 600), null);
  assert.equal(mediaAspectFromDimensions(900, 0), null);
});

test("gallery settling always chooses a whole slide boundary", () => {
  assert.equal(nearestGalleryIndex(0, 390, 5), 0);
  assert.equal(nearestGalleryIndex(194, 390, 5), 0);
  assert.equal(nearestGalleryIndex(196, 390, 5), 1);
  assert.equal(nearestGalleryIndex(780, 390, 5), 2);
  assert.equal(nearestGalleryIndex(9999, 390, 5), 4);
});