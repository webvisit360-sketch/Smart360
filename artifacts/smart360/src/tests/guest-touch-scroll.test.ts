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
    // TSX may retain named-function helpers when serializing nested browser
    // callbacks for evaluate(); provide that harmless helper in the page realm.
    await page.addInitScript("window.__name = (fn) => fn;");
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

    // Browser-only published-data override: keep the real guest shell and swap
    // just the selected item's media to exercise photo, no-photo and panorama
    // detail geometry without changing application fixtures or source files.
    type DetailMediaMode = "photo" | "none" | "panorama";
    let detailMediaMode: DetailMediaMode = "photo";
    let overflowCategoryItems = false;
    await page.route("**/api/storage/img/**", route => route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#547b74"/></svg>',
    }));
    await page.route("**/verification-only/enostaven/meli-pu-en.json", async route => {
      const response = await route.fetch();
      const snapshot: any = await response.json();
      const item = snapshot.sections.flatMap((s: any) => s.categories)
        .flatMap((c: any) => c.items ?? [])
        .find((entry: any) => entry.id === "8fba6248-2c10-43be-b337-519784a1ee3e");
      assert.ok(item, "published fixture must contain the museum detail");
      const original = item.media?.[0] ?? {
        id: "touch-fixture-photo", itemId: item.id, tenantId: null,
        url: "/api/storage/img/touch-fixture.svg", kind: "image",
        width: 1200, height: 800, position: 0,
      };
      item.media = detailMediaMode === "none" ? [] : [{
        ...original,
        url: "/api/storage/img/touch-fixture.svg",
        isPanorama: detailMediaMode === "panorama",
      }];
      if (overflowCategoryItems) {
        const category = snapshot.sections.flatMap((s: any) => s.categories)
          .find((entry: any) => entry.id === "6f4b5883-1171-41d0-b215-46285d12322c");
        assert.ok(category, "published fixture must contain the Heritage category");
        category.items = [
          ...(category.items ?? []),
          ...Array.from({length:24}, (_, index) => ({
            ...item,
            id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
            position: 1000 + index,
          })),
        ];
      }
      await route.fulfill({ response, json: snapshot });
    });

    const categoryId = "6f4b5883-1171-41d0-b215-46285d12322c";
    const itemId = "8fba6248-2c10-43be-b337-519784a1ee3e";
    const sourceItemPath = `/__simple-fixture/c/${categoryId}/i/${itemId}`;
    const sourceCategoryPath = `/__simple-fixture/c/${categoryId}`;
    const sourceHomePath = "/__simple-fixture/home";
    const openFixtureDetail = async (design: "trend" | "simple", media: DetailMediaMode) => {
      detailMediaMode = media;
      const palette = design === "trend" ? "trend" : "bordo";
      await page.goto(`${base}${sourceItemPath}?tenant=melipu&palette=${palette}&source=published&lang=en`, {waitUntil:"domcontentloaded"});
      await page.locator(".lg2-route-layer.v--det.on .lg2-detail-sheet").waitFor({timeout:90_000});
      await page.locator(".lg2-detail-scroll").last().waitFor();
      await page.locator(".lg2-route-layer.v--det").evaluate(async element => {
        await Promise.all(element.getAnimations({subtree:true}).map(animation => animation.finished.catch(() => {})));
      });
    };
    const startPullTrace = async (startY: number) => page.evaluate((startY) => {
      const w = window as any;
      w.__pullTrace = { events: [], frames: [], running: true, startY, lastY: startY };
      for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) {
        document.addEventListener(type, (event: any) => {
          const touch = event.touches?.[0] ?? event.changedTouches?.[0];
          if (touch?.clientY != null) w.__pullTrace.lastY = touch.clientY;
          w.__pullTrace?.events.push({
            type, t: performance.now(), y: event.touches?.[0]?.clientY,
            changedY: event.changedTouches?.[0]?.clientY,
            cancelable: event.cancelable, prevented: event.defaultPrevented,
            scrollTop: document.querySelector(".lg2-detail-scroll")?.scrollTop ?? null,
          });
        }, false);
      }
      window.addEventListener("resize", () => w.__pullTrace?.events.push({type:"resize", t:performance.now()}));
      window.visualViewport?.addEventListener("resize", () => w.__pullTrace?.events.push({type:"visualViewport.resize", t:performance.now()}));
      function sample() {
        const trace = w.__pullTrace;
        if (!trace?.running) return;
        const sheet = document.querySelector(".lg2-route-layer.v--det .lg2-detail-sheet") as HTMLElement | null;
        const route = document.querySelector(".lg2-route-layer.v--det") as HTMLElement | null;
        const hero = document.querySelector(".lg2-hero-image-main") as HTMLElement | null;
        const held = document.querySelector(".lg2-held-stack") as HTMLElement | null;
        const base = document.querySelector(".lg2-base-route-layer") as HTMLElement | null;
        function matrixY(element: HTMLElement | null) {
          if (!element) return null;
          const transform = getComputedStyle(element).transform;
          return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
        }
        function rect(element: HTMLElement | null) {
          return element?.getBoundingClientRect();
        }
        trace.frames.push({
          t: performance.now(), path: location.pathname,
          phase: sheet?.dataset.lgSheetPhase ?? null,
          offset: Number(sheet?.dataset.lgSheetOffset ?? 0),
          fingerOffset: trace.lastY - trace.startY,
          sheetY: matrixY(sheet), sheetTop: rect(sheet)?.top ?? null,
          heroTop: rect(hero)?.top ?? null, routeY: matrixY(route),
          routePhase: route?.dataset.detailTransition ?? null,
          routeTransition: route ? getComputedStyle(route).transition : null,
          heldZ: held ? getComputedStyle(held).zIndex : null,
          heldHeritage: held?.innerText.includes("Heritage") ?? false,
          sourceScroll: held?.querySelector(".lg2-detail-scroll")?.scrollTop ?? null,
          baseZ: base ? getComputedStyle(base).zIndex : null,
          detailZ: route ? getComputedStyle(route).zIndex : null,
          height: innerHeight,
          scrollTop: document.querySelector(".lg2-detail-scroll")?.scrollTop ?? null,
        });
        requestAnimationFrame(sample);
      }
      w.__pullSample = sample;
      sample();
    }, startY);
    const restartPullTrace = async () => page.evaluate(() => {
      const w = window as any;
      w.__pullTrace = {events:[], frames:[], running:true, startY:0, lastY:0};
      w.__pullSample?.();
    });
    const dispatchPull = async (startY: number, offsets: number[], id: number, interval = 40) => {
      const x = 180;
      await cdp.send("Input.dispatchTouchEvent", {type:"touchStart", touchPoints:[{x,y:startY,id}]});
      for (const offset of offsets) {
        await cdp.send("Input.dispatchTouchEvent", {type:"touchMove", touchPoints:[{x,y:startY+offset,id}]});
        await page.waitForTimeout(interval);
      }
      await cdp.send("Input.dispatchTouchEvent", {type:"touchEnd", touchPoints:[]});
    };

    await t.test("detail pull capture — both designs × photo/no photo/panorama", async matrix => {
      for (const design of ["trend", "simple"] as const) {
        for (const media of ["photo", "none", "panorama"] as const) {
          await matrix.test(`${design} / ${media}`, async () => {
            await openFixtureDetail(design, media);
            const box = await page.locator(".v--det.on .lg2-detail-scroll").last().boundingBox();
            assert.ok(box, "detail scroll region must be visible");
            const startY = Math.round(Math.min(560, box.y + box.height - 70));
            await startPullTrace(startY);
            const startTarget = await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.className ?? null, {x:180,y:startY});
            console.log("DETAIL_TOUCH_CASE", {design, media, startY, startTarget, box});

            // Include the first few sub-threshold pixels in the same continuous
            // finger sequence, then continue a slow 60px pull below close distance.
            await dispatchPull(startY, [2,4,7,10,18,26,34,42,50,60], 91, 45);
            await page.waitForTimeout(320);
            const gentle = await page.evaluate(() => {
              const trace = (window as any).__pullTrace;
              trace.running = false;
              const sheet = document.querySelector(".lg2-route-layer.v--det .lg2-detail-sheet") as HTMLElement | null;
              const scroll = document.querySelector(".lg2-detail-scroll") as HTMLElement | null;
              return {
                url: location.pathname, phase: sheet?.dataset.lgSheetPhase ?? null,
                offset: Number(sheet?.dataset.lgSheetOffset ?? 0),
                scrollTop: scroll?.scrollTop ?? null, events: trace.events,
                frames: trace.frames, resizeCount: trace.events.filter((e: any) => e.type.includes("resize")).length,
              };
            });
            assert.equal(gentle.url, sourceItemPath, `${design}/${media}: sub-threshold pull must not close`);
            assert.equal(gentle.scrollTop, 0, `${design}/${media}: gesture begins at detail top`);
            const moves = gentle.events.filter((event: any) => event.type === "touchmove");
            assert.ok(moves.length > 0, `${design}/${media}: browser must deliver touchmove`);
            assert.equal(gentle.events.some((event: any) => event.type === "touchcancel"), false,
              `${design}/${media}: no touchcancel during a slow downward pull`);
            assert.ok(moves.some((event: any) => event.cancelable && event.prevented),
              `${design}/${media}: the shared detail controller must capture the downward pull`);
            const baseline = gentle.frames.find((frame: any) => frame.fingerOffset === 0 && frame.sheetTop !== null);
            const midpoint = gentle.frames.find((frame: any) =>
              frame.fingerOffset >= 18 && frame.fingerOffset <= 55 && frame.sheetTop !== null);
            assert.ok(baseline && midpoint, `${design}/${media}: sample an intermediate finger and sheet position`);
            const sheetDelta = midpoint.sheetTop - baseline.sheetTop;
            assert.ok(Math.abs(sheetDelta - midpoint.fingerOffset) <= 5,
              `${design}/${media}: sheet must track the finger 1:1 mid-drag (${sheetDelta}px vs ${midpoint.fingerOffset}px)`);
            if (media === "photo") {
              const photoDelta = (midpoint.heroTop ?? baseline.heroTop) - baseline.heroTop;
              assert.ok(photoDelta >= 0 && photoDelta < sheetDelta - 2,
                `${design}: photo should lag the 1:1 sheet movement (${photoDelta}px vs ${sheetDelta}px)`);
            }
            assert.ok(gentle.offset >= 0 && gentle.phase === "settling",
              `${design}/${media}: sub-threshold release should settle without closing`);
            assert.equal(gentle.resizeCount, 0, `${design}/${media}: pull must not resize the viewport`);
            const heroFrames = gentle.frames.filter((frame: any) => frame.heroTop !== null);
            console.log("DETAIL_TOUCH_TRACE", {
              design, media,
              firstMoveDelta: moves[0]?.changedY - startY,
              firstDragFrame: gentle.frames.find((frame: any) => frame.phase === "dragging") ?? null,
              maxSheetY: Math.max(0, ...gentle.frames.map((frame: any) => frame.sheetY ?? 0)),
              heroTopRange: heroFrames.length ? [Math.min(...heroFrames.map((f: any) => f.heroTop)), Math.max(...heroFrames.map((f: any) => f.heroTop))] : [],
              moveCancellation: moves.map((event: any) => [event.cancelable,event.prevented]),
              frames: gentle.frames.map((frame: any) => [
                Math.round(frame.t), frame.phase, Number((frame.sheetY ?? 0).toFixed(1)),
                Number((frame.heroTop ?? 0).toFixed(1)), Number((frame.routeY ?? 0).toFixed(1)),
              ]),
            });

            // One qualifying pull must be sufficient to return to the browser
            // back source. Capture every animation frame through that handoff.
            await restartPullTrace();
            await dispatchPull(startY, [12,30,55,80,105,130], 92, 40);
            await page.waitForFunction(path => location.pathname !== path, sourceItemPath, {timeout:10_000});
            const closed = await page.evaluate(() => {
              const trace = (window as any).__pullTrace;
              trace.running = false;
              return {path:location.pathname, events:trace.events, frames:trace.frames};
            });
            assert.ok(!closed.path.includes(`/i/${itemId}`), `${design}/${media}: one pull must return to its source`);
            const closeEnd = closed.events.find((event: any) => event.type === "touchend");
            if (design === "simple") {
              assert.ok(closeEnd?.prevented, `${media}: qualifying Enostaven touchend suppresses the synthetic click`);
              assert.ok(closed.frames.some((frame: any) =>
                frame.routePhase === "closing" && frame.routeY > 2 && frame.routeY < frame.height - 2),
              `${media}: Enostaven close has intermediate route transforms`);
              assert.ok(closed.frames.some((frame: any) =>
                frame.routePhase === "closing" && frame.routeY > 2 && frame.sheetY > 2),
              `${media}: content sheet exits ahead of the photo's route transform`);
              const transition = closed.frames.find((frame: any) => frame.routePhase === "closing")?.routeTransition ?? "";
              assert.match(transition, /0\.34s cubic-bezier\(0\.32, 0, 0\.24, 1\)/,
                `${media}: Enostaven close uses the 340ms Trend close curve`);
            } else {
              assert.ok(closed.frames.some((frame: any) => frame.phase === "closing" && frame.sheetY > 0),
                `${media}: Trend sheet reaches a closing transform on one pull`);
              assert.ok(closed.frames.some((frame: any) =>
                frame.routePhase === "closing" && frame.routeY > 2 && frame.routeY < frame.height - 2),
              `${media}: Trend route moves through intermediate transforms before source`);
            }
            console.log("DETAIL_SINGLE_PULL_CLOSE", {
              design, media, destination:closed.path,
              closeTouchEndPrevented:closeEnd?.prevented,
              closingFrames:closed.frames.filter((frame: any) =>
                frame.phase === "closing" || frame.routePhase === "closing")
                .map((frame: any) => [Math.round(frame.t), frame.phase, frame.sheetY, frame.routePhase, frame.routeY]),
            });
          });
        }
      }
    });

    await t.test("category → entry preserves source scroll and held layer through cancel/reversal/close", async matrix => {
      for (const design of ["trend", "simple"] as const) {
        for (const media of ["photo", "none"] as const) {
          await matrix.test(`${design} / ${media}`, async () => {
            detailMediaMode = media;
            const palette = design === "trend" ? "trend" : "bordo";
            let sourceScrollBeforeOpen = 0;
            overflowCategoryItems = true;
            try {
              await page.goto(`${base}${sourceCategoryPath}?tenant=melipu&palette=${palette}&source=published&lang=en`, {
                waitUntil:"domcontentloaded",
              });
              await page.locator(".lg2-route-layer.v--det.on").waitFor({timeout:90_000});
              const sourceScroller = page.locator(".v--det.on .lg2-detail-scroll").last();
              await sourceScroller.waitFor();
              const sourceBox = await sourceScroller.boundingBox();
              assert.ok(sourceBox, `${design}/${media}: source list is visible`);
              const sourceMetrics = await sourceScroller.evaluate(element => ({
                scrollTop: element.scrollTop,
                scrollHeight: element.scrollHeight,
                clientHeight: element.clientHeight,
              }));
              if (design === "simple") {
                assert.ok(sourceMetrics.scrollHeight > sourceMetrics.clientHeight,
                  `${design}/${media}: duplicate browser fixture entries overflow the source list`);
                const start = Math.round(Math.min(700, sourceBox.y + sourceBox.height - 70));
                await cdp.send("Input.dispatchTouchEvent", {type:"touchStart", touchPoints:[{x:180,y:start,id:96}]});
                for (const delta of [18,36,54,72,90]) {
                  await cdp.send("Input.dispatchTouchEvent", {type:"touchMove", touchPoints:[{x:180,y:start-delta,id:96}]});
                  await page.waitForTimeout(35);
                }
                await cdp.send("Input.dispatchTouchEvent", {type:"touchEnd", touchPoints:[]});
                await page.waitForTimeout(180);
                sourceScrollBeforeOpen = await sourceScroller.evaluate(element => element.scrollTop);
                assert.ok(sourceScrollBeforeOpen > 0,
                  `${design}/${media}: real touch scroll must seed a nonzero source position`);
              } else {
                sourceScrollBeforeOpen = sourceMetrics.scrollTop;
              }
            } finally {
              overflowCategoryItems = false;
            }
            await page.locator(".v--det.on").getByRole("button", {name:/Izolana Museum — House of the Sea/}).first().click();
            await page.locator(".lg2-route-layer.v--det.on .lg2-detail-sheet").waitFor();
            await page.locator(".lg2-route-layer.v--det").evaluate(async element => {
              await Promise.all(element.getAnimations({subtree:true}).map(animation => animation.finished.catch(() => {})));
            });
            const heldScrollOnOpen = await page.locator(".lg2-held-stack .lg2-detail-scroll")
              .evaluate(element => element.scrollTop);
            await page.evaluate(() => {
              const w = window as any;
              w.__staticSource = { running: true, frames: [] };
              const sourcePath = location.pathname;
              const sample = () => {
                const trace = w.__staticSource;
                if (!trace.running || location.pathname !== sourcePath) return;
                const held = document.querySelector(".lg2-held-stack .lg2-held-view:last-of-type") as HTMLElement;
                if (held) {
                  const view = held.querySelector(".lg2-view")!;
                  const scroller = held.querySelector(".lg2-detail-scroll")!;
                  const rect = view.getBoundingClientRect();
                  trace.frames.push({
                    top: rect.top, height: rect.height, width: rect.width,
                    scrollHeight: scroller.getBoundingClientRect().height,
                    scrollTop: scroller.scrollTop,
                    transform: getComputedStyle(held).transform,
                    filter: getComputedStyle(held).filter,
                  });
                }
                requestAnimationFrame(sample);
              };
              sample();
            });
            assert.equal(heldScrollOnOpen, sourceScrollBeforeOpen,
              `${design}/${media}: opening entry must hold the source category at its current scroll position`);

            const layers = await page.locator(".lg2-route-layer").evaluateAll(elements => elements.map(element => ({
              z: getComputedStyle(element).zIndex,
              text: (element as HTMLElement).innerText,
              transition: element.getAttribute("data-detail-transition"),
            })));
            const heldStack = await page.locator(".lg2-held-stack").evaluate(element => ({
              z: getComputedStyle(element).zIndex,
              text: (element as HTMLElement).innerText,
            }));
            assert.ok(layers.some(layer => layer.z === "1"),
              `${design}/${media}: base Home stays at stack z=1`);
            assert.equal(heldStack.z, "2", `${design}/${media}: held stack uses z=2`);
            assert.match(heldStack.text, /Heritage/,
              `${design}/${media}: source Heritage category is held at stack z=2 behind the entry`);
            assert.ok(layers.some(layer => layer.z === "3" && /Izolana Museum/i.test(layer.text)),
              `${design}/${media}: entry detail is on top at stack z=3`);

            const box = await page.locator(".v--det.on .lg2-detail-scroll").last().boundingBox();
            assert.ok(box);
            const startY = Math.round(Math.min(560, box.y + box.height - 70));
            await startPullTrace(startY);
            await cdp.send("Input.dispatchTouchEvent", {type:"touchStart", touchPoints:[{x:180,y:startY,id:94}]});
            for (const offset of [4,10,18,28,38]) {
              await cdp.send("Input.dispatchTouchEvent", {type:"touchMove", touchPoints:[{x:180,y:startY+offset,id:94}]});
              await page.waitForTimeout(40);
            }
            await cdp.send("Input.dispatchTouchEvent", {type:"touchCancel", touchPoints:[]});
            await page.waitForTimeout(350);
            const canceled = await page.evaluate(() => {
              const trace = (window as any).__pullTrace;
              trace.running = false;
              return {
                path: location.pathname, events: trace.events, frames: trace.frames,
                sheetTop: document.querySelector(".v--det.on .lg2-detail-sheet")?.getBoundingClientRect().top ?? null,
              };
            });
            assert.equal(canceled.path, sourceItemPath, `${design}/${media}: cancel keeps the entry open`);
            assert.ok(canceled.events.some((event: any) => event.type === "touchcancel"),
              `${design}/${media}: browser delivers touchcancel`);
            assert.ok(canceled.frames.some((frame: any) =>
              frame.fingerOffset >= 18 && frame.fingerOffset <= 38 && frame.sheetTop !== null &&
              Math.abs((frame.sheetTop - (canceled.frames[0]?.sheetTop ?? frame.sheetTop)) - frame.fingerOffset) <= 5),
            `${design}/${media}: sheet tracks the finger 1:1 before cancellation`);

            await restartPullTrace();
            await dispatchPull(startY, [12,28,42,24,8,0], 95, 35);
            await page.waitForTimeout(300);
            const reversed = await page.evaluate(() => ({
              path: location.pathname,
              offset: Number(document.querySelector(".v--det.on .lg2-detail-sheet")?.getAttribute("data-lg-sheet-offset") ?? 0),
            }));
            assert.equal(reversed.path.endsWith(sourceItemPath), true,
              `${design}/${media}: reversing before the release threshold must not close`);
            assert.ok(Math.abs(reversed.offset) <= 1,
              `${design}/${media}: reversed pull must settle back at neutral offset 0 (actual ${reversed.offset})`);

            await restartPullTrace();
            await dispatchPull(startY, [12,30,55,80,105,130], 96, 40);
            await page.waitForFunction(path => location.pathname !== path, sourceItemPath, {timeout:10_000});
            const closed = await page.evaluate(() => {
              const trace = (window as any).__pullTrace;
              trace.running = false;
              return {path:location.pathname, frames:trace.frames};
            });
            assert.ok(closed.path.endsWith(sourceCategoryPath),
              `${design}/${media}: qualifying pull returns to the source category`);
            const sourceFrames = await page.evaluate(() => {
              (window as any).__staticSource.running = false;
              return (window as any).__staticSource.frames;
            });
            assert.ok(sourceFrames.length > 3);
            const firstSource = sourceFrames[0];
            assert.ok(firstSource.height >= 800, "source must have full viewport layout BEFORE closing");
            for (const frame of sourceFrames) {
              assert.equal(frame.transform, "none", "source must never scale or translate");
              assert.equal(frame.filter, "none", "source must never animate brightness");
              for (const key of ["top", "height", "width", "scrollHeight", "scrollTop"]) {
                assert.ok(Math.abs(frame[key] - firstSource[key]) < 1,
                  `${design}/${media}: source ${key} changes during close`);
              }
            }
            const closingFrames = closed.frames.filter((frame: any) =>
              frame.phase === "closing" || frame.routePhase === "closing");
            assert.ok(closingFrames.length > 0,
              `${design}/${media}: source return includes sampled successful-close frames`);
            assert.ok(closingFrames.every((frame: any) =>
              frame.heldZ === "2" && frame.heldHeritage && frame.baseZ === "1" && frame.detailZ === "3"),
            `${design}/${media}: Heritage stays held at z=2 above Home z=1 during close; it is not exposed as the base layer`);
            const sourceScrollAfterClose = await page.locator(".v--det.on .lg2-detail-scroll").last()
              .evaluate(element => element.scrollTop);
            assert.equal(sourceScrollAfterClose, sourceScrollBeforeOpen,
              `${design}/${media}: return preserves the source category scroll position`);
          });
        }
      }
    });

    for (const design of ["simple", "trend"] as const) {
      await t.test(`${design} closed entry stays offscreen until delayed history removal`, async () => {
        detailMediaMode = "photo";
        const palette = design === "trend" ? "trend" : "bordo";
        await page.goto(`${base}${sourceCategoryPath}?tenant=melipu&palette=${palette}&source=published&lang=en`, {waitUntil:"domcontentloaded"});
        await page.locator(".lg2-route-layer.v--det.on").waitFor({timeout:90_000});
        await page.locator(".v--det.on").getByRole("button", {name:/Izolana Museum — House of the Sea/}).first().click();
        await page.locator(".lg2-route-layer.v--det.on .lg2-detail-sheet").waitFor();
        await page.locator(".lg2-route-layer.v--det").evaluate(async element => {
          await Promise.all(element.getAnimations({subtree:true}).map(animation => animation.finished.catch(() => {})));
        });
        await page.evaluate(() => {
          const w = window as any;
          const outgoing = document.querySelector(".lg2-route-layer.v--det") as HTMLElement;
          const originalGo = history.go.bind(history);
          const originalBack = history.back.bind(history);
          history.go = (delta?: number) => { setTimeout(() => originalGo(delta), 450); };
          history.back = () => { setTimeout(originalBack, 450); };
          w.__closedEnd = { ended: false, removed: false, frames: [] };
          window.addEventListener("lg2:detail-close-animation-end", () => {
            w.__closedEnd.ended = true;
          }, { once: true });
          const sample = () => {
            if (!outgoing.isConnected) {
              w.__closedEnd.removed = true;
              return;
            }
            if (w.__closedEnd.ended) {
              const style = getComputedStyle(outgoing);
              w.__closedEnd.frames.push({
                y: new DOMMatrixReadOnly(style.transform).m42,
                height: outgoing.offsetHeight,
                visibility: style.visibility,
              });
            }
            requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
        const box = await page.locator(".v--det.on .lg2-detail-scroll").last().boundingBox();
        assert.ok(box);
        await dispatchPull(Math.round(Math.min(560, box.y + box.height - 70)), [12,30,55,80,105,130], 98, 40);
        await page.waitForFunction(() => (window as any).__closedEnd.removed);
        const trace = await page.evaluate(() => (window as any).__closedEnd);
        assert.ok(trace.ended);
        assert.ok(trace.frames.length >= 5, "sample delayed history traversal, not only the animation");
        assert.ok(trace.frames.every((frame: any) =>
          frame.y >= frame.height - 1 && frame.visibility === "hidden"),
        "every post-animation frame must retain the closed transform until removal");
      });

      await t.test(`${design} close waits for the longest child transition, not the route deadline`, async () => {
        await openFixtureDetail(design, "photo");
        const override = await page.addStyleTag({ content:
          '.lg2-detail-sheet[data-lg-sheet-phase="closing"], .lgs-root .v--det[data-detail-transition="closing"] .lg2-detail-sheet { transition-duration: 700ms !important; }',
        });
        await page.evaluate(() => {
          const w = window as any;
          w.__longClose = { childEnded: false, completed: false, premature: false };
          document.addEventListener("transitionend", (event: any) => {
            if (event.target?.matches?.('.lg2-detail-sheet[data-lg-sheet-phase="closing"]') &&
                event.propertyName === "transform") w.__longClose.childEnded = true;
          }, { capture: true });
          window.addEventListener("lg2:detail-close-animation-end", () => {
            w.__longClose.completed = true;
            w.__longClose.premature = !w.__longClose.childEnded;
          }, { once: true });
        });
        const box = await page.locator(".v--det.on .lg2-detail-scroll").last().boundingBox();
        assert.ok(box);
        await dispatchPull(Math.round(Math.min(560, box.y + box.height - 70)), [12,30,55,80,105,130], 97, 40);
        await page.waitForFunction(() => (window as any).__longClose.completed);
        const trace = await page.evaluate(() => (window as any).__longClose);
        assert.equal(trace.childEnded, true);
        assert.equal(trace.premature, false, "route handoff must wait for the slower child");
        await override.evaluate(element => element.remove());
      });
    }

    await t.test("Trend close ignores route transitioncancel and waits for real close transition before back-source swap", async () => {
      await openFixtureDetail("trend", "photo");
      await page.evaluate(() => {
        const w = window as any;
        w.__LG2_TEST_HOLD_CLOSE_SWAP__ = true;
        w.__closeRegression = { events: [], frames: [], running: true };
        window.addEventListener("lg2:detail-close-animation-end", () => w.__closeRegression.events.push("animation-end"));
        window.addEventListener("lg2:detail-close-handoff-frame", () => w.__closeRegression.events.push("handoff-frame"));
        window.addEventListener("lg2:detail-close-swap", () => w.__closeRegression.events.push("swap"));
        document.addEventListener("transitioncancel", (event: any) => {
          if (event.target?.matches?.(".lg2-route-layer.v--det")) w.__closeRegression.events.push(`cancel:${event.propertyName}`);
        }, true);
        function sample() {
          const trace = w.__closeRegression;
          if (!trace.running) return;
          const route = document.querySelector(".lg2-route-layer.v--det") as HTMLElement | null;
          const transform = route ? getComputedStyle(route).transform : "none";
          trace.frames.push({
            t: performance.now(), path: location.pathname,
            transition: route?.dataset.detailTransition ?? null,
            y: transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42,
            height: innerHeight,
          });
          requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      const box = await page.locator(".v--det.on .lg2-detail-scroll").last().boundingBox();
      assert.ok(box);
      const startY = Math.round(Math.min(560, box.y + box.height - 70));
      await dispatchPull(startY, [12,30,50,75,100,130], 92, 40);
      const closingRoute = page.locator(`.lg2-route-layer.v--det[data-detail-transition="closing"]`);
      await closingRoute.waitFor({state:"attached",timeout:10_000});
      await page.waitForTimeout(30);
      await page.evaluate(() => {
        const route = document.querySelector(".lg2-route-layer.v--det")!;
        route.dispatchEvent(new TransitionEvent("transitioncancel", {bubbles:true, propertyName:"transform", elapsedTime:0.08}));
      });
      await page.waitForTimeout(40);
      const afterCancel = await page.evaluate(() => ({
        path: location.pathname,
        events: (window as any).__closeRegression.events,
        phase: document.querySelector(".lg2-route-layer.v--det")?.getAttribute("data-detail-transition"),
      }));
      assert.ok(afterCancel.events.includes("cancel:transform"), "test must fire transitioncancel on the closing route");
      assert.equal(afterCancel.events.includes("animation-end"), false,
        "transitioncancel from interrupted opening/route motion must not complete the close");
      assert.equal(afterCancel.path, sourceItemPath, "source detail remains until its closing transition ends");
      await page.waitForFunction(() => (window as any).__closeRegression?.events.includes("animation-end"), {timeout:10_000});
      await page.waitForFunction(() => (window as any).__closeRegression?.events.includes("handoff-frame"), {timeout:5_000});
      const held = await page.evaluate(() => ({
        path: location.pathname,
        events: (window as any).__closeRegression.events,
        frames: (window as any).__closeRegression.frames,
      }));
      assert.equal(held.path, sourceHomePath, "the browser back source is reached after the close transition");
      assert.equal(held.events.includes("swap"), false);
      assert.ok(held.frames.some((frame: any) =>
        frame.transition === "closing" && frame.y > 2 && frame.y < frame.height - 2 && frame.path === sourceItemPath),
      "an intermediate route transform must be painted before the destination is swapped in");
      await page.evaluate(() => {
        (window as any).__closeRegression.running = false;
        window.dispatchEvent(new Event("lg2:test-release-close-swap"));
      });
      await page.waitForFunction(path => location.pathname === path, sourceHomePath, {timeout:10_000});
      await page.waitForFunction(() => (window as any).__closeRegression?.events.includes("swap"), {timeout:5_000});
      const final = await page.evaluate(() => (window as any).__closeRegression.events);
      assert.ok(final.includes("swap"), "back-source route should be swapped in after the real transition");
    });

    await t.test("opening transition interruption does not prematurely complete close when it overlaps", async opening => {
      detailMediaMode = "none";
      await page.goto(`${base}${sourceCategoryPath}?tenant=melipu&palette=trend&source=published&lang=en`, {waitUntil:"domcontentloaded"});
      await page.locator(".lg2-route-layer.v--det.on").waitFor({timeout:90_000});
      await page.waitForFunction(() =>
        Boolean(document.querySelector(".lg2-route-layer.v--det.on")?.hasAttribute("data-open-transition-end-ms")),
      null, {timeout:5_000});
      await page.evaluate(() => {
        const w = window as any;
        w.__openingInterrupt = [];
        document.addEventListener("transitionrun", (event: any) => {
          if (event.target?.matches?.(".lg2-route-layer.v--det")) {
            w.__openingInterrupt.push({type:"run", property:event.propertyName, phase:event.target.dataset.detailTransition});
          }
        }, false);
        document.addEventListener("transitioncancel", (event: any) => {
          if (event.target?.matches?.(".lg2-route-layer.v--det")) {
            w.__openingInterrupt.push({type:"cancel", property:event.propertyName, phase:event.target.dataset.detailTransition});
          }
        }, false);
        window.addEventListener("lg2:detail-close-animation-end", () => w.__openingInterrupt.push({type:"close-end"}));
      });
      await page.locator(".lg2-route-layer.v--det.on .lg2-sub2")
        .filter({hasText:/Izolana Museum/i}).first().click();
      const interruptible = await page.waitForFunction(() => {
        const route = document.querySelector(".lg2-route-layer.v--det.on") as HTMLElement | null;
        const prose = document.querySelector(".lg2-route-layer.v--det.on .lg2-detail-prose");
        const hit = document.elementFromPoint(180, 560);
        if (!route || !prose || !prose.contains(hit)) return false;
        const transform = getComputedStyle(route).transform;
        const y = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
        return y > 8 && y < innerHeight - 8 &&
          (window as any).__openingInterrupt.some((event: any) => event.type === "run");
      }, null, {timeout:3_000}).then(() => true).catch(() => false);
      if (!interruptible) {
        opening.skip("the published item did not expose a touchable sheet while its opening transform was active");
        return;
      }
      await dispatchPull(560, [15,40,70,100,130], 93, 20);
      const interrupted = await page.waitForFunction(() =>
        (window as any).__openingInterrupt.some((event: any) => event.type === "cancel"),
      null, {timeout:3_000}).then(() => true).catch(() => false);
      if (!interrupted) {
        opening.skip("the real touch did not interrupt the opening route transition on this browser run");
        return;
      }
      const afterInterrupt = await page.evaluate(() => (window as any).__openingInterrupt);
      const cancelIndex = afterInterrupt.findIndex((event: any) => event.type === "cancel");
      const closeEndIndex = afterInterrupt.findIndex((event: any) => event.type === "close-end");
      assert.ok(closeEndIndex < 0 || closeEndIndex > cancelIndex,
        "opening transitioncancel must not complete the close ahead of its closing transition");
      await page.waitForFunction(() =>
        (window as any).__openingInterrupt.some((event: any) => event.type === "close-end"),
      null, {timeout:10_000});
      await page.waitForFunction(path => location.pathname === path, sourceCategoryPath, {timeout:10_000});
      console.log("INTERRUPTED_OPENING_TRACE", afterInterrupt);
    });
  } finally {
    await browser?.close();
    vite.kill("SIGTERM");
  }
});
