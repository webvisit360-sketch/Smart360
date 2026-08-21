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