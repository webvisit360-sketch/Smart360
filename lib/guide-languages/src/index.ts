/** Product-wide languages; tenants cannot restrict this registry. */
export const LANGUAGE_REGISTRY = [
  { code: "sl", name: "Slovenščina", locale: "sl-SI" },
  { code: "en", name: "English", locale: "en-GB" },
  { code: "de", name: "Deutsch", locale: "de-DE" },
  { code: "it", name: "Italiano", locale: "it-IT" },
  { code: "fr", name: "Français", locale: "fr-FR" },
  { code: "nl", name: "Nederlands", locale: "nl-NL" },
  { code: "hr", name: "Hrvatski", locale: "hr-HR" },
] as const;
export type GuideLanguage = (typeof LANGUAGE_REGISTRY)[number]["code"];
export const GUIDE_LANGUAGES = LANGUAGE_REGISTRY.map(x => x.code);
export const TRANSLATION_LANGUAGES = GUIDE_LANGUAGES.filter((x): x is Exclude<GuideLanguage, "sl"> => x !== "sl");
/** Existing Creator readiness requirements stay unchanged; new content fields start empty. */
export const REQUIRED_EDITORIAL_LANGUAGES = GUIDE_LANGUAGES.filter(lang => !["fr", "nl", "hr"].includes(lang));
export const LANGUAGE_NAMES = Object.fromEntries(LANGUAGE_REGISTRY.map(x => [x.code, x.name])) as Record<string, string>;
export const LANGUAGE_LOCALES = Object.fromEntries(LANGUAGE_REGISTRY.map(x => [x.code, x.locale])) as Record<GuideLanguage, string>;
export function isGuideLanguage(value: unknown): value is GuideLanguage {
  return typeof value === "string" && GUIDE_LANGUAGES.includes(value as GuideLanguage);
}
export function guideLanguage(value: unknown): GuideLanguage {
  return isGuideLanguage(value) ? value : "sl";
}
/** Whitespace-only translations count as missing; preserve real strings verbatim. */
export function fallbackText(...values: unknown[]): string {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0) as string | undefined ?? "";
}