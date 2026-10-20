import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { simpleCategoryIcon } from "../src/pages/living-guide/simple/simple-tiles.ts";
import { catalogForTileKey } from "@workspace/category-icons";

const dir = "reports/enostaven/icon-library";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  headless: true, args: ["--no-sandbox"],
});
const evidence = [];
const base = "http://localhost:80";
const snapshots = {};
try {
  for (const [tenant, slug] of [["melipu", "meli-pu"], ["drobez", "turizem-drobez"]]) {
    let data;
    const source = tenant === "drobez"
      ? "previously captured Drobež public snapshot; development public URL currently returns 404"
      : "current development public snapshot; no tenant content modified";
    if (tenant === "drobez") {
      data = JSON.parse(await readFile("verification-only/enostaven/turizem-drobez-sl.json", "utf8"));
    } else {
      const response = await fetch(`${base}/api/public/tenants/${slug}?lang=sl`);
      assert.equal(response.status, 200);
      data = await response.json();
    }
    snapshots[tenant] = data;
    await writeFile(`${dir}/${tenant}-source.json`, JSON.stringify(data, null, 2));
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route("**/verification-only/enostaven/*.json", r => r.fulfill({ json: data }));
    await page.goto(`${base}/__simple-fixture/home?tenant=${tenant}&palette=bordo&source=published&lang=sl`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("screen-simple-home").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${dir}/${tenant}-home.png` });
    const used = new Map();
    const rows = [];
    for (const section of data.sections.filter(s => ["offer", "explore", "services"].includes(s.key))) {
      const categories = section.categories.filter(c => c.isVisible !== false && (c.items?.some(i => i.isVisible !== false) || c.layout === "events"));
      for (const category of categories) {
        const icon = simpleCategoryIcon(category, section.key);
        assert.notEqual(icon, "pin", `${category.label} must not fall back to pin`);
        assert.notEqual(icon, "cart", `${category.label} must not fall back to cart`);
        const svg = catalogForTileKey(icon)?.svg;
        assert.ok(svg, category.label);
        assert.ok(!used.has(svg), `${category.label} duplicates ${used.get(svg)}`);
        used.set(svg, category.label);
        const tile = page.getByTestId(`tile-c-${category.id}`);
        const metrics = await tile.evaluate(el => {
          const svg = el.querySelector("svg");
          const r = el.getBoundingClientRect(), i = svg.getBoundingClientRect();
          return { width: r.width, height: r.height, iconWidth: i.width, iconHeight: i.height, viewBox: svg.getAttribute("viewBox"), markup: svg.innerHTML };
        });
        assert.equal(metrics.viewBox, "0 0 24 24");
        assert.ok(metrics.iconHeight > 30 && metrics.iconWidth > 30);
        rows.push({ group: section.key, label: category.label, icon, ...metrics });
      }
      // Screenshot both ends of long groups, each at the requested viewport.
      for (const [position, category] of [["start", categories[0]], ["end", categories.at(-1)]]) {
        if (!category) continue;
        await page.getByTestId(`tile-c-${category.id}`).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${dir}/${tenant}-${section.key}-${position}.png` });
      }
    }
    evidence.push({ tenant, source, rows });
    await page.close();
  }

  // Nonsense labels: actual guest rendering, with only this intercepted fixture changed.
  const fallback = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const data = structuredClone(snapshots.melipu);
  for (const key of ["offer", "explore"]) {
    const section = data.sections.find(s => s.key === key);
    section.categories = [{ ...section.categories[0], id: `nonsense-${key}`,
      key: "xqzv-987", label: `Xqzv 987 ${key}`, icon: "catalog:auto", layout: "text" }];
  }
  await fallback.route("**/verification-only/enostaven/*.json", r => r.fulfill({ json: data }));
  await fallback.goto(`${base}/__simple-fixture/home?tenant=melipu&source=published&palette=bordo`, { waitUntil: "domcontentloaded" });
  for (const key of ["offer", "explore"]) {
    const tile = fallback.getByTestId(`tile-c-nonsense-${key}`);
    await tile.scrollIntoViewIfNeeded();
    const expected = catalogForTileKey(key === "offer" ? "cart" : "pin").svg.match(/d="([^"]+)"/)[1];
    assert.equal(await tile.locator("svg path").first().getAttribute("d"), expected);
    await fallback.screenshot({ path: `${dir}/fallback-${key}.png` });
  }
  await fallback.close();

  // Real category edit dialog; only transport/storage is a synthetic browser fixture.
  let savedIcon = "catalog:auto";
  const editor = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await editor.route("**/api/admin/categories/icon-fixture-category", async route => {
    assert.equal(route.request().method(), "PATCH");
    savedIcon = route.request().postDataJSON().icon;
    await route.fulfill({ json: { id: "icon-fixture-category", label: "Breakfast", icon: savedIcon } });
  });
  await editor.route("**/verification-only/icon-editor-fixture.json", route => route.fulfill({ json: { icon: savedIcon } }));
  await editor.goto(`${base}/__simple-fixture/home?evidence=icon-editor`, { waitUntil: "domcontentloaded" });
  await editor.getByTestId("tile-icon-picker").waitFor();
  assert.equal(await editor.getByRole("option").count(), 50);
  await editor.screenshot({ path: `${dir}/admin-picker.png` });
  await editor.getByLabel("Išči med ikonami kataloga").fill("pizzerias");
  await editor.getByRole("option", { name: "Izberi ikono: Pizzerias" }).click();
  await editor.screenshot({ path: `${dir}/admin-selected.png` });
  await editor.getByRole("button", { name: /^Shrani$/ }).click();
  await editor.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(savedIcon, "catalog:pizzerias");
  await editor.getByRole("button", { name: "Ponovno odpri kategorijo" }).click();
  assert.equal(await editor.getByRole("option", { name: "Izberi ikono: Pizzerias" }).getAttribute("aria-selected"), "true");
  await editor.getByRole("button", { name: /Samodejno po imenu/ }).click();
  await editor.getByRole("button", { name: /^Shrani$/ }).click();
  await editor.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(savedIcon, "catalog:auto");
  evidence.push({ editor: { allIcons: 50, selectionSavedAndReopened: true, automaticReset: true, transport: "synthetic; real API persistence and permissions tested separately" } });
  await editor.close();
  await writeFile(`${dir}/measurements.json`, JSON.stringify(evidence, null, 2));
  console.log("PASS: distinct tenant tiles, measurements, nonsense fallback, real editor selection/save/reopen/reset.");
} finally { await browser.close(); }
