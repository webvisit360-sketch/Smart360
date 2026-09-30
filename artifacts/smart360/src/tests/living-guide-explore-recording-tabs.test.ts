import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { LIVING_GUIDE_UI } from "../pages/guest/i18n";
import { activeExploreCategories, EXPLORE_ALL_CATEGORY_KEY, exploreItemsForCategory } from "../pages/living-guide/living-guide-explore";
import { EXPLORE_RECORDING_TAB_KEY, exploreCategoryChips, recordingTabLabel } from "../pages/living-guide/living-guide-explore-tabs";
import { guestVisibleDraftTree } from "../pages/living-guide/living-guide-groups";
import { syntheticTenant } from "../pages/living-guide/living-guide-weather-fixture-data";

const category = (id: string, label: string, isVisible = true, key?: string) => ({
  id, key, label, isVisible, items: [{ id: `${id}-item`, title: label, isVisible: true }],
});
const labels = (categories: ReturnType<typeof exploreCategoryChips>) => categories.map(({ label }) => label);
const example = [category("food", "Hrana"), category("bike-id", "Kolesarjenje", true, "bike"), category("hike-id", "Pohodništvo", true, "hike"), category("nature", "Narava")];

for (const [lang, expected] of Object.entries({ sl: "Snemanje tur", en: "Record a tour", de: "Tour aufzeichnen", it: "Registra un tour" }) as Array<["sl" | "en" | "de" | "it", string]>) {
  test(`${lang} fixture uses translated display names but stable bike anchor and localized recording tab`, () => {
    const tenant = syntheticTenant(lang);
    const fixtureCategories = tenant.sections[1]!.categories;
    const [bike, hike] = fixtureCategories;
    assert.equal(bike!.key, "bike");
    assert.equal(hike!.key, "hike");
    assert.equal(bike!.label, { sl: "Kolesarjenje", en: "Cycling", de: "Radfahren", it: "In bicicletta" }[lang]);
    const chips = exploreCategoryChips(
      [category("food", "Food"), hike!, bike!, category("sights", "Sights")],
      "All", recordingTabLabel(lang), tenant.tourRecordingEnabled,
    );
    assert.deepEqual(chips.map(({ key }) => key), [
      EXPLORE_ALL_CATEGORY_KEY, "food", "c-hike", "c-bike", EXPLORE_RECORDING_TAB_KEY, "sights",
    ]);
    assert.equal(chips[4]!.label, expected);
  });
}

test("no anchor falls back to last; disabled has no chip even when categories are empty", () => {
  assert.deepEqual(labels(exploreCategoryChips([example[0], example[3]], "Vse", "Snemanje tur", true)),
    ["Vse", "Hrana", "Narava", "Snemanje tur"]);
  assert.deepEqual(labels(exploreCategoryChips([], "Vse", "Snemanje tur", true)), ["Vse", "Snemanje tur"]);
  assert.deepEqual(labels(exploreCategoryChips(example, "Vse", "Snemanje tur", false)),
    ["Vse", ...example.map((row) => row.label)]);
  assert.deepEqual(labels(exploreCategoryChips([], "Vse", "Snemanje tur", false)), ["Vse"]);
  assert.deepEqual(exploreCategoryChips([category("hike-id", "Hiking", true, "hike")], "All", "Record a tour", true).map(({ key }) => key),
    [EXPLORE_ALL_CATEGORY_KEY, "hike-id", EXPLORE_RECORDING_TAB_KEY]);
  assert.deepEqual(exploreCategoryChips([category("bike", "Custom cycling name")], "All", "Record a tour", true).map(({ key }) => key),
    [EXPLORE_ALL_CATEGORY_KEY, "bike", EXPLORE_RECORDING_TAB_KEY]);
  assert.deepEqual(exploreCategoryChips([category("unrelated", "Kolesarjenje"), category("sights", "Sights")], "All", "Record a tour", true).map(({ key }) => key),
    [EXPLORE_ALL_CATEGORY_KEY, "unrelated", "sights", EXPLORE_RECORDING_TAB_KEY]);
});

test("hidden category cannot anchor; recording chip is never content or a real category listing", () => {
  const input = [category("cycle-hidden", "Kolesarjenje", false, "bike"), category("walk", "Pohodništvo", true, "hike"), category("food", "Hrana")];
  const active = activeExploreCategories(input);
  const before = JSON.stringify(input);
  const chips = exploreCategoryChips(active, "Vse", recordingTabLabel("sl"), true);
  assert.deepEqual(chips.map(({ key }) => key), [EXPLORE_ALL_CATEGORY_KEY, "walk", EXPLORE_RECORDING_TAB_KEY, "food"]);
  assert.equal(JSON.stringify(input), before, "guest chip construction does not modify the content structure");
  assert.deepEqual(exploreItemsForCategory(active, EXPLORE_ALL_CATEGORY_KEY).map(({ item }) => item.id), ["walk-item", "food-item"]);
  assert.deepEqual(exploreItemsForCategory(active, "walk").map(({ item }) => item.id), ["walk-item"]);
  assert.deepEqual(exploreItemsForCategory(active, EXPLORE_RECORDING_TAB_KEY), []);
  const tree = guestVisibleDraftTree({ sections: [{ key: "explore", categories: input }] });
  assert.ok(!JSON.stringify(tree).includes(EXPLORE_RECORDING_TAB_KEY));
  assert.ok(!JSON.stringify(tree).includes("Snemanje tur"));
});

test("tab label is code-local in four languages, not a tenant translation key", () => {
  assert.deepEqual(["sl", "en", "de", "it"].map((lang) => recordingTabLabel(lang as "sl" | "en" | "de" | "it")),
    ["Snemanje tur", "Record a tour", "Tour aufzeichnen", "Registra un tour"]);
  assert.ok(!Object.hasOwn(LIVING_GUIDE_UI, "UI.lg.freeTour.tab"));
  const tabSource = readFileSync(new URL("../pages/living-guide/living-guide-explore-tabs.ts", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /const freeTourEnabled = isTourRecordingEnabled\(tenant\)/);
  assert.match(shell, /exploreCategoryChips\(activeCategories,[^\n]*freeTourEnabled\)/);
  assert.match(shell, /recordingTabLabel\(lang\)/);
  assert.match(shell, /freeTourEnabled && recorderMounted && \([\s\S]*?hidden=\{!recordingSelected\}[\s\S]*?<FreeTourRecorder/);
  assert.match(shell, /!recordingSelected && <>[\s\S]*?distanceSections\.map/);
  assert.match(shell, /if \(key === EXPLORE_RECORDING_TAB_KEY\) setRecorderMounted\(true\)/);
  assert.ok(!tabSource.includes("populatedSectionGroups"), "pseudo-tab helper has no admin/group structure dependency");
});

test("development fixture mounts actual guest ExploreView without creating content records", () => {
  const fixture = readFileSync(new URL("./fixtures/explore-recording.tsx", import.meta.url), "utf8");
  assert.match(fixture, /import \{ ExploreView \} from/);
  assert.match(fixture, /className="lg2-app notranslate" data-living-guide/);
  assert.match(fixture, /query\.get\("enabled"\) !== "0"/);
  assert.match(fixture, /import\.meta\.env\.DEV/);
  assert.ok(!fixture.includes("fetch("));
});