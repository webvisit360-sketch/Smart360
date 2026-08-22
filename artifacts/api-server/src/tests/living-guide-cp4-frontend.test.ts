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
const resolverModule = await import(resolverUrl);
const gesturesModule = await import(gesturesUrl);
const resolveLivingGuideNav = resolverModule.resolveLivingGuideNav as (
  storedNav: NavItem[] | null | undefined,
  validFeatures: Set<NavItem>,
  hasSitePlanImages: boolean,
) => NavState;
const getLivingGuideAvailableFeatures =
  resolverModule.getLivingGuideAvailableFeatures as (
    sections: unknown[],
  ) => Set<NavItem>;
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