import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  itemPriceText,
  normalizeGuestMedia,
} from "../pages/living-guide/living-guide-formatters";
import {
  activeExploreCategories,
  EXPLORE_ALL_CATEGORY_KEY,
  exploreItemsForCategory,
  groupExploreItemsByDistance,
  storedRoadDistanceMeters,
  storedTravelDurationMinutes,
} from "../pages/living-guide/living-guide-explore";
import {
  OFFER_GROUPS,
  STAY_GROUPS,
  populatedSectionGroups,
  orderedSectionGroupDefs,
  selectedSectionGroup,
} from "../pages/living-guide/living-guide-groups";
import { LIVING_GUIDE_UI } from "../pages/guest/i18n";

test("published offer/stay groups require a visible, non-deleted item", () => {
  for (const defs of [OFFER_GROUPS, STAY_GROUPS]) {
    const [first, second] = defs;
    const category = (id: string, group: string, items: any[], extra = {}) => ({
      id, exploreGroup: group, items, ...extra,
    });
    const hidden = category("hidden", second.key, [{ id: "hidden-item" }], { isVisible: false });
    const deleted = category("deleted", second.key, [{ id: "deleted-item" }], { deletedAt: "2025-01-01" });
    const empty = category("empty", second.key, []);
    const hiddenItem = category("hidden-item-cat", second.key, [{ id: "invisible", isVisible: false }]);
    const deletedItem = category("deleted-item-cat", second.key, [{ id: "removed", deletedAt: "2025-01-01" }]);
    const excluded = [hidden, deleted, empty, hiddenItem, deletedItem];
    assert.deepEqual(populatedSectionGroups(excluded, defs), [], "zero populated groups");

    const one = category("one", first.key, [{ id: "visible" }, { id: "not-visible", isVisible: false }]);
    const single = populatedSectionGroups([...excluded, one], defs);
    assert.deepEqual(single.map((group) => group.key), [first.key], "one populated group");
    assert.deepEqual(single[0].items.map(({ item }) => item.id), ["visible"]);
    assert.deepEqual(single[0].categories.map((row) => row.id), ["one"]);

    const two = category("two", second.key, [{ id: "second-visible" }]);
    assert.deepEqual(
      populatedSectionGroups([...excluded, one, two], defs).map((group) => group.key),
      [first.key, second.key],
      "two populated groups",
    );
    // A newly published item makes a previously empty group appear automatically.
    const arriving = category("arriving", second.key, [{ id: "arrived" }]);
    assert.deepEqual(
      populatedSectionGroups([...excluded, one, arriving], defs).map((group) => group.key),
      [first.key, second.key],
    );

    // Admin structure preview keeps all configured tabs and empty categories.
    const admin = populatedSectionGroups([...excluded, one], defs, true);
    assert.deepEqual(admin.map((group) => group.key), defs.map((def) => def.key));
    assert.ok(admin.find((group) => group.key === second.key)?.categories.some((row) => row.id === "empty"));
  }
});

test("group selection falls back when removed and can select a returning group", () => {
  const [first, second] = OFFER_GROUPS;
  const make = (secondVisible: boolean) => populatedSectionGroups([
    { id: "one", exploreGroup: first.key, items: [{ id: "one-item" }] },
    { id: "two", exploreGroup: second.key, items: secondVisible ? [{ id: "two-item" }] : [] },
  ], OFFER_GROUPS);
  const both = make(true);
  assert.equal(selectedSectionGroup(both, second.key)?.key, second.key);
  const onlyFirst = make(false);
  assert.equal(selectedSectionGroup(onlyFirst, second.key)?.key, first.key);
  assert.equal(selectedSectionGroup(make(true), first.key)?.key, first.key);
  assert.equal(selectedSectionGroup(make(true), second.key)?.key, second.key);
  assert.equal(selectedSectionGroup([], second.key), undefined);
});

test("offer and stay ordering includes empty tabs but never changes unknown category fallback", () => {
  for (const defs of [OFFER_GROUPS, STAY_GROUPS]) {
    const reversed = defs.map((def) => def.key).reverse();
    assert.deepEqual(orderedSectionGroupDefs(defs, reversed).map((def) => def.key), reversed);
    for (const invalid of [[defs[0].key], [...reversed.slice(1), reversed[1].key], [...reversed.slice(1), "foreign"], "foreign"]) {
      assert.deepEqual(orderedSectionGroupDefs(defs, invalid), defs);
    }
    const categories = [
      { id: "unknown", exploreGroup: "experiences", items: [{ id: "fallback" }] },
      { id: "last", exploreGroup: reversed[0], items: [{ id: "explicit" }] },
    ];
    const groups = populatedSectionGroups(categories, defs, false, reversed);
    assert.deepEqual(groups.map((group) => group.key), [reversed[0], defs[0].key],
      "visible tabs follow stored order while empty tabs stay guest-hidden");
    assert.deepEqual(groups.find((group) => group.key === defs[0].key)?.items.map(({ item }) => item.id), ["fallback"],
      "unknown category keys remain assigned to the canonical first group");
    assert.deepEqual(populatedSectionGroups(categories, defs, true, reversed).map((group) => group.key), reversed,
      "the admin preview retains every empty canonical group");
    assert.deepEqual(populatedSectionGroups(categories, defs, false, null).map((group) => group.key),
      [defs[0].key, reversed[0]]);
  }
});

test("negotiable price is localized semantically", () => {
  const labels: Record<string, string> = {
    sl: "Po dogovoru",
    en: "By agreement",
    de: "Nach Vereinbarung",
    it: "Su accordo",
  };
  for (const [lang, expected] of Object.entries(labels)) {
    assert.equal(
      itemPriceText({ price: "Po dogovoru" }, () => labels[lang]),
      expected,
    );
  }
});

test("guest media normalization filters invalid rows and deduplicates URLs", () => {
  const rows = [
    { id: "a", kind: "image", url: "/one.jpg" },
    { id: "b", kind: "image", url: "/one.jpg" },
    { id: "c", kind: "video", url: "/clip.mp4" },
    { id: "d", kind: "image", url: "" },
    { id: "e", kind: "image", url: "/two.jpg", isVisible: false },
    { id: "f", kind: "image", url: "/three.jpg" },
  ];
  assert.deepEqual(normalizeGuestMedia(rows).map((row) => row.id), ["a", "f"]);
});

test("Living Guide rich titles are sanitized before HTML rendering", async () => {
  const source = await readFile(
    new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /dangerouslySetInnerHTML=\{\{ __html: sanitizeHtml\(value\) \}\}/,
  );
  assert.match(source, /previousMediaKeyRef/);
  assert.match(source, /onGalleryIndex\?\.\(0\)/);

  const swipeSource = await readFile(
    new URL("../pages/guest/GuestSwipe.tsx", import.meta.url),
    "utf8",
  );
  const gallerySource = await readFile(
    new URL("../pages/guest/media-viewer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(swipeSource, /GuestRichBody value=\{item\.body\}/);
  assert.match(swipeSource, /itemPriceText\(item, t\)/);
  assert.match(gallerySource, /media = normalizeGuestMedia\(media\)/);
  assert.match(gallerySource, /setDot\(0\)/);
});

test("draggable detail sheets use grabbers and backdrop close without arrows", async () => {
  const source = await readFile(
    new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url),
    "utf8",
  );
  const draggableDetailSource = source.slice(
    source.indexOf("function HeroGallery("),
    source.indexOf("function BottomNav("),
  );
  const articleCount = (
    draggableDetailSource.match(/<article className=/g) ?? []
  ).length;
  const grabberCount = (
    draggableDetailSource.match(/className="lg2-grabber"/g) ?? []
  ).length;

  assert.doesNotMatch(draggableDetailSource, /className="lg2-detail-back"/);
  assert.equal(articleCount, grabberCount);
  assert.ok(articleCount > 0);
  assert.match(
    draggableDetailSource,
    /!target\.closest\("\.lg2-detail-sheet,\.lg2-order-dock,a,button,input,textarea,select"\)/,
  );
  assert.match(draggableDetailSource, /suppressGalleryClickRef/);
  assert.match(
    draggableDetailSource,
    /data-lg-ambient-hero[\s\S]*?event\.stopPropagation\(\);[\s\S]*?onBack\(\);/,
  );
  assert.doesNotMatch(
    draggableDetailSource,
    /const startsAtTop\s*=\s*ambientHero\s*\|\|/,
  );

  const fullScreenSource = source.slice(
    source.indexOf("function ExploreView("),
    source.indexOf("function HeroGallery("),
  );
  assert.match(fullScreenSource, /className="lg2-detail-back"/);
});

test("explore items use stored range, deterministic fallbacks, and stable distance order", () => {
  const category = { id: "category" };
  const entry = (id: string, item: Record<string, unknown>) => ({
    item: { id, ...item },
    category,
  });
  const sections = groupExploreItemsByDistance([
    entry("unclassified-a", {}),
    entry("near-farther", { range: "near", distanceMeters: 8_000 }),
    entry("excursion-duration", { duration: "21 min", distanceMeters: 21_000 }),
    entry("near-duration-boundary", { duration: "20 min", distanceMeters: 4_000 }),
    entry("excursion-distance-only", { distance: "20,5 km" }),
    entry("near-distance-only", { distance: "2,5 km" }),
    entry("unclassified-b", {}),
    entry("excursion-stored-wins", {
      range: "excursion",
      travelDurationSeconds: 300,
      distanceMeters: 1_000,
    }),
  ]);

  assert.deepEqual(
    sections.map((section) => ({
      key: section.key,
      ids: section.items.map((row) => row.item.id),
    })),
    [
      {
        key: "near",
        ids: ["near-distance-only", "near-duration-boundary", "near-farther"],
      },
      {
        key: "excursion",
        ids: [
          "excursion-stored-wins",
          "excursion-distance-only",
          "excursion-duration",
        ],
      },
      {
        key: "unclassified",
        ids: ["unclassified-a", "unclassified-b"],
      },
    ],
  );
  assert.equal(storedRoadDistanceMeters({ distance: "2,5 km" }), 2_500);
  assert.equal(storedTravelDurationMinutes({ duration: "1 h 5 min" }), 65);
});

test("explore omits empty distance sections", () => {
  const sections = groupExploreItemsByDistance([
    {
      item: { id: "near", distanceMeters: 1_000 },
      category: { id: "category" },
    },
  ]);
  assert.deepEqual(sections.map((section) => section.key), ["near"]);
});

test("explore distance section headers have the approved four-language labels", () => {
  assert.deepEqual(LIVING_GUIDE_UI["UI.lg.distanceGroup.near"], {
    sl: "V bližini",
    en: "Nearby",
    de: "In der Nähe",
    it: "Nelle vicinanze",
  });
  assert.deepEqual(LIVING_GUIDE_UI["UI.lg.distanceGroup.excursion"], {
    sl: "Izleti",
    en: "Day trips",
    de: "Ausflüge",
    it: "Gite",
  });
  assert.deepEqual(LIVING_GUIDE_UI["UI.lg.distanceHint.near"], {
    sl: "do 20 min",
    en: "up to 20 min",
    de: "bis 20 Min.",
    it: "fino a 20 min",
  });
  assert.deepEqual(LIVING_GUIDE_UI["UI.lg.distanceHint.excursion"], {
    sl: "nad 20 min",
    en: "over 20 min",
    de: "über 20 Min.",
    it: "oltre 20 min",
  });
  assert.deepEqual(LIVING_GUIDE_UI["UI.lg.categoryFilter.all"], {
    sl: "Vse",
    en: "All",
    de: "Alle",
    it: "Tutte",
  });
});

test("compact list cards stay scoped to Okolica", async () => {
  const source = await readFile(
    new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL(
      "../pages/living-guide/living-guide-guest.css",
      import.meta.url,
    ),
    "utf8",
  );
  const sharedCardSource = source.slice(
    source.indexOf("function PCard("),
    source.indexOf("function ExploreCard("),
  );
  const exploreCardSource = source.slice(
    source.indexOf("function ExploreCard("),
    source.indexOf("function useGroupTabsState("),
  );
  const exploreViewSource = source.slice(
    source.indexOf("function ExploreView("),
    source.indexOf("function ShopView("),
  );

  assert.match(sharedCardSource, /meta, title, description/);
  assert.match(sharedCardSource, /\{description && <p>\{description\}<\/p>\}/);
  assert.match(exploreCardSource, /className=\{`lg2-explore-card/);
  assert.doesNotMatch(exploreCardSource, /description/);
  assert.match(exploreCardSource, /lg2-explore-card-photo--placeholder/);
  assert.doesNotMatch(exploreCardSource, /fotografija manjka<\/span>/);
  assert.equal((exploreViewSource.match(/<ExploreCard/g) ?? []).length, 2);
  assert.doesNotMatch(exploreViewSource, /<PCard/);
  assert.match(css, /\.lg2-explore-card \{[\s\S]*?gap: 12px;/);
  assert.match(
    css,
    /\.lg2-explore-card-photo \{[\s\S]*?width: 92px;[\s\S]*?height: 76px;/,
  );
  assert.match(css, /\.lg2-pcard \{[\s\S]*?padding: 0;/);
});

test("explore category chips preserve active skeleton order and filter both distance groups", () => {
  const categories = [
    {
      id: "nature",
      label: "Narava",
      items: [
        { id: "nature-near", range: "near", distanceMeters: 8_000 },
        { id: "nature-trip", range: "excursion", distanceMeters: 35_000 },
      ],
    },
    {
      id: "hidden",
      label: "Skrita",
      isVisible: false,
      items: [{ id: "hidden-near", range: "near", distanceMeters: 1_000 }],
    },
    {
      id: "culture",
      label: "Kultura",
      items: [
        { id: "culture-near", range: "near", distanceMeters: 2_000 },
        { id: "culture-trip", range: "excursion", distanceMeters: 25_000 },
      ],
    },
  ];

  assert.deepEqual(
    activeExploreCategories(categories).map((category) => category.id),
    ["nature", "culture"],
  );

  const allSections = groupExploreItemsByDistance(
    exploreItemsForCategory(categories, EXPLORE_ALL_CATEGORY_KEY),
  );
  assert.deepEqual(
    allSections.map((section) => ({
      key: section.key,
      ids: section.items.map((entry) => entry.item.id),
    })),
    [
      { key: "near", ids: ["culture-near", "nature-near"] },
      { key: "excursion", ids: ["culture-trip", "nature-trip"] },
    ],
  );

  const natureSections = groupExploreItemsByDistance(
    exploreItemsForCategory(categories, "nature"),
  );
  assert.deepEqual(
    natureSections.map((section) => ({
      key: section.key,
      ids: section.items.map((entry) => entry.item.id),
    })),
    [
      { key: "near", ids: ["nature-near"] },
      { key: "excursion", ids: ["nature-trip"] },
    ],
  );
});