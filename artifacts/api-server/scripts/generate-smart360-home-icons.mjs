// Run: node artifacts/api-server/scripts/generate-smart360-home-icons.mjs
// Draw from the official vector at each output size. The approved 80px
// welcome/host artwork is only a guard against swapping in another mark.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const brand = path.join(root, "artifacts/smart360/public/brand");
const reports = path.join(root, "reports");
const vector = await readFile(path.join(brand, "smart360-kolobar-temno.svg"));
const approved = await readFile(path.join(brand, "smart360-znak-40.png"));
const sizes = [180, 192, 512, 1024];
const markRatio = 0.66;
const vectorMeta = await sharp(vector).metadata();
assert.equal(vectorMeta.width, 1000, "Unexpected official vector intrinsic width");
assert.equal(vectorMeta.height, 1000, "Unexpected official vector intrinsic height");
assert.ok(!/<image\b|<filter\b|<feGaussianBlur\b/i.test(vector.toString()), "Mark SVG must be paths, not an embedded raster or blur");

async function rgb(buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

// The vector is the high-resolution original of the same approved artwork.
// Small rasterization differences at 80px are expected at antialiased edges.
const reference = await rgb(approved);
const downsample = await rgb(await sharp(vector).resize(80, 80).flatten({ background: "#ffffff" }).png().toBuffer());
assert.equal(reference.info.width, 80);
assert.equal(reference.info.height, 80);
let totalDifference = 0;
for (let i = 0; i < reference.data.length; i += 3) {
  totalDifference += Math.max(...[0, 1, 2].map(k => Math.abs(reference.data[i + k] - downsample.data[i + k])));
}
assert.ok(totalDifference / 6400 < 12, "High-res vector does not match approved welcome/host mark");

const white = { r: 255, g: 255, b: 255 };
const generated = new Map();
for (const size of sizes) {
  const markSize = Math.round(size * markRatio);
  const offset = Math.floor((size - markSize) / 2);
  // Sharp's SVG density defaults to 72 DPI. Specify it explicitly to make
  // the vector rasterize at this target mark size, never from an 80px raster.
  const density = 72 * markSize / vectorMeta.width;
  const source = sharp(vector, { density });
  const sourceMeta = await source.metadata();
  assert.ok(sourceMeta.width >= markSize && sourceMeta.height >= markSize,
    `${size}px icon would upscale a ${sourceMeta.width}x${sourceMeta.height} SVG rasterization`);
  const mark = await source.png().toBuffer();
  const markMeta = await sharp(mark).metadata();
  assert.equal(markMeta.width, markSize);
  assert.equal(markMeta.height, markSize);
  const expected = await sharp({
    create: { width: size, height: size, channels: 3, background: white },
  }).composite([{ input: mark, left: offset, top: offset }]).flatten({ background: white }).removeAlpha().png().toBuffer();
  // 192px is also used by the unrelated tab favicon. Keep that original
  // dark-field file untouched; give the home-screen variant its own name.
  const filename = size === 192 ? "ikona-smart360-home-192.png" : `ikona-smart360-${size}.png`;
  const dest = path.join(brand, filename);
  await writeFile(dest, expected);
  const actual = await readFile(dest);
  const meta = await sharp(actual).metadata();
  assert.equal(meta.format, "png");
  assert.equal(meta.channels, 3, `${filename} must be RGB (no alpha)`);
  assert.equal(meta.width, size);
  assert.equal(meta.height, size);
  const direct = await rgb(actual);
  const blackComposited = await rgb(await sharp(actual).ensureAlpha().flatten({ background: "#000000" }).png().toBuffer());
  assert.ok(direct.data.equals(blackComposited.data), `${filename} differs over black (transparent pixels)`);
  assert.ok(direct.data.equals((await rgb(expected)).data), `${filename} artwork differs from official vector`);
  for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1], [size >> 1, size >> 1]]) {
    const i = (y * size + x) * 3;
    assert.ok(direct.data.subarray(i, i + 3).equals(Buffer.from([255, 255, 255])), `${filename} has a non-white corner/center`);
  }
  // Inspect actual ink rather than the square SVG viewport: the official ring
  // has transparent viewport corners and fits the maskable central safe circle.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      if (direct.data[i] !== 255 || direct.data[i + 1] !== 255 || direct.data[i + 2] !== 255) {
        assert.ok(Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) < size * 0.4,
          `${filename} exceeds maskable safe circle at ${x},${y}`);
      }
    }
  }
  generated.set(size, actual);
}

await mkdir(reports, { recursive: true });
for (const size of [180, 512]) {
  await writeFile(path.join(reports, `smart360-home-icon-approval-${size}.png`), generated.get(size));
}
const black = await sharp({
  create: { width: 1140, height: 560, channels: 3, background: "#000000" },
}).png().toBuffer();
const sheet = await sharp({
  create: { width: 1140, height: 1120, channels: 3, background: "#ffffff" },
}).composite([
  { input: black, left: 0, top: 560 },
  ...[0, 560].flatMap(row => [
    { input: generated.get(180), left: 30, top: row + 30 },
    { input: generated.get(192), left: 235, top: row + 30 },
    { input: generated.get(512), left: 560, top: row + 24 },
  ]),
]).removeAlpha().png().toBuffer();
await writeFile(path.join(reports, "smart360-home-icons-contact-sheet.png"), sheet);
console.log("Verified 180/192/512/1024: direct target-size SVG rasterization, opaque RGB, white corners/center, same official mark, identical over black; saved approvals/contact sheet.");