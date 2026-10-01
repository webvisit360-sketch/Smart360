/**
 * Pure weather model for the Living Guide (no React, no network).
 * WMO descriptions live in a fixed in-code dictionary on purpose: they are NOT
 * routed through the translation pipeline.
 */
import type { TenantWeather } from "@workspace/api-client-react";

export type { TenantWeather };
export type WeatherLang = "sl" | "en" | "de" | "it";
export type WeatherIconKind = "clear" | "partly" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm";
export type WeatherSkin = "morning" | "day" | "evening" | "night";

export const HOME_WEATHER_ZONE = "Europe/Ljubljana";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

type Entry = { icon: WeatherIconKind; sl: string; en: string; de: string; it: string };

export const WMO_CODES: Record<number, Entry> = {
  0: { icon: "clear", sl: "Jasno", en: "Clear sky", de: "Klar", it: "Sereno" },
  1: { icon: "partly", sl: "Pretežno jasno", en: "Mainly clear", de: "Überwiegend klar", it: "Prevalentemente sereno" },
  2: { icon: "partly", sl: "Delno oblačno", en: "Partly cloudy", de: "Teilweise bewölkt", it: "Parzialmente nuvoloso" },
  3: { icon: "cloud", sl: "Oblačno", en: "Overcast", de: "Bedeckt", it: "Coperto" },
  45: { icon: "fog", sl: "Megla", en: "Fog", de: "Nebel", it: "Nebbia" },
  48: { icon: "fog", sl: "Megla z ivjem", en: "Freezing fog", de: "Reifnebel", it: "Nebbia con brina" },
  51: { icon: "drizzle", sl: "Rahlo rosenje", en: "Light drizzle", de: "Leichter Nieselregen", it: "Pioviggine leggera" },
  53: { icon: "drizzle", sl: "Rosenje", en: "Drizzle", de: "Nieselregen", it: "Pioviggine" },
  55: { icon: "drizzle", sl: "Močno rosenje", en: "Dense drizzle", de: "Starker Nieselregen", it: "Pioviggine intensa" },
  56: { icon: "drizzle", sl: "Rahlo ledeno rosenje", en: "Light freezing drizzle", de: "Leichter gefrierender Niesel", it: "Pioviggine gelata leggera" },
  57: { icon: "drizzle", sl: "Ledeno rosenje", en: "Freezing drizzle", de: "Gefrierender Nieselregen", it: "Pioviggine gelata" },
  61: { icon: "rain", sl: "Rahel dež", en: "Light rain", de: "Leichter Regen", it: "Pioggia leggera" },
  63: { icon: "rain", sl: "Dež", en: "Rain", de: "Regen", it: "Pioggia" },
  65: { icon: "rain", sl: "Močan dež", en: "Heavy rain", de: "Starker Regen", it: "Pioggia forte" },
  66: { icon: "rain", sl: "Rahel ledeni dež", en: "Light freezing rain", de: "Leichter gefrierender Regen", it: "Pioggia gelata leggera" },
  67: { icon: "rain", sl: "Ledeni dež", en: "Freezing rain", de: "Gefrierender Regen", it: "Pioggia gelata" },
  71: { icon: "snow", sl: "Rahlo sneženje", en: "Light snow", de: "Leichter Schneefall", it: "Neve debole" },
  73: { icon: "snow", sl: "Sneženje", en: "Snow", de: "Schneefall", it: "Neve" },
  75: { icon: "snow", sl: "Močno sneženje", en: "Heavy snow", de: "Starker Schneefall", it: "Neve forte" },
  77: { icon: "snow", sl: "Zrnat sneg", en: "Snow grains", de: "Schneegriesel", it: "Neve granulosa" },
  80: { icon: "rain", sl: "Rahle plohe", en: "Light showers", de: "Leichte Schauer", it: "Rovesci leggeri" },
  81: { icon: "rain", sl: "Plohe", en: "Showers", de: "Schauer", it: "Rovesci" },
  82: { icon: "rain", sl: "Močne plohe", en: "Violent showers", de: "Heftige Schauer", it: "Rovesci violenti" },
  85: { icon: "snow", sl: "Snežne plohe", en: "Snow showers", de: "Schneeschauer", it: "Rovesci di neve" },
  86: { icon: "snow", sl: "Močne snežne plohe", en: "Heavy snow showers", de: "Starke Schneeschauer", it: "Forti rovesci di neve" },
  95: { icon: "storm", sl: "Nevihta", en: "Thunderstorm", de: "Gewitter", it: "Temporale" },
  96: { icon: "storm", sl: "Nevihta s točo", en: "Thunderstorm with hail", de: "Gewitter mit Hagel", it: "Temporale con grandine" },
  99: { icon: "storm", sl: "Močna nevihta s točo", en: "Severe thunderstorm with hail", de: "Schweres Gewitter mit Hagel", it: "Forte temporale con grandine" },
};

const UNKNOWN: Record<WeatherLang, string> = { sl: "Vreme", en: "Weather", de: "Wetter", it: "Meteo" };

export function weatherLang(lang: string | null | undefined): WeatherLang {
  return lang === "en" || lang === "de" || lang === "it" ? lang : "sl";
}

export function describeWeather(code: number, lang: string): string {
  const l = weatherLang(lang);
  return WMO_CODES[code]?.[l] ?? UNKNOWN[l];
}

export function weatherIconKind(code: number): WeatherIconKind {
  return WMO_CODES[code]?.icon ?? "cloud";
}

const LOCALES: Record<WeatherLang, string> = { sl: "sl-SI", en: "en-GB", de: "de-DE", it: "it-IT" };

function safeZone(tz: string | undefined): string | undefined {
  if (!tz) return undefined;
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return tz; } catch { return undefined; }
}

export function formatClock(ms: number, tz: string | undefined, lang: string): string {
  return new Intl.DateTimeFormat(LOCALES[weatherLang(lang)], {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: safeZone(tz),
  }).format(new Date(ms));
}

function localParts(ms: number, tz: string | undefined): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", timeZone: safeZone(tz),
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

/** Never carry today's solar times across midnight or invent a missing day. */
export function weatherSolarTimes(weather: TenantWeather, at: number): { sunrise: number; sunset: number } | null {
  if (!Number.isFinite(at)) return null;
  const date = localParts(at, HOME_WEATHER_ZONE).day;
  const candidates = [...(weather.solarDaily ?? []), weather.today];
  return candidates.find((day) =>
    Number.isFinite(day.sunrise) && Number.isFinite(day.sunset) && day.sunrise < day.sunset &&
    localParts(day.sunrise, HOME_WEATHER_ZONE).day === date &&
    localParts(day.sunset, HOME_WEATHER_ZONE).day === date &&
    (!("date" in day) || day.date === date),
  ) ?? null;
}

export function weatherSkin(weather: TenantWeather, now: number): WeatherSkin | null {
  const sun = weatherSolarTimes(weather, now);
  if (!sun) return null;
  if (now < sun.sunrise - 30 * MINUTE || now >= sun.sunset + 30 * MINUTE) return "night";
  if (now < sun.sunrise + 2 * HOUR) return "morning";
  if (now < sun.sunset - 2 * HOUR) return "day";
  return "evening";
}

/** The skin's twilight margins do NOT apply to sun/moon icons. */
export function weatherIsDayAt(weather: TenantWeather, at: number): boolean | undefined {
  const sun = weatherSolarTimes(weather, at);
  return sun ? at >= sun.sunrise && at < sun.sunset : undefined;
}

/** Use provider is_day only while it remains valid for the actual display time. */
export function currentWeatherIsDay(weather: TenantWeather, now: number): boolean | undefined {
  const displayed = weatherIsDayAt(weather, now);
  const measured = Number.isFinite(weather.current.time) ? weatherIsDayAt(weather, weather.current.time) : undefined;
  if (typeof weather.current.isDay === "boolean" &&
      (displayed === undefined || (measured === displayed && weather.current.isDay === displayed))) {
    return weather.current.isDay;
  }
  return displayed;
}

/** Local render-only deadline, never an extra request or a query invalidation. */
export function nextWeatherTransition(weather: TenantWeather, now: number): number | null {
  const events = [...(weather.solarDaily ?? []), weather.today].flatMap((sun) => [
    sun.sunrise - 30 * MINUTE, sun.sunrise, sun.sunrise + 2 * HOUR,
    sun.sunset - 2 * HOUR, sun.sunset, sun.sunset + 30 * MINUTE,
  ]).filter((time) => Number.isFinite(time) && time > now);
  return events.length ? Math.min(...events) : null;
}

export const MAX_WEATHER_AGE_MS = 3 * 60 * 60 * 1000;

/** Epoch ms at which this payload stops being usable (3 h age or local midnight). */
export function weatherExpiry(weather: TenantWeather): number {
  const fetched = Date.parse(weather.fetchedAt);
  const day = localParts(fetched, weather.timezone).day;
  let hi = fetched + MAX_WEATHER_AGE_MS;
  if (localParts(hi, weather.timezone).day === day) return hi;
  let lo = fetched; // exact local midnight, including 23/25-hour DST dates
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (localParts(mid, weather.timezone).day === day) lo = mid; else hi = mid;
  }
  return hi;
}

/** Hide silently when missing, malformed, older than 3 h, or from a previous local day. */
export function usableWeather(weather: TenantWeather | null | undefined, now = Date.now()): TenantWeather | null {
  if (!weather || !weather.current || !weather.today || !Array.isArray(weather.hourly)) return null;
  const fetched = Date.parse(weather.fetchedAt);
  if (!Number.isFinite(fetched)) return null;
  if (now - fetched > MAX_WEATHER_AGE_MS) return null;
  if (localParts(fetched, weather.timezone).day !== localParts(now, weather.timezone).day) return null;
  if (!Number.isFinite(weather.current.temperatureC)) return null;
  return weather;
}

export const SLOT_HOURS = [12, 14, 16, 18, 20, 22] as const;

export type WeatherSlot = { time: number; label: string; temperatureC: number; weatherCode: number };

export function todaySlots(weather: TenantWeather, lang: string): WeatherSlot[] {
  const today = localParts(Date.parse(weather.fetchedAt), weather.timezone).day;
  const out: WeatherSlot[] = [];
  for (const hour of SLOT_HOURS) {
    const match = weather.hourly.find((h) => {
      const p = localParts(h.time, weather.timezone);
      return p.day === today && p.hour === hour;
    });
    if (match) out.push({ time: match.time, label: formatClock(match.time, weather.timezone, lang), temperatureC: match.temperatureC, weatherCode: match.weatherCode });
  }
  return out;
}

/** Highest precipitation probability between 12:00 and 18:00 local today. */
export function afternoonPrecipitation(weather: TenantWeather): number {
  const today = localParts(Date.parse(weather.fetchedAt), weather.timezone).day;
  const values = weather.hourly
    .filter((h) => { const p = localParts(h.time, weather.timezone); return p.day === today && p.hour >= 12 && p.hour <= 18; })
    .map((h) => h.precipitationProbability)
    .filter((v) => Number.isFinite(v));
  return values.length ? Math.max(...values) : weather.today.precipitationProbability;
}

export const THUNDERSTORM_CODES = new Set([95, 96, 99]);
export const RAIN_WARNING_PROBABILITY = 60;
/** Drizzle, rain, freezing rain and rain showers. Snow/clear/fog never count as rain. */
export const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
export const WARNING_WINDOW_MS = 6 * 60 * 60 * 1000;

export type TourWeatherWarning = { kind: "storm" | "rain"; time: number; probability: number };

export function tourWarning(weather: TenantWeather, now = Date.now()): TourWeatherWarning | null {
  const window = weather.hourly
    .filter((h) => h.time >= now - 60 * 60 * 1000 && h.time <= now + WARNING_WINDOW_MS)
    .sort((a, b) => a.time - b.time);
  const storm = window.find((h) => THUNDERSTORM_CODES.has(h.weatherCode));
  if (storm) return { kind: "storm", time: storm.time, probability: storm.precipitationProbability };
  const rain = window.find((h) => RAIN_CODES.has(h.weatherCode) && h.precipitationProbability >= RAIN_WARNING_PROBABILITY);
  if (rain) return { kind: "rain", time: rain.time, probability: rain.precipitationProbability };
  return null;
}

type Part = "morning" | "afternoon" | "evening";
function dayPart(hour: number): Part { return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"; }

const WARNING_HEAD: Record<WeatherLang, Record<"storm" | "rain", Record<Part, string>>> = {
  sl: {
    storm: { morning: "Dopoldne so napovedane nevihte.", afternoon: "Popoldne so napovedane nevihte.", evening: "Zvečer so napovedane nevihte." },
    rain: { morning: "Dopoldne je napovedan dež.", afternoon: "Popoldne je napovedan dež.", evening: "Zvečer je napovedan dež." },
  },
  en: {
    storm: { morning: "Thunderstorms are forecast this morning.", afternoon: "Thunderstorms are forecast this afternoon.", evening: "Thunderstorms are forecast this evening." },
    rain: { morning: "Rain is forecast this morning.", afternoon: "Rain is forecast this afternoon.", evening: "Rain is forecast this evening." },
  },
  de: {
    storm: { morning: "Am Vormittag sind Gewitter angesagt.", afternoon: "Am Nachmittag sind Gewitter angesagt.", evening: "Am Abend sind Gewitter angesagt." },
    rain: { morning: "Am Vormittag ist Regen angesagt.", afternoon: "Am Nachmittag ist Regen angesagt.", evening: "Am Abend ist Regen angesagt." },
  },
  it: {
    storm: { morning: "In mattinata sono previsti temporali.", afternoon: "Nel pomeriggio sono previsti temporali.", evening: "In serata sono previsti temporali." },
    rain: { morning: "In mattinata è prevista pioggia.", afternoon: "Nel pomeriggio è prevista pioggia.", evening: "In serata è prevista pioggia." },
  },
};

const WARNING_DETAIL: Record<WeatherLang, (time: string, p: number) => string> = {
  sl: (time, p) => `Okoli ${time} · verjetnost padavin ${p} %`,
  en: (time, p) => `Around ${time} · ${p}% chance of rain`,
  de: (time, p) => `Gegen ${time} · Regenwahrscheinlichkeit ${p} %`,
  it: (time, p) => `Verso le ${time} · probabilità di pioggia ${p}%`,
};

export function warningText(w: TourWeatherWarning, tz: string | undefined, lang: string): { head: string; detail: string } {
  const l = weatherLang(lang);
  const time = formatClock(w.time, tz, l);
  return { head: WARNING_HEAD[l][w.kind][dayPart(localParts(w.time, tz).hour)], detail: WARNING_DETAIL[l](time, Math.round(w.probability)) };
}

export const WEATHER_LABELS: Record<WeatherLang, { title: string; max: string; min: string; rain: string; wind: string; sunrise: string; sunset: string; afternoon: (p: number) => string; afternoonFull: (p: number) => string; percent: (p: number) => string; warning: string }> = {
  sl: { afternoonFull: (p) => `popoldne ${p} % verjetnost padavin`, title: "Vreme danes", max: "najv.", min: "najn.", rain: "Padavine", wind: "Veter", sunrise: "Sončni vzhod", sunset: "Sončni zahod", afternoon: (p) => `popoldne ${p} %`, percent: (p) => `${p} %`, warning: "Opozorilo" },
  en: { afternoonFull: (p) => `${p}% chance of rain this afternoon`, title: "Weather today", max: "max", min: "min", rain: "Rain", wind: "Wind", sunrise: "Sunrise", sunset: "Sunset", afternoon: (p) => `afternoon ${p}%`, percent: (p) => `${p}%`, warning: "Warning" },
  de: { afternoonFull: (p) => `nachmittags ${p} % Regenwahrscheinlichkeit`, title: "Wetter heute", max: "max.", min: "min.", rain: "Regen", wind: "Wind", sunrise: "Sonnenaufgang", sunset: "Sonnenuntergang", afternoon: (p) => `nachm. ${p} %`, percent: (p) => `${p} %`, warning: "Warnung" },
  it: { afternoonFull: (p) => `${p}% di probabilità di pioggia nel pomeriggio`, title: "Meteo di oggi", max: "max", min: "min", rain: "Pioggia", wind: "Vento", sunrise: "Alba", sunset: "Tramonto", afternoon: (p) => `pomeriggio ${p}%`, percent: (p) => `${p}%`, warning: "Avviso" },
};

export function homeSolarChip(weather: TenantWeather, now: number, lang: string): { label: string; time: number | null } {
  const L = WEATHER_LABELS[weatherLang(lang)];
  if (weatherSkin(weather, now) !== "night") {
    return { label: L.sunset, time: weatherSolarTimes(weather, now)?.sunset ?? null };
  }
  const sunrises = [...(weather.solarDaily ?? []), weather.today]
    .filter((sun) => weatherSolarTimes(weather, sun.sunrise)?.sunrise === sun.sunrise)
    .map((sun) => sun.sunrise).filter((time) => time > now);
  return { label: L.sunrise, time: sunrises.length ? Math.min(...sunrises) : null };
}

export function formatTemp(c: number): string {
  return `${Math.round(c)}°`;
}

/** Home card clock: Slovenian reference uses "18.42"; other locales keep their own convention. */
export function formatHomeClock(ms: number, tz: string | undefined, lang: string): string {
  const base = formatClock(ms, tz, lang);
  return weatherLang(lang) === "sl" ? base.replace(":", ".") : base;
}

/** Home hourly slot label: Slovenian "12h"; other locales keep formatClock. */
export function formatHomeHour(ms: number, tz: string | undefined, lang: string): string {
  if (weatherLang(lang) !== "sl") return formatClock(ms, tz, lang);
  return `${Number(formatClock(ms, tz, lang).split(":")[0])}h`;
}

/**
 * Header location from stored tenant fields only. Prefers explicit
 * locationName/locality/city if present, else derives the town from a postal
 * address ("Ter 35, 3333 Ljubno ob Savinji" -> "Ljubno ob Savinji"),
 * else falls back to the tenant name.
 */
export function tenantWeatherLocation(tenant: any): string {
  for (const key of ["locationName", "locality", "city", "town"]) {
    const v = tenant?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const address = typeof tenant?.address === "string" ? tenant.address : "";
  for (const part of address.split(/[,\n]/).map((x: string) => x.trim()).reverse()) {
    const m = part.match(/^(?:[A-Z]{1,2}[- ])?\d{4,5}\s+(.+)$/);
    if (m && /\p{L}/u.test(m[1])) return m[1].trim();
  }
  return typeof tenant?.name === "string" ? tenant.name.trim() : "";
}
