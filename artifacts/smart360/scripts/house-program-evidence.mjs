// DEV verification for the "Hišni program" Domov entry. Read-only:
// serves the stored production snapshots (reports/oklch-palette/icon-v3/prod-*.json)
// to the running dev app via request interception. Variant "dev-schedule" adds an
// in-memory, clearly labelled DEV test category with weekly schedules; nothing is
// written to any database, account or publication.
// Usage (from artifacts/smart360): BASE=http://localhost:80 node scripts/house-program-evidence.mjs
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const require = createRequire(resolve(import.meta.dirname, "../package.json"));
const { chromium } = require("@playwright/test");
const BASE = process.env.BASE ?? "http://localhost:80";
const OUT = resolve(import.meta.dirname, "../reports/house-program");
mkdirSync(OUT, { recursive: true });
const SRC = (slug) => resolve(import.meta.dirname, `../reports/oklch-palette/icon-v3/prod-${slug}.json`);
const LANGS = ["sl", "en", "de", "it", "fr", "nl", "hr"];
const EXPECT = { sl: "Hišni program", en: "Our programme", de: "Unser Programm", it: "Il nostro programma", fr: "Notre programme", nl: "Ons programma", hr: "Naš program" };

function snapshot(slug, { schedules, design, visibility }) {
  const t = JSON.parse(readFileSync(SRC(slug), "utf8"));
  if (design) t.guestDesign = design;
  if (visibility !== undefined) t.systemTileVisibility = visibility;
  if (schedules) {
    const stay = t.sections.find((s) => s.key === "stay");
    stay.categories.push({
      id: "dev-test-program", key: "dev-test-program", label: "DEV test program", layout: "events",
      isVisible: true, position: 999, sectionId: stay.id, items: [
        { id: "dev-yoga", title: "DEV Jutranja joga", isVisible: true, media: [], orderEnabled: true,
          eventSchedule: { type: "weekly", days: ["mon","tue","wed","thu","fri","sat","sun"], timeFrom: "09:00", timeTo: "10:00", inCamp: true } },
        { id: "dev-quiz", title: "DEV Kviz", isVisible: true, media: [],
          eventSchedule: { type: "weekly", days: ["mon","wed","fri","sun"], timeFrom: "20:00", timeTo: "21:30", inCamp: true } },
      ],
    });
  }
  return t;
}
function okolicaEvents(t) {
  const ex = t.sections.find((s) => s.key === "explore");
  return ex.categories.filter((c) => c.layout === "events").map((c) => ({ id: c.id, label: c.label, items: c.items.length }));
}

let exe; try { exe = execSync("which chromium").toString().trim(); } catch {}
const browser = await chromium.launch({ executablePath: exe || undefined });
const report = { generatedAt: new Date().toISOString(), base: BASE, provenance: "reports/oklch-palette/icon-v3/prod-{meli-pu,kamp-savinja}.json (unchanged on disk; overrides in-memory only)", cases: [] };

async function open(slug, opts, path, lang = "sl") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const body = JSON.stringify(snapshot(slug, opts));
  await page.route(new RegExp(`/api/public/tenants/${slug}(\\?|$)`), (r) => r.fulfill({ status: 200, contentType: "application/json", body }));
  await page.goto(`${BASE}/${slug}/${path}?lang=${lang}`, { waitUntil: "load" });
  await page.waitForSelector(".lg2-app", { timeout: 30000 });
  await page.waitForTimeout(2500);
  return { ctx, page };
}
async function entry(page, design) {
  const sel = design === "simple" ? '[data-testid="tile-program"]' : '[data-testid="button-home-program"]';
  const el = page.locator(sel);
  if (!(await el.count())) return null;
  await el.first().scrollIntoViewIfNeeded();
  return el.first().evaluate((node) => {
    const label = node.querySelector("b, span:last-child") ?? node;
    const cs = getComputedStyle(label);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    const r = node.getBoundingClientRect(), lr = label.getBoundingClientRect();
    return { text: node.textContent.trim(), rendered: node.innerText.trim(), icon: node.querySelector("svg use")?.getAttribute("href") ?? (node.querySelector("svg") ? "inline-svg" : null),
      fontSize: cs.fontSize, lines: Math.round(lr.height / lh),
      overflowX: label.scrollWidth > label.clientWidth + 1, overflowY: label.scrollHeight > label.clientHeight + 1,
      insideTile: lr.left >= r.left - 0.5 && lr.right <= r.right + 0.5 && lr.top >= r.top - 0.5 && lr.bottom <= r.bottom + 0.5,
      box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
  });
}

for (const slug of ["meli-pu", "kamp-savinja"]) {
  for (const design of ["simple", "trend"]) {
    // 1) Real published snapshot: no occurrences => no entry; Okolica events unchanged.
    {
      const { ctx, page } = await open(slug, { design }, "home");
      const e = await entry(page, design);
      const okolica = design === "simple" ? await page.locator('[data-testid^="tile-c-"]').evaluateAll((ns) => ns.map((n) => n.innerText.trim())) : null;
      await page.screenshot({ path: `${OUT}/${slug}-${design}-real.png`, fullPage: false });
      const redirect = await (async () => { await page.goto(`${BASE}/${slug}/program?lang=sl`, { waitUntil: "load" }); await page.waitForTimeout(2000); return { url: new URL(page.url()).pathname, programView: await page.locator('[data-testid="program-view"]').count() }; })();
      report.cases.push({ slug, design, variant: "real-published", entryPresent: !!e, okolicaEventsInSnapshot: okolicaEvents(snapshot(slug, {})), simpleCategoryTiles: okolica, directProgramRoute: redirect });
      await ctx.close();
    }
    // 2) DEV schedules: entry in Domov for all 7 languages + fit metrics.
    for (const lang of LANGS) {
      const { ctx, page } = await open(slug, { design, schedules: true }, "home", lang);
      const e = await entry(page, design);
      if (e) await page.locator(design === "simple" ? '[data-testid="tile-program"]' : '[data-testid="button-home-program"]').first().screenshot({ path: `${OUT}/${slug}-${design}-tile-${lang}.png` });
      if (lang === "sl") await page.screenshot({ path: `${OUT}/${slug}-${design}-dev-home.png` });
      const rec = { slug, design, variant: "dev-schedule", lang, expected: EXPECT[lang], entry: e, labelExact: e?.text.replace(/\s+/g, " ") === EXPECT[lang] };
      if (lang === "sl" || lang === "en") {
        await page.locator(design === "simple" ? '[data-testid="tile-program"]' : '[data-testid="button-home-program"]').first().click();
        await page.waitForTimeout(900);
        rec.programRoute = new URL(page.url()).pathname;
        rec.detailTitle = await page.locator('[data-testid="program-view"] h1').first().innerText().catch(() => null);
        await page.screenshot({ path: `${OUT}/${slug}-${design}-program-${lang}.png` });
        const card = page.locator('[data-testid^="program-card-"]').first();
        if (await card.count()) { await card.click(); await page.waitForTimeout(800); rec.cardOpensOriginalRoute = new URL(page.url()).pathname; rec.signupButton = await page.getByText(/Prijava|Sign up|sporočil|messages/i).count(); }
      }
      report.cases.push(rec);
      await ctx.close();
    }
    // 3) Toggle: systemTileVisibility.program=false hides entry and route; missing key = visible.
    for (const visibility of [{ program: false }, { weather: false }]) {
      const { ctx, page } = await open(slug, { design, schedules: true, visibility }, "home");
      const e = await entry(page, design);
      await page.goto(`${BASE}/${slug}/program?lang=sl`, { waitUntil: "load" }); await page.waitForTimeout(2000);
      report.cases.push({ slug, design, variant: "toggle", visibility, entryPresent: !!e, routePath: new URL(page.url()).pathname, programView: await page.locator('[data-testid="program-view"]').count() });
      if (visibility.program === false) await page.screenshot({ path: `${OUT}/${slug}-${design}-toggle-off.png` });
      await ctx.close();
    }
  }
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));

// Self-contained HTML (images inlined as base64).
const img = (f) => { try { return `<img src="data:image/png;base64,${readFileSync(`${OUT}/${f}`).toString("base64")}" alt="${f}"><figcaption>${f}</figcaption>`; } catch { return `<p>missing ${f}</p>`; } };
const rows = report.cases.filter((c) => c.variant === "dev-schedule").map((c) => `<tr><td>${c.slug}</td><td>${c.design}</td><td>${c.lang}</td><td>${c.entry?.text ?? "-"}</td><td>${c.labelExact ? "yes" : "NO"}</td><td>${c.entry?.fontSize}</td><td>${c.entry?.lines}</td><td>${c.entry && !c.entry.overflowX && !c.entry.overflowY && c.entry.insideTile ? "fits" : "CHECK"}</td><td>${c.entry?.icon}</td><td>${c.detailTitle ?? ""}</td><td>${c.cardOpensOriginalRoute ?? ""}</td></tr>`).join("");
const shots = [];
for (const slug of ["meli-pu", "kamp-savinja"]) for (const d of ["simple", "trend"]) {
  shots.push(`<h3>${slug} · ${d}</h3><div class="g">${[`${slug}-${d}-real.png`, `${slug}-${d}-dev-home.png`, `${slug}-${d}-program-sl.png`, `${slug}-${d}-toggle-off.png`].map((f) => `<figure>${img(f)}</figure>`).join("")}</div><div class="t">${LANGS.map((l) => `<figure>${img(`${slug}-${d}-tile-${l}.png`)}</figure>`).join("")}</div>`);
}
writeFileSync(`${OUT}/evidence.html`, `<!doctype html><meta charset="utf-8"><title>Hišni program evidence</title><style>body{font:14px system-ui;margin:24px;background:#f6f3ee}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:3px 6px}.g{display:flex;gap:12px;flex-wrap:wrap}.g img{width:260px}.t{display:flex;gap:8px;flex-wrap:wrap}.t img{height:90px}figure{margin:0}figcaption{font-size:11px}pre{background:#fff;padding:8px;max-height:400px;overflow:auto}</style>
<h1>Hišni program — Domov entry evidence (390×844)</h1><p>Provenance: ${report.provenance}. Generated ${report.generatedAt}. DEV schedules are synthetic, in-memory only.</p>
<h2>Label fit (dev-schedule)</h2><table><tr><th>tenant</th><th>design</th><th>lang</th><th>rendered</th><th>exact</th><th>font</th><th>lines</th><th>fit</th><th>icon</th><th>detail title</th><th>card route</th></tr>${rows}</table>
<h2>Screens</h2>${shots.join("")}<h2>Raw report</h2><pre>${JSON.stringify(report, null, 2).replace(/</g, "&lt;")}</pre>`);
console.log(JSON.stringify(report.cases.map((c) => ({ s: c.slug, d: c.design, v: c.variant, l: c.lang, e: c.entryPresent ?? !!c.entry, x: c.labelExact, f: c.entry && { fs: c.entry.fontSize, ln: c.entry.lines, ox: c.entry.overflowX, oy: c.entry.overflowY, in: c.entry.insideTile, i: c.entry.icon }, t: c.detailTitle, r: c.programRoute, card: c.cardOpensOriginalRoute, rp: c.routePath ?? c.directProgramRoute, tiles: c.simpleCategoryTiles?.length, vis: c.visibility }))));
