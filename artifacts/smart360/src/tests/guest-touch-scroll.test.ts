import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

// Runs as part of pnpm test. Real browser input, never wheel/scrollTop assignment.
// Its own disposable Vite server: no running workflow, DB, or external API required.
test("guest touch-scroll smoke — every main guest surface", { timeout: 600_000 }, async t => {
  const port = await new Promise<number>(done => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const value = (server.address() as {port:number}).port;
      server.close(() => done(value));
    });
  });
  const vite = spawn(process.execPath, [resolve("node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--strictPort"], {
    env:{...process.env, PORT:String(port), BASE_PATH:"/"}, stdio:"pipe",
  });
  let logs = "";
  vite.stdout.on("data", b => { logs += b; });
  vite.stderr.on("data", b => { logs += b; });
  const base = `http://127.0.0.1:${port}`;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    for (let i=0;i<300;i++) {
      if (await fetch(base).then(r => r.ok).catch(() => false)) break;
      assert.equal(vite.exitCode, null, logs);
      await new Promise(r => setTimeout(r,100));
      if (i===299) assert.fail(logs);
    }
    browser = await chromium.launch({executablePath:execFileSync("which",["chromium"],{encoding:"utf8"}).trim(), args:["--no-sandbox"]});
    const context = await browser.newContext({viewport:{width:390,height:844}, hasTouch:true, isMobile:true});
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await page.route("**/api/**", route => route.fulfill({json: route.request().url().includes("/announcements") ? {
      announcements:[{id:"smoke-ann",titleSl:"Smoke notice",bodySl:"<p>Long notice text for touch scrolling.</p>".repeat(70),isVisible:true,validFrom:"2020-01-01T00:00:00Z",validTo:null,createdAt:"2020-01-01T00:00:00Z"}],
    } : []}));
    const cdp = await context.newCDPSession(page);
    const drag = async (x:number,y:number,end:number) => {
      await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
      for (let n=1;n<=8;n++) {
        await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:y+(end-y)*n/8}]});
        await page.waitForTimeout(25);
      }
      await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
      await page.waitForTimeout(250);
    };
    const go = async (path="/home",palette="bordo") => {
      await page.goto(`${base}/__simple-fixture${path}?tenant=melipu&palette=${palette}&lang=en&evidence=scroll-smoke&skin=day`, {waitUntil:"domcontentloaded"});
      await page.locator("[data-living-guide-app]").waitFor({timeout:90_000});
      await page.waitForTimeout(500);
    };
    const scrolled = async (selector:string) => {
      if (await page.locator(".lgs-root").count()) {
        // Owner deviation: only OUTER drop-shadow layers are removed; inset layers
        // (palette gap ring, selected states) must survive.
        await page.waitForTimeout(50);
        const {shadows, insets} = await page.evaluate(() => {
          const outer: string[] = [], inset: string[] = [];
          for (const e of document.querySelectorAll('button,[role="button"],a[class*="btn"],a[class*="cta"],a.lgs-tile')) {
            if (!(e.getBoundingClientRect().width > 0)) continue;
            for (const p of [null, "::before", "::after"]) {
              const s = getComputedStyle(e, p);
              if (p && (s.content === "none" || s.content === "")) continue;
              const layers = s.boxShadow === "none" ? [] : s.boxShadow.split(/,(?![^(]*\))/);
              if (layers.some(l => !/\binset\b/.test(l))) outer.push(`${e.className} ${p ?? ""}: ${s.boxShadow}`);
              if (!p && layers.some(l => /\binset\b/.test(l))) inset.push(String(e.className));
            }
          }
          return {shadows: outer, insets: inset};
        });
        if (await page.locator(".lgs-tile").count()) assert.ok(insets.some(c => c.includes("lgs-tile")), "tile inset gap ring must be kept");
        assert.deepEqual(shadows, [], "Enostaven controls must have no outer drop shadow on any guest surface");
      }
      const el = page.locator(selector).last();
      await el.waitFor();
      const before = await el.evaluate(e => ({top:e.scrollTop, height:e.clientHeight, total:e.scrollHeight}));
      assert.ok(before.total > before.height + 30, `Fixture must overflow: ${selector} ${JSON.stringify(before)}`);
      const box = await el.boundingBox();
      assert.ok(box);
      // Keep the drag inside content, above the fixed Order dock.
      const y = Math.min(580,box.y+box.height-110, (await page.viewportSize())!.height-50);
      const top = Math.max(box.y+70, y-350);
      const atBottom = before.top >= before.total - before.height - 30;
      await drag(160, atBottom ? top : y, atBottom ? y : top);
      const after = await el.evaluate(e => e.scrollTop);
      assert.ok(atBottom ? after < before.top - 20 : after > before.top + 20, `${selector} blocked native touch: ${before.top} -> ${after}`);
    };
    await t.test("landing → open → Enostaven grid uses native touch scrolling", async () => {
      await go("");
      // Landing is intentionally fixed-height: test hit targeting and departure,
      // not an impossible positive scrollTop assertion on a non-scroller.
      await drag(160,500,250);
      await page.getByTestId("button-open-guide").click();
      await page.locator(".lgs-home").waitFor();
      assert.equal(await page.locator(".lgs-cover").count(),0);
      await scrolled(".lgs-home");
    });
    await t.test("category list", async () => { await go("/c/c-explore-sights"); await scrolled(".v--det .lg2-detail-scroll"); });
    await t.test("grid after category back, language change, and away/back restore", async () => {
      await go();
      await page.getByTestId("tile-c-c-explore-sights").click();
      await page.getByTestId("button-simple-detail-back").click();
      await page.locator(".v--det").waitFor({state:"detached"});
      await scrolled(".lgs-home");
      await go();
      await page.getByTestId("button-simple-language").click();
      await page.locator(".lg2-language-options button").filter({hasText:"Deutsch"}).click();
      await scrolled(".lgs-home");
      await page.goto("about:blank");
      await page.goBack({waitUntil:"domcontentloaded"});
      await page.locator(".lgs-home").waitFor();
      await scrolled(".lgs-home");
    });
    await t.test("entry detail", async () => { await go("/c/c-stay-welcome"); await scrolled(".v--det .lg2-detail-scroll"); });
    await t.test("offer detail", async () => {
      await go("/c/c-offer-prices/i/i-offer-prices");
      await scrolled(".v--det .lg2-detail-scroll");
    });
    await t.test("announcement detail", async () => {
      await go(); await page.getByTestId("tile-notices").click();
      await page.locator('[data-testid^="card-announcement-"]').first().click();
      await scrolled(".lg2-ann-layer");
    });
    await t.test("program detail", async () => {
      await go("/c/c-explore-program");
      await page.locator('[data-testid^="program-day-"]:has(.lgp-dot)').first().click();
      await page.locator('[data-testid^="program-card-"]').first().click();
      await scrolled('[data-testid="program-detail"]');
    });
    await t.test("weather detail on a compact viewport", async () => {
      await page.setViewportSize({width:390,height:300});
      await go(); await page.getByTestId("tile-weather").click();
      await scrolled(".lgs-sheet-panel");
      await page.setViewportSize({width:390,height:844});
    });
    await t.test("Trend home", async () => { await go("/home","trend"); await scrolled(".lg2-home-scroll-container"); });
  } finally {
    await browser?.close();
    vite.kill("SIGTERM");
  }
});
