/**
 * Guest-side i18n. Slovene is the source language and lives in the content
 * itself; everything here is overlay: UI strings (tenant.ui), plural forms
 * (tenant.plurals) and language resolution/persistence.
 *
 * Missing translation → silent Slovene fallback, never a raw key.
 */

/** Built-in Slovene UI strings (the source of truth for the interface). */
export const SL_UI: Record<string, string> = {
  "UI.all": "Vse",
  "UI.search.title": "Kaj iščete?",
  "UI.search.sub": "Nastanitev · Ponudba · Okolica",
  "UI.search.placeholder": "Išči",
  "UI.search.empty": "Ni zadetkov.",
  "UI.host.title": "Tu smo za vas",
  "UI.host.sub": "Običajno odgovorimo v nekaj minutah",
  "UI.host.cta": "Kontaktirajte gostitelja",
  "UI.tip": "Nasvet gostitelja",
  "UI.contact.title": "Kontaktirajte gostitelja",
  "UI.contact.sub": "Običajno odgovorimo v nekaj minutah",
  "UI.contact.call": "Pokličite",
  "UI.contact.whatsapp": "WhatsApp",
  "UI.contact.viber": "Viber",
  "UI.contact.message": "Pišite sporočilo",
  "UI.contact.instagram": "Instagram",
  "UI.contact.instagram.sub": "Označite nas v zgodbi",
  "UI.contact.address": "Naslov",
  "UI.contact.email": "E-pošta",
  "UI.contact.directions": "Navigacija do nas",
  "UI.maps": "Google Maps",
  "UI.book": "Rezerviraj",
  "UI.book.title": "Rezervacija",
  "UI.book.fastest": "Najhitrejši odgovor",
  "UI.book.call": "Pokličite gostitelja",
  "UI.book.message": "Pozdravljeni, zanima me: ",
  "UI.share.title": "Delite to stran",
  "UI.share.sub": "Skenirajte kodo ali pošljite povezavo naprej.",
  "UI.share.native": "Deli",
  "UI.share.native.sub": "Pošljite povezavo s telefona",
  "UI.share.copy": "Kopiraj povezavo",
  "UI.share.copied": "Kopirano ✓",
  "UI.share.print": "Natisni nalepko",
  "UI.share.print.sub": "Za apartma, A6",
  "UI.label.scan": "Skenirajte za vse o vašem bivanju",
  "UI.lang.title": "Jezik in nastavitve",
  "UI.lang.sub": "Prevodi se urejajo v administraciji.",
  "UI.lang.selected": "izbrano",
  "UI.sound": "Zvok gumbov",
  "UI.sound.on": "Vklopljen",
  "UI.sound.off": "Izklopljen",
  "UI.sound.turnOn": "Vklopi",
  "UI.sound.turnOff": "Izklopi",
  "UI.tour.pill": "360° sprehod",
  "UI.tour.hint": "Povlecite za razgled",
  "UI.open": "Odprto zdaj",
  "UI.closed": "Zaprto",
  "UI.opensAt": "Odpre ob",
  "UI.closesAt": "Zapre ob",
  "UI.wifi.network": "Omrežje",
  "UI.wifi.password": "Geslo",
  "UI.wifi.copy": "Kopiraj",
  "UI.wifi.scan": "Skenirajte za samodejno povezavo",
  "UI.notFound": "Namestitev ni najdena",
  "UI.zoomHint": "Dvakrat tapnite za povečavo",
  "UI.difficulty.easy": "Lahka",
  "UI.difficulty.mod": "Zmerna",
  "UI.difficulty.hard": "Zahtevna",
  "UI.included": "Vključeno",
  "UI.gallery.of": "od",
  // Theme extras (translatable via ui rows like the rest).
  "UI.interest": "Kaj vas zanima?",
  "UI.contact.k": "Stik",
  "UI.contact.intro": "Vprašanje, rezervacija ali priporočilo — odgovorimo v nekaj minutah.",
  "UI.open247": "Odprto 24/7",
  "UI.website": "Spletna stran",
  "UI.nearby": "v bližini",
  "UI.withEvents": "z dogodki",
  "UI.rules.sub": "Pravila in navodila",
  "UI.info": "Informacije",
  "UI.searching": "Iskanje ...",
  "UI.search.min": "Vnesite vsaj 3 črke za iskanje.",
  "UI.tab.home": "Domov",
  "UI.tab.discover": "Odkrij",
  "UI.tab.offer": "Ponudba",
  "UI.tab.services": "Storitve",
  "UI.tab.contact": "Kontakt",
  "UI.contact.how": "Kako vam lahko pomagamo?",
  "UI.maps.open": "Odpri pot v Google Maps",
};

/** Slovene difficulty values as stored in content → UI keys. */
export const DIFFICULTY_KEYS: Record<string, string> = {
  Lahka: "UI.difficulty.easy",
  Zmerna: "UI.difficulty.mod",
  Zahtevna: "UI.difficulty.hard",
};

/** Built-in Slovene plural forms (4 CLDR forms: one, two, few, other). */
export const SL_PLURALS: Record<string, Record<string, string>> = {
  reviews: { one: "{n} ocena", two: "{n} oceni", few: "{n} ocene", other: "{n} ocen" },
  info: { one: "{n} informacija", two: "{n} informaciji", few: "{n} informacije", other: "{n} informacij" },
  experiences: { one: "{n} doživetje", two: "{n} doživetji", few: "{n} doživetja", other: "{n} doživetij" },
  places: { one: "{n} kraj", two: "{n} kraja", few: "{n} kraji", other: "{n} krajev" },
  routes: { one: "{n} pot", two: "{n} poti", few: "{n} poti", other: "{n} poti" },
  products: { one: "{n} izdelek", two: "{n} izdelka", few: "{n} izdelki", other: "{n} izdelkov" },
  rules: { one: "{n} pravilo", two: "{n} pravili", few: "{n} pravila", other: "{n} pravil" },
  events: { one: "{n} dogodek", two: "{n} dogodka", few: "{n} dogodki", other: "{n} dogodkov" },
  entries: { one: "{n} vnos", two: "{n} vnosa", few: "{n} vnosi", other: "{n} vnosov" },
  options: { one: "{n} možnost", two: "{n} možnosti", few: "{n} možnosti", other: "{n} možnosti" },
  apartments: { one: "{n} apartma", two: "{n} apartmaja", few: "{n} apartmaji", other: "{n} apartmajev" },
};

/** English built-ins for keys/plurals that predate a tenant's ui import. */
const EN_FALLBACK_PLURALS: Record<string, Record<string, string>> = {
  entries: { one: "{n} entry", other: "{n} entries" },
  options: { one: "{n} option", other: "{n} options" },
  apartments: { one: "{n} apartment", other: "{n} apartments" },
};

type TenantLike = {
  ui?: Record<string, string> | null;
  plurals?: Record<string, Record<string, string>> | null;
};

/** UI string lookup: tenant translation → Slovene built-in → the key's tail. */
export function makeT(tenant: TenantLike | null | undefined, lang: string) {
  const overlay = lang !== "sl" ? (tenant?.ui ?? {}) : {};
  return (key: string): string => overlay[key] ?? SL_UI[key] ?? key;
}

/**
 * Pluralised phrase via Intl.PluralRules — never an if/else chain.
 * Slovene has 4 forms; the language's own rules pick the right one.
 */
export function plural(
  tenant: TenantLike | null | undefined,
  lang: string,
  key: string,
  n: number
): string {
  const forms =
    (lang !== "sl"
      ? (tenant?.plurals?.[key] ?? EN_FALLBACK_PLURALS[key])
      : undefined) ?? SL_PLURALS[key];
  if (!forms) return String(n);
  let form: string;
  try {
    form = new Intl.PluralRules(lang).select(n);
  } catch {
    form = new Intl.PluralRules("sl").select(n);
  }
  const tmpl = forms[form] ?? forms["other"] ?? "{n}";
  return tmpl.replace("{n}", String(n));
}

const LS_PREFIX = "s360-lang:";

/**
 * Resolve the guest language: ?lang → remembered choice (per accommodation)
 * → browser language → Slovene. Only languages the tenant enables count.
 */
export function resolveLang(
  slug: string,
  urlLang: string | null,
  enabled: string[] | null | undefined
): string {
  // Before the tenant arrives the enabled list is unknown — accept every
  // supported language; the globe menu itself only offers tenant.languages.
  const langs = enabled?.length ? enabled : ["sl", "en", "de", "it"];
  const ok = (l: string | null | undefined): l is string =>
    !!l && langs.includes(l);
  if (ok(urlLang)) return urlLang;
  try {
    const stored = localStorage.getItem(LS_PREFIX + slug);
    if (ok(stored)) return stored;
  } catch { /* private mode */ }
  const nav = (navigator.language || "").slice(0, 2).toLowerCase();
  if (ok(nav)) return nav;
  return langs.includes("sl") ? "sl" : (langs[0] ?? "sl");
}

/** Once the tenant is known, an un-enabled language silently becomes Slovene. */
export function clampLang(
  lang: string,
  enabled: string[] | null | undefined
): string {
  if (!enabled?.length) return lang;
  return enabled.includes(lang) ? lang : "sl";
}

/** Remember the guest's explicit choice for this accommodation. */
export function rememberLang(slug: string, lang: string): void {
  try {
    localStorage.setItem(LS_PREFIX + slug, lang);
  } catch { /* private mode */ }
}

/** Switch language: persist + reflect in the URL (survives navigation). */
export function switchLang(slug: string, lang: string): void {
  rememberLang(slug, lang);
  const sp = new URLSearchParams(window.location.search);
  if (lang === "sl") sp.delete("lang");
  else sp.set("lang", lang);
  const q = sp.toString();
  window.location.href =
    window.location.pathname + (q ? `?${q}` : "") + window.location.hash;
}

/**
 * Keep <html lang> and hreflang alternates in sync with the active language.
 * Call from the guest page effect.
 */
export function applyDocumentLang(
  lang: string,
  slug: string,
  enabled: string[] | null | undefined
): void {
  document.documentElement.lang = lang;
  document
    .querySelectorAll('link[data-s360-hreflang]')
    .forEach((el) => el.remove());
  const langs = enabled?.length ? enabled : ["sl"];
  const base = `${window.location.origin}/${slug}`;
  for (const l of langs) {
    const link = document.createElement("link");
    link.rel = "alternate";
    link.hreflang = l;
    link.href = l === "sl" ? base : `${base}?lang=${l}`;
    link.setAttribute("data-s360-hreflang", "1");
    document.head.appendChild(link);
  }
  const xd = document.createElement("link");
  xd.rel = "alternate";
  xd.hreflang = "x-default";
  xd.href = base;
  xd.setAttribute("data-s360-hreflang", "1");
  document.head.appendChild(xd);
}

/** Native-name labels for the language switcher. */
export const LANG_NAMES: Record<string, string> = {
  sl: "Slovenščina",
  en: "English",
  de: "Deutsch",
  it: "Italiano",
};
