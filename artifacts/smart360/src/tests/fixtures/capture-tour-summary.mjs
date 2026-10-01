// DEV-only single Chromium pass over the real shared tour-summary panel (synthetic Ljubljana tour).
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const OUT = "reports/tour-summary";
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const base = `https://${process.env.REPLIT_DEV_DOMAIN}/src/tests/fixtures/tour-summary.html`;
const R = { runs: {}, nonGet: [], leaks: [], mapRequests: {}, console: [] };

async function open({ query = "", share = "none", blockTiles = false, viewport = { width: 390, height: 844 } }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true, deviceScaleFactor: 1 });
  ctx.on("request", r => {
    if (!["GET", "HEAD"].includes(r.method())) R.nonGet.push([r.method(), r.url()]);
    if (/46\.05\d|14\.50\d|weightKg/.test(`${r.url()} ${r.postData() || ""}`) && !/fixtures|\/src\//.test(r.url())) R.leaks.push(r.url());
  });
  if (blockTiles) await ctx.route(/openfreemap|tiles\./, r => r.abort());
  await ctx.addInitScript(mode => {
    window.__shares = []; window.__canShareCalls = 0;
    if (mode === "none") { Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined }); Object.defineProperty(navigator, "share", { configurable: true, value: undefined }); }
    else {
      Object.defineProperty(navigator, "canShare", { configurable: true, value: d => { window.__canShareCalls++; return !!d.files; } });
      Object.defineProperty(navigator, "share", { configurable: true, value: async d => {
        const f = d.files[0]; window.__shares.push({ name: f.name, type: f.type, bytes: Array.from(new Uint8Array(await f.arrayBuffer())) });
        if (mode === "abort") { const e = new Error("cancel"); e.name = "AbortError"; throw e; }
      } });
    }
  }, share);
  const page = await ctx.newPage();
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") R.console.push(`${query}: ${m.text().slice(0, 200)}`); });
  const mapReq = [];
  page.on("response", r => { if (/openfreemap|tiles\./.test(r.url())) mapReq.push([r.status(), r.url().replace(/\?.*/, "").slice(0, 90), r.headers()["access-control-allow-origin"] || ""]); });
  page.on("requestfailed", r => { if (/openfreemap|tiles\./.test(r.url())) mapReq.push(["FAILED " + r.failure()?.errorText, r.url().slice(0, 90)]); });
  await page.goto(`${base}?${query}`);
  await page.getByTestId("img-tour-summary").or(page.getByTestId("status-tour-summary-error")).waitFor({ timeout: 60000 });
  return { ctx, page, mapReq };
}
const previewBytes = page => page.evaluate(async () => {
  const img = document.querySelector('[data-testid="img-tour-summary"]');
  const b = await (await fetch(img.src)).arrayBuffer();
  return { bytes: Array.from(new Uint8Array(b)), nw: img.naturalWidth, nh: img.naturalHeight, kind: img.dataset.mapKind, w: img.clientWidth, h: img.clientHeight };
});
const sha = bytes => execFileSync("sha256sum", { input: Buffer.from(bytes) }).toString().slice(0, 16);

// 1) Real map, guided, sl, hiking, no kcal: download + metrics + screenshots
{
  const { ctx, page, mapReq } = await open({ query: "mode=guided&lang=sl&activity=hiking" });
  const p = await previewBytes(page);
  await writeFile(`${OUT}/export-map-guided-sl.png`, Buffer.from(p.bytes));
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("button-tour-download-image").click()]);
  const dlBytes = await readFile(await dl.path());
  const dims = { width: dlBytes.readUInt32BE(16), height: dlBytes.readUInt32BE(20) };
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  const boxes = {};
  for (const id of ["img-tour-summary", "button-tour-share", "button-tour-download-image", "button-tour-download-gpx"]) boxes[id] = await page.getByTestId(id).boundingBox();
  await page.screenshot({ path: `${OUT}/mobile-390-guided-sl.png`, fullPage: true });
  await page.getByTestId("img-tour-summary").screenshot({ path: `${OUT}/onscreen-preview-guided-sl.png` });
  R.runs.mapGuidedSl = { kind: p.kind, natural: [p.nw, p.nh], displayed: [p.w, p.h], previewSha: sha(p.bytes), downloadSha: sha(dlBytes), downloadName: dl.suggestedFilename(), dims, overflow, boxes };
  R.mapRequests.success = mapReq.slice(0, 12).concat([[`total ${mapReq.length}`]]);
  assert.equal(sha(p.bytes), sha(dlBytes)); assert.ok(dims.width >= 1080); assert.ok(overflow.sw <= overflow.cw);
  await ctx.close();
}
// 2) Unsupported share -> download fallback same bytes + hint
{
  const { ctx, page } = await open({ query: "mode=free&lang=en&activity=running", share: "none" });
  const p = await previewBytes(page);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("button-tour-share").click()]);
  const b = await readFile(await dl.path());
  const hint = await page.getByTestId("status-tour-share-hint").textContent();
  await writeFile(`${OUT}/export-${p.kind}-free-en-running.png`, Buffer.from(p.bytes));
  R.runs.shareUnsupported = { kind: p.kind, same: sha(b) === sha(p.bytes), hint };
  assert.equal(sha(b), sha(p.bytes));
  await ctx.close();
}
// 3) Share supported: same File; AbortError -> no download
for (const mode of ["ok", "abort"]) {
  const { ctx, page } = await open({ query: "mode=guided&lang=de&activity=cycling&kcal=1", share: mode });
  const p = await previewBytes(page);
  let downloaded = false; page.on("download", () => { downloaded = true; });
  await page.getByTestId("button-tour-share").click(); await page.waitForTimeout(800);
  const s = await page.evaluate(() => ({ shares: window.__shares.map(x => ({ ...x, bytes: x.bytes })), calls: window.__canShareCalls, hint: document.querySelector('[data-testid="status-tour-share-hint"]')?.textContent ?? null }));
  if (mode === "ok") await writeFile(`${OUT}/export-${p.kind}-guided-de-cycling-kcal.png`, Buffer.from(p.bytes));
  R.runs[`share_${mode}`] = { kind: p.kind, canShareCalls: s.calls, shared: s.shares.length, sameBytes: s.shares[0] ? sha(s.shares[0].bytes) === sha(p.bytes) : false, type: s.shares[0]?.type, name: s.shares[0]?.name, downloaded, hint: s.hint };
  assert.equal(downloaded, false);
  await ctx.close();
}
// 4) Tiles blocked -> schematic fallback; offline
{
  const { ctx, page, mapReq } = await open({ query: "mode=guided&lang=it&activity=hiking", blockTiles: true });
  const p = await previewBytes(page);
  await writeFile(`${OUT}/export-schematic-blocked-it.png`, Buffer.from(p.bytes));
  R.runs.tilesBlocked = { kind: p.kind, mapReqs: mapReq.length };
  await ctx.close();
}
{
  const { ctx, page } = await open({ query: "mode=free&lang=sl&activity=hiking&kcal=1" });
  await ctx.setOffline(true);
  await page.reload().catch(() => {});
  R.runs.offlineReloadNote = "offline reload of DEV server impossible; offline path covered by navigator.onLine guard in captureTourMap (unit-level)";
  await ctx.close();
}
// 5) Language/activity/kcal canvas labels via composer model, all 4 langs
for (const lang of ["sl", "en", "de", "it"]) {
  for (const [activity, kcal] of [["hiking", 0], ["running", 0], ["cycling", 1]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route(/openfreemap|tiles\./, r => r.abort());
    await ctx.addInitScript(() => { window.__labels = []; const o = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { window.__labels.push(String(t)); return o.call(this, t, ...a); }; });
    const page = await ctx.newPage();
    await page.goto(`${base}?mode=free&lang=${lang}&activity=${activity}&kcal=${kcal}`);
    await page.getByTestId("img-tour-summary").waitFor({ timeout: 60000 });
    const labels = [...new Set(await page.evaluate(() => window.__labels))];
    const ui = await page.getByTestId("button-tour-share").textContent();
    R.runs[`labels_${lang}_${activity}_k${kcal}`] = { ui, labels: labels.filter(l => l.length < 40) };
    await ctx.close();
  }
}
// 6) Desktop 1280 layout
{
  const { ctx, page } = await open({ query: "mode=guided&lang=sl", viewport: { width: 1280, height: 900 } });
  await page.screenshot({ path: `${OUT}/desktop-1280-guided-sl.png`, fullPage: true });
  await ctx.close();
}
await writeFile(`${OUT}/observations.json`, JSON.stringify(R, null, 2));
await browser.close();
console.log(JSON.stringify(R, (k, v) => k === "labels" ? v.join(" | ") : v, 1).slice(0, 9000));
