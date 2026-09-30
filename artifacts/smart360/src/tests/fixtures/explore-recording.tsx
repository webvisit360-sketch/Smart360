/** Vite development-only fixture: real ExploreView, synthetic content, no API or auth. */
import React from "react";
import { createRoot } from "react-dom/client";
import { ExploreView } from "../../pages/living-guide/LivingGuideGuestShell";
import { LivingGuideSprite } from "../../pages/living-guide/LivingGuideSprite";
import { livingGuideInterWoff2 } from "../../pages/living-guide/inter-font-source";
import { makeT, type UiLanguage } from "../../pages/guest/i18n";

if (!import.meta.env.DEV) throw new Error("Explore recording fixture is development-only");

const query = new URLSearchParams(location.search);
const requestedLang = query.get("lang");
const lang: UiLanguage = requestedLang === "en" || requestedLang === "de" || requestedLang === "it" ? requestedLang : "sl";
const labels = {
  sl: { bike: "Kolesarjenje", hike: "Pohodništvo" },
  en: { bike: "Cycling", hike: "Hiking" },
  de: { bike: "Radfahren", hike: "Wandern" },
  it: { bike: "In bicicletta", hike: "Escursioni a piedi" },
}[lang];
const requestedTheme = query.get("theme");
document.body.dataset.t = requestedTheme === "jutro" || requestedTheme === "dan" || requestedTheme === "vecer" ? requestedTheme : "noc";
document.documentElement.lang = lang;
document.body.style.margin = "0";

const categories = [
  { id: "fixture-food", label: "Hrana in pijača", isVisible: true, items: [
    { id: "fixture-cafe", title: "Kavarna ob poti", isVisible: true },
  ] },
  { id: "fixture-cycling", key: "bike", label: labels.bike, isVisible: true, items: [
    { id: "fixture-cycle-route", title: "Kolesarska pot", isVisible: true },
  ] },
  { id: "fixture-hiking", key: "hike", label: labels.hike, isVisible: true, items: [
    { id: "fixture-hike-route", title: "Pohodniška pot", isVisible: true },
  ] },
  { id: "fixture-sights", label: "Znamenitosti", isVisible: true, items: [
    { id: "fixture-viewpoint", title: "Razgledna točka", isVisible: true },
  ] },
];
const tenant = {
  name: "Razvojni preizkus",
  tourRecordingEnabled: query.get("enabled") !== "0",
  longitude: 14.5058,
  latitude: 46.0569,
};

createRoot(document.getElementById("root")!).render(
  <div className="lg2-app notranslate" data-living-guide data-living-guide-app data-screen="explore" translate="no">
    <style>{`@font-face{font-family:"Inter";src:url("${livingGuideInterWoff2}") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}`}</style>
    <LivingGuideSprite />
    <main className="lg2-stage">
      <ExploreView tenant={tenant} categories={categories} lang={lang} t={makeT(null, lang)} slug="tour-browser-fixture"
        onOpenCategory={() => undefined} onOpenItem={() => undefined} />
    </main>
  </div>,
);