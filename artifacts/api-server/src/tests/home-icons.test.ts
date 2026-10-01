import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import sharp from "sharp";
import { createHash } from "node:crypto";

const brand = new URL("../../../smart360/public/brand/", import.meta.url);
const reports = new URL("../../../../reports/", import.meta.url);
const svg = await readFile(new URL("smart360-kolobar-faceted.svg", brand));
const variants = [
  ...[180, 192, 512, 1024].map(size => ({
    size, ratio: 0.74, maskable: false,
    filename: size === 192 ? "ikona-smart360-home-192.png" : `ikona-smart360-${size}.png`,
  })),
  ...[192, 512].map(size => ({
    size, ratio: 0.66, maskable: true, filename: `ikona-smart360-maskable-${size}.png`,
  })),
];

test("faceted vector is the exact verbatim splash artwork, not the old gradient mark", async () => {
  const prototype = await readFile(new URL("../../../../attached_assets/Smart360-prototip-2030_1_1790892799958.html", import.meta.url), "utf8");
  const splash = prototype.slice(prototype.indexOf('<div id="splash">'));
  const extracted = splash.match(/<span class="sm">(<svg\b[\s\S]*?<\/svg>)<\/span>/)?.[1];
  assert.ok(extracted);
  assert.ok(svg.equals(Buffer.from(extracted)), "No serialization, formatting, xmlns insertion or geometry changes allowed");
  assert.equal(createHash("sha256").update(svg).digest("hex"), "ca00d0eed25c2f3164105ecfa58617f51351e45dbc1648b28301ccbed8112eaa");
  assert.doesNotMatch(extracted, /gradient|url\(|<image\b|<filter\b|<use\b/i);
  const paths = extracted.match(/<path\b[^>]*\/>/g) ?? [];
  assert.equal(paths.length, 72);
  for (const p of paths) {
    assert.match(p, /\sd="[^"]+"/);
    assert.match(p, /\sfill="#[0-9a-f]{6}"/i);
  }
});

test("legacy original, dark tab icon and both pre-faceted baselines remain byte-identical", async () => {
  for (const [base, filename, hash] of [
    [brand, "smart360-kolobar-temno.svg", "a9fa1661427a9af1d0c5542bacfc664b70541df6458131fd9f0a157a47e8c4be"],
    [brand, "ikona-smart360-192.png", "8b8066d46b020c8ca6d647f6f92aa21036dc1e12e0fc6d4c072c296d74a843c8"],
    [reports, "smart360-prefaceted-180.png", "485f05c8a0bb1a39f62d8a2d3da6250bb77bfa64c0f610b180aa9360696cbffb"],
    [reports, "smart360-prefaceted-192.png", "8bc7c5d10b2ae8c0fb452769cfa797d25417ba5ed214d7c5552ffc7a74ac9f72"],
  ] as const) {
    assert.equal(createHash("sha256").update(await readFile(new URL(filename, base))).digest("hex"), hash, filename);
  }
});

test("home-screen icons render the authoritative faceted vector on opaque white", async (t) => {
  const markup = svg.toString();
  assert.match(markup, /viewBox="0 0 1000 1000"/);
  assert.ok((markup.match(/<path\b/g) ?? []).length > 0, "official SVG must contain vector paths");
  assert.doesNotMatch(markup, /<image\b|<filter\b|<feGaussianBlur\b/i, "embedded bitmap or blur in SVG");
  const intrinsic = await sharp(svg).metadata();
  assert.equal(intrinsic.width, 1000);
  assert.equal(intrinsic.height, 1000);

  for (const { size, ratio, maskable, filename } of variants) {
    await t.test(`${filename}`, async () => {
      const actual = await readFile(new URL(filename, brand));
      const meta = await sharp(actual).metadata();
      assert.equal(meta.format, "png");
      assert.equal(meta.width, size);
      assert.equal(meta.height, size);
      assert.equal(meta.channels, 3, "output must be opaque RGB, not RGBA");

      const markSize = Math.round(size * ratio);
      const offset = Math.floor((size - markSize) / 2);
      const scale = size <= 192 ? 4 : 1;
      const renderSize = size * scale;
      const renderMarkSize = markSize * scale;
      if (scale === 4) assert.ok([720, 768].includes(renderSize), "small icons must use a 4x source canvas");
      const density = 72 * renderMarkSize / intrinsic.width;
      const rasterizer = sharp(svg, { density });
      const rasterMeta = await rasterizer.metadata();
      assert.ok(rasterMeta.width >= renderMarkSize && rasterMeta.height >= renderMarkSize,
        "vector must be rasterized at no less than output mark resolution");
      const mark = await rasterizer.png().toBuffer();
      assert.equal((await sharp(mark).metadata()).width, renderMarkSize);
      const composited = await sharp({
        create: { width: renderSize, height: renderSize, channels: 3, background: "#ffffff" },
      }).composite([{ input: mark, left: offset * scale, top: offset * scale }])
        .flatten({ background: "#ffffff" }).removeAlpha().png().toBuffer();
      const expectedPng = scale === 4
        ? await sharp(composited).resize(size, size, { kernel: "lanczos3" }).removeAlpha().png().toBuffer()
        : composited;
      const expected = await sharp(expectedPng).raw().toBuffer();
      const pixels = await sharp(actual).raw().toBuffer();
      assert.ok(pixels.equals(expected), scale === 4
        ? "output does not match composited 4x SVG render downsampled with Lanczos3"
        : "output does not match direct SVG rasterization at this target size");
      let minX = size, minY = size, maxX = -1, maxY = -1;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 3;
          // Visible ink uses a fixed 15/255 contrast threshold to exclude
          // near-white Lanczos ringing, without shrinking the SVG viewport.
          if (pixels[i] < 240 || pixels[i + 1] < 240 || pixels[i + 2] < 240) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          }
          // Safe-zone validation includes even faint non-white halo pixels.
          if (maskable && (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255)) {
            assert.ok(Math.hypot(x + .5 - size / 2, y + .5 - size / 2) <= size * 0.4,
              `maskable ink outside 80%-diameter safe circle at ${x},${y}`);
          }
        }
      }
      assert.ok(maxX >= minX && maxY >= minY, "must contain actual ink");
      for (const diameter of [maxX - minX + 1, maxY - minY + 1]) {
        assert.ok(Math.abs(diameter / size - ratio) <= 0.01,
          `${filename} measured ring ${diameter}/${size} differs from ${ratio * 100}% by over 1%`);
      }
      assert.ok(Math.abs((minX + maxX + 1) / 2 - size / 2) <= 1);
      assert.ok(Math.abs((minY + maxY + 1) / 2 - size / 2) <= 1);
      for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1], [size >> 1, size >> 1]]) {
        const index = (y * size + x) * 3;
        assert.deepEqual([...pixels.subarray(index, index + 3)], [255, 255, 255]);
      }
      const onBlackPng = await sharp(actual).ensureAlpha().flatten({ background: "#000000" }).png().toBuffer();
      const onBlack = await sharp(onBlackPng).removeAlpha().raw().toBuffer();
      assert.ok(pixels.equals(onBlack), "output changes when placed on black");
    });
  }
});

test("180px before/after comparison uses exact 4x nearest-neighbor pixels", async () => {
  const before = await readFile(new URL("smart360-home-icon-180-previous-66-supersampled.png", reports));
  const after = await readFile(new URL("ikona-smart360-180.png", brand));
  assert.ok(!before.equals(after), "the supersampled 66% 180px approval must remain intact");
  const comparison = await readFile(new URL("smart360-home-icon-180-previous-66-vs-standard-74-4x-nearest.png", reports));
  const comparisonMeta = await sharp(comparison).metadata();
  assert.equal(comparisonMeta.width, 1520);
  assert.equal(comparisonMeta.height, 790);
  for (const [source, left] of [[before, 20], [after, 780]] as const) {
    const expected = await sharp(source).resize(720, 720, { kernel: "nearest" }).removeAlpha().raw().toBuffer();
    const panel = await sharp(comparison).extract({ left, top: 50, width: 720, height: 720 })
      .removeAlpha().raw().toBuffer();
    assert.ok(panel.equals(expected), "panel pixels must be an exact nearest-neighbor enlargement");
  }
});

test("source platform manifest separates standard and maskable icon assets", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../../smart360/public/manifest.webmanifest", import.meta.url), "utf8")) as {
    icons: { src: string; sizes: string; purpose: string }[];
  };
  assert.deepEqual(manifest.icons.map(({ src, sizes, purpose }) => [src, sizes, purpose]), [
    ["/brand/ikona-smart360-home-192.png?v=faceted-1", "192x192", "any"],
    ["/brand/ikona-smart360-512.png?v=faceted-1", "512x512", "any"],
    ["/brand/ikona-smart360-maskable-192.png?v=faceted-1", "192x192", "maskable"],
    ["/brand/ikona-smart360-maskable-512.png?v=faceted-1", "512x512", "maskable"],
  ]);
});

async function edgeContrast(buffer: Buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
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

test("native edge contrast is not softer than preserved old icons; blur negative control", async () => {
  const report = JSON.parse(await readFile(new URL("smart360-faceted-validation.json", reports), "utf8"));
  for (const size of [180, 192]) {
    const before = await readFile(new URL(`smart360-prefaceted-${size}.png`, reports));
    const after = await readFile(new URL(size === 180 ? "ikona-smart360-180.png" : "ikona-smart360-home-192.png", brand));
    assert.ok(!before.equals(after), "old artwork must be preserved independently");
    const oldScore = await edgeContrast(before), newScore = await edgeContrast(after);
    const stored = report.sharpness.find((s: { size: number }) => s.size === size);
    assert.ok(Math.abs(stored.oldScore - oldScore) < 1e-9);
    assert.ok(Math.abs(stored.newScore - newScore) < 1e-9);
    assert.ok(newScore >= oldScore, `${size}px softened: ${oldScore} -> ${newScore}`);
    const blurred = await sharp(after).blur(1).png().toBuffer();
    assert.ok(await edgeContrast(blurred) < newScore * 0.8, "metric must detect deliberate Gaussian blur");
  }
});

test("native evidence retains unscaled old/new pixels and HTML is self-contained", async () => {
  for (const size of [180, 192]) {
    const comparison = await readFile(new URL(`smart360-faceted-native-${size}.png`, reports));
    for (const [file, base, left] of [
      [`smart360-prefaceted-${size}.png`, reports, 20],
      [size === 180 ? "ikona-smart360-180.png" : "ikona-smart360-home-192.png", brand, 250],
    ] as const) {
      const source = await sharp(await readFile(new URL(file, base))).removeAlpha().raw().toBuffer();
      const crop = await sharp(comparison).extract({ left, top: 45, width: size, height: size }).removeAlpha().raw().toBuffer();
      assert.ok(crop.equals(source), "native comparison must not resample or obscure any icon pixels");
    }
  }
  const html = await readFile(new URL("smart360-faceted-comparison.html", reports), "utf8");
  assert.equal((html.match(/src="data:image\/png;base64,/g) ?? []).length, 4);
  assert.doesNotMatch(html, /(?:src|href)="https?:/);
  assert.match(html, /NOT actual iOS\/Android screenshots/);
  assert.match(html, /Turizem Drobež and Meli Pu/);
});