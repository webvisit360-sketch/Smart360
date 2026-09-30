/**
 * DEV-ONLY weather fixture. Renders the actual Living Guide Home and the
 * actual tour surfaces with deterministic synthetic weather (no network for weather).
 *   /__weather-fixture/home?theme=noc&weather=calm&lang=sl
 *   /__weather-fixture/s/explore?theme=noc&weather=calm   (real Raziskuj view;
 *       click the "Snemanje tur" tab to open the real recorder)
 *   /__weather-fixture/gpx?theme=noc&weather=warning&lang=en  (real GPX entry, variant lg)
 */
import { useLayoutEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import LivingGuideGuestShell from "./LivingGuideGuestShell";
import { LivingGuideSprite } from "./LivingGuideSprite";
import { LivingGuideGpxRoute } from "./living-guide-gpx";
import { WeatherProvider } from "./living-guide-weather";
import { isLivingTheme } from "./theme-clock";
import { makeT, type UiLanguage } from "../guest/i18n";
import { SYNTHETIC_GPX_ROUTE, syntheticTenant, syntheticWeather } from "./living-guide-weather-fixture-data";
import "./living-guide-tokens.css";
import "./living-guide-guest.css";

export default function LivingGuideWeatherFixture() {
  const [location] = useLocation();
  const search = new URLSearchParams(window.location.search);
  const mode = search.get("weather") === "warning" ? "warning" : "calm";
  const [lang, setLang] = useState<UiLanguage>(() => {
    const requested = search.get("lang");
    return requested === "en" || requested === "de" || requested === "it" ? requested : "sl";
  });
  const tenant = useMemo(() => syntheticTenant(lang), [lang]);
  const weather = useMemo(() => syntheticWeather(mode), [mode]);
  const surface = location.split("/").filter(Boolean)[1] ?? "home";

  if (surface === "gpx") return <GpxSurface tenant={tenant} lang={lang} weather={weather} theme={search.get("theme")} />;
  return (
    <LivingGuideGuestShell
      tenant={tenant}
      slug={tenant.slug}
      lang={lang}
      onLanguageChange={(next) => setLang(next === "en" || next === "de" || next === "it" ? next : "sl")}
      devWeather={weather}
    />
  );
}

function GpxSurface({ tenant, lang, weather, theme }: { tenant: any; lang: string; weather: ReturnType<typeof syntheticWeather>; theme: string | null }) {
  useLayoutEffect(() => {
    const previous = document.body.dataset.t;
    document.body.dataset.t = isLivingTheme(theme) ? theme : "noc";
    return () => { if (previous) document.body.dataset.t = previous; else delete document.body.dataset.t; };
  }, [theme]);
  const t = makeT(tenant, lang);
  return (
    <WeatherProvider slug={tenant.slug} lang={lang} override={weather}>
      <div className="lg2-app" data-living-guide data-testid="fixture-weather-gpx">
        <LivingGuideSprite />
        <div className="lg-stars" aria-hidden="true" />
        <div className="lgw-fixture">
          <p className="lgw-fixture-note">DEV fixture · synthetic weather</p>
          <LivingGuideGpxRoute route={SYNTHETIC_GPX_ROUTE as any} slug={tenant.slug} itemId="i-hike-1" t={t} variant="lg" heading="TEST GPX tura" />
        </div>
      </div>
    </WeatherProvider>
  );
}
