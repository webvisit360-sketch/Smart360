import fr from "./fr.json";
import nl from "./nl.json";
import hr from "./hr.json";
import { GUIDE_LANGUAGES, type GuideLanguage } from "@workspace/guide-languages";

const catalogs: Partial<Record<GuideLanguage, Record<string, string>>> = { fr, nl, hr };
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const templates = Object.fromEntries(Object.entries(catalogs).map(([lang, catalog]) => [
  lang, Object.entries(catalog!).filter(([key]) => /\{v\d+\}/.test(key)).map(([source, target]) => {
    const names: string[] = [];
    const pattern = source.split(/(\{v\d+\})/).map(part => {
      if (/^\{v\d+\}$/.test(part)) { names.push(part); return "(.*?)"; }
      return escapeRegex(part);
    }).join("");
    return { regex: new RegExp(`^${pattern}$`, "s"), names, target };
  }),
])) as Record<string, { regex: RegExp; names: string[]; target: string }[]>;

/** Static, bundled interface copy only. Never translate tenant content here. */
export function translateEnglish(text: string, lang: string): string {
  const dictionary = catalogs[lang as GuideLanguage];
  if (!dictionary) return text;
  if (dictionary[text]?.trim()) {
    // Split bold/plain sentences rely on their leading/trailing spaces.
    return `${text.match(/^\s*/)?.[0] ?? ""}${dictionary[text].trim()}${text.match(/\s*$/)?.[0] ?? ""}`;
  }
  for (const template of templates[lang] ?? []) {
    const match = template.regex.exec(text);
    if (match) return template.names.reduce((result, name, i) => result.replaceAll(name, match[i + 1]), template.target);
  }
  return text;
}

type Widen<T> = T extends string ? string : T extends (...args: infer A) => unknown ? (...args: A) => string : { [K in keyof T]: Widen<T[K]> };
function localize<T>(value: T, lang: GuideLanguage): Widen<T> {
  if (typeof value === "string") return translateEnglish(value, lang) as Widen<T>;
  if (typeof value === "function") return ((...args: unknown[]) => translateEnglish(value(...args), lang)) as Widen<T>;
  if (Array.isArray(value)) return value.map(entry => localize(entry, lang)) as unknown as Widen<T>;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, localize(entry, lang)])) as Widen<T>;
  return value as Widen<T>;
}
/** Existing dictionaries are returned verbatim; only new languages derive from English. */
export function extendCatalog<T>(base: { en: T } & Partial<Record<GuideLanguage, T>>): Record<GuideLanguage, Widen<T>> {
  return Object.fromEntries(GUIDE_LANGUAGES.map(lang => [lang, base[lang] ?? localize(base.en, lang)])) as Record<GuideLanguage, Widen<T>>;
}