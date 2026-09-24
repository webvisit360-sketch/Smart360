import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import sharp from "sharp";

const brand = new URL("../../../smart360/public/brand/", import.meta.url);
const reports = new URL("../../../../reports/", import.meta.url);
const svg = await readFile(new URL("smart360-kolobar-temno.svg", brand));

test("home-screen icons render the official vector on opaque white", async (t) => {
  const markup = svg.toString();
  assert.match(markup, /viewBox="0 0 1000 1000"/);
  assert.ok((markup.match(/<path\b/g) ?? []).length > 0, "official SVG must contain vector paths");
  assert.doesNotMatch(markup, /<image\b|<filter\b|<feGaussianBlur\b/i, "embedded bitmap or blur in SVG");
  const intrinsic = await sharp(svg).metadata();
  assert.equal(intrinsic.width, 1000);
  assert.equal(intrinsic.height, 1000);

  for (const size of [180, 192, 512, 1024]) {
    await t.test(`${size}x${size}`, async () => {
      const filename = size === 192 ? "ikona-smart360-home-192.png" : `ikona-smart360-${size}.png`;
      const actual = await readFile(new URL(filename, brand));
      const meta = await sharp(actual).metadata();
      assert.equal(meta.format, "png");
      assert.equal(meta.width, size);
      assert.equal(meta.height, size);
      assert.equal(meta.channels, 3, "output must be opaque RGB, not RGBA");

      const markSize = Math.round(size * 0.66);
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
  const before = await readFile(new URL("smart360-home-icon-180-before-supersampling.png", reports));
  const after = await readFile(new URL("ikona-smart360-180.png", brand));
  assert.ok(!before.equals(after), "the original 180px approval must remain intact");
  const comparison = await readFile(new URL("smart360-home-icon-180-old-vs-new-4x-nearest.png", reports));
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