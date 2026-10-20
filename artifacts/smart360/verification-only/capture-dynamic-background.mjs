import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "reports/enostaven/dynamic-background";
await mkdir(dir, { recursive: true });
const results = [];
const rgb = s => [...s.matchAll(/[\d.]+/g)].slice(0, 3).map(m => +m[0]);
const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
const lum = c => c.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
const minimum = (color, stops) => Math.min(...stops.flatMap((a, i) => Array.from({length:101}, (_, n) =>
  contrast(color, a.map((v,j) => v + ((stops[i+1] ?? a)[j] - v)*n/100)))));
const source = await readFile("../../attached_assets/enostavna-dinamicno-1_1792537099902.html", "utf8");
const shared = await readFile("src/pages/living-guide/weather-dayparts.css", "utf8");
const names = {morning:"jutro",day:"dan",evening:"vecer",night:"noc"};
const norm = v => v.toLowerCase().replace(/\s/g, "");
// Read-only production bundle inspection, URL obtained from getDeploymentInfo.
const production = "https://smart360.info";
const html = await (await fetch(production)).text();
const jsPaths = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map(m => new URL(m[1], production));
const js = (await Promise.all(jsPaths.map(async url => (await fetch(url)).text()))).join("\n");
const cssPaths = new Set([...html.matchAll(/href="([^"]+\.css)"/g)].map(m => new URL(m[1], production).href));
for (const m of js.matchAll(/["']([^"']+\.css)["']/g)) cssPaths.add(new URL(m[1].startsWith("/") ? m[1] : `/assets/${m[1].replace(/^assets\//,"")}`, production).href);
const prodCss = (await Promise.all([...cssPaths].map(async url => (await fetch(url)).text()))).join("\n");
const productionGradients = [...new Set([...prodCss.matchAll(/--lgw-bg:([^;}]+)/g)].map(m => m[1]))];
assert.equal(productionGradients.length, 4, "Find all four live weather gradients");
await writeFile(`${dir}/production-tokens.json`, JSON.stringify({production, cssPaths:[...cssPaths], productionGradients}, null, 2));
const browser = await chromium.launch({executablePath:execFileSync("which",["chromium"],{encoding:"utf8"}).trim(),headless:true,args:["--no-sandbox"]});
try {
 for (const skin of Object.keys(names)) {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(`http://localhost:80/__simple-fixture/home?tenant=melipu&palette=bordo&skin=${skin}`,{waitUntil:"domcontentloaded"});
  const home = page.getByTestId("screen-simple-home");
  await home.waitFor();
  assert.equal(await home.getAttribute("data-weather-skin"), skin);
  await page.evaluate(() => document.fonts.ready);
  const values = await home.evaluate(el => {
   const css=getComputedStyle(el), tile=getComputedStyle(el.querySelector(".lgs-tile"));
   return {background:css.backgroundImage, token:css.getPropertyValue("--lgw-bg").trim(),
    heading:getComputedStyle(el.querySelector(".lgs-sec")).color,
    footer:getComputedStyle(el.querySelector(".lgs-foot")).color,
    tile:tile.backgroundImage, ring:tile.outline, stars:getComputedStyle(el,"::before").backgroundImage};
  });
  const mock=source.match(new RegExp(`\\.${names[skin]}\\s*\\{--pagebg:([^;]+)`))[1];
  const stops=[...mock.matchAll(/#[a-f0-9]{6}/gi)].map(m=>hex(m[0]));
  assert.equal(norm(values.token),norm(mock));
  assert.ok(productionGradients.some(g=>norm(g)===norm(values.token)), `${skin}: production mismatch`);
  const ratios={heading:minimum(rgb(values.heading),stops),footer:minimum(rgb(values.footer),stops)};
  assert.ok(ratios.heading>=4.5 && ratios.footer>=4.5, JSON.stringify(ratios));
  assert.ok(values.tile.includes("178, 52, 118"),"Bordo tile unchanged");
  assert.equal(values.stars.includes("data:image/svg"),skin==="night");
  await page.screenshot({path:`${dir}/${skin}.png`});
  await home.locator(".lgs-foot").scrollIntoViewIfNeeded();
  await page.screenshot({path:`${dir}/${skin}-footer.png`});
  // Weather detail uses the same provider clock and exact background variable.
  await page.getByTestId("tile-weather").click();
  const card=page.getByTestId("card-home-weather");
  await card.waitFor();
  assert.equal(await card.getAttribute("data-weather-skin"),skin);
  assert.equal(norm(await card.evaluate(el=>getComputedStyle(el).getPropertyValue("--lgw-bg").trim())),norm(values.token));
  results.push({skin,...values,ratios,mock,productionMatch:true,weatherDetailMatch:true});
  await page.close();
 }
 await writeFile(`${dir}/measurements.json`,JSON.stringify(results,null,2));
 console.log(results.map(r=>({skin:r.skin,contrast:r.ratios,productionMatch:r.productionMatch})));
} finally { await browser.close(); }
