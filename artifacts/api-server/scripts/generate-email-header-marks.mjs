// Run: node artifacts/api-server/scripts/generate-email-header-marks.mjs
// Render the official vector on white at 4x the final raster size, then
// downsample the composited canvas with Lanczos3. No home-icon padding.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const brand = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../smart360/public/brand");
const vector = await readFile(path.join(brand, "smart360-kolobar-temno.svg"));
const sourceMeta = await sharp(vector).metadata();
assert.equal(sourceMeta.width, 1000);
assert.equal(sourceMeta.height, 1000);
assert.ok(!/<image\b|<filter\b|<feGaussianBlur\b/i.test(vector.toString()));
for (const displayed of [20, 46]) {
  const size = displayed * 3;
  const renderSize = size * 4;
  const mark = await sharp(vector, { density: 72 * renderSize / 1000 }).png().toBuffer();
  const meta = await sharp(mark).metadata();
  assert.equal(meta.width, renderSize);
  assert.equal(meta.height, renderSize);
  const composited = await sharp({
    create: { width: renderSize, height: renderSize, channels: 3, background: "#FFFFFF" },
  }).composite([{ input: mark, left: 0, top: 0 }]).flatten({ background: "#FFFFFF" }).removeAlpha().png().toBuffer();
  const final = await sharp(composited).resize(size, size, { kernel: "lanczos3" }).removeAlpha().png().toBuffer();
  const filename = `smart360-email-header-${size}.png`;
  await writeFile(path.join(brand, filename), final);
  const output = await sharp(path.join(brand, filename)).metadata();
  assert.equal(output.width, size);
  assert.equal(output.height, size);
  assert.equal(output.channels, 3);
  console.log(`${filename}: ${size}x${size} RGB for ${displayed}x${displayed} HTML mark`);
}