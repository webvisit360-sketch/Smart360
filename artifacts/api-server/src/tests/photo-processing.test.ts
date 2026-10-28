import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { inspectPhoto, photoVariant } from "../lib/photo-processing";

test("large panorama passes panorama admission, fails ordinary admission, and retains bounded fullscreen quality", async () => {
  const original = await sharp({ create: { width: 16000, height: 5000, channels: 3, background: "#387aa5" } }).jpeg().toBuffer();
  console.log(`Synthetic panorama: 16000x5000, ${original.length} bytes`);
  await assert.rejects(inspectPhoto(original, false));
  assert.equal((await inspectPhoto(original, true)).width, 16000);
  const full = await photoVariant(original, 1400, 75, true);
  const meta = await sharp(full).metadata();
  assert.equal(meta.width, 8192);
  assert.equal(meta.height, 2560);
  assert.equal((await sharp(await photoVariant(original, 620, 65, true)).metadata()).width, 620);
});
test("invalid image fails before storage", async () => {
  await assert.rejects(inspectPhoto(Buffer.from("not an image"), true));
});
