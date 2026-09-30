/**
 * DEV-ONLY synthetic programme tenant (reference case from program-dogodkov-dizajn.html).
 * No real/production images: thumbnails/hero use the reference gradients via __fixtureTint.
 */
import type { ProgramLang } from "./living-guide-program-model";

export const PROGRAM_FIXTURE_SLUG = "__program-fixture";
export const PROGRAM_FIXTURE_DEFAULT_DATE = "2026-08-20";
export const PROGRAM_FIXTURE_CATEGORY_ID = "c-events";

const T: Record<ProgramLang, Record<string, string>> = {
  sl: { yoga: "Jutranja joga", kids: "Otroški klub", bike: "Vodena kolesarska tura", beer: "Degustacija piva", fire: "Večer ob tabornem ognju", yogaBody: "Začnite svoj dan umirjeno, sproščeno in povezano s svojim telesom. Dobrodošli ste vsi — predhodno znanje ni potrebno.", all: "Za vse", person: "osebo", events: "Dogodki", stay: "Bivanje", house: "Hišni red", quiet: "Nočni mir" },
  en: { yoga: "Morning yoga", kids: "Kids' club", bike: "Guided bike tour", beer: "Beer tasting", fire: "Campfire evening", yogaBody: "Start your day calm, relaxed and connected with your body. Everyone is welcome — no prior experience needed.", all: "For everyone", person: "person", events: "Events", stay: "Stay", house: "House rules", quiet: "Quiet hours" },
  de: { yoga: "Morgen-Yoga", kids: "Kinderclub", bike: "Geführte Radtour", beer: "Bierverkostung", fire: "Lagerfeuerabend", yogaBody: "Beginnen Sie den Tag ruhig, entspannt und im Einklang mit Ihrem Körper. Alle sind willkommen — keine Vorkenntnisse nötig.", all: "Für alle", person: "Person", events: "Veranstaltungen", stay: "Aufenthalt", house: "Hausordnung", quiet: "Nachtruhe" },
  it: { yoga: "Yoga del mattino", kids: "Club dei bambini", bike: "Tour guidato in bici", beer: "Degustazione di birra", fire: "Serata al falò", yogaBody: "Inizia la giornata con calma, rilassato e in sintonia con il tuo corpo. Tutti sono benvenuti — non serve esperienza.", all: "Per tutti", person: "persona", events: "Eventi", stay: "Soggiorno", house: "Regole della casa", quiet: "Silenzio notturno" },
};

export function programFixtureTenant(lang: ProgramLang = "sl") {
  const l = T[lang];
  const ev = (id: string, title: string, extra: Record<string, unknown>) => ({
    id, title, isVisible: true, media: [], body: "", ...extra,
  });
  return {
    id: "program-fixture",
    slug: PROGRAM_FIXTURE_SLUG,
    name: "Camping Menina",
    address: "Testni naslov (samo za razvoj)",
    latitude: 46.2745,
    longitude: 14.8513,
    languages: ["sl", "en", "de", "it"],
    notices: [],
    sitePlanImages: [],
    orderPasswordConfigured: false,
    sections: [
      { id: "s-stay", key: "stay", label: l.stay, isVisible: true, categories: [
        { id: "c-house", label: l.house, layout: "rules", isVisible: true, items: [
          { id: "i-quiet", title: l.quiet, subtitle: "22:00–7:00", isVisible: true, media: [], body: "" },
        ] },
      ] },
      { id: "s-events", key: "events", label: l.events, isVisible: true, categories: [
        { id: PROGRAM_FIXTURE_CATEGORY_ID, key: "events", label: l.events, layout: "events", isVisible: true, items: [
          ev("ev-yoga", l.yoga, {
            __fixtureTint: 1, body: l.yogaBody, orderEnabled: true, price: "10 €", priceUnit: l.person,
            eventSchedule: { type: "weekly", days: ["thu", "fri", "sat", "sun"], timeFrom: "09:00", timeTo: "10:00", locationText: "Healthy Corner — Kamp Menina", ageText: l.all, inCamp: true },
          }),
          ev("ev-kids", l.kids, {
            __fixtureTint: 2,
            eventSchedule: { type: "weekly", days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], timeFrom: "09:00", timeTo: "10:30", validFrom: "2026-06-15", validTo: "2026-09-15", inCamp: true },
          }),
          ev("ev-bike", l.bike, {
            __fixtureTint: 3,
            eventSchedule: { type: "once", date: "2026-08-20", timeFrom: "10:00", timeTo: "15:00", inCamp: false },
          }),
          ev("ev-beer", l.beer, {
            __fixtureTint: 4, orderEnabled: true,
            eventSchedule: { type: "once", date: "2026-08-20", timeFrom: "19:00", timeTo: "21:30", ageText: "18+", inCamp: true },
          }),
          // Legacy entry: only eventStart (naive local), no end, no badge.
          ev("ev-fire", l.fire, { eventStart: "2026-08-21T20:00:00" }),
        ] },
      ] },
    ],
  };
}
