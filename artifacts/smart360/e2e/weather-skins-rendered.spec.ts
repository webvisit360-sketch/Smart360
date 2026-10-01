/** Focused, read-only DEV fixture verification; uses the already-running proxy. */
import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const skins = ["morning", "day", "evening", "night"] as const;
const langs = ["sl", "en", "de", "it"] as const;
const labels = {
  sl: ["Sončni zahod", "Sončni vzhod"], en: ["Sunset", "Sunrise"],
  de: ["Sonnenuntergang", "Sonnenaufgang"], it: ["Tramonto", "Alba"],
};
const roles = {
  title: ".lgw-kicker", location: ".lgw-loc", temperature: ".lgw-now-temp",
  description: ".lgw-now-copy b", range: ".lgw-range",
  chipLabel: ".lgw-chip-k", chipValue: ".lgw-chips b",
  slotTime: ".lgw-slot-time", slotValue: ".lgw-slots b", attribution: ".lgw-attrib",
};
const reference = readFileSync(resolve("attached_assets/vreme-deli-dneva_1790830921797.html"), "utf8");
const baseCss = execFileSync("git", ["show", "HEAD:artifacts/smart360/src/pages/living-guide/living-guide-weather.css"], { encoding: "utf8" });
function rule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = reference.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1];
  if (!body) throw new Error(`Missing binding rule: ${selector}`);
  return Object.fromEntries(body.split(";").filter(line => line.includes(":")).map(line => {
    const colon = line.indexOf(":");
    return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
  }));
}

test("390px Home weather: four skins × four languages, binding colors and unchanged type/layout", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const out = resolve("reports/weather-skins");
  mkdirSync(out, { recursive: true });
  const errors: string[] = [];
  const apiIntercepts: { method: string; path: string; action: string }[] = [];
  const measurements: any[] = [];
  const geometryByLang = new Map<string, unknown>();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  // Home mounts an unrelated orders query. Never forward it (or any API/mutation)
  // to the real server/database; empty orders are explicit fixture-only test data.
  await page.route("**/*", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/") || !["GET", "HEAD"].includes(request.method())) {
      const orders = request.method() === "GET" && path === "/api/public/tenants/__weather-fixture/orders";
      apiIntercepts.push({ method: request.method(), path, action: orders ? "fixture-empty-orders" : "blocked-unexpected" });
      if (orders) await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      else await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  for (const lang of langs) for (const skin of skins) {
    const url = `/__weather-fixture/home?theme=noc&weather=calm&skin=${skin}&lang=${lang}`;
    await page.goto(url, { waitUntil: "networkidle" });
    const card = page.getByTestId("card-home-weather");
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-weather-skin", skin);
    await expect(card).toHaveAttribute("lang", lang);
    await card.scrollIntoViewIfNeeded();
    const data = await card.evaluate((element, { roles, binding, chip, hour, icon, baseCss }) => {
      const rect = (node: Element) => {
        const r = node.getBoundingClientRect(), root = element.getBoundingClientRect();
        return { x: r.x - root.x, y: r.y - root.y, width: r.width, height: r.height };
      };
      const style = getComputedStyle(element);
      const font = (node: Element) => {
        const s = getComputedStyle(node);
        return { family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, lineHeight: s.lineHeight,
          spacing: s.letterSpacing, variantNumeric: s.fontVariantNumeric };
      };
      const typography = () => Object.fromEntries(Object.entries(roles).map(([key, selector]) => [key, font(element.querySelector(selector)!)]));
      const canonical = (property: string, value: string) => {
        const div = document.createElement("div");
        div.style.setProperty(property, value);
        element.append(div);
        const valueComputed = getComputedStyle(div).getPropertyValue(property);
        div.remove();
        return valueComputed;
      };
      const actualBinding = {
        background: style.backgroundImage, border: style.borderTopColor,
        chipBackground: getComputedStyle(element.querySelector(".lgw-chips li")!).backgroundColor,
        chipBorder: getComputedStyle(element.querySelector(".lgw-chips li")!).borderTopColor,
        hourBackground: getComputedStyle(element.querySelector(".lgw-slots li")!).backgroundColor,
        icon: getComputedStyle(element.querySelector(".lgw-now-icon")!).color,
      };
      const expectedBinding = {
        background: canonical("background-image", binding.background),
        border: canonical("color", binding["border-color"]),
        chipBackground: canonical("background-color", chip.background),
        chipBorder: canonical("border", chip.border) && canonical("border-top-color", chip.border.replace(/^1px solid /, "")),
        hourBackground: canonical("background-color", hour.background),
        icon: canonical("color", icon.color),
      };
      const type = typography();
      const baseline = document.createElement("style");
      baseline.textContent = baseCss;
      document.head.append(baseline);
      const baseTypography = typography();
      baseline.remove();
      const orbit = (svg: Element) => svg.querySelector(".lgw-moon") ? "moon" : svg.querySelector(".lgw-sun") ? "sun" : "none";
      const solar = element.querySelector(".lgw-chips li:last-child")!;
      const cardRect = element.getBoundingClientRect();
      return {
        card: { x: cardRect.x, width: cardRect.width, height: cardRect.height },
        geometry: {
          width: cardRect.width, height: cardRect.height,
          head: rect(element.querySelector(".lgw-head")!), now: rect(element.querySelector(".lgw-now")!),
          chips: Array.from(element.querySelectorAll(".lgw-chips li")).map(rect),
          slots: Array.from(element.querySelectorAll(".lgw-slots li")).map(rect),
          attribution: rect(element.querySelector(".lgw-attrib")!),
        },
        typography: type, baseTypography,
        actualBinding, expectedBinding,
        textColors: Object.fromEntries(Object.entries(roles).map(([key, selector]) => [key, getComputedStyle(element.querySelector(selector)!).color])),
        solar: { label: solar.querySelector("span")!.textContent, value: solar.querySelector("b")!.textContent },
        currentIcon: orbit(element.querySelector(".lgw-now-icon")!),
        slots: Array.from(element.querySelectorAll(".lgw-slots li")).map(li => ({
          time: li.querySelector("span")!.textContent, orbit: orbit(li.querySelector("svg")!), rect: rect(li),
        })),
        clippedLabels: Array.from(element.querySelectorAll(".lgw-chip-k")).filter(node => node.scrollWidth > node.clientWidth).map(node => node.textContent),
        documentOverflow: document.documentElement.scrollWidth > innerWidth,
        padding: style.padding, radius: style.borderRadius, borderWidth: style.borderTopWidth,
        opacity: style.opacity, animation: style.animationName,
      };
    }, { roles, binding: rule(`.${skin}`), chip: rule(`.${skin} .chipm`),
      hour: rule(`.${skin} .hour`), icon: rule(`.${skin} .ico`), baseCss });
    const item = { skin, lang, url, ...data };
    measurements.push(item);
    expect.soft(data.actualBinding, `${skin}/${lang} binding computed CSS`).toEqual(data.expectedBinding);
    expect.soft(data.typography, `${skin}/${lang} rendered base typography`).toEqual(data.baseTypography);
    const expectedSolar = labels[lang][skin === "night" ? 1 : 0];
    expect.soft(data.solar.label).toBe(expectedSolar);
    expect.soft(data.solar.value).toBe(skin === "night" ? (lang === "sl" ? "07.02" : "07:02") : (lang === "sl" ? "18.40" : "18:40"));
    expect.soft(data.currentIcon).toBe(skin === "morning" || skin === "night" ? "moon" : "sun");
    expect.soft(data.slots.map(slot => slot.orbit)).toEqual(["sun", "sun", "sun", "sun", "moon", "moon"]);
    expect.soft(data.slots.map(slot => slot.time)).toEqual([12, 14, 16, 18, 20, 22].map(h => lang === "sl" ? `${h}h` : `${h}:00`));
    expect.soft(data.card.width).toBe(358);
    expect.soft(data.clippedLabels).toEqual([]);
    expect.soft(data.documentOverflow).toBe(false);
    if (!geometryByLang.has(lang)) geometryByLang.set(lang, data.geometry);
    else expect.soft(data.geometry, `${lang}: identical geometry across skins`).toEqual(geometryByLang.get(lang));
    if (lang === "sl") {
      // Keep measurement viewport unchanged; only the capture uses extra height
      // so the fixed bottom navigation cannot mask hourly rows/attribution.
      await page.setViewportSize({ width: 390, height: 1100 });
      await card.evaluate(element => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
      await card.screenshot({ path: resolve(out, `${skin}-390.png`), animations: "disabled" });
      await page.setViewportSize({ width: 390, height: 844 });
    }
  }
  const summary = {
    combinations: measurements.length, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    screenshotViewport: { width: 390, height: 1100 },
    fixtureSolar: { sunrise: "2026-01-15 07:02 CET", sunset: "2026-01-15 18:40 CET", nightNextSunrise: "2026-01-16 07:02 CET" },
    errors, apiIntercepts, forwardedApiRequests: 0,
    cards: measurements.map(({ skin, lang, card, solar, currentIcon, clippedLabels }) => ({ skin, lang, card, solar, currentIcon, clippedLabels })),
    assertionFailures: testInfo.errors.map(error => error.message),
    limits: ["Chromium only, synthetic DEV fixture, no live weather/API/database exercised",
      "Base typography compared to current git HEAD stylesheet",
      "AA full-gradient coverage belongs to the already-passed unit suite; not rerun here"],
  };
  writeFileSync(resolve(out, "measurements.json"), JSON.stringify(measurements, null, 2));
  writeFileSync(resolve(out, "summary.json"), JSON.stringify(summary, null, 2));
  expect(errors).toEqual([]);
  expect(apiIntercepts.filter(request => request.action === "blocked-unexpected")).toEqual([]);
});