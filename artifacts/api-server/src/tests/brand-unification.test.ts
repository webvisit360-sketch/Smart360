import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import sharp from "sharp";

const brand = new URL("../../../smart360/public/brand/", import.meta.url);
const baseline = new URL("../../../../reports/brand-unification/before/brand/", import.meta.url);
const svg = await readFile(new URL("smart360-kolobar-faceted.svg", brand));
async function render(size: number, markSize: number, offset: number, background: string) {
  const mark = await sharp(svg, { density: 72 * markSize * 4 / 1000 }).png().toBuffer();
  const large = await sharp({ create: { width: size * 4, height: size * 4, channels: 3, background } })
    .composite([{ input: mark, left: offset * 4, top: offset * 4 }]).png().toBuffer();
  const downsampled = await sharp(large).resize(size, size, { kernel: "lanczos3" }).removeAlpha().png().toBuffer();
  if (offset) {
    const tile = await sharp(downsampled).extract({ left: offset, top: offset, width: markSize, height: markSize }).png().toBuffer();
    return sharp({ create: { width: size, height: size, channels: 3, background } }).composite([{ input: tile, left: offset, top: offset }]).removeAlpha().raw().toBuffer();
  }
  return sharp(downsampled).raw().toBuffer();
}
test("generic marks and dark favicon derive from canonical vector at 4x Lanczos3 with unchanged dimensions", async () => {
  for (const [filename, size, markSize, offset, background] of [
    ["smart360-znak-40.png", 80, 80, 0, "#ffffff"],
    ["smart360-email-header-60.png", 60, 60, 0, "#ffffff"],
    ["smart360-email-header-138.png", 138, 138, 0, "#ffffff"],
    ["ikona-smart360-192.png", 192, 142, 25, "#121a14"],
  ] as const) {
    const current = await readFile(new URL(filename, brand));
    const a = await sharp(current).metadata();
    assert.deepEqual([a.width, a.height], [size, size]);
    assert.ok((await sharp(current).removeAlpha().raw().toBuffer()).equals(await render(size, markSize, offset, background)), filename);
  }
});
test("wordmark-only blue logo and already-faceted home icons remain byte-identical", async () => {
  for (const filename of ["logo-smart360-moder.png", "ikona-smart360-180.png", "ikona-smart360-home-192.png", "ikona-smart360-512.png", "ikona-smart360-1024.png", "ikona-smart360-maskable-192.png", "ikona-smart360-maskable-512.png", "smart360-kolobar-faceted.svg"]) {
    assert.ok((await readFile(new URL(filename, brand))).equals(await readFile(new URL(filename, baseline))), filename);
  }
});
test("legacy email lockup retains its dimensions and canonical mark square", async () => {
  const name = "smart360-email-lockup-558x138.png";
  const current = await readFile(new URL(name, brand));
  const meta = await sharp(current).metadata();
  assert.deepEqual([meta.width, meta.height], [558, 138]);
  const mark = await sharp(current).extract({ left: 0, top: 0, width: 138, height: 138 }).removeAlpha().raw().toBuffer();
  assert.ok(mark.equals(await render(138, 138, 0, "#ffffff")));
});