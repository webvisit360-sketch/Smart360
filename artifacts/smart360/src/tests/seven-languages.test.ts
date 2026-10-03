import test from "node:test";
import assert from "node:assert/strict";
import { GUIDE_LANGUAGES, LANGUAGE_NAMES } from "@workspace/guide-languages";
import { makeT, clampLang, resolveLang, rememberLang, plural, LIVING_GUIDE_UI } from "../pages/guest/i18n";
import { sosT } from "../pages/living-guide/sos/sos-i18n";
import { describeWeather, WEATHER_LABELS } from "../pages/living-guide/living-guide-weather-model";
import { localizedField } from "../pages/living-guide/living-guide-announcements-model";
import { offlineCopy } from "../pages/living-guide/living-guide-offline-model";
import { GUIDED_COPY } from "../lib/guided-tour-preflight";
import { buildItemLanguageDrafts } from "../lib/item-translation-drafts";
import { SUMMARY_LABELS, summaryLabels } from "../lib/tour-summary-model";

test("universal registry, native labels, remembered choice independent of old tenant arrays", () => {
  assert.equal(GUIDE_LANGUAGES.length, 7);
  assert.equal(LANGUAGE_NAMES.fr, "Français");
  const values = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) } });
  try {
    for (const lang of GUIDE_LANGUAGES) {
      rememberLang("test", lang);
      assert.equal(resolveLang("test", null, ["sl"]), lang);
      assert.equal(clampLang(lang, ["sl"]), lang);
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
test("new languages have complete Living Guide UI, weather, SOS, guard, summary and offline copy", () => {
  for (const lang of ["fr", "nl", "hr"] as const) {
    for (const [key, values] of Object.entries(LIVING_GUIDE_UI)) {
      assert.ok(values[lang].trim(), `${lang}:${key}`);
      assert.deepEqual(values[lang].match(/\{[^}]+\}/g)?.sort(), values.en.match(/\{[^}]+\}/g)?.sort(), key);
    }
    assert.notEqual(sosT(lang).callReassurance, sosT("en").callReassurance);
    assert.notEqual(sosT(lang).deniedReassurance, sosT("en").deniedReassurance);
    assert.notEqual(describeWeather(95, lang), describeWeather(95, "en"));
    assert.notEqual(WEATHER_LABELS[lang].sunrise, WEATHER_LABELS.en.sunrise);
    assert.notEqual(GUIDED_COPY[lang].far("1,2 km"), GUIDED_COPY.en.far("1,2 km"));
    assert.ok(SUMMARY_LABELS[lang].distance);
    assert.ok(Object.values(offlineCopy(lang)).every(value => value.trim()));
    assert.ok(summaryLabels(lang).locale.startsWith(lang));
    assert.ok(plural(null, lang, "places", 2).includes("2"));
  }
});
test("empty translated fields fall back to English, then Slovenian", () => {
  const row = { id: "x", tenantId: "x", validFrom: "2026-01-01", createdAt: "2026-01-01", titleSl: "Slovenski", titleEn: "English", titleFr: "  " };
  assert.equal(localizedField(row, "title", "fr"), "English");
  assert.equal(localizedField({ ...row, titleEn: "" }, "title", "fr"), "Slovenski");
  assert.equal(makeT({ ui: { "custom": "" }, uiFallback: { custom: "English" } }, "fr")("custom"), "English");
  assert.ok(makeT({ ui: { "UI.lg.openGuide": "" } }, "fr")("UI.lg.openGuide"));
});
test("editors preserve old content and expose empty new fields", () => {
  const drafts = buildItemLanguageDrafts({ title: "Slovenščina", description: "Izvirnik" }, []);
  assert.deepEqual(drafts.map(d => d.language), GUIDE_LANGUAGES);
  for (const lang of ["fr", "nl", "hr"]) {
    assert.deepEqual(drafts.find(d => d.language === lang), { language: lang, title: "", description: "" });
  }
});