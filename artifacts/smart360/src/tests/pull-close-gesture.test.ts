import { test } from "node:test";
import assert from "node:assert/strict";
import { pullAxis } from "../pages/living-guide/simple/pull-close-gesture";

test("only a decisive downward drag from scroll top can engage close", () => {
  assert.equal(pullAxis("pending", 0, 7, 0), "pending");
  assert.equal(pullAxis("pending", 0, 8, 0), "down");
  assert.equal(pullAxis("pending", 0, 30, 50), "native");
  assert.equal(pullAxis("pending", 0, -30, 0), "native");
  assert.equal(pullAxis("pending", 30, 20, 0), "native");
});
test("upward/sideways scrolling never becomes close after reversing direction", () => {
  const axis = pullAxis("pending", 0, -30, 0);
  assert.equal(pullAxis(axis, 0, 150, 0), "native");
  assert.equal(pullAxis("native", 0, 200, -2), "native");
});
