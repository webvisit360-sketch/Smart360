import assert from "node:assert/strict";
import test from "node:test";
import { resolveSimplePalette } from "../pages/living-guide/simple/simple-palette";
import { readFileSync } from "node:fs";

import {
  contrastRatio,
  isDarkSurface,
  lightenStep,
  parseColor,
  ruleIconToneOnDark,
  RULE_ICON_PALE_INK,
  toHex,
} from "../lib/rule-icon-contrast";

const rgb = (v: string) => parseColor(v)!.rgb;

test("Trend rule source uses tenant palette rather than the shared daypart accent", () => {
  const css = readFileSync(new URL("../pages/living-guide/living-guide-guest.css", import.meta.url), "utf8");
  const source = readFileSync(new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url), "utf8");
  assert.match(css, /--rc-acc:\s*var\(--rule-tenant-accent\)/);
  assert.doesNotMatch(css, /--rc-acc:\s*var\(--acc\)/);
  assert.match(source, /"--rule-tenant-accent":\s*resolveSimplePalette\(tenant\?\.simplePalette,\s*tenant\?\.simpleBaseColor\)\.tile2/);
  const green = resolveSimplePalette("custom", "#6CB843").tile2;
  const bordo = resolveSimplePalette("bordo", "#EECB87").tile2;
  assert.equal(green.toUpperCase(), "#559333");
  assert.equal(bordo.toUpperCase(), "#521445");
  const tones = [green, bordo].map(accent=>ruleIconToneOnDark(rgb(accent),rgb("#0C1322")));
  assert.notEqual(tones[0].color,tones[1].color);
  for(const tone of tones) {
    assert.ok(tone.contrast>=3);
    assert.notEqual(tone.color,"#E9A63A");
  }
});

test("sheet example: #4E7431 on #14243C is below 3:1", () => {
  const c = contrastRatio(rgb("#4E7431"), rgb("#14243C"));
  assert.ok(c > 2.8 && c < 2.95, String(c));
});

test("sheet example: one lightening step reaches >= 3:1 near #5E8A3C", () => {
  const tone = ruleIconToneOnDark(rgb("#4E7431"), rgb("#14243C"));
  assert.equal(tone.source, "lightened");
  assert.equal(tone.steps, 1);
  assert.ok(tone.contrast >= 3, String(tone.contrast));
  const [r, g, b] = rgb(tone.color);
  const [er, eg, eb] = rgb("#5E8A3C");
  assert.ok(Math.abs(r - er) <= 3 && Math.abs(g - eg) <= 3 && Math.abs(b - eb) <= 3, tone.color);
});

test("accent kept unchanged when already >= 3:1", () => {
  const tone = ruleIconToneOnDark(rgb("#E9A63A"), rgb("#0C1322"));
  assert.equal(tone.source, "accent");
  assert.equal(tone.color, "#E9A63A");
});

test("lightening keeps hue", () => {
  const next = lightenStep(rgb("#157347"));
  assert.ok(next[1] > next[2] && next[2] > next[0], toHex(next));
});

test("unreachable contrast falls back to pale ink", () => {
  const tone = ruleIconToneOnDark(rgb("#777777"), rgb("#808080"), 0);
  assert.equal(tone.source, "pale-ink");
  assert.equal(tone.color, RULE_ICON_PALE_INK);
});

test("surface classification and rgb() parsing", () => {
  assert.equal(isDarkSurface(rgb("#14243C")), true);
  assert.equal(isDarkSurface(rgb("#FFFFFF")), false);
  assert.deepEqual(parseColor("rgba(12, 19, 34, 0.5)"), { rgb: [12, 19, 34], alpha: 0.5 });
  assert.equal(parseColor("rgba(0, 0, 0, 0)")!.alpha, 0);
});
