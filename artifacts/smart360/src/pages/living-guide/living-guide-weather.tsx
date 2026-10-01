import { useLivingGuideOffline } from "./living-guide-offline";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getGetTenantWeatherQueryKey, useGetTenantWeather } from "@workspace/api-client-react";
import {
  afternoonPrecipitation,
  describeWeather,
  currentWeatherIsDay,
  formatHomeClock,
  formatHomeHour,
  formatTemp,
  homeSolarChip,
  HOME_WEATHER_ZONE,
  nextWeatherTransition,
  todaySlots,
  tourWarning,
  usableWeather,
  warningText,
  weatherIconKind,
  weatherIsDayAt,
  weatherSkin,
  weatherExpiry,
  weatherLang,
  WEATHER_LABELS,
  type TenantWeather,
  type WeatherIconKind,
} from "./living-guide-weather-model";
import "./living-guide-weather.css";

export const WEATHER_TTL_MS = 30 * 60 * 1000;

type WeatherContextValue = { weather: TenantWeather | null; lang: string; now: number };

export const WEATHER_CLOCK_MS = 60 * 1000;

/** Default null: legacy / non-Living-Guide surfaces never render weather. */
export const WeatherContext = createContext<WeatherContextValue | null>(null);
/** Supplied only by the DEV-only fixture, never by production URL parameters. */
export const WeatherFixtureClockContext = createContext<number | undefined>(undefined);

export function useLivingGuideWeather(): WeatherContextValue | null {
  return useContext(WeatherContext);
}

/**
 * The single weather query for a Living Guide session. Home card, free-tour
 * recorder and GPX idle strips all read this one cached value.
 * `override` (dev fixture only) skips the network entirely.
 */
export function WeatherProvider({ slug, lang, override, children }: { slug: string; lang: string; override?: TenantWeather | null; children: ReactNode }) {
  const { disconnected } = useLivingGuideOffline();
  const useOverride = override !== undefined;
  const fixtureClock = useContext(WeatherFixtureClockContext);
  const fixedNow = import.meta.env.DEV && useOverride ? fixtureClock : undefined;
  const query = useGetTenantWeather(slug, {
    query: {
      enabled: !disconnected && !useOverride && !!slug,
      queryKey: getGetTenantWeatherQueryKey(slug),
      staleTime: WEATHER_TTL_MS,
      gcTime: WEATHER_TTL_MS * 2,
      refetchInterval: WEATHER_TTL_MS,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  });
  const raw = useOverride ? override : query.isError ? null : query.data?.weather ?? null;
  // Re-evaluate expiry without relying on the query: offline or paused queries
  // must not keep >3 h / previous-day weather on screen. Minute clock, an exact
  // timer at expiry, and visibility/focus/online wake-ups.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (fixedNow !== undefined) return;
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, WEATHER_CLOCK_MS);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    window.addEventListener("online", tick);
    window.addEventListener("pageshow", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
      window.removeEventListener("online", tick);
      window.removeEventListener("pageshow", tick);
    };
  }, [fixedNow]);
  const displayNow = fixedNow ?? now;
  const weather = disconnected ? null : usableWeather(raw ?? null, displayNow);
  const expiry = weather ? weatherExpiry(weather) : null;
  const transition = weather ? nextWeatherTransition(weather, displayNow) : null;
  useEffect(() => {
    if (expiry === null || fixedNow !== undefined) return;
    const deadline = Math.min(expiry, transition ?? Infinity);
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, deadline - Date.now()) + 1);
    return () => window.clearTimeout(timer);
  }, [expiry, transition, fixedNow]);
  const value = useMemo(() => ({ weather, lang, now: displayNow }), [weather, lang, displayNow]);
  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function WeatherIcon({ code, isDay = true, className }: { code: number; isDay?: boolean; className?: string }) {
  const kind: WeatherIconKind = weatherIconKind(code);
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const cloud = "M7 18h10.5a3.5 3.5 0 0 0 .4-6.98A5 5 0 0 0 8.2 10 4 4 0 0 0 7 18z";
  const smallCloud = "M7 15h9a3 3 0 0 0 .3-6A4.3 4.3 0 0 0 8 8.6 3.3 3.3 0 0 0 7 15z";
  const orb = isDay ? (
    <g className="lgw-sun"><circle cx="9" cy="8" r="3" /><path d="M9 2.5v1.2M3.5 8h1.2M5.1 4.1l.9.9M12.9 4.1l-.9.9" /></g>
  ) : (
    <path className="lgw-moon" d="M11.5 3.5a4.6 4.6 0 1 0 3.7 7.4 4 4 0 0 1-3.7-7.4z" />
  );
  let body: ReactNode;
  switch (kind) {
    case "clear":
      body = isDay ? (
        <g className="lgw-sun"><circle cx="12" cy="12" r="4.2" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></g>
      ) : (
        <path className="lgw-moon" d="M14.5 4a7.5 7.5 0 1 0 5.5 11.6A6.5 6.5 0 0 1 14.5 4z" />
      );
      break;
    case "partly":
      body = <>{orb}<path d="M9 19h8.5a3 3 0 0 0 .3-6A4.3 4.3 0 0 0 10 12.6 3.3 3.3 0 0 0 9 19z" /></>;
      break;
    case "cloud":
      body = <path d={cloud} />;
      break;
    case "fog":
      body = <><path d={smallCloud} /><path d="M4 18.5h16M6 21h12" /></>;
      break;
    case "drizzle":
      body = <><path d={smallCloud} /><path d="M9 18.5v.5M13 18.5v.5M11 21v.5M15 21v.5" /></>;
      break;
    case "rain":
      body = <><path d={smallCloud} /><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3" /></>;
      break;
    case "snow":
      body = <><path d={smallCloud} /><path d="M9 19.5h.01M13 19.5h.01M11 22h.01M15 22h.01M17 19.5h.01" strokeWidth={2.4} /></>;
      break;
    case "storm":
      body = <><path d={smallCloud} /><path d="M12.5 16 10 20h3l-1.5 3.5" /></>;
      break;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} data-kind={kind} {...common}>{body}</svg>;
}

function Glyph({ name }: { name: "drop" | "wind" | "sunset" | "alert" }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      {name === "drop" && <path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z" />}
      {name === "wind" && <path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8" />}
      {name === "sunset" && <path d="M5 17a7 7 0 0 1 14 0M3 20h18M12 4v4M9.5 6.5 12 9l2.5-2.5M4.5 11.5l1.2.8M19.5 11.5l-1.2.8" />}
      {name === "alert" && <path d="M12 4 2.8 19.5h18.4L12 4zM12 10v4.5M12 17.2h.01" />}
    </svg>
  );
}

/** Domov card: inserted between the quick tiles and "Danes". */
export function WeatherCard({ location }: { location?: string }) {
  const ctx = useLivingGuideWeather();
  if (!ctx?.weather) return null;
  const { weather, lang, now } = ctx;
  const skin = weatherSkin(weather, now);
  if (!skin) return null; // Missing astronomical data is never synthesized.
  const l = weatherLang(lang);
  const L = WEATHER_LABELS[l];
  const slots = todaySlots(weather, l);
  const desc = describeWeather(weather.current.weatherCode, l);
  const solarChip = homeSolarChip(weather, now, l);
  return (
    <section className="lgw-card" data-weather-skin={skin} lang={l} aria-label={L.title} data-testid="card-home-weather">
      <div className="lgw-head">
        <p className="lgw-kicker">{L.title}</p>
        {location && <span className="lgw-loc" data-testid="text-weather-location">{location}</span>}
      </div>
      <div className="lgw-now">
        <WeatherIcon code={weather.current.weatherCode} isDay={currentWeatherIsDay(weather, now)} className="lgw-now-icon" />
        <div className="lgw-now-temp" data-testid="text-weather-temp">{formatTemp(weather.current.temperatureC)}</div>
        <div className="lgw-now-copy">
          <b data-testid="text-weather-desc">{desc}</b>
          <span className="lgw-range">
            {L.max} {formatTemp(weather.today.maxC)} <i aria-hidden="true">·</i> {L.min} {formatTemp(weather.today.minC)}
          </span>
        </div>
      </div>
      <ul className="lgw-chips" data-testid="list-weather-chips">
        <li><span className="lgw-chip-k">{L.rain}</span><b>{L.percent(Math.round(weather.today.precipitationProbability))}</b></li>
        <li><span className="lgw-chip-k">{L.wind}</span><b>{Math.round(weather.current.windKmh)} km/h</b></li>
        <li><span className="lgw-chip-k">{solarChip.label}</span><b>{solarChip.time === null ? "—" : formatHomeClock(solarChip.time, HOME_WEATHER_ZONE, l)}</b></li>
      </ul>
      {slots.length > 0 && (
        <ol className="lgw-slots" data-testid="list-weather-slots">
          {slots.map((slot) => (
            <li key={slot.time}>
              <span className="lgw-slot-time">{formatHomeHour(slot.time, HOME_WEATHER_ZONE, l)}</span>
              <WeatherIcon code={slot.weatherCode} isDay={weatherIsDayAt(weather, slot.time)} />
              <b>{formatTemp(slot.temperatureC)}</b>
            </li>
          ))}
        </ol>
      )}
      <span className="lgw-attrib">Open-Meteo</span>
    </section>
  );
}

/** Tour surfaces: calm one-liner, or amber warning when the next ~6 h look rough. */
export function TourWeatherStrip() {
  const ctx = useLivingGuideWeather();
  if (!ctx?.weather) return null;
  const { weather, lang } = ctx;
  const l = weatherLang(lang);
  const L = WEATHER_LABELS[l];
  const warning = tourWarning(weather, ctx.now);
  if (warning) {
    const text = warningText(warning, weather.timezone, l);
    return (
      <div className="lgw-warn" role="status" data-testid="banner-tour-weather-warning" data-kind={warning.kind}>
        <span className="lgw-warn-icon"><Glyph name="alert" /></span>
        <div>
          <b>{text.head}</b>
          <span>{text.detail}</span>
        </div>
      </div>
    );
  }
  return (
    <p className="lgw-strip" data-testid="strip-tour-weather" aria-label={`${formatTemp(weather.current.temperatureC)}, ${describeWeather(weather.current.weatherCode, l)}, ${L.afternoonFull(Math.round(afternoonPrecipitation(weather)))}`}>
      <WeatherIcon code={weather.current.weatherCode} isDay={weather.current.isDay} />
      <b>{formatTemp(weather.current.temperatureC)}</b>
      <span>{describeWeather(weather.current.weatherCode, l)}</span>
      <span className="lgw-strip-rain" aria-hidden="true"><Glyph name="drop" />{L.afternoon(Math.round(afternoonPrecipitation(weather)))}</span>
    </p>
  );
}
