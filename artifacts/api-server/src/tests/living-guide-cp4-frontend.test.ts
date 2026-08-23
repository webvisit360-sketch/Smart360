import assert from "node:assert/strict";
import test from "node:test";

type NavItem =
  | "home"
  | "stay"
  | "offer"
  | "explore"
  | "program"
  | "messages";
type NavState = {
  resolved: NavItem[];
  omitted: NavItem[];
  hasSiteMap: boolean;
};

const resolverUrl = new URL(
  ["..", "..", "..", "smart360", "src", "pages", "living-guide", "living-guide-nav-resolver.ts"].join("/"),
  import.meta.url,
).href;
const gesturesUrl = new URL(
  ["..", "..", "..", "smart360", "src", "pages", "living-guide", "living-guide-gestures.ts"].join("/"),
  import.meta.url,
).href;
const homeUrl = new URL(
  ["..", "..", "..", "smart360", "src", "pages", "living-guide", "living-guide-home.ts"].join("/"),
  import.meta.url,
).href;
const resolverModule = await import(resolverUrl);
const gesturesModule = await import(gesturesUrl);
const homeModule = await import(homeUrl);
const resolveLivingGuideNav = resolverModule.resolveLivingGuideNav as (
  storedNav: NavItem[] | null | undefined,
  validFeatures: Set<NavItem>,
  hasSitePlanImages: boolean,
) => NavState;
const getLivingGuideAvailableFeatures =
  resolverModule.getLivingGuideAvailableFeatures as (
    sections: unknown[],
  ) => Set<NavItem>;
const shouldShowLivingGuideBottomNav =
  resolverModule.shouldShowLivingGuideBottomNav as (
    screen: string,
  ) => boolean;
const calculatePinchZoom = gesturesModule.calculatePinchZoom as (
  currentScale: number,
  currentX: number,
  currentY: number,
  startDistance: number,
  currentDistance: number,
  startScale: number,
  center: { x: number; y: number },
  minScale?: number,
  maxScale?: number,
) => { scale: number };
const clampPan = gesturesModule.clampPan as (
  x: number,
  y: number,
  scale: number,
  containerW: number,
  containerH: number,
  contentW: number,
  contentH: number,
) => { x: number; y: number };
const resolveHomeHeroMedia = homeModule.resolveHomeHeroMedia as (
  livingGuideHeroUrl: unknown,
  sections: unknown[],
) => any | null;
const selectHomeTodayEntries = homeModule.selectHomeTodayEntries as (
  sections: unknown[],
  now?: Date,
) => {
  hasProgramme: boolean;
  entries: Array<{
    id: string;
    categoryLabel: string;
    detail: string;
    item: { id: string; title: string };
  }>;
};

const allFeatures = new Set<NavItem>([
  "home",
  "stay",
  "offer",
  "explore",
  "program",
  "messages",
]);

test("Meli Pu default keeps five slots and exposes Program through More", () => {
  const state = resolveLivingGuideNav(null, allFeatures, false);

  assert.deepEqual(state.resolved, [
    "home",
    "stay",
    "offer",
    "explore",
    "messages",
  ]);
  assert.deepEqual(state.omitted, ["program"]);
  assert.equal(state.hasSiteMap, false);
});

test("Camp configuration omits Offer while retaining its More destination", () => {
  const state = resolveLivingGuideNav(
    ["home", "stay", "explore", "program", "messages"],
    allFeatures,
    true,
  );

  assert.deepEqual(state.resolved, [
    "home",
    "stay",
    "explore",
    "program",
    "messages",
  ]);
  assert.deepEqual(state.omitted, ["offer"]);
  assert.equal(state.hasSiteMap, true);
});

test("an unavailable default slot is replaced by a real tenant feature", () => {
  const campFeatures = new Set<NavItem>([
    "home",
    "stay",
    "explore",
    "program",
    "messages",
  ]);
  const state = resolveLivingGuideNav(null, campFeatures, false);

  assert.deepEqual(state.resolved, [
    "home",
    "stay",
    "explore",
    "messages",
    "program",
  ]);
  assert.deepEqual(state.omitted, []);
});

test("malformed duplicate legacy settings are de-duplicated before backfill", () => {
  const state = resolveLivingGuideNav(
    ["home", "stay", "stay", "offer", "explore"],
    allFeatures,
    false,
  );

  assert.equal(state.resolved.length, 5);
  assert.equal(new Set(state.resolved).size, 5);
  assert.equal(state.resolved[0], "home");
});

test("More keeps the bottom bar while Cover and fullscreen Map hide it", () => {
  assert.equal(shouldShowLivingGuideBottomNav("more"), true);
  assert.equal(shouldShowLivingGuideBottomNav("home"), true);
  assert.equal(shouldShowLivingGuideBottomNav("cover"), false);
  assert.equal(shouldShowLivingGuideBottomNav("site-map"), false);
});

test("availability requires renderable content and a dated Program item", () => {
  const features = getLivingGuideAvailableFeatures([
    {
      key: "stay",
      isVisible: true,
      categories: [{ isVisible: true, items: [] }],
    },
    {
      key: "offer",
      isVisible: true,
      categories: [
        { isVisible: true, items: [{ isVisible: true, title: "Breakfast" }] },
      ],
    },
    {
      key: "explore",
      isVisible: true,
      categories: [
        { isVisible: true, items: [{ isVisible: false, title: "Hidden" }] },
      ],
    },
    {
      key: "program",
      isVisible: true,
      categories: [
        {
          layout: "events",
          isVisible: true,
          items: [
            {
              isVisible: true,
              title: "Poletni večer",
              eventStart: "2026-08-23T18:30:00.000Z",
            },
          ],
        },
      ],
    },
  ]);

  assert.deepEqual(
    [...features],
    ["home", "messages", "offer", "program"],
  );
});

test("pinch zoom and pan helpers clamp guest map transforms", () => {
  assert.equal(
    calculatePinchZoom(1, 0, 0, 100, 250, 1, { x: 0, y: 0 }, 1, 5).scale,
    2.5,
  );
  assert.equal(
    calculatePinchZoom(1, 0, 0, 100, 900, 1, { x: 0, y: 0 }, 1, 5).scale,
    5,
  );
  assert.deepEqual(clampPan(400, -400, 2, 300, 200, 300, 200), {
    x: 150,
    y: -100,
  });
});

test("Domov hero prefers its tenant field, then the first gallery image", () => {
  const sections = [
    {
      categories: [
        {
          items: [
            {
              media: [
                { kind: "video", url: "/video.mp4" },
                { kind: "image", url: "/gallery-first.jpg" },
              ],
            },
          ],
        },
      ],
    },
  ];

  assert.equal(
    resolveHomeHeroMedia("/living-guide.jpg", sections).url,
    "/living-guide.jpg",
  );
  assert.equal(
    resolveHomeHeroMedia(null, sections).url,
    "/gallery-first.jpg",
  );
  assert.equal(resolveHomeHeroMedia(null, []), null);
});

test("Domov with a programme requires a title and photo, then orders today's events by time", () => {
  const now = new Date(2026, 7, 23, 12, 0, 0);
  const result = selectHomeTodayEntries(
    [
      {
        key: "program",
        categories: [
          {
            id: "events",
            label: "Dogodki",
            layout: "events",
            items: [
              {
                id: "evening",
                title: "Večerni koncert",
                eventStart: "2026-08-23T18:00:00",
                duration: "90 min",
                media: [{ kind: "image", url: "/evening.jpg" }],
              },
              {
                id: "morning",
                title: "Jutranja vadba",
                eventStart: "2026-08-23T09:00:00",
                distance: "200 m",
                media: [{ kind: "image", url: "/morning.jpg" }],
              },
              {
                id: "tomorrow",
                title: "Jutri",
                eventStart: "2026-08-24T09:00:00",
                duration: "1 h",
                media: [{ kind: "image", url: "/tomorrow.jpg" }],
              },
              {
                id: "missing-detail",
                title: "Brez uporabne vrstice",
                eventStart: "2026-08-23T14:00:00",
                subtitle: "Splošen opis",
                media: [{ kind: "image", url: "/title-only.jpg" }],
              },
            ],
          },
        ],
      },
      {
        key: "explore",
        categories: [
          {
            id: "cycling",
            label: "Kolesarjenje",
            items: [
              {
                id: "route",
                title: "Kolesarska pot",
                distance: "4 km",
              },
            ],
          },
        ],
      },
    ],
    now,
  );

  assert.equal(result.hasProgramme, true);
  assert.deepEqual(
    result.entries.map((entry) => entry.item.id),
    ["morning", "missing-detail", "evening"],
  );
  assert.deepEqual(
    result.entries.map((entry) => entry.categoryLabel),
    ["Dogodki", "Dogodki", "Dogodki"],
  );
});

test("Domov without a programme uses only approved nearby categories", () => {
  const result = selectHomeTodayEntries([
    {
      key: "explore",
      categories: [
        {
          id: "hiking",
          label: "Pohodništvo",
          items: [
            {
              id: "far",
              title: "Daljša pot",
              distance: "8 km",
              distanceMeters: 8000,
              media: [{ kind: "image", url: "/far.jpg" }],
            },
            {
              id: "no-detail",
              title: "Brez razdalje",
              body: "<p>Lep razgled &amp; mirna pot skozi gozd.</p>",
              media: [{ kind: "image", url: "/no-distance.jpg" }],
            },
            {
              id: "title-only",
              title: "Samo naslov",
              media: [{ kind: "image", url: "/title-only.jpg" }],
            },
            {
              id: "missing-photo",
              title: "Brez fotografije",
            },
          ],
        },
        {
          id: "heritage",
          label: "Heritage",
          items: [
            {
              id: "near",
              title: "Grad",
              distance: "900 m",
              duration: "15 min",
              distanceMeters: 900,
              body: "Kratek zgodovinski opis.",
              media: [{ kind: "image", url: "/castle.jpg" }],
            },
          ],
        },
        {
          id: "shops",
          label: "Trgovine",
          items: [
            {
              id: "shop",
              title: "Trgovina",
              distance: "100 m",
              distanceMeters: 100,
              media: [{ kind: "image", url: "/shop.jpg" }],
            },
          ],
        },
      ],
    },
  ]);

  assert.equal(result.hasProgramme, false);
  assert.deepEqual(
    result.entries.map((entry) => entry.item.id),
    ["near", "far", "no-detail", "title-only"],
  );
  assert.equal(
    result.entries.find((entry) => entry.item.id === "near")?.detail,
    "900 m · 15 min · Kratek zgodovinski opis.",
  );
  assert.equal(
    result.entries.find((entry) => entry.item.id === "no-detail")?.detail,
    "Lep razgled & mirna pot skozi gozd.",
  );
  assert.equal(
    result.entries.find((entry) => entry.item.id === "title-only")?.detail,
    "",
  );
  assert.equal(selectHomeTodayEntries([]).entries.length, 0);
});