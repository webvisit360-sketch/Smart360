import test from "node:test";
import assert from "node:assert/strict";
import { BORDO, MODRA, deriveSimplePalette, simplePaletteStyle } from "../pages/living-guide/simple/simple-palette";

test("custom outlines retain the pale master treatment independently of adaptive ink", () => {
  const inks = new Set<string>();
  for (const base of ["#48A1D4", "#FF7A00", "#FF2D87", "#101B2E", "#FFFFFF"]) {
    const tokens = deriveSimplePalette(base);
    const style = simplePaletteStyle(tokens);
    assert.equal(style["--s-outline"], "#C2DCF8");
    assert.equal(style["--s-ink"], tokens.stroke);
    assert.equal(style["--s-stroke"], tokens.stroke);
    inks.add(tokens.stroke);
  }
  assert.ok(inks.size > 1);
});

test("preset outline colors remain their original hand-tuned values", () => {
  for (const tokens of [BORDO, MODRA]) {
    const style = simplePaletteStyle(tokens);
    assert.equal(style["--s-outline"], undefined);
    assert.equal(style["--s-ink"], undefined);
    assert.equal(style["--s-stroke"], tokens.stroke);
  }
});
