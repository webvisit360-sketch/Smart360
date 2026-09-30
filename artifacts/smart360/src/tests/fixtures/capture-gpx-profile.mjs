// Local development-only visual verification. Requires the already-running Vite preview.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    let callback;
    let errorCallback;
    Object.defineProperty(navigator, "geolocation", { value: {
      watchPosition: (success, error) => { callback = success; errorCallback = error; return 1; },
      clearWatch: () => { callback = undefined; errorCallback = undefined; },
    } });
    Object.defineProperty(navigator, "wakeLock", { value: { request: async () => {
      const lock = new EventTarget();
      lock.released = false;
      lock.release = async () => { lock.released = true; lock.dispatchEvent(new Event("release")); };
      return lock;
    } } });
    window.emitProfileFix = (lat, lon, accuracy = 5) => callback?.({
      timestamp: Date.now(), coords: { latitude: lat, longitude: lon, accuracy, altitude: 5 },
    });
    window.emitProfileError = () => errorCallback?.({ code: 3 });
  });
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/src/tests/fixtures/live-tour.html`);
  await page.getByTestId("button-gpx-locate").click();
  await page.evaluate(() => window.emitProfileFix(45.5365, 13.66));
  await page.getByTestId("profile-remaining").waitFor();
  await page.waitForTimeout(1200);
  const normal = page.getByTestId("profile-normal");
  assert.match(await normal.innerText(), /še 0,3 km/);
  assert.equal(await normal.locator(".recharts-reference-dot").count(), 1);
  const normalDot = await normal.locator(".recharts-reference-dot").boundingBox();
  const normalChart = await normal.locator(".recharts-surface").boundingBox();
  assert.ok(normalDot && normalChart && normalDot.x > normalChart.x && normalDot.x < normalChart.x + normalChart.width);
  // Regression: reference dot must be precisely on the visible linear elevation stroke,
  // not on a linear estimate while Recharts draws a curved monotone interpolation.
  const alignment = await normal.evaluate(figure => {
    const dot = figure.querySelector(".recharts-reference-dot circle");
    const curve = figure.querySelector(".recharts-area-curve");
    const path = curve?.getAttribute("d") ?? "";
    const vertices = [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(match => [Number(match[1]), Number(match[2])]);
    const x = Number(dot?.getAttribute("cx")), y = Number(dot?.getAttribute("cy"));
    const edge = vertices.findIndex((point, i) => i + 1 < vertices.length && x >= point[0] && x <= vertices[i + 1][0]);
    const expectedY = edge < 0 ? NaN : vertices[edge][1] +
      (vertices[edge + 1][1] - vertices[edge][1]) * (x - vertices[edge][0]) / (vertices[edge + 1][0] - vertices[edge][0]);
    return { path, errorPx: Math.abs(y - expectedY) };
  });
  assert.doesNotMatch(alignment.path, /C|Q|S/);
  assert.ok(alignment.errorPx < 0.1, `Dot misses plotted line by ${alignment.errorPx}px`);
  const initialDot = await normal.locator(".recharts-reference-dot circle").getAttribute("cx");
  await mkdir("screenshots", { recursive: true });
  await normal.screenshot({ path: "screenshots/gpx-profile-normal-on.png" });
  // Accuracy worse than the tour's 30m gate cannot move the marker.
  await page.evaluate(() => window.emitProfileFix(45.54, 13.66, 31));
  assert.equal(await normal.locator(".recharts-reference-dot circle").getAttribute("cx"), initialDot);
  await page.evaluate(() => window.emitProfileFix(45.5365, 13.663));
  await page.getByTestId("profile-offroute").waitFor();
  assert.equal(await normal.locator(".recharts-reference-dot").count(), 0);
  await normal.screenshot({ path: "screenshots/gpx-profile-normal-off.png" });
  await page.getByTestId("button-gpx-locate").click();
  assert.equal(await normal.getByTestId("profile-offroute").count(), 0);
  assert.equal(await normal.getByTestId("profile-remaining").count(), 0);
  await page.getByTestId("button-tour-start").click();
  await page.evaluate(() => window.emitProfileFix(45.5365, 13.66));
  await page.getByTestId("button-tour-fullscreen").click();
  const full = page.getByTestId("profile-fullscreen");
  await full.getByTestId("profile-remaining").waitFor();
  await page.waitForTimeout(1200);
  const strip = await full.boundingBox();
  const attribution = await page.locator(".s360-gpx-full .s360-gpx-attrib").boundingBox();
  assert.ok(strip && attribution && strip.y + strip.height <= attribution.y);
  assert.equal(await full.locator(".recharts-reference-dot").count(), 1);
  await page.screenshot({ path: "screenshots/gpx-profile-fullscreen-on.png" });
  await page.evaluate(() => window.emitProfileError());
  await full.getByTestId("profile-remaining").waitFor({ state: "detached" });
  assert.equal(await full.locator(".recharts-reference-dot").count(), 0);
  await page.evaluate(() => window.emitProfileFix(45.5365, 13.66));
  await full.getByTestId("profile-remaining").waitFor();
  await page.evaluate(() => window.emitProfileFix(45.5365, 13.663));
  await full.getByTestId("profile-offroute").waitFor();
  assert.equal(await full.locator(".recharts-reference-dot").count(), 0);
  await page.screenshot({ path: "screenshots/gpx-profile-fullscreen-off.png" });
  await page.getByTestId("button-tour-exit-fullscreen").click();
  await page.getByTestId("button-tour-pause").click();
  await page.evaluate(() => window.emitProfileFix(45.537, 13.66));
  await normal.locator(".recharts-reference-dot").waitFor();
  assert.equal(await normal.locator(".recharts-reference-dot").count(), 1);
  assert.match(await normal.getByTestId("profile-remaining").innerText(), /še 0,3 km/);
  await normal.screenshot({ path: "screenshots/gpx-profile-manual-pause.png" });
  await page.getByTestId("button-tour-finish").click();
  await normal.getByTestId("profile-remaining").waitFor({ state: "detached" });
  assert.equal(await normal.locator(".recharts-reference-dot").count(), 0);
  console.log("Profile marker bounds:", normalDot, "fullscreen strip:", strip, "attribution:", attribution);
} finally { await browser.close(); }