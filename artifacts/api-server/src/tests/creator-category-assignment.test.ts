import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCreatorSharedCategory,
  CREATOR_SHARED_CATEGORY_KEYS,
  remapLegacyCreatorCategory,
} from "../lib/creatorCategoryAssignment";
import { CREATOR_SOURCE_CATEGORIES } from "../lib/creatorSourceModelExtraction";

test("Creator model accepts exactly the complete shared Meli Pu skeleton", () => {
  assert.equal(CREATOR_SHARED_CATEGORY_KEYS.length, 37);
  assert.deepEqual(CREATOR_SOURCE_CATEGORIES, CREATOR_SHARED_CATEGORY_KEYS);
  assert.equal(new Set(CREATOR_SOURCE_CATEGORIES).size, 37);
  assert.equal(CREATOR_SOURCE_CATEGORIES.includes("food" as never), false);
  assert.equal(CREATOR_SOURCE_CATEGORIES.includes("sights" as never), false);
});

test("legacy remap keeps broad source intent while refining deterministic subtypes", () => {
  assert.equal(remapLegacyCreatorCategory({
    name: "Šport Center Prodnik",
    legacyCategory: "food",
  }), "culinary");
  assert.equal(remapLegacyCreatorCategory({
    name: "Kriška gora",
    legacyCategory: "trips",
  }), "trips");
  assert.equal(remapLegacyCreatorCategory({
    name: "Kolesarski vzpon na Golte",
    legacyCategory: "act",
  }), "bike");
  assert.equal(remapLegacyCreatorCategory({
    name: "Slap Rinka",
    legacyCategory: "sights",
  }), "nature");
});

test("deterministic assignment uses the granular shared destination categories", () => {
  const cases = [
    ["Planinski dom na Smrekovcu", "food", "hike"],
    ["Kolesarski center Beli zajec", "act", "bike"],
    ["Gostilna Pri lipi", "food", "culinary"],
    ["Picerija Pr' Pek", "food", "pizza"],
    ["Muzej Vrbovec", "sights", "culture"],
    ["Slap Rinka", "sights", "nature"],
    ["Izlet v Veliko planino", "trips", "trips"],
    ["Flosarski bal", "act", "events"],
    ["Plaža ob Savinji", "act", "beach"],
    ["Lekarna Ljubno", "sights", "pharm"],
    ["Bencinska črpalka Petrol", "trips", "gas"],
    ["Fitnes Luče", "act", "fitness"],
    ["Rafting Savinja", "act", "act"],
  ] as const;

  for (const [name, suggestedCategory, expected] of cases) {
    assert.equal(
      classifyCreatorSharedCategory({ name, suggestedCategory }),
      expected,
      name,
    );
  }
});