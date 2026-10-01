import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  WMO_CODES,
  afternoonPrecipitation,
  describeWeather,
  todaySlots,
  tourWarning,
  usableWeather,
  weatherExpiry,
  warningText,
  type TenantWeather,
} from "../pages/living-guide/living-guide-weather-model";
import { syntheticWeather } from "../pages/living-guide/living-guide-weather-fixture-data";

const HOUR = 3_600_000;
const ALL_WMO = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];

function base(now: number, hourly: TenantWeather["hourly"]): TenantWeather {
  return {
    fetchedAt: new Date(now - 5 * 60_000).toISOString(),
    timezone: "Europe/Ljubljana",
    current: { time: now, temperatureC: 20, weatherCode: 1, isDay: true, windKmh: 8 },
    today: { maxC: 25, minC: 13, precipitationProbability: 20, sunrise: now - 4 * HOUR, sunset: now + 6 * HOUR },
    solarDaily: [],
    hourly,
  };
}
// 2025-07-14 10:00 Ljubljana (08:00 UTC)
const NOW = Date.UTC(2025, 6, 14, 8, 0);
const hours = (fn: (i: number) => Partial<TenantWeather["hourly"][number]>) =>
  Array.from({ length: 16 }, (_, i) => ({ time: NOW + i * HOUR, temperatureC: 20, weatherCode: 2, precipitationProbability: 10, ...fn(i) }));

test("WMO dictionary covers every code in SL/EN/DE/IT", () => {
  for (const code of ALL_WMO) {
    for (const l of ["sl", "en", "de", "it"] as const) assert.ok(WMO_CODES[code]?.[l], `${code} ${l}`);
  }
  assert.equal(describeWeather(2, "sl"), "Delno oblačno");
  assert.equal(describeWeather(2, "en"), "Partly cloudy");
  assert.equal(describeWeather(2, "de"), "Teilweise bewölkt");
  assert.equal(describeWeather(2, "it"), "Parzialmente nuvoloso");
  assert.equal(describeWeather(95, "de"), "Gewitter");
  assert.equal(describeWeather(12345, "it"), "Meteo");
});

test("thunderstorm code in next 6h warns with storm wording", () => {
  const w = base(NOW, hours((i) => (i === 4 ? { weatherCode: 96, precipitationProbability: 55 } : {})));
  const warning = tourWarning(w, NOW);
  assert.equal(warning?.kind, "storm");
  const sl = warningText(warning!, w.timezone, "sl");
  assert.equal(sl.head, "Popoldne so napovedane nevihte.");
  assert.equal(sl.detail, "Okoli 14:00 · verjetnost padavin 55 %");
  assert.match(warningText(warning!, w.timezone, "en").head, /Thunderstorms/);
});

test("rain >= 60% warns with rain wording; 59% does not", () => {
  const rain = base(NOW, hours((i) => (i === 3 ? { weatherCode: 63, precipitationProbability: 60 } : {})));
  const w = tourWarning(rain, NOW);
  assert.equal(w?.kind, "rain");
  assert.match(warningText(w!, rain.timezone, "sl").head, /dež/);
  const almost = base(NOW, hours((i) => (i === 3 ? { precipitationProbability: 59 } : {})));
  assert.equal(tourWarning(almost, NOW), null);
});

test("storms beyond 6h and calm days do not warn", () => {
  assert.equal(tourWarning(base(NOW, hours((i) => (i === 8 ? { weatherCode: 95 } : {}))), NOW), null);
  assert.equal(tourWarning(base(NOW, hours(() => ({}))), NOW), null);
  assert.equal(tourWarning(syntheticWeather("calm", NOW), NOW), null);
  assert.equal(tourWarning(syntheticWeather("warning", NOW), NOW)?.kind, "storm");
});

test("age > 3h, previous day, or null is hidden", () => {
  const w = base(NOW, hours(() => ({})));
  assert.ok(usableWeather(w, NOW));
  assert.equal(usableWeather(null, NOW), null);
  assert.equal(usableWeather({ ...w, fetchedAt: new Date(NOW - 3 * HOUR - 60_000).toISOString() }, NOW), null);
  // fetched 23:30 local yesterday, viewed 00:40 local today (under 3h, but a different day)
  const late = Date.UTC(2025, 6, 13, 21, 30);
  assert.equal(usableWeather({ ...w, fetchedAt: new Date(late).toISOString() }, late + 70 * 60_000), null);
});

test("six 2-hour slots 12..22 and afternoon probability", () => {
  const w = base(NOW, hours((i) => (i === 6 ? { precipitationProbability: 44 } : {})));
  const slots = todaySlots(w, "sl");
  assert.deepEqual(slots.map((s) => s.label), ["12:00", "14:00", "16:00", "18:00", "20:00", "22:00"]);
  assert.equal(afternoonPrecipitation(w), 44);
});

test("home weather card sits between quick tiles and Danes; Danes untouched", () => {
  const src = readFileSync(fileURLToPath(new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url)), "utf8");
  const bar = src.indexOf('className="lg2-hqbar"');
  const card = src.indexOf("<WeatherCard location={tenantWeatherLocation(tenant)} />");
  const danes = src.indexOf("{visibleDanesItems.length > 0 && (");
  assert.ok(bar > 0 && card > bar && danes > card);
  assert.equal(src.split("<WeatherCard location={tenantWeatherLocation(tenant)} />").length, 2);
  assert.match(src, /<WeatherProvider slug=\{slug\}/);
  const gpx = readFileSync(fileURLToPath(new URL("../pages/living-guide/living-guide-gpx.tsx", import.meta.url)), "utf8");
  assert.match(gpx, /\{lg && status === null && <TourWeatherStrip \/>\}/);
  const weather = readFileSync(fileURLToPath(new URL("../pages/living-guide/living-guide-weather.tsx", import.meta.url)), "utf8");
  assert.match(weather, /createContext<WeatherContextValue \| null>\(null\)/);
  assert.doesNotMatch(weather, /open-meteo\.com/);
});

test("precipitation >= 60 with clear, snow or fog codes does not invent rain", () => {
  for (const code of [0, 1, 2, 3, 45, 71, 73, 75, 77, 85, 86]) {
    const w = base(NOW, hours((i) => (i === 2 ? { weatherCode: code, precipitationProbability: 85 } : {})));
    assert.equal(tourWarning(w, NOW), null, `code ${code}`);
  }
  for (const code of [51, 61, 66, 80, 82]) {
    const w = base(NOW, hours((i) => (i === 2 ? { weatherCode: code, precipitationProbability: 60 } : {})));
    assert.equal(tourWarning(w, NOW)?.kind, "rain", `code ${code}`);
  }
  const thunderLow = base(NOW, hours((i) => (i === 2 ? { weatherCode: 95, precipitationProbability: 5 } : {})));
  assert.equal(tourWarning(thunderLow, NOW)?.kind, "storm");
});

test("warning window follows the supplied clock", () => {
  const w = base(NOW, hours((i) => (i === 9 ? { weatherCode: 95 } : {})));
  assert.equal(tourWarning(w, NOW), null);
  assert.equal(tourWarning(w, NOW + 4 * HOUR)?.kind, "storm");
});

test("expiry is 3h after fetch, or local midnight if sooner", () => {
  const w = base(NOW, hours(() => ({})));
  assert.equal(weatherExpiry(w), Date.parse(w.fetchedAt) + 3 * HOUR);
  const late = { ...w, fetchedAt: new Date(Date.UTC(2025, 6, 13, 21, 0)).toISOString() }; // 23:00 local
  const exp = weatherExpiry(late);
  assert.ok(Math.abs(exp - Date.UTC(2025, 6, 13, 22, 0)) <= 60_000);
  assert.ok(usableWeather(late, exp - 120_000));
  assert.equal(usableWeather(late, exp + 1000), null);
});

import { tenantWeatherLocation, formatHomeClock, formatHomeHour, WEATHER_LABELS as HOME_LABELS } from "../pages/living-guide/living-guide-weather-model";

test("home weather location: explicit field, postal-address town, name fallback", () => {
  assert.equal(tenantWeatherLocation({ city: "Mozirje", address: "Ter 35, 3333 Ljubno ob Savinji", name: "X" }), "Mozirje");
  assert.equal(tenantWeatherLocation({ address: "Ter 35, 3333 Ljubno ob Savinji", name: "Turizem" }), "Ljubno ob Savinji");
  assert.equal(tenantWeatherLocation({ address: "Nekje brez pošte", name: "Turizem Drobež" }), "Turizem Drobež");
});

test("home weather chips order and SL labels", () => {
  const L = HOME_LABELS.sl;
  assert.deepEqual([L.rain, L.wind, L.sunset], ["Padavine", "Veter", "Sončni zahod"]);
  assert.equal(HOME_LABELS.en.sunset, "Sunset");
  const src = readFileSync(fileURLToPath(new URL("../pages/living-guide/living-guide-weather.tsx", import.meta.url)), "utf8");
  const card = src.slice(src.indexOf("export function WeatherCard"), src.indexOf("export function TourWeatherStrip"));
  assert.ok(card.indexOf("L.rain") < card.indexOf("L.wind") && card.indexOf("L.wind") < card.indexOf("solarChip.label"));
  assert.ok(card.indexOf("lgw-kicker") < card.indexOf("lgw-loc") && card.indexOf("lgw-loc") < card.indexOf("lgw-now"));
});

test("home weather SL time formats", () => {
  const ms = Date.UTC(2025, 5, 1, 16, 42);
  assert.equal(formatHomeClock(ms, "Europe/Ljubljana", "sl"), "18.42");
  assert.equal(formatHomeClock(ms, "Europe/Ljubljana", "en"), "18:42");
  assert.equal(formatHomeHour(Date.UTC(2025, 5, 1, 10), "Europe/Ljubljana", "sl"), "12h");
});
