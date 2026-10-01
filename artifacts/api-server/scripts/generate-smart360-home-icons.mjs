// Run: node artifacts/api-server/scripts/generate-smart360-home-icons.mjs
// Draw from the official vector. Small icons use a 4x white-field render
// downsampled only after compositing; larger icons retain their direct pipeline.
// The checked-in canonical SVG is authoritative; never re-extract historical artwork.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const brand = path.join(root, "artifacts/smart360/public/brand");
const reports = path.join(root, "reports");
const prototypePath = path.join(brand, "smart360-kolobar-faceted.svg");
const extracted = await readFile(prototypePath, "utf8");
assert.ok(extracted, "Missing canonical faceted SVG");
assert.match(extracted, /viewBox="0 0 1000 1000"/);
assert.doesNotMatch(extracted, /gradient|url\(|<image\b|<filter\b|<use\b/i);
const paths = extracted.match(/<path\b[^>]*\/>/g) ?? [];
assert.ok(paths.length > 0);
assert.ok(paths.every(p => /\sd="[^"]+"/.test(p) && /\sfill="#[0-9a-f]{6}"/i.test(p)), "Every path needs explicit geometry and solid fill");
const vector = Buffer.from(extracted);
assert.ok((await readFile(path.join(brand, "smart360-kolobar-faceted.svg"))).equals(vector));
const sizes = [
  ...[180, 192, 512, 1024].map(size => ({
    size, ratio: 0.74, maskable: false,
    filename: size === 192 ? "ikona-smart360-home-192.png" : `ikona-smart360-${size}.png`,
  })),
  ...[192, 512].map(size => ({
    size, ratio: 0.66, maskable: true, filename: `ikona-smart360-maskable-${size}.png`,
  })),
];
const baselinePath = path.join(reports, "smart360-home-icon-180-previous-66-supersampled.png");
const comparisonPath = path.join(reports, "smart360-home-icon-180-previous-66-vs-standard-74-4x-nearest.png");
await mkdir(reports, { recursive: true });
for (const size of [180, 192]) {
  const filename = size === 180 ? "ikona-smart360-180.png" : "ikona-smart360-home-192.png";
  try {
    await copyFile(path.join(brand, filename), path.join(reports, `smart360-prefaceted-${size}.png`), constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
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

const white = { r: 255, g: 255, b: 255 };
const generated = new Map();
const measurements = [];
for (const { size, ratio, maskable, filename } of sizes) {
  const markSize = Math.round(size * ratio);
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
  // The separate dark-field tab favicon remains untouched.
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
  // Measure visibly colored ink (a channel < 240): faint Lanczos3 edge
  // ringing can be nearly white and extend beyond the actual 74%/66% ring.
  // This fixed 15/255 contrast cutoff excludes the halo, not real colored edges.
  let minX = size, minY = size, maxX = -1, maxY = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      if (direct.data[i] !== 255 || direct.data[i + 1] !== 255 || direct.data[i + 2] !== 255) {
        if (direct.data[i] < 240 || direct.data[i + 1] < 240 || direct.data[i + 2] < 240) {
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
        if (maskable) {
          assert.ok(Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) <= size * 0.4,
            `${filename} exceeds maskable 80%-diameter safe circle at ${x},${y}`);
        }
      }
    }
  }
  assert.ok(maxX >= minX && maxY >= minY, `${filename} contains no ink`);
  for (const diameter of [maxX - minX + 1, maxY - minY + 1]) {
    assert.ok(Math.abs(diameter / size - ratio) <= 0.01,
      `${filename} measured ink diameter ${diameter}/${size} is not ${ratio * 100}% ±1%`);
  }
  assert.ok(Math.abs((minX + maxX + 1) / 2 - size / 2) <= 1 &&
    Math.abs((minY + maxY + 1) / 2 - size / 2) <= 1, `${filename} ink is not centered`);
  console.log(`${filename}: visible ink (<240/channel) ${maxX - minX + 1}x${maxY - minY + 1}/${size} (${((maxX - minX + 1) / size * 100).toFixed(2)}%, ${((maxY - minY + 1) / size * 100).toFixed(2)}%)`);
  generated.set(filename, actual);
  measurements.push({ filename, size, ratio, measuredWidthRatio: (maxX - minX + 1) / size, measuredHeightRatio: (maxY - minY + 1) / size, maskable });
}

for (const size of [180, 512]) {
  await writeFile(path.join(reports, `smart360-home-icon-approval-${size}.png`),
    generated.get(`ikona-smart360-${size}.png`));
}
const old180 = await readFile(baselinePath);
const enlargedOld = await sharp(old180).resize(720, 720, { kernel: "nearest" }).png().toBuffer();
const enlargedNew = await sharp(generated.get("ikona-smart360-180.png")).resize(720, 720, { kernel: "nearest" }).png().toBuffer();
const label = Buffer.from(`<svg width="1520" height="50" xmlns="http://www.w3.org/2000/svg"><text x="20" y="32" font-family="sans-serif" font-size="24" fill="#111">PREVIOUS — 66% supersampled</text><text x="780" y="32" font-family="sans-serif" font-size="24" fill="#111">NEW — 74% standard</text></svg>`);
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
    { input: generated.get("ikona-smart360-180.png"), left: 30, top: row + 30 },
    { input: generated.get("ikona-smart360-home-192.png"), left: 235, top: row + 30 },
    { input: generated.get("ikona-smart360-512.png"), left: 560, top: row + 24 },
  ]),
]).removeAlpha().png().toBuffer();
await writeFile(path.join(reports, "smart360-home-icons-contact-sheet.png"), sheet);
console.log("Verified 74% standard and 66% safe-zone maskable ink bounds, small 4x white-field Lanczos3 and large direct vector renders; saved approvals/contact sheet and previous-66/new-74 comparison.");

// Adjacent-pixel RGB contrast, weighted by edge magnitude: sum(d²)/sum(d).
// Flat white contributes zero. Unlike raw Laplacian variance this is normalized
// by edge mass, so simply adding more facets does not itself raise the score.
// It measures rendered edge contrast, not an OS screenshot or an MTF estimate.
async function edgeContrast(buffer) {
  const { data, info } = await rgb(buffer);
  let mass = 0, energy = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 3;
    for (const j of [x + 1 < info.width ? i + 3 : -1, y + 1 < info.height ? i + info.width * 3 : -1]) {
      if (j < 0) continue;
      const d = Math.hypot(data[i] - data[j], data[i + 1] - data[j + 1], data[i + 2] - data[j + 2]) / Math.sqrt(3);
      mass += d; energy += d * d;
    }
  }
  return energy / mass;
}
const sharpness = [];
const evidenceRows = [];
for (const size of [180, 192]) {
  const before = await readFile(path.join(reports, `smart360-prefaceted-${size}.png`));
  const after = generated.get(size === 180 ? "ikona-smart360-180.png" : "ikona-smart360-home-192.png");
  const oldScore = await edgeContrast(before), newScore = await edgeContrast(after);
  sharpness.push({ size, oldScore, newScore, notSofter: newScore >= oldScore });
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="460" height="45"><text x="20" y="28" font-family="sans-serif" font-size="16">OLD ${size}px (native)</text><text x="250" y="28" font-family="sans-serif" font-size="16">NEW ${size}px (native)</text></svg>`);
  const native = await sharp({ create: { width: 460, height: size + 65, channels: 3, background: white } })
    .composite([{ input: label, top: 0, left: 0 }, { input: before, top: 45, left: 20 }, { input: after, top: 45, left: 250 }])
    .removeAlpha().png().toBuffer();
  await writeFile(path.join(reports, `smart360-faceted-native-${size}.png`), native);
  // Native pixels above are never scaled; separate 60px mock launcher views
  // deliberately use normal Lanczos3 scaling, without sharpening.
  const tiles = await Promise.all([before, after].map(b => sharp(b).resize(60, 60, { kernel: "lanczos3" }).png().toBuffer()));
  const caption = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="180"><g font-family="sans-serif" fill="#111" text-anchor="middle"><text x="300" y="20" font-size="13">Illustrative home-screen scale · ${size}px source · NOT OS screenshots</text><text x="80" y="48">OLD</text><text x="220" y="48">NEW</text><text x="380" y="48">OLD</text><text x="520" y="48">NEW</text><text x="80" y="143">Turizem Drobež</text><text x="220" y="143">Turizem Drobež</text><text x="380" y="143">Meli Pu</text><text x="520" y="143">Meli Pu</text><text x="300" y="171" font-size="12">Shared Smart360 artwork; tenant labels only differ.</text></g></svg>`);
  const launcher = await sharp({ create: { width: 600, height: 180, channels: 3, background: "#e7edf3" } })
    .composite([{ input: caption, top: 0, left: 0 }, ...[50, 190, 350, 490].map((left, i) => ({ input: tiles[i % 2], top: 60, left }))])
    .removeAlpha().png().toBuffer();
  await writeFile(path.join(reports, `smart360-faceted-homescreen-illustrative-${size}.png`), launcher);
  evidenceRows.push(`<h2>${size}px sources</h2><img width="460" height="${size + 65}" alt="Old and new native ${size}px icons at 100%" src="data:image/png;base64,${native.toString("base64")}"><br><img width="600" height="180" alt="Illustrative home-screen scale; not actual OS screenshots" src="data:image/png;base64,${launcher.toString("base64")}">`);
}
const report = {
  source: path.relative(root, prototypePath), selector: "canonical file", sha256: createHash("sha256").update(vector).digest("hex"),
  bytes: vector.length, pathCount: paths.length, measurements,
  metric: "Adjacent-pixel RGB RMS contrast weighted by magnitude: sum(d²)/sum(d), full unscaled image, no threshold. Edge-mass normalized; artwork/color dependent, not optical MTF.",
  sharpness,
};
await writeFile(path.join(reports, "smart360-faceted-validation.json"), JSON.stringify(report, null, 2) + "\n");
await writeFile(path.join(reports, "smart360-faceted-comparison.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Smart360 faceted icon comparison</title><style>body{font:16px system-ui;margin:24px;background:#fafafa;color:#17212d}img{max-width:none}pre{white-space:pre-wrap;max-width:900px}</style><h1>Smart360: old vs faceted prototype artwork</h1><p>Native PNG panels: 100%, one image pixel per CSS pixel at browser zoom 100%. Home-screen views: illustrative 60 CSS px, NOT actual iOS/Android screenshots. No sharpening applied. Turizem Drobež and Meli Pu use the same Smart360 icon with different labels.</p>${evidenceRows.join("")}<h2>Quantitative validation</h2><pre>${JSON.stringify(report, null, 2)}</pre></html>`);
console.log(JSON.stringify(report, null, 2));
assert.ok(sharpness.every(s => s.notSofter), "Faceted edge-contrast regression; actual scores saved without adjustment in reports/smart360-faceted-validation.json");