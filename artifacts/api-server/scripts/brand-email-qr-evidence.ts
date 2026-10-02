// Offline synthetic fixtures only: no route import, DB, auth, or delivery.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { chromium } from "@playwright/test";
import { makeGuideSticker, makeGuideStickers } from "../src/lib/guideStickers";

const root = resolve(import.meta.dirname, "../../..");
const out = resolve(root, "reports/brand-unification");
await mkdir(out, { recursive: true });
const after = await readFile(resolve(root, "artifacts/smart360/public/brand/smart360-email-lockup-host-594x138.png"));
const measurements = [];
for (const [name, bytes] of [["canonical", after]] as const) {
  const m = await sharp(bytes).metadata();
  assert.equal(m.width, 594);
  assert.equal(m.height, 138);
  assert.equal(m.channels, 3);
  measurements.push({ name, width: m.width, height: m.height, channels: m.channels, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
}
const html = `<!doctype html><meta charset="utf-8"><title>Canonical email artwork</title><body style="background:white;font:16px Arial;padding:32px"><h1>Canonical faceted email artwork only</h1><h2>Displayed 198 × 46</h2><img width="198" height="46" src="data:image/png;base64,${after.toString("base64")}"><h3>Native 594 × 138</h3><img width="594" height="138" src="data:image/png;base64,${after.toString("base64")}"></body>`;
await writeFile(resolve(out, "email-canonical.html"), html);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(), args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 720 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.locator("img").evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
  await page.screenshot({ path: resolve(out, "email-canonical.png"), fullPage: true });
} finally { await browser.close(); }

// Verify both delivery and admin paths use the shared generator, without DB access.
const source = await readFile(resolve(root, "artifacts/api-server/src/routes/adminTenants.ts"), "utf8");
assert.ok(source.includes("makeGuideSticker(tenant.name, url, size)"));
const fixture = { name: "Offline fixture accommodation", slug: "offline-fixture" };
const url = "https://example.invalid/offline-fixture";
const stickers = await makeGuideStickers(fixture.name, url);
for (const size of ["large", "small"] as const) {
  const labelPath = resolve(out, `qr-admin-label-${size}.pdf`);
  await writeFile(labelPath, await makeGuideSticker(fixture.name, url, size));
  execFileSync("pdftoppm", ["-singlefile", "-scale-to", "1000", "-png", labelPath, labelPath.replace(".pdf", "")]);
  const stickerPath = resolve(out, `qr-ready-sticker-${size}.pdf`);
  await writeFile(stickerPath, stickers[size]);
  execFileSync("pdftoppm", ["-singlefile", "-scale-to", "1000", "-png", stickerPath, stickerPath.replace(".pdf", "")]);
  assert.deepEqual(await readFile(labelPath.replace(".pdf", ".png")), await readFile(stickerPath.replace(".pdf", ".png")));
}
await writeFile(resolve(out, "email-qr-measurements.json"), JSON.stringify({
  email: measurements, display: [198, 46],
  qrArtwork: "Shared large and small stickers for admin download and ready email.",
  qrAdminAndEmailIdentical: true,
  fixture: "Isolated example.invalid tenant; both current sizes rendered through shared generators. No historical PDF claim.",
  sideEffects: "No DB, auth, send or publish",
}, null, 2));
console.log("Canonical email byte metadata, native/display artwork and actual QR generator fixtures verified.");