import assert from "node:assert/strict";
import test from "node:test";

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
