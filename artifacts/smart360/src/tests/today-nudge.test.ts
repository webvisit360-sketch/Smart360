import assert from "node:assert/strict";
import test from "node:test";
import {
  TODAY_NUDGE_DELAY_MS,
  TODAY_NUDGE_MAX_MS,
  TODAY_NUDGE_MIN_MS,
  TODAY_NUDGE_MS_PER_PX,
  TODAY_NUDGE_SOFT_START,
  todayNudgeDuration,
  todayNudgeEase,
  selectHomeTodayEntries,
} from "../pages/living-guide/living-guide-home";
import { exploreItemDescription } from "../pages/living-guide/living-guide-explore";

test("Danes keeps a nearby item without a photograph eligible", () => {
  const result = selectHomeTodayEntries([{
    isVisible: true,
    categories: [{
      isVisible: true, label: "Izleti", items: [{
        id: "creator-no-photo", title: "Creator place", isVisible: true,
        distanceMeters: 1200, media: [],
      }],
    }],
  }]);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0]?.media, null);
});

test("Living Guide suppresses food/service guest descriptions centrally", () => {
  assert.equal(exploreItemDescription({ body: "Ne sme se prikazati" }, {
    exploreGroup: "food_drink", label: "Hrana",
  }), "");
});

test("Danes detail preserves distance and duration but suppresses culinary prose", () => {
  const result = selectHomeTodayEntries([{
    categories: [{
      id: "food-trip",
      label: "Izleti",
      exploreGroup: "food_drink",
      items: [{
        id: "restaurant", title: "Gostilna", distanceMeters: 750,
        duration: "10 min", body: "Skriti uredniški opis",
      }],
    }],
  }]);
  assert.equal(result.entries[0]?.detail, "750 m · 10 min");
});

/* Vrednosti so vezane na prototip (prototip-2030) in se ne smejo
   spremeniti brez nove prototipne predloge. */
test("Danes auto-scroll keeps the binding constants from the prototype", () => {
  assert.equal(TODAY_NUDGE_DELAY_MS, 650);
  assert.equal(TODAY_NUDGE_MS_PER_PX, 11);
  assert.equal(TODAY_NUDGE_MIN_MS, 4000);
  assert.equal(TODAY_NUDGE_MAX_MS, 14000);
  assert.equal(TODAY_NUDGE_SOFT_START, 0.12);
});

test("Danes auto-scroll duration scales ~11 ms/px, clamped to 4–14 s", () => {
  assert.equal(todayNudgeDuration(100), 4000); // 1100 ms → clamp up
  assert.equal(todayNudgeDuration(500), 5500); // 500 * 11
  assert.equal(todayNudgeDuration(1000), 11000);
  assert.equal(todayNudgeDuration(5000), 14000); // 55000 ms → clamp down
});

test("Danes auto-scroll eases softly for the first 12 %, then runs linearly", () => {
  // prototype: k<.12 ? (k/.12)^2*.12 : k
  assert.equal(todayNudgeEase(0), 0);
  assert.ok(Math.abs(todayNudgeEase(0.06) - 0.03) < 1e-12); // (0.5)^2*0.12
  assert.ok(Math.abs(todayNudgeEase(0.12) - 0.12) < 1e-12); // continuous seam
  assert.equal(todayNudgeEase(0.5), 0.5);
  assert.equal(todayNudgeEase(1), 1);
});
