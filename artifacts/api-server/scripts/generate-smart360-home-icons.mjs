// Run: node artifacts/api-server/scripts/generate-smart360-home-icons.mjs
// Draw from the official vector. Small icons use a 4x white-field render
// downsampled only after compositing; larger icons retain their direct pipeline.
// The approved 80px welcome/host artwork guards against swapping the mark.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import { constants } from "node:fs";
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
const baselinePath = path.join(reports, "smart360-home-icon-180-before-supersampling.png");
const comparisonPath = path.join(reports, "smart360-home-icon-180-old-vs-new-4x-nearest.png");
await mkdir(reports, { recursive: true });
// Capture the shipped 180px icon BEFORE writing any new icons; never replace
// this comparison baseline on subsequent generator runs.
try {
  await copyFile(path.join(brand, "ikona-smart360-180.png"), baselinePath, constants.COPYFILE_EXCL);
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
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
  const scale = size <= 192 ? 4 : 1;
  const renderSize = size * scale;
  const renderMarkSize = markSize * scale;
  // Sharp's SVG density defaults to 72 DPI. Specify it explicitly to make
  // the vector rasterize at this mark size, never from an 80px raster.
  const density = 72 * renderMarkSize / vectorMeta.width;
  const source = sharp(vector, { density });
  const sourceMeta = await source.metadata();
  assert.ok(sourceMeta.width >= renderMarkSize && sourceMeta.height >= renderMarkSize,
    `${size}px icon would upscale a ${sourceMeta.width}x${sourceMeta.height} SVG rasterization`);
  const mark = await source.png().toBuffer();
  const markMeta = await sharp(mark).metadata();
  assert.equal(markMeta.width, renderMarkSize);
  assert.equal(markMeta.height, renderMarkSize);
  const composite = await sharp({
    create: { width: renderSize, height: renderSize, channels: 3, background: white },
  }).composite([{ input: mark, left: offset * scale, top: offset * scale }])
    .flatten({ background: white }).removeAlpha().png().toBuffer();
  // Separate Sharp instances make the order unambiguous: composite on the
  // full white canvas first, then Lanczos3 downsample the complete small icon.
  const expected = scale === 4
    ? await sharp(composite).resize(size, size, { kernel: "lanczos3" }).removeAlpha().png().toBuffer()
    : composite;
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

for (const size of [180, 512]) {
  await writeFile(path.join(reports, `smart360-home-icon-approval-${size}.png`), generated.get(size));
}
const old180 = await readFile(baselinePath);
const enlargedOld = await sharp(old180).resize(720, 720, { kernel: "nearest" }).png().toBuffer();
const enlargedNew = await sharp(generated.get(180)).resize(720, 720, { kernel: "nearest" }).png().toBuffer();
const label = Buffer.from(`<svg width="1520" height="50" xmlns="http://www.w3.org/2000/svg"><text x="20" y="32" font-family="sans-serif" font-size="24" fill="#111">OLD — direct 180px</text><text x="780" y="32" font-family="sans-serif" font-size="24" fill="#111">NEW — 4x supersampled 180px</text></svg>`);
const comparison = await sharp({
  create: { width: 1520, height: 790, channels: 3, background: white },
}).composite([
  { input: enlargedOld, left: 20, top: 50 },
  { input: enlargedNew, left: 780, top: 50 },
  { input: label, left: 0, top: 0 },
]).removeAlpha().png().toBuffer();
await writeFile(comparisonPath, comparison);
for (const [panel, left] of [[enlargedOld, 20], [enlargedNew, 780]]) {
  const cropped = await rgb(await sharp(comparison).extract({ left, top: 50, width: 720, height: 720 }).png().toBuffer());
  assert.ok(cropped.data.equals((await rgb(panel)).data), "Comparison panel must be nearest-neighbor pixels without labels or other overlays");
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
console.log("Verified 180/192 from 720/768px white canvases with 4x SVG marks and Lanczos3 downsampling; 512/1024 remain direct. Opaque RGB, white corners/center, official mark, identical over black; saved approvals/contact sheet and old/new comparison.");