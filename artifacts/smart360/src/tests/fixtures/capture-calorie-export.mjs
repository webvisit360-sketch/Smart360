// Focused DEV-only PNG export layout check. Real free-tour component, synthetic GPS, no account/tenant.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  headless: true, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const evidence = {};
await mkdir("screenshots", { recursive: true });
try {
  for (const lang of ["sl", "en", "de", "it"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await context.addInitScript(() => {
      localStorage.setItem("smart360:tour-profile-intro:v1", "yes");
      localStorage.setItem("smart360:tour-profile:v1", JSON.stringify({ weightKg: 70, sex: "female" }));
      let callback = null, tick = 0;
      Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
        watchPosition: fn => { callback = fn; return 1; }, clearWatch: () => { callback = null; },
      } });
      Object.defineProperty(navigator, "wakeLock", { configurable: true, value: {
        request: async () => ({ released: false, release: async () => undefined, addEventListener: () => undefined }),
      } });
      window.emitFix = () => {
        tick++;
        callback?.({ timestamp: Date.now() + tick * 5000, coords: {
          latitude: 45.536 + tick * 25 / 111195, longitude: 13.66,
          altitude: 5 + tick * 1.25, altitudeAccuracy: 5, accuracy: 3, heading: null, speed: null,
        } });
      };
      window.exportTexts = [];
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
        if (y >= 180 && y <= 350) {
          const width = this.measureText(String(text)).width;
          window.exportTexts.push({ text: String(text), x, y, width, maxWidth, effectiveWidth: Math.min(width, maxWidth ?? width) });
        }
        return original.call(this, text, x, y, maxWidth);
      };
    });
    const page = await context.newPage();
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/free-tour.html?externalGps=1&lang=${lang}`);
    await page.getByTestId("radio-free-activity-running").check();
    await page.getByTestId("button-free-tour-start").click();
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.emitFix());
      await page.waitForTimeout(85);
    }
    await page.getByTestId("button-tour-finish").click();
    const downloadEvent = page.waitForEvent("download");
    await page.getByTestId("button-tour-download-image").click();
    const file = await downloadEvent;
    assert.equal(await file.failure(), null);
    await file.saveAs(`screenshots/calorie-export-layout-${lang}.png`);
    if (lang === "sl") await file.saveAs("screenshots/calorie-running.png");
    const rows = await page.evaluate(() => window.exportTexts);
    assert.ok(rows.length >= 12, `${lang}: six labels and six values must be drawn`);
    assert.ok(rows.some(row => row.text.includes("kcal")), `${lang}: localized kcal value`);
    assert.ok(rows.some(row => row.y >= 295 && row.y < 350), `${lang}: second stats row`);
    for (const row of rows) {
      const col = Math.round((row.x - 64) / (1072 / 3));
      const right = 64 + (col + 1) * 1072 / 3 - 12;
      assert.ok(row.x + row.effectiveWidth <= right + 1, `${lang}: ${row.text} overflows column: ${JSON.stringify(row)}`);
    }
    evidence[lang] = rows;
    await context.close();
  }
  await writeFile("screenshots/calorie-export-bounds.json", JSON.stringify(evidence, null, 2));
  console.log("Six-stat PNG SL/EN/DE/IT: all canvas-measured labels and values fit three-column two-row grid.");
} finally { await browser.close(); }