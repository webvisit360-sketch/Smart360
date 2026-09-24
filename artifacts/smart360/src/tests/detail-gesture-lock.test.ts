import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { lockDetailGesture, type DetailGestureLock } from "../pages/living-guide/detail-gesture-lock";

const gesture = (): DetailGestureLock => ({ startX: 0, startY: 0, axis: null });

test("fast horizontal and vertical movements choose one exclusive owner", () => {
  const horizontal = gesture();
  assert.equal(lockDetailGesture(horizontal, 60, 4), "horizontal");
  assert.equal(lockDetailGesture(horizontal, 60, 80), "horizontal");
  const vertical = gesture();
  assert.equal(lockDetailGesture(vertical, 3, -50), "vertical");
  assert.equal(lockDetailGesture(vertical, 70, -50), "vertical");
});

test("slow motion waits until threshold and never reassigns ownership", () => {
  const motion = gesture();
  for (const x of [1, 2, 3, 4, 5]) {
    assert.equal(lockDetailGesture(motion, x, 0), null);
  }
  assert.equal(lockDetailGesture(motion, 6, 0), "horizontal");
  assert.equal(lockDetailGesture(motion, 6, 70), "horizontal");
});

test("diagonal tie assigns sheet immediately at threshold, with no dead zone", () => {
  const tie = gesture();
  assert.equal(lockDetailGesture(tie, 5, 5), null);
  assert.equal(lockDetailGesture(tie, 6, 6), "vertical");
  assert.equal(lockDetailGesture(tie, 30, 7), "vertical");
  const nearTie = gesture();
  assert.equal(lockDetailGesture(nearTie, -7, 6), "horizontal");
});

test("cancel discards gesture ownership for the next press", () => {
  let motion = gesture();
  assert.equal(lockDetailGesture(motion, 14, 2), "horizontal");
  motion = gesture();
  assert.equal(lockDetailGesture(motion, 2, 14), "vertical");
});

test("gallery and sheet retain separate native pan directions and deferred capture", async () => {
  const css = await readFile(new URL("../pages/living-guide/living-guide-guest.css", import.meta.url), "utf8");
  const source = await readFile(new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url), "utf8");
  assert.match(css, /\.lg2-gallery-track\s*\{[^}]*touch-action: pan-x;/);
  assert.match(css, /\.lg2-detail-sheet\s*\{[^}]*touch-action: pan-y;/);
  const press = source.slice(source.indexOf("const beginGalleryDrag ="), source.indexOf("const moveGalleryDrag ="));
  assert.doesNotMatch(press, /setPointerCapture|preventDefault/);
  assert.match(source, /root\.addEventListener\("touchmove", onTouchMove, \{ passive: false \}\)/);
  assert.match(source, /root\.addEventListener\("pointercancel", onPointerCancel\)/);
  assert.match(source, /root\.addEventListener\("touchcancel", onTouchCancel\)/);
});