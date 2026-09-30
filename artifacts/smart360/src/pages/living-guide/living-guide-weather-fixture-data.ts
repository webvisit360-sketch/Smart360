/** Deterministic synthetic weather + tenant for the dev-only weather fixture. */
import type { TenantWeather } from "./living-guide-weather-model";

const HOUR = 60 * 60 * 1000;

/** Epoch ms of today's HH:MM in Europe/Ljubljana, independent of the current clock time. */
function ljubljanaToday(hour: number, minute: number, now: number): number {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, hour, minute);
  const localHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Ljubljana", hour: "2-digit", hourCycle: "h23" }).format(new Date(guess)));
  return guess - (localHour - hour) * HOUR; // remove the CET/CEST offset
}

export function syntheticWeather(mode: "calm" | "warning", now = Date.now()): TenantWeather {
  const hourStart = Math.floor(now / HOUR) * HOUR;
  const hourly: TenantWeather["hourly"] = [];
  for (let i = -14; i <= 26; i++) {
    const time = hourStart + i * HOUR;
    const wave = Math.round(10 * Math.sin((i + 14) / 5));
    const stormy = mode === "warning" && i >= 2 && i <= 4;
    hourly.push({
      time,
      temperatureC: 21.4 + wave / 3,
      weatherCode: stormy ? 95 : i % 5 === 0 ? 1 : 2,
      precipitationProbability: stormy ? 72 : mode === "warning" ? 38 : 12 + (Math.abs(wave) % 9),
    });
  }
  return {
    fetchedAt: new Date(now - 7 * 60 * 1000).toISOString(),
    timezone: "Europe/Ljubljana",
    current: { time: hourStart, temperatureC: 22.6, weatherCode: mode === "warning" ? 3 : 2, isDay: true, windKmh: 11.3 },
    today: { maxC: 26.8, minC: 14.2, precipitationProbability: mode === "warning" ? 72 : 18, sunset: ljubljanaToday(18, 40, now) },
    hourly,
  };
}

const item = (id: string, title: string, subtitle: string) => ({
  id, title, subtitle, isVisible: true, media: [], body: "", mapQuery: title,
});

export function syntheticTenant(lang: "sl" | "en" | "de" | "it" = "sl") {
  const labels = {
    sl: { bike: "Kolesarjenje", hike: "Pohodništvo" },
    en: { bike: "Cycling", hike: "Hiking" },
    de: { bike: "Radfahren", hike: "Wandern" },
    it: { bike: "In bicicletta", hike: "Escursioni a piedi" },
  }[lang];
  return {
    id: "weather-fixture",
    slug: "__weather-fixture",
    name: "TEST – vremenski prikaz",
    address: "Testni naslov (samo za razvoj)",
    latitude: 46.1273,
    longitude: 14.4632,
    tourRecordingEnabled: true,
    languages: ["sl", "en", "de", "it"],
    notices: [],
    sitePlanImages: [],
    wifiSsid: "Brinje-Guest",
    wifiPassword: "smreka-2291",
    sections: [
      { id: "s-stay", key: "stay", label: "Bivanje", isVisible: true, categories: [
        { id: "c-house", label: "Hišni red", layout: "rules", isVisible: true, items: [item("i-quiet", "Nočni mir", "Od 22:00 do 7:00")] },
      ] },
      { id: "s-explore", key: "explore", label: "Raziskuj", isVisible: true, categories: [
        { id: "c-bike", key: "bike", label: labels.bike, layout: "routes", isVisible: true, items: [
          item("i-bike-1", "TEST kolesarska tura A", "Testni vnos · 18 km"),
          item("i-bike-2", "TEST kolesarska tura B", "Testni vnos · 32 km"),
        ] },
        { id: "c-hike", key: "hike", label: labels.hike, layout: "routes", isVisible: true, items: [
          item("i-hike-1", "TEST pohod A", "Testni vnos · 2 h"),
          item("i-hike-2", "TEST pohod B", "Testni vnos · 3 h 30 min"),
        ] },
      ] },
    ],
  };
}

export const SYNTHETIC_GPX_ROUTE = {
  fileId: "fixture-gpx",
  filename: "smarna-gora.gpx",
  activity: "hiking",
  distanceKm: 6.4,
  ascentM: 412,
  descentM: 409,
  minElevationM: 312,
  maxElevationM: 669,
  durationMinutes: 142,
  segments: [[[14.4580, 46.1210], [14.4610, 46.1245], [14.4632, 46.1273], [14.4660, 46.1302]]],
  profile: [
    { distanceKm: 0, elevationM: 312, segment: 0 },
    { distanceKm: 2.1, elevationM: 455, segment: 0 },
    { distanceKm: 4.3, elevationM: 669, segment: 0 },
    { distanceKm: 6.4, elevationM: 318, segment: 0 },
  ],
};
