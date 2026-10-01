import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  currentWeatherIsDay, formatHomeClock, homeSolarChip, HOME_WEATHER_ZONE,
  nextWeatherTransition, weatherIsDayAt, weatherSkin, weatherSolarTimes,
  usableWeather, weatherExpiry,
  type TenantWeather,
} from "../pages/living-guide/living-guide-weather-model";
import { syntheticWeather, weatherFixtureTime } from "../pages/living-guide/living-guide-weather-fixture-data";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const skins = ["morning", "day", "evening", "night"] as const;
const langs = ["sl", "en", "de", "it"] as const;

function solarWeather(date = "2026-01-15", sunrise = `${date}T06:02:00Z`, sunset = `${date}T17:40:00Z`): TenantWeather {
  const w = syntheticWeather("calm", Date.parse(sunrise));
  const solar = { date, sunrise: Date.parse(sunrise), sunset: Date.parse(sunset) };
  return { ...w, today: { ...w.today, ...solar }, solarDaily: [solar] };
}

test("all four skin boundaries are inclusive/exclusive at exactly -30m/+2h/-2h/+30m", () => {
  const w = solarWeather();
  const { sunrise, sunset } = w.today;
  for (const [at, before, after] of [
    [sunrise - 30 * MINUTE, "night", "morning"],
    [sunrise + 2 * HOUR, "morning", "day"],
    [sunset - 2 * HOUR, "day", "evening"],
    [sunset + 30 * MINUTE, "evening", "night"],
  ] as const) {
    assert.equal(weatherSkin(w, at - 1), before);
    assert.equal(weatherSkin(w, at), after);
    assert.equal(weatherSkin(w, at + 1), after);
    assert.equal(nextWeatherTransition(w, at - 1), at);
    assert.ok(nextWeatherTransition(w, at) === null || nextWeatherTransition(w, at)! > at);
  }
});

test("current icon has strict solar boundaries, not the skin's twilight margins", () => {
  const w = solarWeather();
  for (const [at, day, skin] of [
    [w.today.sunrise - 30 * MINUTE, false, "morning"],
    [w.today.sunrise - 1, false, "morning"],
    [w.today.sunrise, true, "morning"],
    [w.today.sunset - 1, true, "evening"],
    [w.today.sunset, false, "evening"],
    [w.today.sunset + 30 * MINUTE - 1, false, "evening"],
  ] as const) {
    // The cached current flag can be stale on either side of the boundary.
    for (const isDay of [true, false, undefined]) {
      assert.equal(currentWeatherIsDay({ ...w, current: { ...w.current, isDay } }, at), day);
    }
    assert.equal(weatherSkin(w, at), skin);
  }
  assert.equal(nextWeatherTransition(w, w.today.sunrise - 1), w.today.sunrise);
  assert.equal(nextWeatherTransition(w, w.today.sunset - 1), w.today.sunset);
});

test("available current is_day is honored when valid, and a measured timestamp cannot carry it across sunrise/sunset", () => {
  const w = solarWeather();
  w.current.time = w.today.sunrise - MINUTE;
  w.current.isDay = false;
  assert.equal(currentWeatherIsDay(w, w.today.sunrise - 1), false);
  assert.equal(currentWeatherIsDay(w, w.today.sunrise), true);
  w.current.time = w.today.sunset - MINUTE;
  w.current.isDay = true;
  assert.equal(currentWeatherIsDay(w, w.today.sunset - 1), true);
  assert.equal(currentWeatherIsDay(w, w.today.sunset), false);
  w.current.isDay = undefined;
  assert.equal(currentWeatherIsDay(w, w.today.sunrise + HOUR), true);
});

test("hourly icons use their own local date across midnight and next-day dawn", () => {
  const w = solarWeather();
  const tomorrow = { date: "2026-01-16", sunrise: Date.parse("2026-01-16T06:04:00Z"), sunset: Date.parse("2026-01-16T17:42:00Z") };
  w.solarDaily.push(tomorrow);
  for (const [iso, day] of [
    ["2026-01-15T22:59:59.999Z", false], ["2026-01-15T23:00:00Z", false],
    ["2026-01-16T00:00:00Z", false], ["2026-01-16T05:00:00Z", false],
    ["2026-01-16T06:03:59.999Z", false], ["2026-01-16T06:04:00Z", true],
    ["2026-01-16T17:41:59.999Z", true], ["2026-01-16T17:42:00Z", false],
  ] as const) assert.equal(weatherIsDayAt(w, Date.parse(iso)), day, iso);
  assert.equal(weatherSkin(w, Date.parse("2026-01-15T23:00:00Z")), "night");
  assert.equal(weatherSolarTimes(w, Date.parse("2026-01-15T23:00:00Z"))?.sunrise, tomorrow.sunrise);
  w.solarDaily = [];
  assert.equal(weatherIsDayAt(w, tomorrow.sunrise), undefined);
  assert.equal(weatherSkin(w, tomorrow.sunrise), null);
  assert.equal(weatherSolarTimes(w, NaN), null);
});

test("night chip picks the NEXT real sunrise; other skins keep sunset in all four languages", () => {
  const w = syntheticWeather("calm", weatherFixtureTime("day"));
  const labels = { sl: ["Sončni vzhod", "Sončni zahod"], en: ["Sunrise", "Sunset"], de: ["Sonnenaufgang", "Sonnenuntergang"], it: ["Alba", "Tramonto"] };
  for (const l of langs) {
    for (const skin of skins) {
      const at = weatherFixtureTime(skin);
      const chip = homeSolarChip(w, at, l);
      assert.equal(chip.label, labels[l][skin === "night" ? 0 : 1]);
      assert.equal(chip.time, skin === "night" ? w.solarDaily[1]!.sunrise : w.today.sunset);
    }
    const preDawn = homeSolarChip(w, w.today.sunrise - 31 * MINUTE, l);
    assert.equal(preDawn.time, w.today.sunrise);
    assert.equal(preDawn.label, labels[l][0]);
  }
  w.solarDaily = []; // Legacy today-only data cannot stand in for tomorrow.
  assert.equal(homeSolarChip(w, weatherFixtureTime("night"), "sl").time, null);
  assert.equal(homeSolarChip(w, w.today.sunrise - HOUR, "sl").time, w.today.sunrise);
});

test("Europe/Ljubljana DST changes use each date's own offset and absolute elapsed solar margins", () => {
  for (const [date, sunrise, sunset, repeatedOrSkippedHours] of [
    ["2026-03-29", "2026-03-29T04:50:00Z", "2026-03-29T17:25:00Z", ["2026-03-29T00:59:59Z", "2026-03-29T01:00:00Z"]],
    ["2026-10-25", "2026-10-25T05:30:00Z", "2026-10-25T15:55:00Z", ["2026-10-25T00:30:00Z", "2026-10-25T01:30:00Z"]],
  ] as const) {
    const w = solarWeather(date, sunrise, sunset);
    for (const iso of repeatedOrSkippedHours) {
      assert.equal(weatherSkin(w, Date.parse(iso)), "night");
      assert.equal(weatherIsDayAt(w, Date.parse(iso)), false);
      assert.equal(homeSolarChip(w, Date.parse(iso), "en").time, Date.parse(sunrise));
    }
    assert.equal(weatherSkin(w, Date.parse(sunrise) - 30 * MINUTE), "morning");
    assert.equal(weatherSkin(w, Date.parse(sunrise) + 2 * HOUR), "day");
    assert.equal(weatherSkin(w, Date.parse(sunset) - 2 * HOUR), "evening");
    assert.equal(weatherSkin(w, Date.parse(sunset) + 30 * MINUTE), "night");
    assert.equal(formatHomeClock(Date.parse(sunrise), HOME_WEATHER_ZONE, "en"), date.includes("03") ? "06:50" : "06:30");
  }
});

test("midnight expiry is exact on ordinary, 23-hour spring and 25-hour autumn local days", () => {
  for (const [date, fetched, midnight] of [
    ["2026-01-15", "2026-01-15T22:50:00Z", "2026-01-15T23:00:00Z"],
    ["2026-03-29", "2026-03-29T21:50:00Z", "2026-03-29T22:00:00Z"],
    ["2026-10-25", "2026-10-25T22:50:00Z", "2026-10-25T23:00:00Z"],
  ]) {
    const w = solarWeather(date);
    w.fetchedAt = fetched!;
    assert.equal(weatherExpiry(w), Date.parse(midnight!));
    assert.ok(usableWeather(w, Date.parse(midnight!) - 1));
    assert.equal(usableWeather(w, Date.parse(midnight!)), null);
  }
});

test("each dev fixture freezes the actual provider clock for 4 skins × 4 languages; production has no test URL params", () => {
  for (const skin of skins) {
    for (const _lang of langs) {
      const at = weatherFixtureTime(skin);
      assert.equal(weatherSkin(syntheticWeather("calm", at), at), skin);
    }
  }
  const source = readFileSync(new URL("../pages/living-guide/living-guide-weather.tsx", import.meta.url), "utf8");
  assert.match(source, /import\.meta\.env\.DEV && useOverride \? fixtureClock : undefined/);
  assert.doesNotMatch(source, /URLSearchParams|window\.location/);
  assert.match(source, /isDay=\{currentWeatherIsDay\(weather, now\)\}/);
  assert.match(source, /isDay=\{weatherIsDayAt\(weather, slot\.time\)\}/);
  assert.match(source, /staleTime: WEATHER_TTL_MS/);
  assert.match(source, /refetchInterval: WEATHER_TTL_MS/);
  assert.equal((source.match(/useGetTenantWeather\(slug/g) ?? []).length, 1);
});

// Parse the production CSS and binding HTML directly: no duplicated palette in
// tests that could pass while the rendered colors/backgrounds drift.
const css = readFileSync(new URL("../pages/living-guide/living-guide-weather.css", import.meta.url), "utf8");
const reference = readFileSync(new URL("../../../../attached_assets/vreme-deli-dneva_1790830921797.html", import.meta.url), "utf8");
function rule(source: string, selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = source.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1];
  assert.ok(body, selector);
  return Object.fromEntries(body.split(";").filter((line) => line.includes(":")).map((line) => {
    const colon = line.indexOf(":");
    return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
  }));
}
function tokens(skin: string) {
  return {
    ...rule(css, "[data-living-guide] .lgw-card"),
    ...(skin === "night" ? {} : rule(css, `[data-living-guide] .lgw-card[data-weather-skin="${skin}"]`)),
  };
}
const normalize = (v: string) => v.replace(/\s/g, "").toUpperCase();
type RGB = [number, number, number];
function rgb(hex: string): RGB {
  assert.match(hex, /^#[\da-f]{6}$/i);
  return hex.slice(1).match(/../g)!.map((n) => parseInt(n, 16)) as RGB;
}
function luminance(color: RGB): number {
  return color.map((v) => {
    const n = v / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i]!, 0);
}
function contrast(fg: RGB, bg: RGB): number {
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function gradientSamples(gradient: string): RGB[] {
  const stops = [...gradient.matchAll(/(#[\da-f]{6})\s+(\d+)%/gi)].map((m) => ({ color: rgb(m[1]!), at: Number(m[2]) / 100 }));
  assert.ok(stops.length >= 2);
  const samples: RGB[] = [];
  for (let i = 0; i <= 1000; i++) {
    const at = i / 1000;
    let n = stops.findIndex((stop) => stop.at >= at);
    if (n < 0) n = stops.length - 1;
    if (n === 0) samples.push(stops[0]!.color);
    else {
      const a = stops[n - 1]!, b = stops[n]!;
      const fraction = Math.min(1, (at - a.at) / (b.at - a.at));
      samples.push(a.color.map((v, j) => v + (b.color[j]! - v) * fraction) as RGB);
    }
  }
  return samples;
}
function composite(background: string, samples: RGB[]): RGB[] {
  const values = background.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
  assert.ok(values, background);
  const [r, g, b, a] = values.slice(1).map(Number);
  return samples.map((color) => color.map((v, j) => [r!, g!, b!][j]! * a! + v * (1 - a!)) as RGB);
}

test("binding gradients, borders, chip/hour opacity and icon tokens match the attached HTML EXACTLY", () => {
  for (const skin of skins) {
    const actual = tokens(skin);
    const base = rule(reference, `.${skin}`);
    const chip = rule(reference, `.${skin} .chipm`);
    const hour = rule(reference, `.${skin} .hour`);
    for (const [token, expected] of [
      ["--lgw-bg", base.background], ["--lgw-line", base["border-color"]],
      ["--lgw-chip-bg", chip.background], ["--lgw-chip-line", chip.border!.replace(/^1px solid /, "")],
      ["--lgw-slot-bg", hour.background], ["--lgw-icon", rule(reference, `.${skin} .ico`).color],
    ]) assert.equal(normalize(actual[token!]!), normalize(expected!), `${skin} ${token}`);
  }
});

test("every actual CSS text role is AA 4.5:1 across the full gradient and composited chips/hours, even 38px primary", (t) => {
  const selectorPrefix = "[data-living-guide] ";
  // Resolve each rendered role's actual CSS color declaration (and inheritance).
  const roles = [
    [".lgw-now-temp", ".temp", "base"], [".lgw-now-copy b", ".desc", "base"],
    [".lgw-kicker", ".t", "base"], [".lgw-loc", ".loc", "base"],
    [".lgw-range", ".hilo", "base"], [".lgw-chip-k", ".k", "chip"],
    [".lgw-chips b", ".v", "chip"], [".lgw-slot-time", ".h", "slot"],
    [".lgw-slots b", ".t2", "slot"], [".lgw-attrib", ".src", "base"],
  ] as const;
  for (const skin of skins) {
    const actual = tokens(skin);
    const base = gradientSamples(actual["--lgw-bg"]!);
    const surfaces = { base, chip: composite(actual["--lgw-chip-bg"]!, base), slot: composite(actual["--lgw-slot-bg"]!, base) };
    const primary = rgb(actual["--lgw-txt"]!);
    for (const [selector, refSelector, surface] of roles) {
      const declaration = rule(css, selectorPrefix + selector).color!;
      const variable = declaration.match(/^var\((--[\w-]+)\)$/)?.[1];
      assert.ok(variable, selector);
      const fg = rgb(actual[variable]!);
      const minimum = Math.min(...surfaces[surface].map((bg) => contrast(fg, bg)));
      assert.ok(minimum >= 4.5, `${skin} ${selector}: ${minimum}`);
      t.diagnostic(`${skin} ${selector} ${actual[variable]} ${minimum.toFixed(3)}:1`);
      // Preserve the primary/secondary color hierarchy, not a wholesale palette replacement.
      if ([".lgw-kicker", ".lgw-loc", ".lgw-range", ".lgw-chip-k", ".lgw-slot-time"].includes(selector)) {
        assert.ok(skin === "night" ? luminance(fg) < luminance(primary) : luminance(fg) > luminance(primary), `${skin} ${selector} hierarchy`);
      }
      // The final HEX must be the first rounded sRGB mixture that passes.
      // All reference gradient channels are monotonic, so the worst sample
      // is an endpoint; still assert every intermediate sample above.
      const original = rgb(rule(reference, `.${skin} ${refSelector}`).color!);
      const worst = surfaces[surface].reduce((a, b) =>
        (skin === "night" ? luminance(a) > luminance(b) : luminance(a) < luminance(b)) ? a : b);
      let expected = original;
      if (contrast(original, worst) < 4.5) {
        const target = skin === "night" ? 255 : 0;
        const mix = (amount: number) => original.map((v) => Math.round(v + (target - v) * amount)) as RGB;
        let lo = 0, hi = 1;
        for (let i = 0; i < 50; i++) {
          const mid = (lo + hi) / 2;
          if (contrast(mix(mid), worst) >= 4.5) hi = mid; else lo = mid;
        }
        expected = mix(hi);
      }
      assert.deepEqual(fg, expected, `${skin} ${selector} smallest sRGB mix`);
    }
  }
  assert.equal(rule(css, selectorPrefix + ".lgw-now-temp")["font-size"], "38px");
  assert.equal(rule(css, selectorPrefix + ".lgw-now-temp")["font-weight"], "800");
  assert.equal(rule(css, selectorPrefix + ".lgw-now-copy b")["font-weight"], "600");
  assert.equal(rule(css, selectorPrefix + ".lgw-range")["font-weight"], undefined);
});