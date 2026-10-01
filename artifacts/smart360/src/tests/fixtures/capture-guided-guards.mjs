// DEV-only real-component checks. Synthetic GPS/local storage; no API writes.
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const out = "screenshots/guided-guards";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const fixture = `${base}/src/tests/fixtures/live-tour.html`;
const report = { checks: [], console: [], pageErrors: [], buttons: [] };
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("console", m => { if (m.type() === "error" || m.type() === "warning") report.console.push(m.text()); });
page.on("pageerror", e => report.pageErrors.push(String(e)));
await page.addInitScript(() => {
  const watchers = new Map();
  let next = 0;
  window.testGps = {
    watchers, throwWatch: false,
    fix: (meters = 0, accuracy = 5) => {
      for (const { success } of [...watchers.values()]) success({
        timestamp: Date.now(), coords: { latitude: 45.536 + meters / 111195, longitude: 13.66,
          accuracy, altitude: 5, altitudeAccuracy: 5, heading: null, speed: null },
      });
    },
    error: code => { for (const { error } of [...watchers.values()]) error({ code }); },
  };
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    watchPosition(success, error) {
      if (window.testGps.throwWatch) throw new Error("Synthetic unsupported watch");
      const id = ++next; watchers.set(id, { success, error }); return id;
    },
    clearWatch(id) { watchers.delete(id); },
  } });
});
const start = () => page.getByTestId("button-tour-start");
const fix = (m = 0, accuracy = 5) => page.evaluate(([m, accuracy]) => window.testGps.fix(m, accuracy), [m, accuracy]);
const idle = async () => { await expect(start()).toBeVisible(); await expect(start()).toBeDisabled(); };
const shot = async name => {
  await page.screenshot({ path: `${out}/${name}-390.png` });
  if (await start().count()) report.buttons.push({ name, ...await start().evaluate(el => ({
    disabled: el.disabled, opacity: getComputedStyle(el).opacity, text: el.textContent,
    width: el.getBoundingClientRect().width,
  })) });
};
async function check(name, run) {
  try { await run(); report.checks.push({ name, passed: true }); }
  catch (e) { report.checks.push({ name, passed: false, error: String(e) }); await shot(`failed-${report.checks.length}`); }
}
// Build storage fixtures using the real device-only tour model.
async function seed(key, finished = true, distance = 0) {
  await page.evaluate(async ({ key, finished, distance }) => {
    const model = await import("/src/lib/live-tour.ts");
    const now = Date.now();
    let state = model.startTour(now - 30000);
    for (let i = 0; i <= (distance ? 4 : 0); i++) {
      state = model.recordTourPoint(state, { lat: 45.536 + i * 20 / 111195, lon: 13.66, accuracy: 5, timestamp: now - 25000 + i * 5000 });
    }
    if (finished) state = model.finishTour(state, now);
    model.saveTour(key, state);
  }, { key, finished, distance });
}
const key = "tour-browser-fixture/synthetic-route";
try {
  await page.goto(fixture);
  await idle();
  await check("guard no-fix/poor/far/near/errors, single watch, profile confirmation recheck", async () => {
    await expect.poll(() => page.evaluate(() => window.testGps.watchers.size)).toBe(1);
    await shot("waiting");
    await fix(0, 100.1); await expect(start()).toBeDisabled();
    await fix(-76000); await expect(start()).toBeDisabled();
    await expect(page.getByTestId("guided-preflight-far")).toContainText("76,0 km");
    await shot("far");
    await fix(0, 100); await expect(start()).toBeEnabled(); await shot("near");
    await start().click();
    await expect(page.getByTestId("dialog-tour-profile")).toBeVisible();
    await fix(-1000);
    await page.getByTestId("button-tour-profile-skip").click();
    await idle();
    await fix(0); await expect(start()).toBeEnabled();
    await page.evaluate(() => window.testGps.error(1));
    await expect(page.getByTestId("guided-preflight-denied")).toBeVisible(); await idle(); await shot("denied");
    await fix(0); await page.evaluate(() => window.testGps.error(2)); await idle();
  });
  await check("short finish skips summary, localized notice, new idle watch", async () => {
    await fix(0); await start().click();
    await expect(page.getByTestId("button-tour-finish")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.testGps.watchers.size)).toBe(1);
    await fix(0);
    await page.getByTestId("button-tour-finish").click();
    await expect(page.getByTestId("notice-tour-too-short")).toHaveText("Tura je bila prekratka za povzetek.");
    await expect(page.getByTestId("panel-tour-result")).toHaveCount(0);
    await idle(); await shot("short");
    await expect.poll(() => page.evaluate(() => window.testGps.watchers.size)).toBe(1);
  });
  await check("stale finished persisted state rejected at entry", async () => {
    await seed(key);
    await page.reload(); await idle();
    await expect(page.getByTestId("panel-tour-result")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("smart360:live-tour:v1:tour-browser-fixture%2Fsynthetic-route"))).toBe(null);
  });
  await check("active reload preserved, >=50m summary preview, dismiss and revisit", async () => {
    await seed(key, false, 80);
    await page.reload();
    await expect(page.getByTestId("button-tour-finish")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("button-tour-finish")).toBeVisible();
    await page.getByTestId("button-tour-finish").click();
    await expect(page.getByTestId("panel-tour-result")).toBeVisible();
    await expect(page.getByTestId("img-tour-summary")).toBeVisible({ timeout: 45000 });
    await shot("summary");
    await page.getByTestId("button-tour-reset").click(); await idle();
    await page.getByTestId("fixture-toggle-route").click();
    await expect.poll(() => page.evaluate(() => window.testGps.watchers.size)).toBe(0);
    await page.getByTestId("fixture-toggle-route").click(); await idle();
  });
  await check("finished summary disappears on reload, unmount and pagehide", async () => {
    for (const action of ["reload", "unmount", "pagehide"]) {
      await seed(key, false, 80); await page.reload();
      await page.getByTestId("button-tour-finish").click();
      await expect(page.getByTestId("panel-tour-result")).toBeVisible();
      if (action === "reload") await page.reload();
      else if (action === "pagehide") await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      else { await page.getByTestId("fixture-toggle-route").click(); await page.getByTestId("fixture-toggle-route").click(); }
      await idle();
    }
  });
  await check("watch throw is unsupported, disabled, cleans up", async () => {
    await page.getByTestId("fixture-toggle-route").click();
    await page.evaluate(() => { window.testGps.throwWatch = true; });
    await page.getByTestId("fixture-toggle-route").click(); await idle();
    await expect(page.getByTestId("guided-preflight-unsupported")).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.testGps.watchers.size)).toBe(0);
  });
  await check("four languages waiting, distance, permission and short notice", async () => {
    const copy = {
      sl: ["Pridobivam lokacijo", "Tura je bila prekratka za povzetek."],
      en: ["Acquiring location", "The tour was too short for a summary."],
      de: ["Standort wird ermittelt", "Die Tour war zu kurz für eine Zusammenfassung."],
      it: ["Acquisizione della posizione", "Il tour era troppo breve per un riepilogo."],
    };
    for (const [lang, texts] of Object.entries(copy)) {
      await page.goto(`${fixture}?lang=${lang}`); await idle();
      await expect(page.getByTestId("guided-preflight-waiting")).toContainText(texts[0]);
      await fix(-1000); await expect(page.getByTestId("guided-preflight-far")).toContainText(/1[.,]0 km/);
      await page.evaluate(() => window.testGps.error(1));
      await expect(page.locator('[data-testid="guided-preflight-denied"] li')).not.toHaveCount(0);
      await shot(`permission-${lang}`);
      await fix(0); await start().click(); await page.getByTestId("button-tour-finish").click();
      await expect(page.getByTestId("notice-tour-too-short")).toHaveText(texts[1]);
    }
  });
  await check("real main app startup purges finished guided only", async () => {
    await seed("purge-test/route", true);
    await seed("purge-test/free-tour", true);
    await seed("purge-test/active", false, 80);
    await page.goto(`${base}/`);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("smart360:live-tour:v1:purge-test%2Froute"))).toBe(null);
    await expect.poll(() => page.evaluate(() => !!localStorage.getItem("smart360:live-tour:v1:purge-test%2Ffree-tour"))).toBe(true);
    await expect.poll(() => page.evaluate(() => !!localStorage.getItem("smart360:live-tour:v1:purge-test%2Factive"))).toBe(true);
  });
  await check("free recording Start remains enabled without guided preflight", async () => {
    await page.goto(`${base}/free-tour.html?externalGps=1`);
    await expect(page.getByTestId("button-free-tour-start")).toBeEnabled();
    await expect(page.locator('[data-testid^="guided-preflight"]')).toHaveCount(0);
    await shot("free-idle");
    await page.getByTestId("button-free-tour-start").click();
    await expect(page.getByTestId("button-tour-finish")).toBeVisible();
  });
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
if (report.checks.some(c => !c.passed) || report.pageErrors.length) process.exitCode = 1;