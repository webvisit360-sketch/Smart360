import type { GuideLanguage } from "@workspace/guide-languages";
const nouns = {
  reviews: { en: ["review", "reviews"], fr: ["avis", "avis"], nl: ["beoordeling", "beoordelingen"], hr: ["recenzija", "recenzije", "recenzija"] },
  info: { en: ["piece of information", "pieces of information"], fr: ["information", "informations"], nl: ["informatiebericht", "informatieberichten"], hr: ["informacija", "informacije", "informacija"] },
  experiences: { en: ["experience", "experiences"], fr: ["expérience", "expériences"], nl: ["ervaring", "ervaringen"], hr: ["doživljaj", "doživljaja", "doživljaja"] },
  places: { en: ["place", "places"], fr: ["lieu", "lieux"], nl: ["plek", "plekken"], hr: ["mjesto", "mjesta", "mjesta"] },
  routes: { en: ["route", "routes"], fr: ["itinéraire", "itinéraires"], nl: ["route", "routes"], hr: ["ruta", "rute", "ruta"] },
  products: { en: ["product", "products"], fr: ["produit", "produits"], nl: ["product", "producten"], hr: ["proizvod", "proizvoda", "proizvoda"] },
  rules: { en: ["rule", "rules"], fr: ["règle", "règles"], nl: ["regel", "regels"], hr: ["pravilo", "pravila", "pravila"] },
  events: { en: ["event", "events"], fr: ["événement", "événements"], nl: ["evenement", "evenementen"], hr: ["događaj", "događaja", "događaja"] },
  entries: { en: ["entry", "entries"], fr: ["entrée", "entrées"], nl: ["item", "items"], hr: ["unos", "unosa", "unosa"] },
  options: { en: ["option", "options"], fr: ["option", "options"], nl: ["optie", "opties"], hr: ["mogućnost", "mogućnosti", "mogućnosti"] },
  apartments: { en: ["apartment", "apartments"], fr: ["appartement", "appartements"], nl: ["appartement", "appartementen"], hr: ["apartman", "apartmana", "apartmana"] },
};
type Forms = Record<string, Record<string, string>>;
export const UI_PLURALS = Object.fromEntries(
  (["en", "fr", "nl", "hr"] as const).map(lang => [lang, Object.fromEntries(
    Object.entries(nouns).map(([key, names]) => [key, {
      one: `{n} ${names[lang][0]}`, other: `{n} ${names[lang].at(-1)}`,
      ...(lang === "hr" ? { few: `{n} ${names.hr[1]}` } : {}),
    }]),
  )]),
) as unknown as Record<"en" | "fr" | "nl" | "hr", Forms> & Partial<Record<GuideLanguage, Forms>>;