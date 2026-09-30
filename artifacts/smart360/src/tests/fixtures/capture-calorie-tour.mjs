// DEV-only single Chromium pass: real guest components, synthetic device GPS; no tenant/auth/data writes.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const observations = {};
const leaks = [];
const created = [];
await mkdir("screenshots", { recursive: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
context.on("request", request => {
  if (request.method() !== "GET" && request.method() !== "HEAD") created.push([request.method(), request.url()]);
  const payload = `${request.url()} ${request.postData() || ""}`;
  if (/weightKg|calorieProfile|caloriesKcal|\"assist\"|\"sex\"|\"age\"/.test(payload)) leaks.push(request.url());
});
await context.addInitScript(() => {
  let callback = null;
  let tick = 0;
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    watchPosition: success => { callback = success; return 1; },
    clearWatch: () => { callback = null; },
  } });
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async () => ({
    released: false, release: async () => undefined, addEventListener: () => undefined,
  }) } });
  window.emitTourFix = (meters, ascent = 0) => {
    tick++;
    callback?.({
      timestamp: Date.now() + tick * 5000,
      coords: { latitude: 45.536 + meters / 111195, longitude: 13.66,
        altitude: 5 + ascent, altitudeAccuracy: 5, accuracy: 3, heading: null, speed: null },
    });
  };
  window.canvasLabels = [];
  const original = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
    window.canvasLabels.push(String(text));
    return original.call(this, text, ...args);
  };
});

const bounds = async (page, ids) => Object.fromEntries(await Promise.all(ids.map(async id => {
  const node = page.getByTestId(id);
  const box = await node.boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= 391 && box.y >= 0, `${id} out of 390px viewport: ${JSON.stringify(box)}`);
  return [id, box];
})));
const fixStream = async (page, count = 10) => {
  for (let i = 0; i <= count; i++) {
    await page.evaluate(([meters, ascent]) => window.emitTourFix(meters, ascent), [i * 25, i * 1.25]);
    await page.waitForTimeout(85);
  }
  await page.waitForTimeout(200);
};
const exportImage = async (page, name, shouldHaveKcal) => {
  await page.evaluate(() => { window.canvasLabels.length = 0; });
  const event = page.waitForEvent("download");
  await page.getByTestId("button-tour-download-image").click();
  const download = await event;
  assert.equal(await download.failure(), null);
  await download.saveAs(`screenshots/calorie-${name}.png`);
  const labels = await page.evaluate(() => window.canvasLabels);
  assert.equal(labels.some(s => /kcal/.test(s)), shouldHaveKcal, `PNG canvas kcal ${name}`);
  return labels.filter(s => /kcal/.test(s));
};
const openFixture = async (url) => {
  const page = await context.newPage();
  await page.goto(base + url);
  await page.getByTestId("button-tour-profile").waitFor();
  return page;
};

try {
  // Separate fresh origin storage tests FIRST tour skip and missing-weight for planned GPX.
  let page = await openFixture("/src/tests/fixtures/live-tour.html?activity=hiking");
  await page.getByTestId("button-tour-start").click();
  await page.getByTestId("dialog-tour-profile").waitFor();
  observations.plannedFirstProfile = await bounds(page, ["dialog-tour-profile", "input-tour-weight", "button-tour-profile-skip"]);
  await page.screenshot({ path: "screenshots/calorie-planned-profile.png", fullPage: true });
  await page.getByTestId("button-tour-profile-skip").click();
  await page.getByTestId("panel-tour-live").waitFor();
  await fixStream(page);
  assert.equal(await page.getByTestId("text-tour-calories").count(), 0);
  assert.equal(await page.getByTestId("text-tour-overlay-calories").count(), 0);
  await page.screenshot({ path: "screenshots/calorie-planned-no-weight-live.png", fullPage: true });
  await page.getByTestId("button-tour-finish").click();
  assert.equal(await page.getByTestId("text-tour-calories").count(), 0);
  observations.noWeightImage = await exportImage(page, "planned-no-weight", false);
  await page.close();

  // Fresh profile step in an isolated device; then persistent profile across all subsequent pages.
  const weightedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  weightedContext.on("request", request => {
    if (request.method() !== "GET" && request.method() !== "HEAD") created.push([request.method(), request.url()]);
    if (/weightKg|calorieProfile|caloriesKcal|\"assist\"|\"sex\"|\"age\"/.test(`${request.url()} ${request.postData() || ""}`)) leaks.push(request.url());
  });
  // Reuse the same synthetic device stubs on this independent browser context.
  await weightedContext.addInitScript(() => {
    let callback = null, tick = 0;
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
      watchPosition: success => { callback = success; return 1; }, clearWatch: () => { callback = null; },
    } });
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async () => ({
      released: false, release: async () => undefined, addEventListener: () => undefined,
    }) } });
    window.emitTourFix = (meters, ascent = 0) => {
      tick++;
      callback?.({ timestamp: Date.now() + tick * 5000,
        coords: { latitude: 45.536 + meters / 111195, longitude: 13.66,
          altitude: 5 + ascent, altitudeAccuracy: 5, accuracy: 3, heading: null, speed: null } });
    };
    window.canvasLabels = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      window.canvasLabels.push(String(text)); return original.call(this, text, ...args);
    };
  });
  const url = name => `${base}/free-tour.html?externalGps=1&case=${name}`;
  for (const activity of ["running", "hiking", "cycling"]) {
    const p = await weightedContext.newPage();
    await p.goto(url(activity));
    await p.getByTestId(`radio-free-activity-${activity}`).check();
    await p.getByTestId("button-free-tour-start").click();
    if (activity === "running") {
      await p.getByTestId("dialog-tour-profile").waitFor();
      await p.getByTestId("input-tour-age").fill("37");
      await p.getByTestId("select-tour-sex").selectOption("female");
      await p.getByTestId("input-tour-weight").fill("73");
      observations.freeProfile = await bounds(p, ["dialog-tour-profile", "input-tour-weight", "button-tour-profile-save"]);
      await p.screenshot({ path: "screenshots/calorie-free-profile.png", fullPage: true });
      await p.getByTestId("button-tour-profile-save").click();
    } else assert.equal(await p.getByTestId("dialog-tour-profile").count(), 0, "profile introduction persists");
    await p.getByTestId("panel-tour-live").waitFor();
    await fixStream(p);
    const kcal = await p.getByTestId("text-tour-calories").innerText();
    assert.match(kcal, /pribl\..*kcal/);
    observations[activity] = { live: await bounds(p, ["panel-tour-live", "text-tour-calories", "button-tour-profile"]) , kcal };
    await p.screenshot({ path: `screenshots/calorie-${activity}-live.png`, fullPage: true });
    if (activity === "running") {
      const old = await p.evaluate(() => {
        const key = Object.keys(localStorage).find(s => s.includes("live-tour") && s.includes("free-tour"));
        return JSON.parse(localStorage.getItem(key)).state.calorieProfile.weightKg;
      });
      await p.getByTestId("button-tour-profile").click();
      assert.match(await p.getByTestId("dialog-tour-profile").innerText(), /naslednjo turo/);
      await p.getByTestId("input-tour-weight").fill("81");
      await p.getByTestId("button-tour-profile-save").click();
      const snapshot = await p.evaluate(() => {
        const key = Object.keys(localStorage).find(s => s.includes("live-tour") && s.includes("free-tour"));
        return JSON.parse(localStorage.getItem(key)).state.calorieProfile.weightKg;
      });
      assert.equal(old, 73); assert.equal(snapshot, 73);
      observations.runningImmutableSnapshot = { old, snapshot };
    }
    await p.getByTestId("button-tour-finish").click();
    observations[activity].result = await bounds(p, ["panel-tour-result", "text-tour-calories"]);
    await p.screenshot({ path: `screenshots/calorie-${activity}-result.png`, fullPage: true });
    observations[activity].png = await exportImage(p, activity, true);
    await p.getByTestId("button-tour-reset").click();
    await p.close();
  }
  // Cycling profile edit exposes exactly four bike types and assist only for electric.
  const ebike = await weightedContext.newPage();
  await ebike.goto(url("electric"));
  await ebike.getByTestId("radio-free-activity-cycling").check();
  await ebike.getByTestId("button-tour-profile").click();
  assert.deepEqual(await ebike.getByTestId("select-tour-bike").locator("option").evaluateAll(all => all.filter(o => o.value).map(o => o.value)),
    ["road", "mtb", "trekking-city", "electric"]);
  assert.equal(await ebike.getByTestId("select-tour-assist").count(), 0);
  await ebike.getByTestId("select-tour-bike").selectOption("electric");
  await ebike.getByTestId("select-tour-assist").selectOption("high");
  observations.ebikeProfile = await bounds(ebike, ["dialog-tour-profile", "select-tour-bike", "select-tour-assist"]);
  await ebike.screenshot({ path: "screenshots/calorie-ebike-profile.png", fullPage: true });
  await ebike.getByTestId("button-tour-profile-save").click();
  await ebike.reload();
  await ebike.getByTestId("radio-free-activity-cycling").check();
  await ebike.getByTestId("button-tour-profile").click();
  assert.equal(await ebike.getByTestId("select-tour-bike").inputValue(), "electric");
  assert.equal(await ebike.getByTestId("select-tour-assist").inputValue(), "high");
  assert.equal(await ebike.getByTestId("input-tour-weight").inputValue(), "81");
  await ebike.getByTestId("button-tour-profile-skip").click();
  await ebike.getByTestId("button-free-tour-start").click();
  await fixStream(ebike);
  assert.match(await ebike.getByTestId("text-tour-calories").innerText(), /kcal/);
  await ebike.getByTestId("button-tour-finish").click();
  observations.ebikePng = await exportImage(ebike, "ebike", true);
  await ebike.getByTestId("button-tour-reset").click();
  await ebike.close();
  const planned = await weightedContext.newPage();
  await planned.goto(`${base}/src/tests/fixtures/live-tour.html?activity=cycling`);
  await planned.getByTestId("button-tour-profile").click();
  assert.equal(await planned.getByTestId("select-tour-bike").inputValue(), "electric");
  observations.plannedEdit = await bounds(planned, ["dialog-tour-profile", "select-tour-bike", "select-tour-assist"]);
  await planned.screenshot({ path: "screenshots/calorie-planned-edit.png", fullPage: true });
  await planned.getByTestId("button-tour-profile-skip").click();
  await planned.getByTestId("button-tour-start").click();
  assert.equal(await planned.getByTestId("dialog-tour-profile").count(), 0);
  await fixStream(planned);
  observations.plannedWeighted = await bounds(planned, ["panel-tour-live", "text-tour-calories"]);
  await planned.screenshot({ path: "screenshots/calorie-planned-weighted-live.png", fullPage: true });
  await planned.getByTestId("button-tour-finish").click();
  observations.plannedWeightedResult = await bounds(planned, ["panel-tour-result", "text-tour-calories"]);
  await planned.screenshot({ path: "screenshots/calorie-planned-weighted-result.png", fullPage: true });
  observations.plannedWeightedPng = await exportImage(planned, "planned-weighted", true);
  await planned.close();
  await weightedContext.close();

  assert.deepEqual(leaks, [], "profile fields must never leave via network");
  assert.deepEqual(created, [], "fixtures may request tiles/assets but must not write");
  await writeFile("screenshots/calorie-bounds.json", JSON.stringify({ observations, leaks, created }, null, 2));
  console.log(JSON.stringify({ observations, leaks, created }, null, 2));
} finally { await context.close(); await browser.close(); }