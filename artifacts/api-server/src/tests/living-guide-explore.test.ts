import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createRequire } from "node:module";
import { GUIDE_LANGUAGES } from "@workspace/guide-languages";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
} from "@workspace/api-zod";

const exploreModuleUrl = new URL(
  "../../../smart360/src/pages/living-guide/living-guide-explore.ts",
  import.meta.url,
).href;
const guestI18nModuleUrl = new URL(
  "../../../smart360/src/pages/guest/i18n.ts",
  import.meta.url,
).href;

async function loadExploreModule(): Promise<{
  EXPLORE_GROUPS: ReadonlyArray<{
    key: string;
    adminLabel: string;
  }>;
  exploreItemDescription: (item: unknown) => string;
  populatedExploreGroups: (categories: unknown) => any[];
}> {
  return import(exploreModuleUrl);
}

test("nature_trails keeps its stable key with the four renamed labels", async () => {
  const { EXPLORE_GROUPS } = await loadExploreModule();
  const { LIVING_GUIDE_UI } = await import(guestI18nModuleUrl);
  const group = EXPLORE_GROUPS.find((entry) => entry.key === "nature_trails");

  assert.equal(group?.key, "nature_trails");
  assert.equal(group?.adminLabel, "Aktivnosti");
  const labels = LIVING_GUIDE_UI["UI.lg.exploreGroup.natureTrails"];
  for (const language of GUIDE_LANGUAGES) assert.ok(labels[language]?.trim(), language);
  assert.deepEqual(Object.fromEntries(["sl", "en", "de", "it"].map(lang => [lang, labels[lang]])), {
    sl: "Aktivnosti",
    en: "Activities",
    de: "Aktivitäten",
    it: "Attività",
  });
});

test("Okolica keeps the complete seeded group skeleton regardless of items", async () => {
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
    "experiences",
    "food_drink",
    "nature_trails",
    "sights",
    "services",
  ]);
  assert.equal(groups[2]?.items[0]?.item.id, "hike-1");
  assert.equal(groups[4]?.items[0]?.category.id, "shops");
  assert.equal(groups[1]?.categories[0]?.id, "food");
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
  // Execute the real function bodies, located by AST rather than source formatting.
  const ast = ts.createSourceFile("shell.tsx", shell, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) &&
    ["ExploreCard", "useGroupTabsState"].includes(node.name?.text ?? ""));
  assert.equal(functions.length, 2);
  const js = ts.transpileModule(functions.map(node => node.getText(ast)).join("\n"), {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const requireClient = createRequire(new URL("../../../smart360/package.json", import.meta.url));
  const React = requireClient("react");
  const { renderToStaticMarkup } = requireClient("react-dom/server");
  let selected: string | null = null;
  const scrolls: unknown[] = [];
  const deps = {
    React, LivingGuideCategoryIcon: () => null, RichInline: ({ value }: any) => value,
    useState: (initial: string | null) => [initial, (value: string) => { selected = value; }],
    useRef: () => ({ current: { scrollTo: (options: unknown) => scrolls.push(options) } }),
    useEffect: (effect: () => void) => effect(),
    selectedSectionGroup: (groups: any[], key: string) => groups.find(group => group.key === key),
    navigator: {},
  };
  const { ExploreCard, useGroupTabsState } = new Function(...Object.keys(deps),
    `${js}; return { ExploreCard, useGroupTabsState };`)(...Object.values(deps));
  const state = useGroupTabsState([{ key: "beaches" }, { key: "hiking" }]);
  assert.equal(state.selectedGroup.key, "beaches");
  state.selectGroup("hiking");
  assert.equal(selected, "hiking");
  assert.deepEqual(scrolls, [{ top: 0, behavior: "auto" }]);
  const empty = renderToStaticMarkup(React.createElement(ExploreCard, { title: "Beach" }));
  assert.ok(empty.includes("Beach"));
  assert.ok(!empty.includes("lg2-explore-card-info"));
  const populated = renderToStaticMarkup(React.createElement(ExploreCard, {
    title: "Beach", infoText: "2 km", status: { isOpen: true, text: "Open" },
  }));
  assert.ok(populated.includes("2 km"));
  assert.ok(populated.includes("is-open"));
  assert.ok(populated.includes("Open"));
});