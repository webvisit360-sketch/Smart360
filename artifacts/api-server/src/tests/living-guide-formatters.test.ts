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
  calculateLivingGuideUniformGalleryLayout,
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

test("hero rule uses natural full width through the 89 percent threshold", () => {
  const exactlyAtThreshold = calculateLivingGuideHeroLayout({
    containerWidth: 400,
    imageAspect: 400 / 712,
    viewportHeight: 800,
  });
  assert.deepEqual(exactlyAtThreshold, {
    branch: "full-bleed",
    naturalHeight: 712,
    thresholdHeight: 712,
    heroHeight: 712,
  });

  const wide = calculateLivingGuideHeroLayout({
    containerWidth: 400,
    imageAspect: 2.5,
    viewportHeight: 800,
  });
  assert.equal(wide?.branch, "full-bleed");
  assert.equal(wide?.heroHeight, 160);
});

test("hero rule caps only images above 89 percent and uses 89 percent height", () => {
  const capped = calculateLivingGuideHeroLayout({
    containerWidth: 400,
    imageAspect: 0.5,
    viewportHeight: 800,
  });
  assert.equal(capped?.branch, "side-blur");
  assert.equal(capped?.naturalHeight, 800);
  assert.equal(capped?.thresholdHeight, 712);
  assert.equal(capped?.heroHeight, 712);
});

test("multi-photo galleries use the median natural height and clamp it to 45–89 percent", () => {
  const oddGallery = calculateLivingGuideUniformGalleryLayout({
    containerWidth: 390,
    imageAspects: [0.8, 0.75, 0.7],
    viewportHeight: 844,
  });
  assert.equal(oddGallery?.medianHeight, 520);
  assert.equal(oddGallery?.heroHeight, 520);
  assert.equal(oddGallery?.minHeight, 379.8);
  assert.equal(oddGallery?.maxHeight, 751.16);

  const evenGallery = calculateLivingGuideUniformGalleryLayout({
    containerWidth: 390,
    imageAspects: [1, 0.5],
    viewportHeight: 844,
  });
  assert.equal(evenGallery?.medianHeight, 585);
  assert.equal(evenGallery?.heroHeight, 585);

  const clampedShort = calculateLivingGuideUniformGalleryLayout({
    containerWidth: 390,
    imageAspects: [4, 3],
    viewportHeight: 844,
  });
  assert.equal(clampedShort?.heroHeight, 380);

  const clampedTall = calculateLivingGuideUniformGalleryLayout({
    containerWidth: 390,
    imageAspects: [0.25, 0.3],
    viewportHeight: 844,
  });
  assert.equal(clampedTall?.heroHeight, 751);
  assert.equal(
    calculateLivingGuideUniformGalleryLayout({
      containerWidth: 390,
      imageAspects: [0.8, null],
      viewportHeight: 844,
    }),
    null,
  );
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