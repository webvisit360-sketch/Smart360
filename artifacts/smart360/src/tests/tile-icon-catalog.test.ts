import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  AUTOMATIC_TILE_ICON, TILE_ICON_CATALOG, catalogForTileKey,
  matchTileCatalog, normalizeTileLabel, searchTileCatalog, tileKeyForCatalog,
} from "@workspace/category-icons";
import { simpleCategoryIcon } from "../pages/living-guide/simple/simple-tiles";

test("all 50 catalog SVGs and keywords are imported verbatim", () => {
  const html = readFileSync(new URL("../../../../attached_assets/ikone-gumbov-1_1792535751859.html", import.meta.url), "utf8");
  const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const source = [...html.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].map(m => decode(m[1]));
  assert.equal(TILE_ICON_CATALOG.length, 50);
  assert.deepEqual(TILE_ICON_CATALOG.map(e => e.svg), source);
  assert.equal(new Set(TILE_ICON_CATALOG.map(e => e.id)).size, 50);
  for (const entry of TILE_ICON_CATALOG) assert.ok(!/<script|on\w+=|href=/i.test(entry.svg));
});

test("all seven language keywords match inside longer, uppercase, accent-free labels", () => {
  for (const entry of TILE_ICON_CATALOG.filter(e => e.keywords.length)) {
    assert.equal(entry.keywords.length, 7, entry.name);
    for (const keyword of entry.keywords) {
      const label = `XX ${normalizeTileLabel(keyword).toUpperCase()} YY`;
      const actual = matchTileCatalog(label);
      assert.ok(actual, label);
      assert.equal(tileKeyForCatalog(actual), tileKeyForCatalog(entry), label);
    }
  }
});

test("owner's examples select distinct catalogue pictograms; map and hiking retain their aliases", () => {
  const examples = ["Breakfast", "Where to eat", "Nightlife", "Pizzerias", "Things to do",
    "Shops", "Bakeries", "Petrol stations", "Cash machines", "Pharmacies", "Healthcare",
    "SUP board", "Scooter", "Outdoor gym", "Barbecue", "Boat with a skipper",
    "Boat line", "Games", "Olive oil", "Ice cream"];
  const icons = examples.map(label => {
    const icon = simpleCategoryIcon({ label, layout: "poi", icon: "pin" }, "explore");
    assert.ok(icon.startsWith("catalog:"), label);
    assert.notEqual(icon, "pin", label);
    return catalogForTileKey(icon)!.svg;
  });
  assert.equal(new Set(icons).size, examples.length);
  assert.equal(simpleCategoryIcon({ label: "Hiking maps" }, "explore"), "hike");
  assert.equal(simpleCategoryIcon({ label: "Map" }, "explore"), "pin");
});

test("explicit selection wins; automatic reset, invalid stored key and nonsense fallback work", () => {
  assert.equal(simpleCategoryIcon({ label: "Breakfast", icon: "catalog:pizzerias" }, "explore"), "catalog:pizzerias");
  assert.equal(simpleCategoryIcon({ label: "Breakfast", icon: AUTOMATIC_TILE_ICON }, "explore"), "catalog:breakfast");
  assert.equal(simpleCategoryIcon({ label: "Breakfast", icon: "catalog:unknown" }, "explore"), "catalog:breakfast");
  assert.equal(simpleCategoryIcon({ label: "Xqzv 987" }, "explore"), "pin");
  assert.equal(simpleCategoryIcon({ label: "Xqzv 987" }, "offer"), "cart");
  assert.equal(matchTileCatalog("Xqzv 987"), undefined);
  assert.ok(searchTileCatalog("FRUHSTUCK").some(e => e.id === "catalog:breakfast"));
  assert.equal(searchTileCatalog("").length, 50);
});
