// Source-derived isolated browser fixtures, not authenticated application screenshots.
// Run before regeneration first, then after. Never overwrites archived assets.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { chromium } from "@playwright/test";
import { transform } from "esbuild";
import React from "../../smart360/node_modules/react/index.js";
import { renderToStaticMarkup } from "../../smart360/node_modules/react-dom/server.node.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const brand = path.join(root, "artifacts/smart360/public/brand");
const report = path.join(root, "reports/brand-unification");
const before = path.join(report, "before/brand");
const mode = process.argv[2];
const svg = await readFile(path.join(brand, "smart360-kolobar-faceted.svg"));
async function renderMark(size, background) {
  const mark = await sharp(svg, { density: 72 * size * 4 / 1000 }).png().toBuffer();
  const large = await sharp({ create: { width: size * 4, height: size * 4, channels: 4, background } })
    .composite([{ input: mark }]).png().toBuffer();
  return sharp(large).resize(size, size, { kernel: "lanczos3" }).png().toBuffer();
}
if (mode === "generate") {
  for (const [name, size] of [["smart360-znak-40.png", 80], ["smart360-email-header-60.png", 60], ["smart360-email-header-138.png", 138]]) {
    await writeFile(path.join(brand, name), await sharp(await renderMark(size, "#ffffff")).removeAlpha().png().toBuffer());
  }
  const oldLockup = await readFile(path.join(before, "smart360-email-lockup-558x138.png"));
  // Replace only the square mark; wordmark and its spacing remain pixel-identical.
  await sharp(oldLockup).composite([{ input: await renderMark(138, "#ffffff"), left: 0, top: 0 }])
    .removeAlpha().png().toFile(path.join(brand, "smart360-email-lockup-558x138.png"));
  const mark = await sharp(svg, { density: 72 * 142 * 4 / 1000 }).png().toBuffer();
  const large = await sharp({ create: { width: 768, height: 768, channels: 3, background: "#121a14" } })
    .composite([{ input: mark, top: 100, left: 100 }]).png().toBuffer();
  const downsampled = await sharp(large).resize(192, 192, { kernel: "lanczos3" }).png().toBuffer();
  // Keep the existing occupied 142px square; discard Lanczos ringing beyond it.
  const tile = await sharp(downsampled).extract({ left: 25, top: 25, width: 142, height: 142 }).png().toBuffer();
  await sharp({ create: { width: 192, height: 192, channels: 3, background: "#121a14" } })
    .composite([{ input: tile, top: 25, left: 25 }]).removeAlpha().png().toFile(path.join(brand, "ikona-smart360-192.png"));
  console.log("Generated generic/email marks, legacy lockup square only, and dark favicon; home icons and blue wordmark untouched.");
} else if (mode === "before" || mode === "after") {
  await mkdir(path.join(report, mode), { recursive: true });
  const assets = mode === "before" ? before : brand;
  const data = async (file, type = "image/png") => `data:${type};base64,${(await readFile(file)).toString("base64")}`;
  const mark = await data(path.join(assets, "smart360-znak-40.png"));
  const favicon = await data(path.join(assets, "ikona-smart360-192.png"));
  const font = await data(path.join(root, "artifacts/smart360/public/fonts/Archivo-800.ttf"), "font/ttf");
  const src = path.join(root, "artifacts/smart360/src");
  const css = (await readFile(path.join(src, "index.css"), "utf8")).replace(/@import[^;]+;/g, "") +
    await readFile(path.join(src, "pages/admin/login.css"), "utf8");
  const lockupSource = (await readFile(path.join(src, "components/brand-lockup.tsx"), "utf8"))
    .replace("export function", "function").replace(/`\$\{import.meta.env.BASE_URL\}brand\/smart360-znak-40.png(?:\?v=faceted-1)?`/g, JSON.stringify(mark));
  const compiled = await transform(lockupSource + "\nreturn BrandLockup;", { loader: "tsx", jsxFactory: "React.createElement" });
  const BrandLockup = new Function("React", compiled.code)(React);
  const lockup = renderToStaticMarkup(React.createElement(BrandLockup, { className: "smart-login__logo" }));
  const app = await readFile(path.join(src, "App.tsx"), "utf8");
  const splashJsx = app.slice(app.indexOf("  return (\n    <div\n      className={`guest-entry-splash"), app.indexOf("\n}\n\n/**", app.indexOf("  return (\n    <div\n      className={`guest-entry-splash")));
  const compiledSplash = await transform(`function Splash(){const phase="visible", hide=()=>{}, BRAND_TAGLINE="Everything about your stay, in one place.";${splashJsx}}\nreturn Splash;`.replace(/`\$\{import.meta.env.BASE_URL\}brand\/smart360-znak-40.png(?:\?v=faceted-1)?`/g, JSON.stringify(mark)), { loader: "tsx", jsxFactory: "React.createElement" });
  const splash = renderToStaticMarkup(React.createElement(new Function("React", compiledSplash.code)(React)));
  const login = await readFile(path.join(src, "pages/admin/login.tsx"), "utf8");
  const heading = login.slice(login.indexOf("          <h1>Portal"), login.indexOf("        </header>", login.indexOf("          <h1>Portal")));
  const samples = {
    splash,
    login: `<div class="smart-login" data-surface="admin"><img class="smart-login__ring" src="${mark}" alt=""><main class="smart-login__card"><header class="smart-login__header">${lockup}${heading}</header></main></div>`,
    header: lockup,
    favicon: `<div style="display:flex;gap:24px"><img src="${favicon}" width="16" height="16"><img src="${favicon}" width="32" height="32"></div>`,
  };
  const browser = await chromium.launch({ executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(), args: ["--no-sandbox"] });
  const layouts = {};
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
    for (const [name, body] of Object.entries(samples)) {
      const html = `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:Archivo;src:url("${font}");font-weight:800}${css}body{margin:0}aside{position:fixed;z-index:20000;bottom:8px;left:8px;font:12px sans-serif;color:#555;background:#fff}</style>${body}<aside>ISOLATED SOURCE-DERIVED ${name} · ${mode} · 100% · not authenticated UI${name === "login" ? " · brand/header only, form omitted" : ""}</aside>`;
      await writeFile(path.join(report, mode, `frontend-${name}.html`), html);
      await page.setContent(html);
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); document.getAnimations().forEach(a => { a.pause(); a.currentTime = 1800; }); });
      layouts[name] = await page.locator("img, .guest-entry-splash__wordmark, .guest-entry-splash__subtitle, [role=img] span, h1, header p").evaluateAll(nodes => nodes.map(n => {
        const b = n.getBoundingClientRect(), c = getComputedStyle(n);
        return { tag: n.tagName, class: n.className, x: b.x, y: b.y, width: b.width, height: b.height, font: c.font, letterSpacing: c.letterSpacing, background: c.backgroundColor, transform: c.transform, animation: c.animation };
      }));
      await page.screenshot({ path: path.join(report, mode, `frontend-${name}.png`) });
    }
    await writeFile(path.join(report, mode, "frontend-layout.json"), JSON.stringify(layouts, null, 2));
    if (mode === "after") {
      const old = JSON.parse(await readFile(path.join(report, "before/frontend-layout.json")));
      if (JSON.stringify(old) !== JSON.stringify(layouts)) throw new Error("Computed layout invariants changed");
      await writeFile(path.join(report, "frontend-layout-invariants.json"), JSON.stringify({ identical: true, fixture: "Isolated source-derived JSX/CSS at DPR 1; not authenticated. Animation paused identically at 1800ms; production CSS unchanged.", layouts }, null, 2));
    }
  } finally { await browser.close(); }
  console.log(`${mode} isolated fixtures captured; all images decoded`);
} else if (mode === "audit") {
  const rows = [];
  for (const filename of (await readdir(before)).filter(n => /\.(png|svg)$/.test(n))) {
    const previous = await readFile(path.join(before, filename));
    const current = await readFile(path.join(brand, filename));
    const hash = b => createHash("sha256").update(b).digest("hex");
    async function measure(buffer) {
      const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const bg = [...data.subarray(0, 4)];
      let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 4;
        if (data[i + 3] > 15 && (bg[3] === 0 || [0, 1, 2].some(c => Math.abs(data[i + c] - bg[c]) > 15))) {
          minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
      return { width: info.width, height: info.height, cornerRGBA: bg, visibleBounds: [minX, minY, maxX, maxY] };
    }
    rows.push({ filename, unchanged: previous.equals(current), oldSha256: hash(previous), newSha256: hash(current), before: await measure(previous), after: await measure(current) });
  }
  await writeFile(path.join(report, "frontend-asset-inventory.json"), JSON.stringify({ boundsThreshold: "alpha >15 and >15/255 contrast from corner background; inclusive pixel coordinates", assets: rows }, null, 2));
  console.log(rows.map(r => `${r.filename}: ${r.unchanged ? "unchanged" : "changed"} ${JSON.stringify(r.before.visibleBounds)} -> ${JSON.stringify(r.after.visibleBounds)}`).join("\n"));
} else {
  throw new Error("Usage: brand-unification-frontend.mjs before|generate|after");
}