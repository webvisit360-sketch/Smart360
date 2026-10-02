// Generate only the shared email top edge; never modifies TOUR or app UI.
// Run: node artifacts/api-server/scripts/generate-email-signature.mjs
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const source = await readFile(path.join(root, "artifacts/smart360/src/lib/tour-summary-render.ts"), "utf8");
const literal = source.match(/stops:\s*(\[\[.*?\]\])/s)?.[1];
assert.ok(literal, "TOUR export gradient stops missing");
const stops = JSON.parse(literal.replaceAll("'", '"'));
assert.deepEqual(stops, [[0, "#E8862E"], [0.30, "#2F72C4"], [0.55, "#3E9E4E"], [0.80, "#F5C62E"], [1, "#E8862E"]]);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const radius of [14, 16]) {
    const data = await page.evaluate(({ stops, radius }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1116; canvas.height = 8;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D unavailable");
      ctx.scale(2, 2);
      // The card has a 1px border: clip to its inner radius, not outer radius.
      ctx.beginPath();
      ctx.roundRect(0, 0, 558, 100, radius - 1);
      ctx.clip();
      const gradient = ctx.createLinearGradient(0, 0, 558, 0);
      for (const [offset, color] of stops) gradient.addColorStop(offset, color);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 558, 4);
      return canvas.toDataURL("image/png").split(",")[1];
    }, { stops, radius });
    const png = await sharp(Buffer.from(data, "base64")).png().toBuffer();
    const meta = await sharp(png).metadata();
    assert.equal(meta.width, 1116); assert.equal(meta.height, 8);
    assert.equal(meta.hasAlpha, true);
    const filename = `smart360-email-signature-r${radius}-1116x8.png`;
    await writeFile(path.join(root, "artifacts/smart360/public/brand", filename), png);
    console.log(`${filename}: 1116x8 RGBA, displayed 558x4, outer radius ${radius}, stops ${JSON.stringify(stops)}`);
  }
} finally {
  await browser.close();
}