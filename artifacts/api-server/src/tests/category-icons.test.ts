import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CATEGORY_ICON,
  normalizeSlovenian,
  suggestCategoryIcon,
  suggestCategoryIcons,
} from "@workspace/category-icons";

test("Slovenian category names normalize accents and case", () => {
  assert.equal(normalizeSlovenian("  KÔLÉSARSTVO & VÓDA  "), "kolesarstvo voda");
});

test("kitchen names produce exactly three distinct suggestions", () => {
  for (const name of ["Skupna KUHINJA", "Domača kulinarika", "Sveža hrana"]) {
    assert.deepEqual(
      suggestCategoryIcons(name),
      ["lucide:utensils", "lucide:chef-hat", "lucide:cooking-pot"],
    );
    assert.equal(new Set(suggestCategoryIcons(name)).size, 3);
  }
});

test("generic names produce the three stable fallback suggestions", () => {
  assert.deepEqual(
    suggestCategoryIcons("Nekaj povsem drugega"),
    ["lucide:star", "lucide:tag", "lucide:sparkles"],
  );
  assert.equal(suggestCategoryIcon("Nekaj povsem drugega"), DEFAULT_CATEGORY_ICON);
});

test("different Slovene name groups receive useful distinct suggestions", () => {
  const cases = [
    ["Izposoja koles", "lucide:bike"],
    ["Vodni bazen", "lucide:waves"],
    ["Lokalna trgovina", "lucide:shopping-bag"],
    ["Parkiranje avtomobila", "lucide:car"],
    ["Spalnica apartmaja", "lucide:bed"],
    ["WiFi internet", "lucide:wifi"],
    ["Hišna pravila", "lucide:clipboard-list"],
    ["Zajtrk in kava", "lucide:coffee"],
    ["Zdravje in lekarna", "lucide:heart-pulse"],
    ["Pohodniški izleti", "lucide:mountain"],
    ["Otroška igrala", "lucide:baby"],
    ["Wellness in savna", "lucide:sparkles"],
    ["Kontaktni telefon", "lucide:phone"],
    ["Glasbeni dogodki", "lucide:calendar-days"],
    ["Pranje perila", "lucide:washing-machine"],
  ] as const;
  for (const [name, first] of cases) {
    const suggestions = suggestCategoryIcons(name);
    assert.equal(suggestions.length, 3);
    assert.equal(new Set(suggestions).size, 3);
    assert.equal(suggestions[0], first);
    assert.equal(suggestCategoryIcon(name), suggestions[0]);
  }
});

test("single automatic suggestion is the first of the same three matches", () => {
  assert.deepEqual(
    ["Skupna kuhinja", "Kolesarstvo", "Bazen"].map(suggestCategoryIcon),
    ["lucide:utensils", "lucide:bike", "lucide:waves"],
  );
});