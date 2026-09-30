// Development-only visual verification. Real components, synthetic device GPS.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const tiles = [];
  page.on("response", r => { if (/openfreemap.*\.pbf/.test(r.url())) tiles.push(r.status()); });
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/free-tour.html`);
  await page.getByTestId("button-free-tour-start").waitFor();
  console.log("SELECTED_STYLE", await page.locator(".s360-free-choice.is-on").evaluate(el => ({
    color: getComputedStyle(el).color, border: getComputedStyle(el).borderColor,
  })));
  await mkdir("screenshots", { recursive: true });
  await page.screenshot({ path: "screenshots/free-tour-card.png", fullPage: true });
  await page.getByTestId("radio-free-activity-cycling").check();
  await page.getByTestId("button-free-tour-start").click();
  await page.waitForTimeout(15000);
  const distance = await page.getByTestId("text-tour-distance").innerText();
  assert.notEqual(distance.trim(), "0 m", "slow consecutive GPS steps must accumulate");
  console.log("DISTANCE", distance, "ASCENT", await page.getByTestId("text-free-tour-ascent").innerText());
  await page.screenshot({ path: "screenshots/free-tour-live.png", fullPage: true });
  await page.getByTestId("button-tour-fullscreen").click();
  await page.waitForTimeout(800);
  console.log("FULLSCREEN", await page.getByTestId("dialog-tour-fullscreen").boundingBox());
  console.log("PROFILE", await page.getByTestId("profile-free-fullscreen").boundingBox());
  console.log("TIMER", await page.getByTestId("overlay-tour-timer").boundingBox());
  console.log("POSITION_DOT", await page.locator(".s360-gpx-marker--me").boundingBox());
  await page.screenshot({ path: "screenshots/free-tour-fullscreen.png" });
  await page.getByTestId("button-tour-exit-fullscreen").click();
  await page.getByTestId("button-tour-finish").click();
  await page.getByTestId("panel-tour-result").waitFor();
  await page.screenshot({ path: "screenshots/free-tour-summary.png", fullPage: true });
  for (const [button, name] of [["button-tour-download-image", "free-tour.png"], ["button-tour-download-gpx", "free-tour.gpx"]]) {
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId(button).click();
    const download = await downloadPromise;
    assert.equal(await download.failure(), null);
    await download.saveAs(`screenshots/${name}`);
    console.log("EXPORT", name, "OK");
  }
  console.log("TILES", tiles, "WEBGL2", await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2")));
} finally { await browser.close(); }