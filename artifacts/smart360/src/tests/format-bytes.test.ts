import test from "node:test";
import assert from "node:assert/strict";
import { fmtMediaSize, fmtMediaUsage, usagePct } from "../lib/format-bytes";

test("media usage uses whole MiB below one GiB", () => {
  assert.equal(fmtMediaUsage(31 * 1024 ** 2, 2 * 1024 ** 3), "31 MB od 2 GB");
});

test("media usage uses one decimal GiB from one GiB", () => {
  assert.equal(fmtMediaUsage(1.4 * 1024 ** 3, 2 * 1024 ** 3), "1,4 GB od 2 GB");
  assert.equal(fmtMediaSize(1024 ** 3), "1,0 GB");
});

test("display formatting does not change the byte-based quota threshold", () => {
  assert.equal(usagePct(2 * 1024 ** 3, 2 * 1024 ** 3), 100);
  assert.equal(usagePct(2_000_000_000, 2 * 1024 ** 3), 93);
});