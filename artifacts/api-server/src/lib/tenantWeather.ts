import type { TenantWeather } from "@workspace/api-zod";
import { normalizeTranslationFailure, TranslationFailure } from "./creatorEditorialTranslation";
import { logger } from "./logger";

export type { TenantWeather } from "@workspace/api-zod";

const TTL = 30 * 60_000;
const MAX_STALE = 3 * 60 * 60_000;
type Entry = { coords: string; attemptedAt: number; weather: TenantWeather | null };
const object = (x: unknown): Record<string, unknown> => {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new TranslationFailure("invalid_output", null, null);
  return x as Record<string, unknown>;
};
const finite = (x: unknown): number => {
  if (typeof x !== "number" || !Number.isFinite(x)) throw new TranslationFailure("invalid_output", null, null);
  return x;
};
const range = (x: unknown, low: number, high: number): number => {
  const n = finite(x);
  if (n < low || n > high) throw new TranslationFailure("invalid_output", null, null);
  return n;
};
const epoch = (x: unknown): number => {
  const n = finite(x);
  if (!Number.isInteger(n) || n < 1_500_000_000 || n > 4_102_444_800) throw new TranslationFailure("invalid_output", null, null);
  return n * 1000;
};
const array = (x: unknown): unknown[] => {
  if (!Array.isArray(x) || !x.length || x.length > 72) throw new TranslationFailure("invalid_output", null, null);
  return x;
};
const aligned = (source: Record<string, unknown>, fields: string[]): unknown[][] => {
  const lists = fields.map((field) => array(source[field]));
  if (lists.some((list) => list.length !== lists[0]!.length)) throw new TranslationFailure("invalid_output", null, null);
  return lists;
};
function localDay(ms: number, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(ms));
}

/** Reject incomplete/misaligned responses rather than synthesizing missing measurements. */
export function parseTenantWeather(raw: unknown, now: number): TenantWeather {
  const root = object(raw);
  const timezone = root["timezone"];
  if (typeof timezone !== "string" || !timezone || timezone.length > 100) throw new TranslationFailure("invalid_output", null, null);
  try { new Intl.DateTimeFormat("en-CA", { timeZone: timezone }); }
  catch { throw new TranslationFailure("invalid_output", null, null); }
  const offset = range(root["utc_offset_seconds"], -50_400, 50_400);
  const current = object(root["current"]);
  const daily = object(root["daily"]);
  const hourly = object(root["hourly"]);
  const [days, max, min, probability, sunsets] = aligned(daily,
    ["time", "temperature_2m_max", "temperature_2m_min", "precipitation_probability_max", "sunset"]);
  const dayIndex = days.findIndex((value) => {
    const timestamp = epoch(value);
    return new Date(timestamp + offset * 1000).toISOString().slice(0, 10) === localDay(now, timezone);
  });
  if (dayIndex < 0) throw new TranslationFailure("invalid_output", null, null);
  const [times, temperatures, codes, precipitation] = aligned(hourly,
    ["time", "temperature_2m", "weather_code", "precipitation_probability"]);
  const hours = times.map((time, i) => ({
    time: epoch(time),
    temperatureC: range(temperatures[i], -100, 70),
    weatherCode: range(codes[i], 0, 99),
    precipitationProbability: range(precipitation[i], 0, 100),
  }));
  if (hours.some((hour, i) => !Number.isInteger(hour.weatherCode) || (i > 0 && hour.time <= hours[i - 1]!.time)) ||
      hours.at(-1)!.time < now + 6 * 60 * 60_000) {
    throw new TranslationFailure("invalid_output", null, null);
  }
  const isDay = current["is_day"];
  if (isDay !== 0 && isDay !== 1) throw new TranslationFailure("invalid_output", null, null);
  const weatherCode = range(current["weather_code"], 0, 99);
  if (!Number.isInteger(weatherCode)) throw new TranslationFailure("invalid_output", null, null);
  return {
    fetchedAt: new Date(now).toISOString(),
    timezone,
    current: {
      time: epoch(current["time"]),
      temperatureC: range(current["temperature_2m"], -100, 70),
      weatherCode,
      isDay: isDay === 1,
      windKmh: range(current["wind_speed_10m"], 0, 500),
    },
    today: {
      maxC: range(max[dayIndex], -100, 70),
      minC: range(min[dayIndex], -100, 70),
      precipitationProbability: range(probability[dayIndex], 0, 100),
      sunset: epoch(sunsets[dayIndex]),
    },
    hourly: hours,
  };
}

export function createTenantWeatherCache(options: {
  now?: () => number;
  fetchWeather?: (latitude: number, longitude: number, now: number) => Promise<TenantWeather>;
  logFailure?: (fields: { category: string; httpStatus: number | null; code: string | null }) => void;
  maxEntries?: number;
} = {}) {
  const maxEntries = options.maxEntries ?? 500;
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) throw new Error("Invalid weather cache capacity");
  const now = options.now ?? Date.now;
  const fetchWeather = options.fetchWeather ?? fetchOpenMeteo;
  const logFailure = options.logFailure ?? ((fields) => logger.warn(fields, "Tenant weather fetch failed"));
  const entries = new Map<string, Entry>();
  const pending = new Map<string, { coords: string; token: object; promise: Promise<TenantWeather | null> }>();
  const usable = (value: TenantWeather | null, at: number): TenantWeather | null =>
    value && at - Date.parse(value.fetchedAt) <= MAX_STALE &&
    localDay(at, value.timezone) === localDay(Date.parse(value.fetchedAt), value.timezone) ? value : null;
  // Prune only tenants past BOTH their provider cooldown and stale-data window.
  // In-flight calls are never evicted; at capacity new tenants fail closed.
  const prune = (at: number): void => {
    for (const [key, value] of entries) {
      if (entries.size < maxEntries) break;
      if (!pending.has(key) && at - value.attemptedAt >= TTL && !usable(value.weather, at)) entries.delete(key);
    }
  };
  return async (id: string, latitude: number | null, longitude: number | null): Promise<TenantWeather | null> => {
    if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      const entry = entries.get(id);
      if (entry) entries.set(id, { ...entry, coords: "", weather: null });
      pending.delete(id);
      return null;
    }
    const coords = `${latitude},${longitude}`;
    let entry = entries.get(id);
    if (entry && entry.coords !== coords) {
      entries.delete(id);
      // A location edit invalidates the forecast immediately, but does not
      // reset the per-tenant 30-minute provider budget.
      entry = { coords, attemptedAt: entry.attemptedAt, weather: null };
      entries.set(id, entry);
    }
    const flight = pending.get(id);
    if (flight && flight.coords !== coords) pending.delete(id);
    if (flight?.coords === coords) return flight.promise;
    const at = now();
    if (entry && at - entry.attemptedAt < TTL) return usable(entry.weather, at);
    if (!entry && entries.size >= maxEntries) {
      prune(at);
      if (entries.size >= maxEntries) return null;
    }
    const prior = entry?.weather ?? null;
    // Reserve the attempt synchronously: concurrent guests share one upstream call.
    entries.set(id, { coords, attemptedAt: at, weather: prior });
    const token = {};
    const promise = (async () => {
      let weather: TenantWeather | null = null;
      try {
        weather = await fetchWeather(latitude, longitude, now());
        // A delayed response must not overwrite a newer location's cache entry.
        if (pending.get(id)?.token !== token) return null;
        entries.set(id, { coords, attemptedAt: at, weather });
        return weather;
      } catch (error) {
        const failure = normalizeTranslationFailure(error);
        logFailure({ category: failure.category, httpStatus: failure.httpStatus, code: failure.code });
        weather = usable(prior, now());
        if (pending.get(id)?.token !== token) return null;
        entries.set(id, { coords, attemptedAt: at, weather: prior });
        return weather;
      } finally {
        if (pending.get(id)?.token === token) pending.delete(id);
      }
    })();
    pending.set(id, { coords, token, promise });
    return promise;
  };
}

async function fetchOpenMeteo(latitude: number, longitude: number, now: number): Promise<TenantWeather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude),
    current: "temperature_2m,weather_code,is_day,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunset",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    forecast_days: "2", timeformat: "unixtime", timezone: "auto",
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw { status: response.status };
  // Bound the streamed body before allocation/parsing (provider content is untrusted).
  if (!response.body) throw new TranslationFailure("invalid_output", null, null);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 250_000) throw new TranslationFailure("invalid_output", null, null);
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  let data: unknown;
  try { data = JSON.parse(body); } catch { throw new TranslationFailure("invalid_output", null, null); }
  return parseTenantWeather(data, now);
}

export const getTenantWeatherCached = createTenantWeatherCache();