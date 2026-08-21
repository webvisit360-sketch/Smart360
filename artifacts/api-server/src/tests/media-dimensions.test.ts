import assert from "node:assert/strict";
import test from "node:test";
import { orientedImageDimensions } from "../lib/mediaDimensions";

test("media dimensions preserve ordinary display axes", () => {
  assert.deepEqual(
    orientedImageDimensions({ width: 1400, height: 1050, orientation: 1 }),
    { width: 1400, height: 1050 },
  );
});

test("media dimensions follow EXIF rotations that swap axes", () => {
  assert.deepEqual(
    orientedImageDimensions({ width: 3024, height: 4032, orientation: 6 }),
    { width: 4032, height: 3024 },
  );
});

test("media dimensions reject absent or invalid metadata", () => {
  assert.equal(orientedImageDimensions({ width: 0, height: 900 }), null);
  assert.equal(orientedImageDimensions({ width: undefined, height: 900 }), null);
});