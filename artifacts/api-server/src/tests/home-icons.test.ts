import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import sharp from "sharp";

const brand = new URL("../../../smart360/public/brand/", import.meta.url);
const svg = await readFile(new URL("smart360-kolobar-temno.svg", brand));

test("home-screen icons are native-resolution renders of the official vector on opaque white", async (t) => {
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
      const density = 72 * markSize / intrinsic.width;
      const rasterizer = sharp(svg, { density });
      const rasterMeta = await rasterizer.metadata();
      assert.ok(rasterMeta.width >= markSize && rasterMeta.height >= markSize,
        "vector must be rasterized at no less than output mark resolution");
      const mark = await rasterizer.png().toBuffer();
      assert.equal((await sharp(mark).metadata()).width, markSize);
      const expected = await sharp({
        create: { width: size, height: size, channels: 3, background: "#ffffff" },
      }).composite([{ input: mark, left: offset, top: offset }]).removeAlpha().raw().toBuffer();
      const pixels = await sharp(actual).raw().toBuffer();
      assert.ok(pixels.equals(expected), "output does not match direct SVG rasterization at this target size");
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