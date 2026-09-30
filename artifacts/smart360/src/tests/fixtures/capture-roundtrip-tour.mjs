// Development-only browser evidence for the EXACT synthetic GPX route returned
// by the real API integration upload. No real tenant, session or API read.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import sharp from "../../../../api-server/node_modules/sharp/dist/index.mjs";

const route = JSON.parse(await readFile("/tmp/free-tour-uploaded-route.json", "utf8"));
assert.equal(route.version, 1);
assert.deepEqual(route.segments.map(segment => segment.length), [3, 3]);
assert.equal(route.activity, "hiking");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let intercepted = 0;
  await page.route("**/__free-tour-test-route.json", async request => {
    intercepted++;
    await request.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(route) });
  });
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/src/tests/fixtures/roundtrip-tour.html`);
  await page.getByTestId("lg-gpx-route").waitFor();
  await page.locator(".maplibregl-canvas").waitFor();
  await page.locator(".s360-gpx-marker--start").waitFor();
  await page.locator(".s360-gpx-marker--end").waitFor();
  await page.waitForFunction(() => Array.isArray(window.__roundtripDrawnLine));
  await page.waitForTimeout(3500);
  assert.equal(intercepted, 1, "fixture reads only the intercepted uploaded route");
  assert.deepEqual(errors, [], "real GPX component has no page errors");
  assert.equal(await page.locator(".s360-gpx-alert").count(), 0, "map has no load error");
  const drawnLine = await page.evaluate(() => window.__roundtripDrawnLine);
  assert.deepEqual(drawnLine, route.segments.map(segment => segment.map(point => [point.lon, point.lat])),
    "actual MapLibre GeoJSON has precisely the uploaded segment coordinates, without bridging the gap");
  const map = await page.getByTestId("map-gpx").boundingBox();
  const canvas = await page.locator(".maplibregl-canvas").boundingBox();
  const start = await page.locator(".s360-gpx-marker--start").boundingBox();
  const end = await page.locator(".s360-gpx-marker--end").boundingBox();
  const centerInside = (box, outer) => !!box && !!outer &&
    box.x + box.width / 2 >= outer.x && box.x + box.width / 2 <= outer.x + outer.width &&
    box.y + box.height / 2 >= outer.y && box.y + box.height / 2 <= outer.y + outer.height;
  assert.ok(map && canvas && start && end, "map, canvas and start/end markers must have boxes");
  assert.ok(centerInside(start, map) && centerInside(end, map), "start/end markers must sit inside the actual map");
  assert.ok(await page.getByTestId("profile-normal").isVisible(), "uploaded elevation profile is visible");
  const pixels = await page.locator(".maplibregl-canvas").screenshot();
  const { data, info } = await sharp(pixels).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let routeColorPixels = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (Math.abs(data[i] - 21) <= 9 && Math.abs(data[i + 1] - 115) <= 9 &&
        Math.abs(data[i + 2] - 71) <= 9) routeColorPixels++;
  }
  assert.ok(routeColorPixels > 25, `uploaded route line should paint in the real canvas, pixels=${routeColorPixels}`);
  await mkdir("screenshots", { recursive: true });
  await page.screenshot({ path: "screenshots/free-tour-imported-route.png", fullPage: true });
  console.log("UPLOADED_ROUTE_RENDER", JSON.stringify({
    intercepted, segments: route.segments.map(segment => segment.length), drawnLine,
    first: route.segments[0][0], last: route.segments.at(-1).at(-1),
    map, canvas, start, end, startInside: centerInside(start, map), endInside: centerInside(end, map),
    routeColorPixels, webgl2: await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2")),
    screenshot: "screenshots/free-tour-imported-route.png",
  }));
} finally {
  await browser.close();
}