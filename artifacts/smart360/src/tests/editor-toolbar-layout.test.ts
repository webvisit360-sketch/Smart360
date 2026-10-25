import test from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

// Real production forms, synthetic data, no authentication or database writes.
test("inline edit actions stay inside their own panel and deletion names its category", {timeout:300_000}, async t => {
  const port = await new Promise<number>(done => {
    const server = createServer();
    server.listen(0,"127.0.0.1", () => {
      const port = (server.address() as {port:number}).port;
      server.close(() => done(port));
    });
  });
  const vite = spawn(process.execPath,[resolve("node_modules/vite/bin/vite.js"),"--host","127.0.0.1","--strictPort"], {
    env:{...process.env,PORT:String(port),BASE_PATH:"/"},stdio:"pipe",
  });
  let logs = "";
  vite.stdout.on("data", b => {logs += b;});
  vite.stderr.on("data", b => {logs += b;});
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i=0;i<300;i++) {
      if (await fetch(base).then(r=>r.ok).catch(()=>false)) break;
      assert.equal(vite.exitCode,null,logs);
      await new Promise(r=>setTimeout(r,100));
      if(i===299) assert.fail(logs);
    }
    browser = await chromium.launch({executablePath:execFileSync("which",["chromium"],{encoding:"utf8"}).trim(),args:["--no-sandbox"]});
    const page = await browser.newPage();
    page.setDefaultTimeout(20_000);
    await page.route("https://fonts.googleapis.com/**", route=>route.abort());
    await page.route("https://fonts.gstatic.com/**", route=>route.abort());
    const writes: string[] = [];
    await page.route("**/api/**",route => {
      if (!["GET","HEAD"].includes(route.request().method())) writes.push(route.request().url());
      return route.fulfill({json:[]});
    });
    for (const width of [1440,1280,390]) {
      await page.setViewportSize({width,height:width===390?844:800});
      for (const kind of ["category","section","item"]) {
        t.diagnostic(`Checking ${kind} at ${width}px`);
        await page.goto(`${base}/src/tests/fixtures/editor-toolbar.html?kind=${kind}`, {waitUntil:"domcontentloaded",timeout:90_000});
        const panel = page.locator("[data-preview-inline-editor]");
        await panel.waitFor();
        for (const scrollY of [0,320,650]) {
          await page.evaluate(y=>window.scrollTo(0,y),scrollY);
          const bounds = await panel.evaluate(el => {
            const p=el.getBoundingClientRect();
            const buttons = [...el.querySelectorAll("button")].filter(b=>["Shrani","Prekliči","Izbriši kategorijo"].includes(b.textContent?.trim()??""));
            return {
              panel:{left:p.left,right:p.right,top:p.top,bottom:p.bottom},
              actions:buttons.map(b=>{const r=b.getBoundingClientRect();return {label:b.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom};}),
              following:document.querySelector("[data-following-row]")!.getBoundingClientRect().top,
            };
          });
          assert.ok(bounds.actions.length>=2);
          assert.ok(bounds.following>=bounds.panel.bottom,JSON.stringify({width,kind,bounds}));
          for(const action of bounds.actions) {
            assert.ok(action.top>=bounds.panel.top && action.bottom<=bounds.panel.bottom &&
              action.left>=bounds.panel.left && action.right<=bounds.panel.right,
              JSON.stringify({width,kind,scrollY,bounds}));
          }
        }
        if(kind==="category") {
          const confirmation = page.waitForEvent("dialog").then(async dialog=>{
            const message=dialog.message();
            await dialog.dismiss();
            return message;
          });
          await page.getByRole("button",{name:"Izbriši kategorijo",exact:true}).click();
          assert.match(await confirmation,/Izbrišem kategorijo "Hišni red"\?/);
        }
      }
    }
    await page.goto(`${base}/src/tests/fixtures/editor-toolbar.html?kind=category&restricted`,{waitUntil:"domcontentloaded"});
    await page.getByTestId("status-content-draft-restricted").waitFor();
    for (const label of ["Izbriši kategorijo","Prekliči","Shrani"]) {
      assert.equal(await page.getByRole("button",{name:label,exact:true}).isDisabled(),true);
    }
    assert.deepEqual(writes,[],"Cancelling deletion must not send a write");
  } finally {
    await browser?.close();
    vite.kill("SIGTERM");
  }
});
