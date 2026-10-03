// Guest menu copy and row order (pure, testable).
import { guideLanguage, LANGUAGE_NAMES, type GuideLanguage } from "@workspace/guide-languages";
import { extendCatalog } from "../../lib/guest-catalogs";
export type MenuLang = GuideLanguage;
export const LANG_NAMES: Record<string, string> = LANGUAGE_NAMES;

export const MENU_COPY = extendCatalog({
  sl: {
    menu: "Meni", close: "Zapri meni", language: "Jezik", profile: "Moj profil", profileSub: "Za izračun kalorij pri turah — ostane na napravi",
    install: "Dodaj na začetni zaslon", installSub: "Vodnik kot aplikacija z ikono", help: "Pomoč in nujni primeri", helpSub: "Kontakti, 112, SOS lokacija",
    about: "O vodniku", aboutSub: "Zasebnost in viri podatkov", footer: "Digitalni vodnik poganja Smart360 · smart360.info",
    aboutTitle: "O vodniku", aboutWhatH: "Kaj je ta vodnik", aboutWhat: "Digitalni vodnik vaše namestitve: informacije o bivanju, ponudba, dogodki, ture in nasveti za okolico — v brskalniku, brez prijave in brez namestitve aplikacije.",
    aboutPrivacyH: "Zasebnost", aboutPrivacy: "Posnete ture, vaš profil za izračun kalorij, stanje prebranih obvestil in SOS lokacija ostanejo samo na tej napravi in se ne pošiljajo na strežnik. Sporočila in naročila gostitelju se pošljejo le, ko jih sami oddate.",
    aboutSourcesH: "Viri podatkov", aboutSources: "Vsebino vodnika in obvestila ureja gostitelj. Vremenska napoved: Open-Meteo (open-meteo.com). Zemljevidi in navigacija se odprejo v vaši aplikaciji za zemljevide. Številka 112 je enotna evropska številka za nujne primere.",
  },
  en: {
    menu: "Menu", close: "Close menu", language: "Language", profile: "My profile", profileSub: "For tour calorie estimates — stays on this device",
    install: "Add to Home Screen", installSub: "Use the guide like an app", help: "Help & emergencies", helpSub: "Contacts, 112, SOS location",
    about: "About this guide", aboutSub: "Privacy and data sources", footer: "Digital guide powered by Smart360 · smart360.info",
    aboutTitle: "About this guide", aboutWhatH: "What this guide is", aboutWhat: "The digital guide to your stay: practical information, services, events, tours and local tips — right in your browser, no sign-up and no app install.",
    aboutPrivacyH: "Privacy", aboutPrivacy: "Recorded tours, your calorie profile, which announcements you have read and your SOS location stay on this device only and are never sent to a server. Messages and orders reach your host only when you send them.",
    aboutSourcesH: "Data sources", aboutSources: "Guide content and announcements are maintained by your host. Weather forecast: Open-Meteo (open-meteo.com). Maps and directions open in your maps app. 112 is the single European emergency number.",
  },
  de: {
    menu: "Menü", close: "Menü schließen", language: "Sprache", profile: "Mein Profil", profileSub: "Für Kalorienschätzung bei Touren — bleibt auf dem Gerät",
    install: "Zum Home-Bildschirm", installSub: "Den Guide wie eine App nutzen", help: "Hilfe & Notfälle", helpSub: "Kontakte, 112, SOS-Standort",
    about: "Über den Guide", aboutSub: "Datenschutz und Datenquellen", footer: "Digitaler Guide bereitgestellt von Smart360 · smart360.info",
    aboutTitle: "Über den Guide", aboutWhatH: "Was dieser Guide ist", aboutWhat: "Der digitale Guide zu Ihrem Aufenthalt: Infos, Angebote, Veranstaltungen, Touren und Tipps für die Umgebung — direkt im Browser, ohne Anmeldung und ohne App-Installation.",
    aboutPrivacyH: "Datenschutz", aboutPrivacy: "Aufgezeichnete Touren, Ihr Kalorienprofil, gelesene Mitteilungen und Ihr SOS-Standort bleiben nur auf diesem Gerät und werden nicht an einen Server gesendet. Nachrichten und Bestellungen erreichen den Gastgeber nur, wenn Sie sie absenden.",
    aboutSourcesH: "Datenquellen", aboutSources: "Inhalte und Mitteilungen pflegt Ihr Gastgeber. Wettervorhersage: Open-Meteo (open-meteo.com). Karten und Navigation öffnen sich in Ihrer Karten-App. 112 ist der einheitliche europäische Notruf.",
  },
  it: {
    menu: "Menu", close: "Chiudi menu", language: "Lingua", profile: "Il mio profilo", profileSub: "Per stimare le calorie nei tour — resta sul dispositivo",
    install: "Aggiungi alla schermata Home", installSub: "Usa la guida come un'app", help: "Aiuto ed emergenze", helpSub: "Contatti, 112, posizione SOS",
    about: "Informazioni sulla guida", aboutSub: "Privacy e fonti dei dati", footer: "Guida digitale realizzata con Smart360 · smart360.info",
    aboutTitle: "Informazioni sulla guida", aboutWhatH: "Che cos'è questa guida", aboutWhat: "La guida digitale del tuo soggiorno: informazioni pratiche, servizi, eventi, tour e consigli sui dintorni — nel browser, senza registrazione e senza installare app.",
    aboutPrivacyH: "Privacy", aboutPrivacy: "I tour registrati, il profilo calorie, gli avvisi letti e la posizione SOS restano solo su questo dispositivo e non vengono inviati a nessun server. Messaggi e ordini arrivano all'host solo quando li invii tu.",
    aboutSourcesH: "Fonti dei dati", aboutSources: "Contenuti e avvisi sono gestiti dal tuo host. Previsioni meteo: Open-Meteo (open-meteo.com). Mappe e indicazioni si aprono nella tua app di mappe. Il 112 è il numero unico europeo di emergenza.",
  },
});
export const menuCopy = (lang: string) => MENU_COPY[guideLanguage(lang)];

/** Exactly five rows in this order; install hidden when the guide already runs standalone. */
export function menuRowIds(installAvailable: boolean) {
  return ["language", "profile", ...(installAvailable ? ["install"] : []), "help", "about"] as const;
}

