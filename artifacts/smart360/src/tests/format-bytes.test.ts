import test from "node:test";
import assert from "node:assert/strict";
import { fmtMediaSize, fmtMediaUsage, usagePct } from "../lib/format-bytes";

test("media usage uses whole decimal MB below one decimal GB", () => {
  assert.equal(fmtMediaUsage(31_450_000, 2_000_000_000), "31 MB od 2 GB");
});

test("media usage uses one decimal GB from one decimal GB", () => {
  assert.equal(fmtMediaUsage(1_400_000_000, 2_000_000_000), "1,4 GB od 2 GB");
  assert.equal(fmtMediaSize(1_000_000_000), "1,0 GB");
});

test("quota threshold uses the same decimal byte family as the display", () => {
  assert.equal(usagePct(2_000_000_000, 2_000_000_000), 100);
  assert.equal(usagePct(1_000_000_000, 2_000_000_000), 50);
});