/**
 * DEV-ONLY programme fixture (no auth). Renders the real Living Guide shell
 * with a synthetic Camping Menina programme and a selectable "today".
 *   /__program-fixture/c/c-events?date=2026-08-20&lang=sl            week view
 *   /__program-fixture/c/c-events?date=2026-08-20&filter=out         filtered view
 *   /__program-fixture/c/c-events/i/ev-yoga?date=2026-08-20          detail + pills
 *   /__program-fixture/home?date=2026-08-20                          Domov / Danes
 */
import { useMemo, useState } from "react";
import LivingGuideGuestShell from "./LivingGuideGuestShell";
import { programLang, programUiState, setProgramTodayOverride, type ProgramLang } from "./living-guide-program-model";
import { PROGRAM_FIXTURE_DEFAULT_DATE, programFixtureTenant } from "./living-guide-program-fixture-data";

let configured = false;
function configureOnce(search: URLSearchParams) {
  if (configured) return;
  configured = true;
  const date = search.get("date") ?? PROGRAM_FIXTURE_DEFAULT_DATE;
  setProgramTodayOverride(date);
  programUiState.selectedDate = null;
  const filter = search.get("filter");
  programUiState.filter = filter === "in" || filter === "out" ? filter : "all";
  // Deep links to /c/... open as the real detail sheet (same as tapping in-app).
  if (/\/c\//.test(window.location.pathname)) {
    window.history.replaceState({ ...(window.history.state ?? {}), livingGuidePresentation: "detail" }, "");
  }
}

export default function LivingGuideProgramFixture() {
  const search = new URLSearchParams(window.location.search);
  if (import.meta.env.DEV) configureOnce(search);
  const [lang, setLang] = useState<ProgramLang>(() => programLang(search.get("lang") ?? "sl"));
  const tenant = useMemo(() => programFixtureTenant(lang), [lang]);
  return (
    <LivingGuideGuestShell
      tenant={tenant}
      slug={tenant.slug}
      lang={lang}
      onLanguageChange={(next) => setLang(programLang(next))}
      devWeather={null}
    />
  );
}
