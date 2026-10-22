import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../pages/living-guide/simple/living-guide-simple.css", import.meta.url), "utf8");
const contract = css.slice(css.indexOf("/* Enostaven surface contract:"));

test("Enostaven color contract is scoped away from Trend", () => {
  // Every selector in this isolated contract must require the simple root.
  for (const match of contract.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{/g)) {
    for (const selector of match[1].split(",")) assert.ok(selector.includes(".lgs-root"), selector);
  }
  assert.match(contract, /--s-detail-accent:\s*color-mix\(in srgb, var\(--s-tile1\) 45%, #000\)/);
  assert.doesNotMatch(contract, /--s-(?:tile1|tile15|tile2|bg):|--lgw-bg:|--daypart-/);
});
test("Enostaven reading cards are explicitly white, not inherited from night", () => {
  for (const selector of [".lg2-detail-sheet", ".lgp-desc", ".lg2-ann-detail-body"]) {
    const rule = contract.slice(contract.indexOf(selector)).split("}")[0];
    assert.match(rule, /background:\s*#FFFFFF/);
  }
  assert.match(contract, /--lgp-bg:\s*var\(--bg\)/);
  assert.match(contract, /--lgp-card2:\s*#FFFFFF/);
});
