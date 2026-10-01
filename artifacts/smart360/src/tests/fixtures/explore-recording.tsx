/** Vite development-only fixture: real ExploreView, synthetic content, no API or auth. */
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ExploreView } from "../../pages/living-guide/LivingGuideGuestShell";
import { LivingGuideSprite } from "../../pages/living-guide/LivingGuideSprite";
import { livingGuideInterWoff2 } from "../../pages/living-guide/inter-font-source";
import { makeT, type UiLanguage } from "../../pages/guest/i18n";
import { WeatherContext } from "../../pages/living-guide/living-guide-weather";
import { syntheticTenant, syntheticWeather } from "../../pages/living-guide/living-guide-weather-fixture-data";

if (!import.meta.env.DEV) throw new Error("Explore recording fixture is development-only");

const query = new URLSearchParams(location.search);
const requestedLang = query.get("lang");
const initialLang: UiLanguage = requestedLang === "en" || requestedLang === "de" || requestedLang === "it" ? requestedLang : "sl";
const requestedTheme = query.get("theme");
document.body.dataset.t = requestedTheme === "jutro" || requestedTheme === "dan" || requestedTheme === "vecer" ? requestedTheme : "noc";
document.documentElement.lang = initialLang;
document.body.style.margin = "0";

function ExploreRecordingFixture() {
  const [lang, setLang] = useState<UiLanguage>(initialLang);
  const [fallback, setFallback] = useState(query.get("fallback") === "1");
  const [enabled, setEnabled] = useState(query.get("enabled") !== "0");
  const tenant = useMemo(() => ({
    ...syntheticTenant(lang), name: "Razvojni preizkus", tourRecordingEnabled: enabled,
  }), [lang, enabled]);
  const categories = useMemo(() => [
    { id: "fixture-food", key: "food", label: { sl: "Hrana", en: "Food", de: "Essen", it: "Cibo" }[lang], isVisible: true, items: [
      { id: "fixture-cafe", title: "TEST café", isVisible: true },
    ] },
    ...tenant.sections[1]!.categories.map((category) => ({
      ...category,
      isVisible: !fallback,
      items: query.get("empty") === ("key" in category ? category.key : undefined) ? [] : category.items,
    })),
    // Labels deliberately resemble eligible categories; stable key act is NOT eligible.
    { id: "fixture-other", key: "act", label: { sl: "Šport", en: "Sport", de: "Sport", it: "Sport" }[lang], isVisible: true, items: [
      { id: "fixture-other-item", title: "TEST other", isVisible: true },
    ] },
  ], [tenant, lang, fallback]);
  const weatherValue = useMemo(() => {
    const now = Date.now();
    return { lang, now, weather: syntheticWeather(query.get("weather") === "warning" ? "warning" : "calm", now) };
  }, [lang]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  // Optional real chip selection for non-interactive screenshots, fixture only.
  useEffect(() => {
    const category = tenant.sections[1]!.categories.find((row) => "key" in row && row.key === query.get("category"));
    if (category) {
      Array.from(document.querySelectorAll<HTMLButtonElement>(".lg2-gtabs button"))
        .find((button) => button.textContent === category.label)?.click();
    }
  }, []);
  return <>
    {query.get("controls") === "1" && <aside>
      <button data-testid="fixture-toggle-fallback" onClick={() => setFallback((value) => !value)}>Toggle eligible categories</button>
      <button data-testid="fixture-toggle-enabled" onClick={() => setEnabled((value) => !value)}>Toggle recording</button>
      <button data-testid="fixture-change-language" onClick={() => setLang((value) => value === "sl" ? "en" : "sl")}>Change language</button>
    </aside>}
    <div className="lg2-app notranslate" data-living-guide data-living-guide-app data-screen="explore" translate="no">
      <style>{`@font-face{font-family:"Inter";src:url("${livingGuideInterWoff2}") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}`}</style>
      <LivingGuideSprite />
      <main className="lg2-stage">
        <WeatherContext.Provider value={weatherValue}>
          <ExploreView tenant={tenant} categories={categories} lang={lang} t={makeT(null, lang)} slug="tour-browser-fixture"
            onOpenCategory={() => undefined} onOpenItem={() => undefined} />
        </WeatherContext.Provider>
      </main>
    </div>
  </>;
}

createRoot(document.getElementById("root")!).render(<ExploreRecordingFixture />);