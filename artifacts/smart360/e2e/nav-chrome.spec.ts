import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

test("real Living Guide five-tab chrome is opaque, with unchanged geometry", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  // This is isolated synthetic fixture data, never a production tenant.
  await page.route("**/api/**", route => route.fulfill({
    json: new URL(route.request().url()).pathname.includes("messages") ? { messages: [] } : [],
  }));
  const out = resolve("reports/nav-chrome");
  mkdirSync(out, { recursive: true });
  const rows: any[] = [];
  const images: string[] = ["<p>Stress setup also appends a test-only 1000px spacer to each real scroll container to ensure every tab can be scrolled. Table Scroll Y is the actual container scrollTop, not window scrolling. Neither spacer nor photo underlay exists in normal screenshots or shipped app code.</p>"];
  const pixel = (buffer: Buffer, x = 3, y = 830) => {
    const png = PNG.sync.read(buffer);
    return [...png.data.slice((y * png.width + x) * 4, (y * png.width + x) * 4 + 4)];
  };
  const geometry = () => page.locator(".lg2-bottom-nav").evaluate(e => ({
    rect: e.getBoundingClientRect().toJSON(),
    buttons: [...e.querySelectorAll("button,svg,b")].map(x => ({
      rect: x.getBoundingClientRect().toJSON(), font: getComputedStyle(x).font,
    })),
  }));
  const tabs = [["home", "Domov"], ["s/stay", "Nastanitev"], ["s/offer", "Ponudba"], ["s/explore", "Okolica"], ["messages", "Sporočila"]];
  for (const [path, label] of tabs) {
    await page.goto(`/__weather-fixture/${path}?chrome=1&theme=noc&weather=calm&skin=night&lang=sl`);
    const nav = page.locator(".lg2-bottom-nav");
    await expect(nav).toBeVisible();
    await expect(nav.locator("button")).toHaveCount(5);
    await expect(nav.locator("button.is-active")).toContainText(label);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1100);
    const beforeStyle = await page.addStyleTag({ content: ".lg2-bottom-nav {background:var(--glass)!important;backdrop-filter:blur(20px)!important;-webkit-backdrop-filter:blur(20px)!important}" });
    const oldGeometry = await geometry();
    await beforeStyle.evaluate(e => e.remove());
    expect(await geometry()).toEqual(oldGeometry);
    const stem = path.replace("/", "-");
    const normal = await page.screenshot({ path: `${out}/${stem}-normal.png` });
    expect(pixel(normal)).toEqual([18, 26, 44, 255]);
    // Deliberate test-only stress underlay: actual repository photo, above page
    // content but BELOW z-index 50 nav. Not an authored tenant photo placement.
    await page.evaluate(() => {
      const image = document.createElement("img");
      image.id = "qa-photo-underlay";
      image.src = "/images/IMG_6196_0.jpg";
      image.alt = "QA-only photo stress underlay";
      image.style.cssText = "position:fixed;bottom:0;left:0;width:390px;height:240px;object-fit:cover;z-index:49;pointer-events:none;filter:brightness(4)";
      document.querySelector("[data-living-guide]")!.append(image);
      const scroller = document.querySelector<HTMLElement>(".lg2-screen-scroll, .lg2-msg-sc")!;
      const spacer = document.createElement("div");
      spacer.style.cssText = "height:1000px;min-height:1000px;flex:none";
      spacer.dataset.qa = "scroll-stress-spacer";
      scroller.append(spacer);
      scroller.scrollTop = scroller.scrollHeight;
      return image.decode();
    });
    await page.waitForTimeout(300);
    const bright = await page.screenshot({ path: `${out}/${stem}-bright.png` });
    expect(pixel(bright)).toEqual(pixel(normal));
    await page.locator("#qa-photo-underlay").evaluate(e => (e as HTMLElement).style.filter = "brightness(0)");
    const dark = await page.screenshot();
    expect(pixel(dark)).toEqual(pixel(normal));
    const scrollY = await page.locator(".lg2-screen-scroll, .lg2-msg-sc").first().evaluate(e => e.scrollTop);
    expect(scrollY).toBeGreaterThan(0);
    rows.push({ tab: label, normal: pixel(normal), brightPhotoScrolled: pixel(bright), darkPhotoScrolled: pixel(dark), scrollY, geometryAndFontsUnchanged: true });
    images.push(`<section><h2>${label} — normal / bright-photo stress (scrolled)</h2><img width="390" height="844" src="data:image/png;base64,${normal.toString("base64")}"><img width="390" height="844" src="data:image/png;base64,${bright.toString("base64")}"></section>`);
  }
  // Top controls are hero-local absolute elements, not viewport-fixed chrome.
  // Verify scrolling moves them away; their existing glass remains intentional.
  await page.goto("/__weather-fixture/home?chrome=1&theme=noc&weather=calm&skin=night&lang=sl");
  const top = page.locator(".lg2-hhero-top");
  await expect(top).toBeVisible();
  await page.waitForTimeout(1100);
  const topAudit = await top.evaluate(e => ({ position: getComputedStyle(e).position, y: e.getBoundingClientRect().y }));
  await page.locator(".lg2-screen-scroll").first().evaluate(e => e.scrollTop = 300);
  const scrolledY = await top.evaluate(e => e.getBoundingClientRect().y);
  expect(topAudit.position).toBe("absolute");
  expect(scrolledY).toBeLessThan(topAudit.y);
  for (const theme of ["jutro", "dan", "vecer", "noc"]) {
    await page.evaluate(theme => document.body.dataset.t = theme, theme);
    const color = await page.locator(".lg2-bottom-nav").evaluate(e => getComputedStyle(e).backgroundColor);
    expect(color).toMatch(/^rgb\(/);
  }
  const baseline = JSON.parse(readFileSync(`${out}/before.json`, "utf8"));
  writeFileSync(`${out}/results.json`, JSON.stringify({ source: "DEV weather fixture, real LivingGuideGuestShell; no auth/DB writes", baselineHomePixel: baseline.pixel, sample: { x: 3, y: 830 }, rows, topAudit: { ...topAudit, scrolledY, note: "Absolute hero controls move with content; not persistent top chrome." } }, null, 2));
  writeFileSync(`${out}/index.html`, `<!doctype html><meta charset="utf-8"><title>Living Guide chrome evidence</title><style>body{font:16px system-ui;background:#eee;color:#111}img{max-width:100%;vertical-align:top}table{border-collapse:collapse}td,th{padding:10px;border:1px solid #aaa}</style><h1>Living Guide navigation — 390 × 844, night</h1><p>Real application components with explicitly synthetic DEV tenant/weather; not production or Meli Pu. All API calls intercepted; no auth, writes or publishing. Native PNGs embedded at 390 × 844.</p><p>Before Home pixel: ${baseline.pixel}. After samples at (3,830), away from icons/border. Photo source: existing repository /images/IMG_6196_0.jpg. Brightened photo is an injected, test-only underlay beneath navigation on every tab, including Home/messages where photos do not naturally reach the bar. Stress images are NOT normal app content. Dark-photo stress also tested. Geometry/fonts compared against original glass CSS on the same five-tab fixture.</p><table><tr><th>Tab</th><th>Normal RGBA</th><th>Bright scrolled</th><th>Dark scrolled</th><th>Scroll Y</th></tr>${rows.map(r => `<tr><td>${r.tab}</td><td>${r.normal}</td><td>${r.brightPhotoScrolled}</td><td>${r.darkPhotoScrolled}</td><td>${r.scrollY}</td></tr>`).join("")}</table><p>Top audit: hero controls are absolute, scroll with hero (${topAudit.y} → ${scrolledY}), not fixed/sticky; intentionally unchanged. All four theme nav backgrounds are opaque. Chromium only; no physical-device validation.</p>${images.join("")}`);
});