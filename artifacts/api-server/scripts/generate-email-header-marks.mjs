// Run: node artifacts/api-server/scripts/generate-email-header-marks.mjs
// One canonical lockup: official vector + actual Archivo-800; no SVG fallback font.
// Composite on white at 4x the final 3x-retina raster, Lanczos3 downsample last.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const brand = path.join(root, "artifacts/smart360/public/brand");
const vector = await readFile(path.join(brand, "smart360-kolobar-temno.svg"));
const font = await readFile(path.join(root, "artifacts/api-server/assets/Archivo-800.ttf"));
const svgMeta = await sharp(vector).metadata();
assert.equal(svgMeta.width, 1000);
assert.equal(svgMeta.height, 1000);
assert.ok(!/<image\b|<filter\b|<feGaussianBlur\b/i.test(vector.toString()));
const displayHeight = 46, retina = 3, scale = 4;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"], headless: true,
});
let raster;
try {
  const page = await browser.newPage();
  raster = await page.evaluate(async ({ svg, ttf, height, retina, scale }) => {
    const fontFace = new FontFace("OfficialArchivo800", `url(data:font/ttf;base64,${ttf})`, { weight: "800" });
    await fontFace.load();
    document.fonts.add(fontFace);
    await document.fonts.load("800 24px OfficialArchivo800", "SMART360");
    if (!document.fonts.check("800 24px OfficialArchivo800", "SMART360")) throw new Error("Official Archivo-800 font did not load");
    const img = new Image();
    img.src = `data:image/svg+xml;base64,${svg}`;
    await img.decode();
    const measure = document.createElement("canvas").getContext("2d");
    if (!measure) throw new Error("Canvas 2D is unavailable");
    measure.font = "800 24px OfficialArchivo800";
    const text = "SMART360";
    const tracking = 24 * 0.02;
    const wordWidth = [...text].reduce((sum, letter) => sum + measure.measureText(letter).width, 0) + (text.length - 1) * tracking;
    const displayWidth = Math.ceil(height + 12 + wordWidth);
    const width = displayWidth * retina;
    const outputHeight = height * retina;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = outputHeight * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, outputHeight * scale, outputHeight * scale);
    const size = 24 * retina * scale;
    ctx.font = `800 ${size}px OfficialArchivo800`;
    ctx.fillStyle = "#121A14";
    ctx.textBaseline = "middle";
    const trackingAtRender = 0.02 * size;
    let x = (height + 12) * retina * scale;
    const extent = [...text].reduce((sum, letter) => sum + ctx.measureText(letter).width + trackingAtRender, 0) - trackingAtRender;
    if (x + extent > canvas.width) throw new Error(`Lockup wordmark exceeds canvas (${x + extent}/${canvas.width})`);
    for (const letter of text) {
      ctx.fillText(letter, x, canvas.height / 2);
      x += ctx.measureText(letter).width + trackingAtRender;
    }
    return { base64: canvas.toDataURL("image/png").split(",")[1], displayWidth, wordWidth };
  }, {
    svg: vector.toString("base64"), ttf: font.toString("base64"),
    height: displayHeight, retina, scale,
  });
  await page.close();
} finally {
  await browser.close();
}
const outputWidth = raster.displayWidth * retina, outputHeight = displayHeight * retina;
const composite = Buffer.from(raster.base64, "base64");
const final = await sharp(composite).flatten({ background: "#FFFFFF" })
  .resize(outputWidth, outputHeight, { kernel: "lanczos3" }).removeAlpha().png().toBuffer();
const output = path.join(brand, `smart360-email-lockup-host-${outputWidth}x${outputHeight}.png`);
await writeFile(output, final);
const meta = await sharp(output).metadata();
assert.equal(meta.width, outputWidth);
assert.equal(meta.height, outputHeight);
assert.equal(meta.channels, 3);
console.log(`Official SVG + verified Archivo-800 24px #121A14 at 0.02em: glyph width ${raster.wordWidth.toFixed(3)}px, gap 12px, display ${raster.displayWidth}x${displayHeight}px, asset ${outputWidth}x${outputHeight} RGB.`);