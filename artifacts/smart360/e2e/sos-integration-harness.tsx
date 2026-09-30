/** Development fixture only; no API fixtures, tenant mutation or publication. */
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LivingGuideGuestShell from "../src/pages/living-guide/LivingGuideGuestShell";
import { syntheticTenant, syntheticWeather, SYNTHETIC_GPX_ROUTE } from "../src/pages/living-guide/living-guide-weather-fixture-data";
import type { UiLanguage } from "../src/pages/guest/i18n";
import "../src/index.css";
import "../src/pages/living-guide/living-guide-tokens.css";
import "../src/pages/living-guide/living-guide-guest.css";

if (!import.meta.env.DEV) throw new Error("SOS integration fixture is development-only");
const search = new URLSearchParams(window.location.search);
const requestedLang = search.get("lang");
const lang: UiLanguage = requestedLang === "en" || requestedLang === "de" || requestedLang === "it" ? requestedLang : "sl";
const tenant = {
  ...syntheticTenant(lang),
  name: "SOS TEST — synthetic tenant",
  latitude: search.has("noCoordinates") ? null : 46.374,
  longitude: search.has("noCoordinates") ? null : 14.815,
};
// Reuse the bounded test GPX, never any guest-recorded data.
Object.assign(tenant.sections[1]!.categories[1]!.items[0]!, {
  gpxRoute: {
    ...SYNTHETIC_GPX_ROUTE,
    // The old weather fixture stores drawing tuples; the real public GPX
    // contract is {lat, lon}. Preserve that contract in this integration test.
    segments: SYNTHETIC_GPX_ROUTE.segments.map(segment => segment.map(([lon, lat]) => ({ lat, lon }))),
  },
});
const surface = search.get("surface") === "gpx" ? "c/c-hike/i/i-hike-1"
  : search.get("surface") === "free" ? "s/explore" : "help";
history.replaceState({
  livingGuidePresentation: surface === "s/explore" ? "standard" : "detail",
  livingGuideFromPresentation: "standard",
  livingGuideHeldDepth: 0,
}, "", `/${tenant.slug}/${surface}?${search}`);
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <LivingGuideGuestShell tenant={tenant} slug={tenant.slug} lang={lang}
      onLanguageChange={() => undefined} devWeather={syntheticWeather("calm")} />
  </QueryClientProvider>,
);