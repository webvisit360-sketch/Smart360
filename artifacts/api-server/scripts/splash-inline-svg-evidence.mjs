// Isolated source-derived actual JSX/CSS fixtures. Does not start the app, access
// auth/API/DB, regenerate artwork, or mutate App.tsx/index.css.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import sharp from "sharp";
import { chromium } from "@playwright/test";
import { transform } from "esbuild";
import React from "../../smart360/node_modules/react/index.js";
import { renderToStaticMarkup } from "../../smart360/node_modules/react-dom/server.node.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const report = path.join(root, "reports/splash-inline-svg");
const src = path.join(root, "artifacts/smart360/src");
const oldDir = path.join(report, "before-source");
const read = async file => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const oldApp = await read(path.join(oldDir, "App.tsx"));
const oldCss = await read(path.join(oldDir, "index.css"));
const newApp = await read(path.join(src, "App.tsx"));
const newCss = await read(path.join(src, "index.css"));
const rawImport = newApp.match(/import\s+(\w+)\s+from\s+['"]([^'"]+\.svg)\?raw['"]/);
assert.ok(rawImport, "NEW must import canonical SVG as raw");
assert.equal(rawImport[2], "../public/brand/smart360-kolobar-faceted.svg");
const svg = await read(path.resolve(src, rawImport[2]));
const rasterPath = path.join(root, "artifacts/smart360/public/brand/smart360-znak-40.png");
const raster = await readFile(rasterPath);
const rasterMeta = await sharp(raster).metadata();
assert.equal(rasterMeta.width, 80, "OLD is the current faceted 80px raster");
assert.equal(rasterMeta.height, 80);
await mkdir(path.join(report, "after-source"), { recursive: true });
await writeFile(path.join(oldDir, "smart360-znak-40.png"), raster);
await writeFile(path.join(report, "after-source/App.tsx"), newApp);
await writeFile(path.join(report, "after-source/index.css"), newCss);
await writeFile(path.join(report, "after-source/smart360-kolobar-faceted.svg"), svg);

const data = (buffer, type) => `data:${type};base64,${buffer.toString("base64")}`;
const markData = data(raster, "image/png");
const fontData = data(await readFile(path.join(root, "artifacts/smart360/public/fonts/Archivo-800.ttf")), "font/ttf");
const brandSource = await read(path.join(src, "lib/brand.ts"));
const tagline = JSON.parse(brandSource.match(/BRAND_TAGLINE\s*=\s*("[^"]+")/)[1]);
function splashReturn(app) {
  const start = app.indexOf("  return (\n    <div\n      className={`guest-entry-splash");
  const end = app.indexOf("\n}\n\n/**", start);
  assert.ok(start >= 0 && end > start, "Actual splash JSX must be located");
  return app.slice(start, end);
}
function lifecycle(app) {
  return app.slice(app.indexOf("function GuestEntrySplash"), app.indexOf(splashReturn(app)));
}
assert.equal(lifecycle(oldApp), lifecycle(newApp), "Splash timers/lifecycle must be unchanged");
function splashCss(css) {
  return css.slice(css.indexOf(".guest-entry-splash {"), css.indexOf(".guest-load-failure {"));
}
assert.equal(splashCss(oldCss).replaceAll(".guest-entry-splash__mark img", ".guest-entry-splash__mark svg"),
  splashCss(newCss), "Only splash CSS selector may change");
assert.ok(splashReturn(oldApp).includes("<img"));
assert.ok(splashReturn(newApp).includes(`dangerouslySetInnerHTML={{ __html: ${rawImport[1]} }}`));

async function fixture(app, css, mode) {
  const jsx = splashReturn(app).replace(/`\$\{import.meta.env.BASE_URL\}brand\/smart360-znak-40.png(?:\?v=faceted-1)?`/g, JSON.stringify(markData));
  const compiled = await transform(`function Splash(){const phase="visible",hide=()=>{};${jsx}}\nreturn Splash;`,
    { loader: "tsx", jsxFactory: "React.createElement" });
  const Splash = new Function("React", "BRAND_TAGLINE", rawImport[1], compiled.code)(React, tagline, svg);
  const markup = renderToStaticMarkup(React.createElement(Splash));
  if (mode === "new") {
    assert.ok(markup.includes(svg), "NEW must inject the imported canonical raw SVG byte-for-byte");
    assert.ok(!markup.includes("<img"), "NEW must not use an SVG image fallback");
  }
  // Same self-contained font treatment as brand-unification-frontend.mjs.
  // Browser system fallback renders Inter in both sides (not a live app claim).
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${mode} source-derived splash fixture</title><style>@font-face{font-family:Archivo;src:url("${fontData}");font-weight:800}${css.replace(/@import[^;]+;/g, "")}body{margin:0}</style>${markup}</html>`;
}
const fixtures = { old: await fixture(oldApp, oldCss, "old"), new: await fixture(newApp, newCss, "new") };
for (const [mode, html] of Object.entries(fixtures)) await writeFile(path.join(report, `${mode}-fixture.html`), html);
const browser = await chromium.launch({
  executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  args: ["--no-sandbox"],
});
const measurements = [];
try {
  for (const viewport of [{ width: 1280, height: 844 }, { width: 390, height: 844 }]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const pair = {};
      for (const mode of ["old", "new"]) {
        const page = await browser.newPage({ viewport, deviceScaleFactor: 3, reducedMotion });
        await page.setContent(fixtures[mode]);
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all([...document.images].map(image => image.decode()));
          document.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 1800; });
        });
        const metrics = await page.evaluate(() => {
          const info = selector => {
            const el = document.querySelector(selector), rect = el.getBoundingClientRect(), css = getComputedStyle(el);
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
              font: css.font, letterSpacing: css.letterSpacing, color: css.color,
              textAlign: css.textAlign, textTransform: css.textTransform,
              transform: css.transform, transformOrigin: css.transformOrigin,
              opacity: css.opacity, animation: css.animation, animationName: css.animationName, transition: css.transition };
          };
          return { dpr: devicePixelRatio, splash: info(".guest-entry-splash"),
            mark: info(".guest-entry-splash__mark"), artwork: info(".guest-entry-splash__mark > img, .guest-entry-splash__mark > svg"),
            wordmark: info(".guest-entry-splash__wordmark"), subtitle: info(".guest-entry-splash__subtitle"),
            tagline: info(".guest-entry-splash__tagline-text"),
            lines: [...document.querySelectorAll(".guest-entry-splash__tagline-part")].map(el => ({
              text: el.textContent, y: el.getBoundingClientRect().y, height: el.getBoundingClientRect().height })),
            animations: document.getAnimations().map(a => ({ name: a.animationName, currentTime: a.currentTime,
              duration: a.effect.getTiming().duration, delay: a.effect.getTiming().delay, iterations: String(a.effect.getTiming().iterations) })) };
        });
        assert.equal(metrics.mark.width, 104);
        assert.equal(metrics.mark.height, 104);
        assert.equal(metrics.dpr, 3);
        assert.equal(metrics.lines[0].y === metrics.lines[1].y, viewport.width >= 480);
        assert.equal(metrics.tagline.y - metrics.wordmark.y - metrics.wordmark.height, 18);
        if (reducedMotion === "reduce") {
          assert.equal(metrics.artwork.transform, "none");
          assert.equal(metrics.artwork.animationName, "none");
        } else {
          assert.ok(metrics.artwork.animation.includes("5.4s"));
          assert.notEqual(metrics.artwork.transform, "none");
          const at1800 = metrics.artwork.transform;
          await page.evaluate(() => document.getAnimations().forEach(a => { a.currentTime = 1980; }));
          const later = await page.locator(".guest-entry-splash__mark > img, .guest-entry-splash__mark > svg").evaluate(el => getComputedStyle(el).transform);
          assert.notEqual(at1800, later, "Rotation continues at 1980ms");
          await page.evaluate(() => document.getAnimations().forEach(a => { a.currentTime = 1800; }));
          const file = `${mode}-${viewport.width}-dpr3.png`;
          const screenshot = await page.screenshot({ path: path.join(report, file), scale: "device" });
          const metadata = await sharp(screenshot).metadata();
          assert.equal(metadata.width, viewport.width * 3);
          assert.equal(metadata.height, viewport.height * 3);
          // Crop from native screenshot pixels without resizing; wrapper is 104 CSS px.
          await sharp(screenshot).extract({ left: Math.round(metrics.mark.x * 3), top: Math.round(metrics.mark.y * 3),
            width: 312, height: 312 }).png().toFile(path.join(report, `${mode}-${viewport.width}-mark-native312.png`));
        }
        pair[mode] = metrics;
        await page.close();
      }
      assert.deepEqual(pair.old, pair.new, `All computed layout/timing/line metrics identical at ${viewport.width}/${reducedMotion}`);
      measurements.push({ viewport, reducedMotion, identical: true, ...pair });
    }
  }
} finally { await browser.close(); }
const hash = input => createHash("sha256").update(input).digest("hex");
const audit = { fixture: "Source-derived actual splash JSX/CSS, not authenticated UI or full app",
  oldSource: "git HEAD before inline SVG switch; current faceted 80×80 raster (not older pre-faceted artwork)",
  newSource: "App.tsx actual dangerouslySetInnerHTML with its imported raw canonical SVG",
  canonicalSha256: hash(svg), oldRasterSha256: hash(raster), animationTimeMs: 1800, deviceScaleFactor: 3,
  nativeScreenshotSizes: ["3840×2532 (1280×844 CSS)", "1170×2532 (390×844 CSS)"],
  crop: "104×104 CSS wrapper = 312×312 native screenshot pixels, extracted without scaling",
  sourceTimingUnchanged: true, sourceCssOnlySelectorChanged: true, measurements };
await writeFile(path.join(report, "verification.json"), JSON.stringify(audit, null, 2));
const embed = async name => data(await readFile(path.join(report, name)), "image/png");
let sections = "";
for (const width of [1280, 390]) {
  sections += `<h2>${width === 1280 ? "Desktop" : "390px mobile"} — native 312×312 mark crop</h2><div class="pair">`;
  for (const mode of ["old", "new"]) sections += `<figure><figcaption>${mode.toUpperCase()} · ${mode === "old" ? "80×80 raster" : "inline canonical SVG"} · DPR 3 · 1800ms</figcaption><img src="${await embed(`${mode}-${width}-mark-native312.png`)}" width="312" height="312" alt="${mode} native mark crop"></figure>`;
  sections += `</div><details><summary>Full native PNGs at 100% — ${width * 3}×2532 each (scroll horizontally; no rescaling)</summary>`;
  for (const mode of ["old", "new"]) sections += `<h3>${mode.toUpperCase()}</h3><div class="native"><img src="${await embed(`${mode}-${width}-dpr3.png`)}" width="${width * 3}" height="2532" alt="${mode} full native ${width}px fixture"></div>`;
  sections += "</details>";
}
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Smart360 splash: raster vs inline SVG — DPR3</title><style>body{font:15px/1.5 system-ui;margin:32px;color:#121a14}h1{font-size:26px}.pair{display:flex;gap:28px;flex-wrap:wrap}figure{margin:0}figcaption{margin-bottom:8px}.native{overflow:auto;border:1px solid #ccc}img{display:block;max-width:none;image-rendering:auto}details{margin:24px 0}pre{white-space:pre-wrap;font-size:12px}code{background:#eee}</style><h1>Smart360 splash — OLD raster vs NEW inline canonical SVG</h1><p><strong>Isolated source-derived actual JSX/CSS fixtures, not authenticated application screenshots.</strong> OLD uses the current faceted 80×80 PNG at 104×104 CSS px. NEW executes the actual App.tsx dangerouslySetInnerHTML JSX with the SVG imported by its raw canonical path. No brand assets were regenerated.</p><p>Chromium · DPR 3 · identical 1800ms animation time (120° of the 5.4s rotation). All images have native pixel dimensions; there is <strong>no report resizing</strong>. At browser zoom 100%, one PNG pixel occupies one CSS pixel in this report, irrespective of the viewer’s own screen DPR. These native crops intentionally appear 312px wide here: the original splash footprint was 104 CSS px × capture DPR 3 = 312 physical screenshot pixels. Full native PNGs are in expandable scrollable panels below.</p><p><strong>PASS:</strong> desktop and 390px mobile computed layout, fonts, colors, transforms, animation timing, opacity, and slogan line positions match exactly. Desktop slogan is one line; mobile is two. Source lifecycle timers (2500ms minimum, 3200ms safety, 420ms exit) are identical. CSS is identical after the img→svg selector substitution. Reduced motion: artwork animation and transform are none on both sides. Rotation changes when advanced from 1800ms to 1980ms on both sides. Archivo-800 is embedded; Inter uses the same browser/system fallback on both sides, following the existing source-fixture technique.</p>${sections}<details><summary>Verification metrics and provenance</summary><pre>${JSON.stringify(audit, null, 2).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</pre></details></html>`;
await writeFile(path.join(report, "comparison.html"), html);
console.log(`PASS: ${measurements.length} old/new pairs; native DPR3 desktop/mobile PNGs, crops, source snapshots, self-contained comparison.html and verification.json in ${report}`);