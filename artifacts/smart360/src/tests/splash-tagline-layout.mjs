// Run from the workspace root after building the web app:
// node artifacts/smart360/src/tests/splash-tagline-layout.mjs [before|after]
import { chromium } from "@playwright/test";
import { spawn, execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const stage = process.argv[2] ?? "after";
const folder = `reports/splash-layout/${stage}`;
mkdirSync(folder, { recursive: true });
const server = spawn("node", ["artifacts/smart360/server.mjs"], {
  env: { ...process.env, PORT: "5199" }, stdio: "ignore",
});
const browser = await chromium.launch({
  executablePath: execSync("which chromium").toString().trim(),
  args: ["--no-sandbox"],
});
const measurements = [];
try {
  await new Promise(resolve => setTimeout(resolve, 700));
  for (const width of [390, 430, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    // Hold only the splash dismissal timers for capture; CSS animations and
    // normal rendering continue unchanged. No authentication or DB writes.
    await page.addInitScript(() => {
      const timer = window.setTimeout;
      window.setTimeout = (fn, delay, ...args) =>
        timer(fn, delay >= 2000 && delay <= 3200 ? 60000 : delay, ...args);
    });
    await page.route("**/api/**", async route => {
      const url = new URL(route.request().url());
      await route.fulfill({ response: await route.fetch({
        url: `http://127.0.0.1:8080${url.pathname}${url.search}`,
      }) });
    });
    await page.goto("http://127.0.0.1:5199/meli-pu?lang=en");
    await page.locator(".guest-entry-splash__subtitle").waitFor();
    await page.waitForTimeout(1000);
    const metrics = await page.evaluate(() => {
      const info = selector => {
        const el = document.querySelector(selector);
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return { x: r.x, y: r.y, width: r.width, height: r.height,
          font: s.font, spacing: s.letterSpacing, color: s.color,
          textAlign: s.textAlign, textTransform: s.textTransform,
          animation: s.animation, transform: s.transform,
          text: el.textContent, src: el.getAttribute("src") };
      };
      return {
        containerWidth: document.querySelector(".guest-entry-splash").clientWidth,
        mark: info(".guest-entry-splash__mark"),
        image: info(".guest-entry-splash__mark img"),
        wordmark: info(".guest-entry-splash__wordmark"),
        tagline: info(document.querySelector(".guest-entry-splash__tagline-text")
          ? ".guest-entry-splash__tagline-text" : ".guest-entry-splash__subtitle"),
        lines: [...document.querySelectorAll(".guest-entry-splash__tagline-part")]
          .map(el => ({ text: el.textContent, y: el.getBoundingClientRect().y })),
      };
    });
    await page.waitForTimeout(180);
    const nextTransform = await page.locator(".guest-entry-splash__mark img")
      .evaluate(el => getComputedStyle(el).transform);
    assert.notEqual(metrics.image.transform, nextTransform, "mark must keep spinning");
    if (stage === "after") {
      assert.equal(metrics.tagline.textAlign, "center");
      assert.ok(Math.abs(metrics.tagline.x + metrics.tagline.width / 2 - width / 2) < 1);
      assert.ok(metrics.tagline.x >= 16);
      assert.equal(metrics.tagline.y - metrics.wordmark.y - metrics.wordmark.height, 18);
      assert.deepEqual(metrics.lines.map(l => l.text),
        ["Everything about your stay,", "in one place."]);
      assert.equal(metrics.lines[0].y === metrics.lines[1].y, metrics.containerWidth >= 480);
    }
    measurements.push({ width, ...metrics });
    await page.screenshot({ path: `${folder}/${width}.png` });
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.close();
  }
  writeFileSync(`${folder}/measurements.json`, JSON.stringify(measurements, null, 2));
  console.log(JSON.stringify(measurements, null, 2));
} finally {
  await browser.close();
  server.kill();
}