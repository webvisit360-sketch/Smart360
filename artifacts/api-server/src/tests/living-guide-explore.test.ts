import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
} from "@workspace/api-zod";

const exploreModuleUrl = new URL(
  "../../../smart360/src/pages/living-guide/living-guide-explore.ts",
  import.meta.url,
).href;

async function loadExploreModule(): Promise<{
  exploreItemDescription: (item: unknown) => string;
  populatedExploreGroups: (categories: unknown) => any[];
}> {
  return import(exploreModuleUrl);
}

test("Okolica uses persisted category groups in product order and hides empty groups", async () => {
  const { populatedExploreGroups } = await loadExploreModule();
  const groups = populatedExploreGroups([
    {
      id: "shops",
      exploreGroup: "services",
      items: [{ id: "shop-1", title: "Shop", isVisible: true }],
    },
    {
      id: "hike",
      exploreGroup: "nature_trails",
      items: [{ id: "hike-1", title: "Trail", isVisible: true }],
    },
    {
      id: "food",
      exploreGroup: "food_drink",
      items: [{ id: "food-hidden", title: "Hidden", isVisible: false }],
    },
    {
      id: "legacy-label-only",
      label: "Kulinarika",
      items: [{ id: "legacy-1", title: "Legacy", isVisible: true }],
    },
  ]);

  assert.deepEqual(groups.map((group) => group.key), [
    "nature_trails",
    "services",
  ]);
  assert.equal(groups[0]?.items[0]?.item.id, "hike-1");
  assert.equal(groups[1]?.items[0]?.category.id, "shops");
  assert.equal(groups[0]?.key, "nature_trails");
});

test("Okolica category group survives create/update contracts and rejects unknown keys", () => {
  const created = CreateCategoryBody.parse({
    label: "Lekarne",
    icon: "pharmacy",
    layout: "poi",
    exploreGroup: "services",
  });
  const updated = UpdateCategoryBody.parse({ exploreGroup: "sights" });

  assert.equal(created.exploreGroup, "services");
  assert.equal(updated.exploreGroup, "sights");
  assert.throws(() =>
    CreateCategoryBody.parse({
      label: "Invalid",
      icon: "pin",
      layout: "poi",
      exploreGroup: "label-derived",
    }),
  );
});

test("Meli Pu seed maps every product category by stable key", () => {
  const seed = readFileSync(
    new URL("../../scripts/seed-melipu.mjs", import.meta.url),
    "utf8",
  );
  const mappings = {
    experiences: ["act", "trips", "events"],
    food_drink: ["breakfast", "culinary", "pizza", "night"],
    nature_trails: ["hike", "bike", "beach"],
    sights: ["culture", "nature"],
    services: ["shops", "bakery", "gas", "atm", "pharm", "hosp"],
  };

  for (const [group, keys] of Object.entries(mappings)) {
    for (const key of keys) {
      assert.match(seed, new RegExp(`\\\\[\\"${key}\\"\\\\s*,\\\\s*\\"${group}\\"\\\\]`));
    }
  }
});

test("Okolica description is text-only and falls back through authored item fields", async () => {
  const { exploreItemDescription } = await loadExploreModule();
  assert.equal(
    exploreItemDescription({
      body: JSON.stringify([
        "<p>First sentence.</p>",
        "<p>Second &amp; final sentence.</p>",
      ]),
    }),
    "First sentence. Second & final sentence.",
  );
  assert.equal(
    exploreItemDescription({ noteText: "<strong>Bring water.</strong>" }),
    "Bring water.",
  );
  assert.equal(
    exploreItemDescription({ bullets: ["First stop", "Second stop"] }),
    "First stop Second stop",
  );
});

test("Okolica binding CSS keeps one tab row and exact large-card values", () => {
  const css = readFileSync(
    new URL(
      "../../../smart360/src/pages/living-guide/living-guide-guest.css",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(css, /\.lg2-gtabs\s*\{[\s\S]*height:\s*60px/);
  assert.match(css, /\.lg2-gtabs\s*\{[\s\S]*flex-wrap:\s*nowrap/);
  assert.match(css, /\.lg2-gtabs button\s*\{[\s\S]*height:\s*44px/);
  assert.match(css, /\.lg2-pcard\s*\{[\s\S]*border-radius:\s*24px/);
  assert.match(css, /\.lg2-pcard-photo\s*\{[\s\S]*aspect-ratio:\s*16 \/ 9/);
  assert.match(css, /\.lg2-pcard p\s*\{[\s\S]*-webkit-line-clamp:\s*2/);
});

test("Okolica UI selects the first populated group, resets scroll, and omits optional meta", () => {
  const shell = readFileSync(
    new URL(
      "../../../smart360/src/pages/living-guide/LivingGuideGuestShell.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const exploreView = shell.slice(
    shell.indexOf("function ExploreView"),
    shell.indexOf("function MessagesView"),
  );

  assert.match(exploreView, /groups\[0\]\?\.key \?\? null/);
  assert.match(exploreView, /scrollTo\(\{ top: 0, behavior: "auto" \}\)/);
  assert.match(exploreView, /\{distance && <span/);
  assert.match(exploreView, /\{status \? \(/);
  assert.doesNotMatch(exploreView, /Preberi več|read-more/i);
});