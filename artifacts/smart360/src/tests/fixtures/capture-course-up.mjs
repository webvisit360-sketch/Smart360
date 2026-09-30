// Development-only browser acceptance against the real GPX and free-tour components.
// GPS is synthetic inside this browser only; no API or tenant data is changed.
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
  await page.addInitScript(() => {
    let callback;
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      watchPosition: success => { callback = success; return 1; },
      clearWatch: () => { callback = null; },
    } });
    window.emitCourseFix = (heading, speed, meters = 0) => callback?.({
      timestamp: Date.now(),
      coords: { latitude: 45.536 + meters / 111195, longitude: 13.66, accuracy: 5,
        altitude: 5, altitudeAccuracy: 5, heading, speed },
    });
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async () => {
      const lock = new EventTarget();
      lock.released = false;
      lock.release = async () => { lock.released = true; lock.dispatchEvent(new Event("release")); };
      return lock;
    } } });
  });
  await mkdir("screenshots", { recursive: true });
  const bearing = async () => Number(await page.getByTestId("map-gpx").getAttribute("data-camera-bearing"));
  const fix = async (heading, speed, meters) => {
    await page.evaluate(([h, s, m]) => window.emitCourseFix(h, s, m), [heading, speed, meters]);
    await page.waitForTimeout(550);
  };
  for (const [name, path, start] of [
    ["gpx", "/src/tests/fixtures/live-tour.html", "button-tour-start"],
    ["free", "/free-tour.html?externalGps=1", "button-free-tour-start"],
  ]) {
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}${path}`);
    await page.getByTestId(start).click();
    assert.equal(await page.getByTestId("button-tour-course-toggle").getAttribute("aria-pressed"), "true", `${name}: starts course-up`);
    await page.getByTestId("map-gpx").locator(".maplibregl-canvas").waitFor();
    await page.waitForTimeout(800);
    await fix(350, 3, 0);
    assert.ok(Math.abs((await bearing()) - 350) < 5 || Math.abs((await bearing()) + 10) < 5, `${name}: bearing 350`);
    await fix(10, 3, 15);
    assert.ok(Math.abs((await bearing()) - 10) < 5, `${name}: shortest 350→10 turn`);
    await fix(null, 3, 25);
    assert.ok(Math.abs((await bearing()) - 10) < 5, `${name}: null heading frozen`);
    await fix(100, 0.5, 30);
    assert.ok(Math.abs((await bearing()) - 10) < 5, `${name}: slow speed frozen`);
    await page.screenshot({ path: `screenshots/${name}-course-up.png` });
    await page.getByTestId("button-tour-fullscreen").click();
    await page.getByTestId("button-tour-compass").waitFor();
    await page.screenshot({ path: `screenshots/${name}-course-compass.png` });
    await page.getByTestId("button-tour-exit-fullscreen").click();
    await page.getByTestId("button-tour-pause").click();
    await fix(150, 3, 35);
    assert.ok(Math.abs((await bearing()) - 10) < 5, `${name}: pause freezes rotation`);
    await page.getByTestId("button-tour-compass").click();
    await page.waitForTimeout(400);
    assert.ok(Math.abs(await bearing()) < 1, `${name}: compass resets north`);
    assert.equal(await page.getByTestId("button-tour-course-toggle").getAttribute("aria-pressed"), "false");
    // In north mode the GPX camera stays where the user left it; the free
    // recorder can fit its track, but a fix already inside the view must not
    // trigger course-follow recentering or zoom.
    await page.waitForTimeout(550);
    const before = await page.getByTestId("map-gpx").evaluate(el => ({
      center: JSON.parse(el.dataset.cameraCenter), zoom: Number(el.dataset.cameraZoom),
    }));
    await fix(90, 3, 36);
    const after = await page.getByTestId("map-gpx").evaluate(el => ({
      center: JSON.parse(el.dataset.cameraCenter), zoom: Number(el.dataset.cameraZoom),
    }));
    assert.ok(Math.abs(before.center[0] - after.center[0]) < 1e-7 &&
      Math.abs(before.center[1] - after.center[1]) < 1e-7 &&
      Math.abs(before.zoom - after.zoom) < 1e-7, `${name}: north mode must not course-follow`);
    await page.reload();
    assert.equal(await page.getByTestId("button-tour-course-toggle").getAttribute("aria-pressed"), "false", `${name}: same tour north restored`);
    await page.getByTestId("button-tour-finish").click();
    await page.getByTestId("panel-tour-result").waitFor();
    assert.equal(await page.getByTestId("button-tour-course-toggle").count(), 0, `${name}: inactive has no course control`);
    assert.ok(Math.abs(await bearing()) < 1, `${name}: inactive north`);
    await page.getByTestId("button-tour-reset").click();
    await page.getByTestId(start).click();
    assert.equal(await page.getByTestId("button-tour-course-toggle").getAttribute("aria-pressed"), "true", `${name}: NEW tour starts course-up`);
    console.log(name, "course, shortest turn, freeze, pause, compass, reload, finish and new tour OK");
  }
  assert.ok(tiles.some(status => status === 200), "real vector tile must render");
  console.log("VECTOR_TILE_200", tiles.filter(status => status === 200).length);
} finally {
  await browser.close();
}