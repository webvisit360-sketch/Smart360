/**
 * DEV-ONLY Enostaven comparison fixture (real LivingGuideGuestShell).
 *   /__simple-fixture/home?tenant=drobez|melipu&palette=bordo|modra|custom|trend&color=%23RRGGBB&lang=sl
 *   /__simple-fixture?tenant=melipu&palette=modra            (landing)
 * Guest identity is not required: the "open guide" sign-in sheet offers "later".
 */
import { guideLanguage } from "@workspace/guide-languages";
import { useMemo, useState, useEffect } from "react";
import LivingGuideGuestShell from "../LivingGuideGuestShell";
import { simpleFixtureTenant } from "./simple-fixture-data";
import TileIconEditorFixture from "./TileIconEditorFixture";
import { WeatherFixtureClockContext } from "../living-guide-weather";
import { syntheticWeather, weatherFixtureTime } from "../living-guide-weather-fixture-data";
import type { WeatherSkin } from "../living-guide-weather-model";

export default function SimpleDesignFixture() {
  const [search] = useState(() => new URLSearchParams(window.location.search));
  const [lang, setLang] = useState(() => guideLanguage(search.get("lang")));
  const tenantKey = search.get("tenant") ?? "drobez";
  const palette = search.get("palette") ?? "bordo";
  const color = search.get("color");
  const skin = search.get("skin");
  const dynamic = ["morning", "day", "evening", "night"].includes(skin ?? "");
  const fixedNow = dynamic ? weatherFixtureTime(skin as WeatherSkin) : undefined;
  const published = search.get("source") === "published";
  const [snapshot, setSnapshot] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!published) return;
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}verification-only/enostaven/${tenantKey === "melipu" ? "meli-pu" : "turizem-drobez"}-${lang}.json`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw Error("Published evidence snapshot missing"); return r.json(); })
      .then(setSnapshot).catch(e => { if (e.name !== "AbortError") setError(String(e)); });
    return () => controller.abort();
  }, [published, tenantKey, lang]);
  const tenant = useMemo(
    () => published && snapshot ? { ...snapshot, slug: "__simple-fixture", guestDesign: palette === "trend" ? "trend" : "simple", simplePalette: palette, simpleBaseColor: color } : simpleFixtureTenant(tenantKey, palette, color),
    [tenantKey, palette, color, published, snapshot],
  );
  if (error) return <p role="alert">{error}</p>;
  if (search.get("evidence") === "icon-editor") return <TileIconEditorFixture />;
  if (published && !snapshot) return <p>Loading published evidence…</p>;
  return (
    <WeatherFixtureClockContext.Provider value={fixedNow}>
    <LivingGuideGuestShell
      tenant={search.get("evidence") === "landing-photo" ? {
        ...tenant, tourUrl: null,
        livingGuideHeroUrl: `${import.meta.env.BASE_URL}reports/enostaven/landing-correction/${tenantKey === "melipu" ? "melipu" : "drobez"}-photo.jpg`,
      } : { ...tenant, simpleDynamicBackground: dynamic }}
      slug="__simple-fixture"
      lang={lang}
      devWeather={fixedNow !== undefined ? syntheticWeather("calm", fixedNow) : null}
      onLanguageChange={(next) => setLang(guideLanguage(next))}
    />
    </WeatherFixtureClockContext.Provider>
  );
}
