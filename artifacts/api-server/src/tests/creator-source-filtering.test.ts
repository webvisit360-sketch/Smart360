import assert from "node:assert/strict";
import test from "node:test";
import { classifyCreatorAccommodationProvider } from "../lib/creatorAccommodationClassifier";
import { CreatorRunUrlClaims, rankCreatorDepthOneUrls } from "../lib/creatorSourceReader";

test("accommodation providers are excluded without excluding ordinary mountain huts", () => {
  for (const name of [
    "Kamp Savinja",
    "Glamping Gaj",
    "Hotel Planinka",
    "Hostel Celje",
    "Motel Pri mostu",
    "Penzion Pri Ani",
    "Guesthouse Pri Maji",
    "Vila Bled",
    "Chalet Golte",
    "Resort Savinja",
    "B&B Pri Joži",
    "Apartmaji Golte",
    "Apartmajska hiša Jezero",
    "Sobe pri Ani",
    "Počitniška hiša Sonce",
    "Herbal glamping Ljubno",
    "Naturplac Na skali",
  ]) {
    assert.equal(classifyCreatorAccommodationProvider({
      name, categoryKey: "culture", evidence: name,
    }).excluded, true, name);
  }
  assert.equal(classifyCreatorAccommodationProvider({
    name: "Planinski dom na Travniku",
    categoryKey: "hike",
    evidence: "Planinski dom na Travniku je cilj pohodniške poti.",
  }).excluded, false);
});

test("tourist farms require entity-local public food service, not aggregation context", () => {
  assert.equal(classifyCreatorAccommodationProvider({
    name: "Turistična kmetija Visočnik",
    categoryKey: "culinary",
    evidence: "Nudimo prenočišča in zajtrk.",
  }).excluded, true);
  assert.equal(classifyCreatorAccommodationProvider({
    name: "Turistična kmetija Visočnik",
    categoryKey: "culinary",
    evidence: "Izletniška kmetija z domačo kuhinjo in kosili za obiskovalce.",
  }).excluded, false);
  assert.equal(classifyCreatorAccommodationProvider({
    name: "Turistična kmetija Visočnik",
    categoryKey: "culinary",
    evidence: "Turistična kmetija Visočnik nudi prenočišča.",
  }).excluded, true, "another restaurant on an aggregation page cannot authorize this fact");
  assert.equal(classifyCreatorAccommodationProvider({
    name: "Turistična kmetija Visočnik",
    categoryKey: "trips",
    evidence: "Gostilna in kosila.",
  }).excluded, true);
});

test("detail URLs rank before news/events regardless of locale and locale families fetch once", () => {
  assert.deepEqual(rankCreatorDepthOneUrls([
    "https://example.si/novice/objava",
    "https://example.si/en/attractions/castle",
    "https://example.si/znamenitosti/grad",
    "https://example.si/dogodki/koledar",
  ]), [
    "https://example.si/znamenitosti/grad",
    "https://example.si/en/attractions/castle",
    "https://example.si/dogodki/koledar",
    "https://example.si/novice/objava",
  ]);
  const claims = new CreatorRunUrlClaims();
  assert.equal(claims.claim("https://example.si/grad"), "claimed");
  assert.equal(claims.claim("https://example.si/grad"), "duplicate-url");
  assert.equal(claims.claim("https://example.si/sl/izlet"), "claimed");
  assert.equal(claims.claim("https://example.si/en/izlet"), "locale-variant");
  assert.equal(claims.claim("https://example.si/de/izlet"), "locale-variant");
});