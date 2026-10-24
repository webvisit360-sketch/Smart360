import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../pages/living-guide/simple/living-guide-simple.css", import.meta.url), "utf8");
const contract = css.slice(css.indexOf("/* Enostaven surface contract:"));

test("Enostaven color contract is scoped away from Trend", () => {
  // Split only selector-list commas, not commas inside :is()/SVG data URLs.
  // Body-scoped Enostaven rules also cover guest portals outside the root.
  for (const match of contract.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{/g)) {
    let depth = 0, start = 0;
    const selectors: string[] = [];
    for (let i = 0; i < match[1].length; i++) {
      if (match[1][i] === "(") depth++;
      if (match[1][i] === ")") depth--;
      if (match[1][i] === "," && depth === 0) { selectors.push(match[1].slice(start, i)); start = i + 1; }
    }
    selectors.push(match[1].slice(start));
    for (const selector of selectors) assert.ok(selector.includes(".lgs-root") || selector.trim().startsWith('body[data-guest-design="simple"] '), selector);
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
