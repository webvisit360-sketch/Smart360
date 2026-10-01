import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { LIVING_GUIDE_UI } from "../pages/guest/i18n";
import { activeExploreCategories, EXPLORE_ALL_CATEGORY_KEY, exploreItemsForCategory } from "../pages/living-guide/living-guide-explore";
import { EXPLORE_RECORDING_TAB_KEY, exploreCategoryChips, exploreRecorderVisible, recordingTabLabel } from "../pages/living-guide/living-guide-explore-tabs";
import { guestVisibleDraftTree, selectedSectionGroup } from "../pages/living-guide/living-guide-groups";
import { syntheticTenant } from "../pages/living-guide/living-guide-weather-fixture-data";

const category = (id: string, label: string, isVisible = true, key?: string) => ({
  id, key, label, isVisible, items: [{ id: `${id}-item`, title: label, isVisible: true }],
});
const labels = (categories: ReturnType<typeof exploreCategoryChips>) => categories.map(({ label }) => label);
const example = [category("food", "Hrana"), category("bike-id", "Kolesarjenje", true, "bike"), category("hike-id", "Pohodništvo", true, "hike"), category("nature", "Narava")];

for (const [lang, expected] of Object.entries({ sl: "Snemanje tur", en: "Record a tour", de: "Tour aufzeichnen", it: "Registra un tour" }) as Array<["sl" | "en" | "de" | "it", string]>) {
  test(`${lang} translated fixture hosts recorder in all four stable sport categories, never All/other`, () => {
    const tenant = syntheticTenant(lang);
    const fixtureCategories = tenant.sections[1]!.categories;
    const expectedLabels = {
      sl: ["Kolesarjenje", "Pohodništvo", "Tek", "Aktivnosti"],
      en: ["Cycling", "Hiking", "Running", "Activities"],
      de: ["Radfahren", "Wandern", "Laufen", "Aktivitäten"],
      it: ["In bicicletta", "Escursioni a piedi", "Corsa", "Attività"],
    }[lang];
    assert.deepEqual(fixtureCategories.map(({ key }) => key), ["bike", "hike", "run", "activities"]);
    assert.deepEqual(fixtureCategories.map(({ label }) => label), expectedLabels);
    const categories = [category("food", "Food"), ...fixtureCategories, category("act-id", "Activities", true, "act")];
    const chips = exploreCategoryChips(
      categories,
      "All", recordingTabLabel(lang), tenant.tourRecordingEnabled,
    );
    assert.deepEqual(chips.map(({ key }) => key), [
      EXPLORE_ALL_CATEGORY_KEY, "food", "c-bike", "c-hike", "c-run", "c-activities", "act-id",
    ]);
    for (const row of fixtureCategories) {
      assert.equal(exploreRecorderVisible(categories, row.id, true), true, row.key);
      assert.equal(exploreRecorderVisible(categories, row.id, false), false, "operator flag is required");
      const onlyEligible = [category("other", "Other"), row];
      assert.ok(!exploreCategoryChips(onlyEligible, "All", expected, true).some(({ key }) => key === EXPLORE_RECORDING_TAB_KEY),
        `${row.key} alone suppresses the pseudo-tab`);
    }
    for (const key of [EXPLORE_ALL_CATEGORY_KEY, "food", "act-id", EXPLORE_RECORDING_TAB_KEY, "missing"]) {
      assert.equal(exploreRecorderVisible(categories, key, true), false, key);
    }
    const fallback = exploreCategoryChips([categories[0]!], "All", recordingTabLabel(lang), true);
    assert.equal(fallback.at(-1)?.key, EXPLORE_RECORDING_TAB_KEY);
    assert.equal(fallback.at(-1)?.label, expected);
    assert.equal(exploreRecorderVisible([categories[0]!], EXPLORE_RECORDING_TAB_KEY, true), true);
  });
}

test("pseudo-tab exists only as last fallback without eligible categories; disabled is always absent", () => {
  assert.deepEqual(labels(exploreCategoryChips([example[0], example[3]], "Vse", "Snemanje tur", true)),
    ["Vse", "Hrana", "Narava", "Snemanje tur"]);
  assert.deepEqual(labels(exploreCategoryChips([], "Vse", "Snemanje tur", true)), ["Vse", "Snemanje tur"]);
  assert.deepEqual(labels(exploreCategoryChips(example, "Vse", "Snemanje tur", false)),
    ["Vse", ...example.map((row) => row.label)]);
  assert.deepEqual(labels(exploreCategoryChips([], "Vse", "Snemanje tur", false)), ["Vse"]);
  assert.deepEqual(exploreCategoryChips([category("hike-id", "Hiking", true, "hike")], "All", "Record a tour", true).map(({ key }) => key),
    [EXPLORE_ALL_CATEGORY_KEY, "hike-id"]);
  assert.deepEqual(exploreCategoryChips([category("bike", "Custom cycling name")], "All", "Record a tour", true).map(({ key }) => key),
    [EXPLORE_ALL_CATEGORY_KEY, "bike"]);
  assert.deepEqual(exploreCategoryChips([category("unrelated", "Kolesarjenje"), category("sights", "Sights")], "All", "Record a tour", true).map(({ key }) => key),
    [EXPLORE_ALL_CATEGORY_KEY, "unrelated", "sights", EXPLORE_RECORDING_TAB_KEY]);
  assert.equal(exploreRecorderVisible([], EXPLORE_RECORDING_TAB_KEY, true), true);
  assert.equal(exploreRecorderVisible([], EXPLORE_RECORDING_TAB_KEY, false), false);
  assert.equal(exploreRecorderVisible([], EXPLORE_ALL_CATEGORY_KEY, true), false);
  for (const stableKey of ["act", "biking", "hiking", "running"]) {
    const other = [category("bike", "Cycling", true, stableKey)];
    assert.equal(exploreRecorderVisible(other, "bike", true), false, "explicit stable key takes priority over ID/label");
    assert.equal(exploreCategoryChips(other, "All", "Record a tour", true).at(-1)?.key, EXPLORE_RECORDING_TAB_KEY);
  }
});

test("hidden categories do not suppress fallback; recorder is never a content record", () => {
  const input = [category("cycle-hidden", "Kolesarjenje", false, "bike"), category("walk", "Pohodništvo", true, "hike"), category("food", "Hrana")];
  const active = activeExploreCategories(input);
  const before = JSON.stringify(input);
  const chips = exploreCategoryChips(active, "Vse", recordingTabLabel("sl"), true);
  assert.deepEqual(chips.map(({ key }) => key), [EXPLORE_ALL_CATEGORY_KEY, "walk", "food"]);
  assert.equal(JSON.stringify(input), before, "guest chip construction does not modify the content structure");
  assert.deepEqual(exploreItemsForCategory(active, EXPLORE_ALL_CATEGORY_KEY).map(({ item }) => item.id), ["walk-item", "food-item"]);
  assert.deepEqual(exploreItemsForCategory(active, "walk").map(({ item }) => item.id), ["walk-item"]);
  assert.deepEqual(exploreItemsForCategory(active, EXPLORE_RECORDING_TAB_KEY), []);
  const tree = guestVisibleDraftTree({ sections: [{ key: "explore", categories: input }] });
  assert.ok(!JSON.stringify(tree).includes(EXPLORE_RECORDING_TAB_KEY));
  assert.ok(!JSON.stringify(tree).includes("Snemanje tur"));
  const hiddenOnly = activeExploreCategories([input[0], input[2]]);
  assert.equal(exploreCategoryChips(hiddenOnly, "All", "Record a tour", true).at(-1)?.key, EXPLORE_RECORDING_TAB_KEY);
  assert.equal(exploreRecorderVisible(hiddenOnly, EXPLORE_RECORDING_TAB_KEY, true), true);
  assert.equal(exploreRecorderVisible(hiddenOnly, "cycle-hidden", true), false);
});

test("empty visible eligible categories still host the recorder and suppress fallback", () => {
  for (const key of ["bike", "hike", "run", "activities"]) {
    const empty = [{ ...category(`empty-${key}`, "Custom translated name", true, key), items: [] }];
    assert.deepEqual(exploreItemsForCategory(empty, empty[0]!.id), []);
    assert.equal(exploreRecorderVisible(empty, empty[0]!.id, true), true);
    assert.equal(exploreRecorderVisible(empty, empty[0]!.id, false), false);
    assert.ok(!exploreCategoryChips(empty, "All", "Record a tour", true).some((row) => row.key === EXPLORE_RECORDING_TAB_KEY));
  }
});

test("obsolete pseudo selection resolves immediately to All after language/category/flag transitions", () => {
  const fallback = exploreCategoryChips([example[0]], "All", recordingTabLabel("sl"), true);
  assert.equal(selectedSectionGroup(fallback, EXPLORE_RECORDING_TAB_KEY)?.key, EXPLORE_RECORDING_TAB_KEY);
  const translatedFallback = exploreCategoryChips([example[0]], "All", recordingTabLabel("en"), true);
  assert.equal(selectedSectionGroup(translatedFallback, EXPLORE_RECORDING_TAB_KEY)?.label, "Record a tour");
  for (const next of [
    exploreCategoryChips(example, "All", recordingTabLabel("en"), true),
    exploreCategoryChips([example[0]], "All", recordingTabLabel("de"), false),
  ]) {
    const selected = selectedSectionGroup(next, EXPLORE_RECORDING_TAB_KEY)!;
    assert.equal(selected.key, EXPLORE_ALL_CATEGORY_KEY);
    assert.equal(exploreRecorderVisible(example, selected.key, true), false);
    assert.ok(exploreItemsForCategory(example, selected.key).length > 0, "normal view is populated, not blank/stale");
  }
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
  assert.match(shell, /freeTourEnabled && \(recorderMounted \|\| recordingVisible\) && \([\s\S]*?hidden=\{!recordingVisible\}[\s\S]*?<FreeTourRecorder/);
  assert.match(shell, /!recordingSelected && <>[\s\S]*?distanceSections\.map/);
  assert.match(shell, /if \(exploreRecorderVisible\(activeCategories, key, freeTourEnabled\)\) setRecorderMounted\(true\)/);
  assert.match(shell, /if \(recordingVisible\) setRecorderMounted\(true\)/);
  const exploreView = shell.slice(shell.indexOf("export function ExploreView"), shell.indexOf("// Ponudba"));
  assert.equal((exploreView.match(/<FreeTourRecorder/g) ?? []).length, 1, "one shared mounted recorder preserves a live session");
  assert.ok(exploreView.indexOf("<FreeTourRecorder") > exploreView.indexOf("distanceSections.map"), "recorder is LAST after all distance groups");
  assert.ok(exploreView.indexOf("<FreeTourRecorder") > exploreView.indexOf("emptyCategories.map"), "recorder is LAST even with empty rows");
  assert.match(exploreView, /<FreeTourRecorder[^>]+\/>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/section>/);
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