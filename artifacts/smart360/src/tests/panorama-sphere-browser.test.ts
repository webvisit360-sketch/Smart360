import test from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

test("spherical viewer supports touch rotation, poles, pinch and flat gallery transitions", { timeout: 180_000 }, async () => {
  const port = await new Promise<number>(done => {
    const server = createServer().listen(0, "127.0.0.1", () => {
      const port = (server.address() as {port: number}).port;
      server.close(() => done(port));
    });
  });
  const vite = spawn(process.execPath, [resolve("node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--strictPort"],
    { env: { ...process.env, PORT: String(port), BASE_PATH: "/" }, stdio: "pipe" });
  let logs = "";
  vite.stdout.on("data", b => { logs += b; });
  vite.stderr.on("data", b => { logs += b; });
  const browser = await chromium.launch({
    executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 300; i++) {
      if (await fetch(base).then(r => r.ok).catch(() => false)) break;
      assert.equal(vite.exitCode, null, logs);
      await new Promise(r => setTimeout(r, 100));
      if (i === 299) assert.fail(logs);
    }
    const context = await browser.newContext({ viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true });
    await context.addInitScript("window.__name = (fn) => fn;");
    // Browser-test-only observation: the production wrapper exposes no debug API.
    await context.addInitScript(() => {
      let lib: any;
      Object.defineProperty(window, "pannellum", { configurable: true, get: () => lib, set: value => {
        lib = value;
        const original = lib.viewer;
        lib.viewer = (...args: any[]) => {
          const viewer = original(...args);
          (window as any).__sphere = viewer;
          return viewer;
        };
      } });
    });
    const page = await context.newPage();
    const imageKinds: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname === "/sphere-test.svg") imageKinds.push(request.resourceType());
    });
    await page.route(url => url.pathname === "/sphere-test.svg", route => route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024"><rect width="2048" height="512" fill="#60aaff"/><rect y="512" width="2048" height="512" fill="#46843b"/></svg>',
    }));
    const cdp = await context.newCDPSession(page);
    const drag = async () => {
      await cdp.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x: 310, y: 400}]});
      for (let n = 1; n <= 8; n++) {
        await cdp.send("Input.dispatchTouchEvent", {type: "touchMove", touchPoints: [{x: 310 - n * 25, y: 400}]});
        await page.waitForTimeout(25);
      }
      await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
      await page.waitForTimeout(200);
    };
    for (const design of ["simple", "trend"]) {
      await page.goto(`${base}/src/tests/fixtures/panorama-viewer.html?design=${design}&image=/sphere-test.svg`);
      await page.locator('[data-testid="panorama-sphere"][data-state="ready"]').waitFor({ timeout: 60_000 });
      const initial = await page.evaluate(() => (window as any).__sphere.getYaw());
      await drag();
      assert.notEqual(await page.evaluate(() => (window as any).__sphere.getYaw()), initial, `${design}: real touch rotates sphere`);
      for (const pitch of [-90, 90]) {
        await page.evaluate(p => (window as any).__sphere.setPitch(p, false), pitch);
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => (window as any).__sphere.getPitch()), pitch);
      }
      await page.evaluate(() => (window as any).__sphere.setPitch(0, false));
      const before = await page.evaluate(() => (window as any).__sphere.getHfov());
      await cdp.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x: 160, y: 400, id: 1}, {x: 230, y: 400, id: 2}]});
      for (let n = 1; n <= 5; n++) {
        await cdp.send("Input.dispatchTouchEvent", {type: "touchMove", touchPoints: [{x: 160 - n * 15, y: 400, id: 1}, {x: 230 + n * 15, y: 400, id: 2}]});
      }
      await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
      assert.ok(await page.evaluate(() => (window as any).__sphere.getHfov()) < before, `${design}: pinch zooms`);
      await page.getByTestId("button-panorama-next").click();
      await page.getByTestId("panorama-image").waitFor();
      assert.equal(await page.getByTestId("panorama-sphere").count(), 0);
      assert.match(await page.getByTestId("text-panorama-counter").innerText(), /2\s*\/\s*2/);
      await page.getByTestId("button-panorama-prev").click();
      await page.locator('[data-testid="panorama-sphere"][data-state="ready"]').waitFor();
      await page.getByTestId("button-panorama-close").click();
      assert.equal(await page.getByTestId("panorama-viewer").count(), 0);
    }
    assert.ok(imageKinds.length > 0);
    assert.ok(imageKinds.every(kind => kind === "image"), "sphere loading must use the worker's image path, never XHR/fetch");
    await context.close();
  } finally {
    await browser.close();
    vite.kill("SIGTERM");
  }
});
