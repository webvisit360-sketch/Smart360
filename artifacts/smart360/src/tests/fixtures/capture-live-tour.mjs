// Development-only visual verification with WebGL2/SwiftShader.
// Synthetic GPS stays inside this browser context; no tenant or database writes.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const responses = [];
  page.on("response", r => { if (/openfreemap/.test(r.url())) responses.push([r.status(), r.url()]); });
  await page.addInitScript(() => {
    let callback;
    Object.defineProperty(navigator, "geolocation", { value: {
      watchPosition: success => { callback = success; return 1; },
      clearWatch: () => { callback = null; },
    } });
    Object.defineProperty(navigator, "wakeLock", { value: { request: async () => {
      const lock = new EventTarget();
      lock.released = false;
      lock.release = async () => { lock.released = true; lock.dispatchEvent(new Event("release")); };
      return lock;
    } } });
    window.emitTourFix = (meters) => callback?.({
      timestamp: Date.now(), coords: {
        latitude: 45.536 + meters / 111195, longitude: 13.66,
        accuracy: 5, altitude: 5, altitudeAccuracy: 5, heading: null, speed: null,
      },
    });
  });
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/src/tests/fixtures/live-tour.html?activity=running`);
  await page.getByTestId("button-tour-start").waitFor();
  const badge = page.getByTestId("badge-gpx-activity");
  assert.equal(await badge.innerText(), "Tek");
  const badgeBounds = await badge.boundingBox();
  const headingBounds = await page.getByRole("heading", { name: "Obalna testna pot" }).boundingBox();
  assert.ok(badgeBounds && headingBounds && badgeBounds.x >= headingBounds.x + headingBounds.width &&
    badgeBounds.x + badgeBounds.width <= 390, "badge must fit beside heading at 390px");
  console.log("RUNNING_BADGE_BOUNDS_390", badgeBounds, headingBounds);
  await page.waitForTimeout(7000);
  await mkdir("screenshots", { recursive: true });
  await page.screenshot({ path: "screenshots/running-guest-gpx-detail.png" });
  await page.screenshot({ path: "screenshots/live-tour-entry-webgl.png" });
  await page.getByTestId("button-tour-start").click();
  await page.waitForTimeout(100);
  await page.evaluate(() => window.emitTourFix(0));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.emitTourFix(25));
  await page.getByTestId("button-tour-fullscreen").click();
  await page.waitForTimeout(1000);
  console.log("FULLSCREEN", await page.getByTestId("dialog-tour-fullscreen").boundingBox());
  console.log("CANVAS", await page.locator(".maplibregl-canvas").boundingBox());
  console.log("OVERLAY", await page.getByTestId("overlay-tour-timer").boundingBox());
  await page.screenshot({ path: "screenshots/live-tour-fullscreen-webgl.png" });
  await page.getByTestId("button-tour-exit-fullscreen").click();
  await page.getByTestId("button-tour-finish").click();
  await page.getByTestId("panel-tour-result").waitFor();
  await page.getByTestId("lg-gpx-route").screenshot({ path: "screenshots/live-tour-result-webgl.png" });
  console.log("VECTOR_RESPONSES", JSON.stringify(responses));
  console.log("WEBGL2", await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2")));
} finally { await browser.close(); }