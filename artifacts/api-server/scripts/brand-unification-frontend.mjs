// Canonical-only generic mark generator. No historical artwork inputs or modes.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const brand = path.join(root, "artifacts/smart360/public/brand");
if (process.argv[2] !== "generate") throw new Error("Usage: brand-unification-frontend.mjs generate");
const svg = await readFile(path.join(brand, "smart360-kolobar-faceted.svg"));
async function renderMark(size, background) {
  const mark = await sharp(svg, { density: 72 * size * 4 / 1000 }).png().toBuffer();
  const large = await sharp({ create: { width: size * 4, height: size * 4, channels: 4, background } })
    .composite([{ input: mark }]).png().toBuffer();
  return sharp(large).resize(size, size, { kernel: "lanczos3" }).png().toBuffer();
}
for (const [name, size] of [["smart360-znak-40.png", 80], ["smart360-email-header-60.png", 60], ["smart360-email-header-138.png", 138]]) {
  await writeFile(path.join(brand, name), await sharp(await renderMark(size, "#ffffff")).removeAlpha().png().toBuffer());
}
// Keep only the current wordmark pixels; never require an old lockup baseline.
const lockup = await readFile(path.join(brand, "smart360-email-lockup-558x138.png"));
const wordmark = await sharp(lockup).extract({ left: 138, top: 0, width: 420, height: 138 }).png().toBuffer();
const updated = await sharp({ create: { width: 558, height: 138, channels: 3, background: "#ffffff" } })
  .composite([{ input: wordmark, left: 138, top: 0 }, { input: await renderMark(138, "#ffffff"), left: 0, top: 0 }])
  .removeAlpha().png().toBuffer();
await writeFile(path.join(brand, "smart360-email-lockup-558x138.png"), updated);
const mark = await sharp(svg, { density: 72 * 142 * 4 / 1000 }).png().toBuffer();
const large = await sharp({ create: { width: 768, height: 768, channels: 3, background: "#121a14" } })
  .composite([{ input: mark, top: 100, left: 100 }]).png().toBuffer();
const downsampled = await sharp(large).resize(192, 192, { kernel: "lanczos3" }).png().toBuffer();
const tile = await sharp(downsampled).extract({ left: 25, top: 25, width: 142, height: 142 }).png().toBuffer();
await sharp({ create: { width: 192, height: 192, channels: 3, background: "#121a14" } })
  .composite([{ input: tile, top: 25, left: 25 }]).removeAlpha().png().toFile(path.join(brand, "ikona-smart360-192.png"));
console.log("Generated canonical generic/email marks, lockup mark and dark favicon; home icons and wordmark untouched.");