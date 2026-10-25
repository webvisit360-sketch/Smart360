import test from "node:test";
import assert from "node:assert/strict";
import { coverImageCrop, landingInk } from "../pages/living-guide/landing-ink-model";

test("landing ink chooses dark on bright photos and pale on dark or unsampleable pixels", () => {
  assert.equal(landingInk([235, 245, 250, 255]), "dark");
  assert.equal(landingInk([20, 35, 45, 255]), "pale");
  assert.equal(landingInk([255, 255, 255, 0]), "pale");
  assert.equal(landingInk([]), "pale");
});
test("landing image sample follows object-cover cropping and the text region, not the entire photo", () => {
  assert.deepEqual(coverImageCrop(1000, 1000, 400, 800, 50, 50,
    { x: 20, y: 600, width: 360, height: 100 }),
    { x: 275, y: 750, width: 450, height: 125 });
  assert.equal(coverImageCrop(1000, 1000, 400, 800, 100, 50,
    { x: 20, y: 600, width: 360, height: 100 }).x, 525);
});
