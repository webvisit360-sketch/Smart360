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
import { LIVING_GUIDE_UI } from "../pages/guest/i18n";

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
  assert.deepEqual(LIVING_GUIDE_UI["UI.lg.categoryFilter.all"], {
    sl: "Vse",
    en: "All",
    de: "Alle",
    it: "Tutte",
  });
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