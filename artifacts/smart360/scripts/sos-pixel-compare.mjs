// DEV verification: scoped pixel + computed-style parity of the SOS fixture vs binding HTML.
// Usage (from artifacts/smart360): BASE=http://localhost:80 node scripts/sos-pixel-compare.mjs
// Output: reports/sos/*.png + reports/sos/report.json
// Actual content is never altered; alignment normalisation happens only inside the comparison.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const require = createRequire(resolve(import.meta.dirname, "../package.json"));
const { chromium } = require("@playwright/test");

const BASE = process.env.BASE ?? "http://localhost:80";
const REF = "file://" + resolve(import.meta.dirname, "../../../attached_assets/sos-dizajn_1790801495037.html");
const OUT = resolve(import.meta.dirname, "../reports/sos");
mkdirSync(OUT, { recursive: true });
const FIXED_NOW = new Date("2026-06-01T10:00:00Z"); // fixture emits fix at now-3000ms => "pred 3 s"
const THRESH = 48; // summed RGB delta per pixel counted as different

let exe; try { exe = execSync("which chromium").toString().trim(); } catch { /* bundled */ }
const browser = await chromium.launch({ executablePath: exe || undefined });
const PROPS = ["font-size","font-weight","font-family","color","background-color","background-image","border-top-width","border-top-color","border-radius","padding-top","padding-left","margin-bottom","line-height","letter-spacing","text-align","box-shadow"];
const S2 = "?state=active&lang=sl";
const pairs = [
  { name: "card", ref: ".phone:nth-of-type(1) .soscard", act: ".sos-scope.soscard", url: "?state=active&lang=sl&view=card" },
  { name: "coord", ref: ".phone:nth-of-type(2) .coord", act: ".sos-overlay .coord", url: S2 },
  { name: "near", ref: ".phone:nth-of-type(2) .near", act: ".sos-overlay .near", url: S2 },
  { name: "call112", ref: ".phone:nth-of-type(2) .call112", act: ".sos-overlay .call112", url: S2 },
  { name: "secrow", ref: ".phone:nth-of-type(2) .secrow", act: ".sos-overlay .secrow", url: S2 },
  { name: "guide", ref: ".phone:nth-of-type(2) .guide", act: ".sos-overlay .guide", url: S2 },
  { name: "priv", ref: ".phone:nth-of-type(2) .priv", act: ".sos-overlay .priv", url: S2 },
];

async function grab(page, sel) {
  const el = page.locator(sel).first();
  await el.waitFor();
  const box = await el.boundingBox();
  const png = await el.screenshot({ animations: "disabled", caret: "hide" });
  const info = await el.evaluate((n, P) => {
    const c = getComputedStyle(n);
    return { styles: Object.fromEntries(P.map((p) => [p, c.getPropertyValue(p)])), text: n.innerText.replace(/\s+/g, " ").trim() };
  }, PROPS);
  return { box, png, ...info };
}

// Raster-alignment normalisation: nudge the REFERENCE mock page (never the app) by the
// sub-pixel delta so both elements start on the same fractional pixel offset.
async function grabAligned(page, sel, actBox) {
  await page.evaluate(() => { document.body.style.position = ""; document.body.style.top = ""; document.body.style.left = ""; });
  const b0 = await page.locator(sel).first().boundingBox();
  const fr = (v) => v - Math.floor(v);
  let dy = fr(actBox.y) - fr(b0.y), dx = fr(actBox.x) - fr(b0.x);
  await page.evaluate(([dx, dy]) => { document.body.style.position = "relative"; document.body.style.top = dy + "px"; document.body.style.left = dx + "px"; }, [dx, dy]);
  const g = await grab(page, sel);
  g.alignNudge = { dx: +dx.toFixed(4), dy: +dy.toFixed(4) };
  return g;
}

// Compare in a blank page via canvas. Tries integer shifts dx,dy in [-1..1] to separate
// raster/sub-pixel alignment from real differences; emits diff image for shift 0 and best.
async function compare(page, a, b) {
  return page.evaluate(async ([a, b, T]) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + s; });
    const [A, B] = await Promise.all([load(a), load(b)]);
    const W = Math.max(A.width, B.width), H = Math.max(A.height, B.height);
    const px = (I) => { const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.drawImage(I, 0, 0); return x.getImageData(0, 0, W, H).data; };
    const da = px(A), db = px(B);
    const run = (dx, dy, draw) => {
      let bad = 0, n = 0, minX = W, minY = H, maxX = -1, maxY = -1;
      const c = draw ? document.createElement("canvas") : null; let img, out;
      if (c) { c.width = W; c.height = H; out = c.getContext("2d"); img = out.createImageData(W, H); }
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = (y * W + x) * 4, j = ((y + dy) * W + (x + dx)) * 4; n++;
        const d = Math.abs(da[i]-db[j]) + Math.abs(da[i+1]-db[j+1]) + Math.abs(da[i+2]-db[j+2]);
        const diff = d > T;
        if (diff) { bad++; if (x<minX)minX=x; if (y<minY)minY=y; if (x>maxX)maxX=x; if (y>maxY)maxY=y; }
        if (img) { const g = da[i] * 0.3; img.data[i]=diff?255:g; img.data[i+1]=diff?0:g; img.data[i+2]=diff?255:g; img.data[i+3]=255; }
      }
      if (img) out.putImageData(img, 0, 0);
      return { dx, dy, diffPixels: bad, diffPct: +(100 * bad / n).toFixed(2), diffBBox: maxX < 0 ? null : [minX, minY, maxX, maxY], png: c ? c.toDataURL("image/png").split(",")[1] : null };
    };
    const zero = run(0, 0, true);
    let best = zero;
    for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) { if (!dx && !dy) continue; const r = run(dx, dy, false); if (r.diffPixels < best.diffPixels) best = r; }
    if (best !== zero) best = run(best.dx, best.dy, true);
    return { refSize: [A.width, A.height], actSize: [B.width, B.height], zero, best };
  }, [a.toString("base64"), b.toString("base64"), THRESH]);
}

// Row-band breakdown to locate residual differences (e.g. in the 112 button).
async function bands(page, diffPng, n = 6) {
  return page.evaluate(async ([s, n]) => {
    const i = await new Promise((r) => { const m = new Image(); m.onload = () => r(m); m.src = "data:image/png;base64," + s; });
    const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0);
    const d = x.getImageData(0, 0, i.width, i.height).data; const cols = Array(n).fill(0);
    for (let y = 0; y < i.height; y++) for (let X = 0; X < i.width; X++) { const k = (y*i.width+X)*4; if (d[k]===255&&d[k+1]===0&&d[k+2]===255) cols[Math.min(n-1, Math.floor(X*n/i.width))]++; }
    return cols.map((v, k) => ({ xRange: [Math.round(k*i.width/n), Math.round((k+1)*i.width/n)], diffPixels: v }));
  }, [diffPng, n]);
}

const refPage = await browser.newPage({ viewport: { width: 414, height: 2400 } }); // .phone renders at its full 390px
await refPage.goto(REF);
const actCtx = await browser.newContext({ viewport: { width: 390, height: 2400 } });
const act = await actCtx.newPage();
await act.clock.setFixedTime(FIXED_NOW);
const blank = await browser.newPage();

const report = { base: BASE, reference: REF, viewport: { actual: 390, reference: "414 (phone frame 390)" }, threshold: THRESH, frozenClock: FIXED_NOW.toISOString(), elements: [] };
const save = (name, b64) => writeFileSync(resolve(OUT, name), Buffer.from(b64, "base64"));

let lastUrl = "";
for (const p of pairs) {
  if (p.url !== lastUrl) { await act.goto(BASE + "/__sos-fixture" + p.url); await act.waitForTimeout(600); lastUrl = p.url; }
  const a = await grab(act, p.act);
  const r = await grabAligned(refPage, p.ref, a.box);
  writeFileSync(resolve(OUT, `${p.name}-reference.png`), r.png);
  writeFileSync(resolve(OUT, `${p.name}-actual.png`), a.png);
  const c = await compare(blank, r.png, a.png);
  save(`${p.name}-diff.png`, c.zero.png);
  if (c.best !== c.zero) save(`${p.name}-diff-bestshift.png`, c.best.png);
  const entry = {
    element: p.name,
    refBox: r.box, actBox: a.box, referenceAlignNudgePx: r.alignNudge,
    refText: r.text, actText: a.text, textEqual: r.text === a.text,
    refSize: c.refSize, actSize: c.actSize,
    shift0: { diffPixels: c.zero.diffPixels, diffPct: c.zero.diffPct, diffBBox: c.zero.diffBBox },
    bestShift: { dx: c.best.dx, dy: c.best.dy, diffPixels: c.best.diffPixels, diffPct: c.best.diffPct, diffBBox: c.best.diffBBox },
    styleDiffs: PROPS.filter((k) => r.styles[k] !== a.styles[k]).map((k) => ({ prop: k, ref: r.styles[k], act: a.styles[k] })),
  };
  if (p.name === "call112") entry.diffColumns = await bands(blank, c.best.png ?? c.zero.png, 8);
  report.elements.push(entry);
}

// Screen 2 overall (reference phone vs actual view content, same width; actual cropped to reference height).
await act.goto(BASE + "/__sos-fixture" + S2); await act.waitForTimeout(600);
const actBox0 = await act.locator(".sos-overlay .sos-scope.phone").boundingBox();
await grabAligned(refPage, ".phone:nth-of-type(2)", actBox0);
const refPhone = refPage.locator(".phone:nth-of-type(2)");
const refBox = await refPhone.boundingBox();
const refShot = await refPhone.screenshot({ animations: "disabled" });
const actBox = await act.locator(".sos-overlay .sos-scope.phone").boundingBox();
const actShot = await act.screenshot({ animations: "disabled", clip: { x: actBox.x, y: actBox.y, width: actBox.width, height: Math.min(actBox.height, refBox.height) } });
writeFileSync(resolve(OUT, "screen2-reference.png"), refShot);
writeFileSync(resolve(OUT, "screen2-actual.png"), actShot);
const s2 = await compare(blank, refShot, actShot);
save("screen2-diff.png", s2.zero.png);
report.screen2 = {
  refBox, actBox, refSize: s2.refSize, actSize: s2.actSize,
  shift0: { diffPct: s2.zero.diffPct, diffPixels: s2.zero.diffPixels },
  bestShift: { dx: s2.best.dx, dy: s2.best.dy, diffPct: s2.best.diffPct },
  note: "Whole-screen diff includes known intentional deviations: close button, reference .caption omitted in app, phone corner radius/shadow of mock frame. Not a pixel-identity claim.",
};

writeFileSync(resolve(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
