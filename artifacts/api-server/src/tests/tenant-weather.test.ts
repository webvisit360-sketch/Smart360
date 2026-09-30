import assert from "node:assert/strict";
import { test } from "node:test";
import { createTenantWeatherCache, parseTenantWeather, type TenantWeather } from "../lib/tenantWeather";

const noon = Date.parse("2026-01-01T11:00:00Z");
function weather(at = noon): TenantWeather {
  return {
    fetchedAt: new Date(at).toISOString(), timezone: "Europe/Ljubljana",
    current: { time: at, temperatureC: 8, weatherCode: 2, isDay: true, windKmh: 9 },
    today: { maxC: 12, minC: 2, precipitationProbability: 20, sunset: noon + 4 * 3_600_000 },
    hourly: [{ time: at + 3_600_000, temperatureC: 7, weatherCode: 2, precipitationProbability: 20 }],
  };
}
test("TTL, failure cooldown, stale horizon, and redacted categorized failure", async () => {
  let clock = noon;
  let calls = 0;
  const logs: unknown[] = [];
  const cache = createTenantWeatherCache({
    now: () => clock,
    fetchWeather: async () => {
      calls++;
      if (calls > 1) throw Object.assign(new Error("private-url-and-location"), { status: 503 });
      return weather(clock);
    },
    logFailure: (fields) => logs.push(fields),
  });
  assert.ok(await cache("a", 46, 14));
  clock += 29 * 60_000;
  assert.ok(await cache("a", 46, 14));
  assert.equal(calls, 1);
  clock += 2 * 60_000;
  assert.ok(await cache("a", 46, 14)); // failed refresh serves fresh stale data
  assert.equal(calls, 2);
  assert.deepEqual(logs, [{ category: "provider_unavailable", httpStatus: 503, code: null }]);
  clock += 29 * 60_000;
  assert.ok(await cache("a", 46, 14)); // failure also has a 30 min cooldown
  assert.equal(calls, 2);
  clock = noon + 3 * 3_600_000 + 1;
  assert.equal(await cache("a", 46, 14), null);
  assert.equal(calls, 3);
});

test("no coordinates never fetch; single-flight and coordinate change discard old location", async () => {
  let clock = noon;
  let calls = 0;
  let finish!: (value: TenantWeather) => void;
  const cache = createTenantWeatherCache({
    now: () => clock,
    fetchWeather: () => {
      calls++;
      return new Promise((resolve) => { finish = resolve; });
    },
  });
  assert.equal(await cache("a", null, 14), null);
  assert.equal(calls, 0);
  const first = cache("a", 46, 14);
  const second = cache("a", 46, 14);
  assert.equal(calls, 1);
  assert.equal(await cache("a", 47, 14), null);
  finish(weather());
  assert.deepEqual(await Promise.all([first, second]), [null, null]);
  assert.equal(await cache("a", 47, 14), null);
  clock += 30 * 60_000;
  const newLocation = cache("a", 47, 14);
  assert.equal(calls, 2);
  finish(weather(clock));
  await newLocation;
  assert.ok(await cache("a", 47, 14));
});

test("local day rollover removes old today's bucket, including negative-cache interval", async () => {
  let clock = Date.parse("2026-01-01T22:50:00Z"); // 23:50 Ljubljana
  let calls = 0;
  const cache = createTenantWeatherCache({
    now: () => clock,
    fetchWeather: async () => { calls++; return weather(clock); },
  });
  assert.ok(await cache("a", 46, 14));
  clock += 20 * 60_000; // 00:10 next local day, within 30 min
  assert.equal(await cache("a", 46, 14), null);
  assert.equal(calls, 1);
});

test("capacity fails closed; never evicts cooldowns or usable stale data", async () => {
  let clock = noon;
  const calls: string[] = [];
  const cache = createTenantWeatherCache({
    maxEntries: 1, now: () => clock,
    fetchWeather: async (latitude) => { calls.push(String(latitude)); return weather(clock); },
  });
  assert.ok(await cache("first", 46, 14));
  assert.equal(await cache("second", 47, 14), null); // first has live TTL
  clock += 31 * 60_000;
  assert.equal(await cache("second", 47, 14), null); // first has usable stale fallback
  assert.ok(await cache("first", 46, 14));
  assert.deepEqual(calls, ["46", "46"]);
  clock += 3 * 3_600_000 + 1; // first stale and cooldown both expired
  assert.ok(await cache("second", 47, 14));
  assert.deepEqual(calls, ["46", "46", "47"]);
  assert.equal(await cache("first", 46, 14), null); // second has a live cooldown
});

test("negative-cache capacity keeps unsuccessful provider attempt budget", async () => {
  let clock = noon;
  let calls = 0;
  const cache = createTenantWeatherCache({
    maxEntries: 1, now: () => clock,
    fetchWeather: async () => { calls++; throw { status: 503 }; },
    logFailure: () => {},
  });
  assert.equal(await cache("first", 46, 14), null);
  assert.equal(await cache("second", 47, 14), null);
  clock += 29 * 60_000;
  assert.equal(await cache("second", 47, 14), null);
  assert.equal(calls, 1);
  clock += 60_000;
  assert.equal(await cache("second", 47, 14), null);
  assert.equal(calls, 2);
  assert.equal(await cache("first", 46, 14), null);
  assert.equal(calls, 2);
});

test("unix timestamps, daily local-day alignment and strict incomplete payload rejection", () => {
  const start = Date.parse("2026-01-01T00:00:00Z") / 1000;
  const raw = {
    timezone: "Europe/Ljubljana", utc_offset_seconds: 3600,
    current: { time: start + 12 * 3600, temperature_2m: 8, weather_code: 2, is_day: 1, wind_speed_10m: 9 },
    daily: {
      time: [start, start + 86400], temperature_2m_max: [12, 13],
      temperature_2m_min: [2, 3], precipitation_probability_max: [20, 40],
      sunset: [start + 16 * 3600, start + 40 * 3600],
    },
    hourly: {
      time: Array.from({ length: 48 }, (_, i) => start + i * 3600),
      temperature_2m: Array(48).fill(8),
      weather_code: Array(48).fill(2),
      precipitation_probability: Array(48).fill(20),
    },
  };
  assert.equal(parseTenantWeather(raw, noon).today.sunset, (start + 16 * 3600) * 1000);
  assert.equal(parseTenantWeather(raw, noon).hourly.length, 48);
  assert.throws(() => parseTenantWeather({ ...raw, hourly: { ...raw.hourly, precipitation_probability: [] } }, noon));
  assert.throws(() => parseTenantWeather({ ...raw, current: { ...raw.current, wind_speed_10m: null } }, noon));
});