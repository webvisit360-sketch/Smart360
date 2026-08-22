/**
 * Guest-side i18n. Slovene is the source language and lives in the content
 * itself; everything here is overlay: UI strings (tenant.ui), plural forms
 * (tenant.plurals) and language resolution/persistence.
 *
 * Missing translation → silent Slovene fallback, never a raw key.
 */

export type UiLanguage = "sl" | "en" | "de" | "it";
export type UiVariables = Record<string, string | number>;
export type UiTranslator = (key: string, variables?: UiVariables) => string;

/**
 * Living Guide UI chrome. Slovene values are copied from the binding
 * prototip-2030.html; the other three languages are built-in fallbacks until
 * a tenant-specific translation with the same key is available.
 */
export const LIVING_GUIDE_UI = {
  "UI.lg.guide": {
    sl: "Vaš vodnik",
    en: "Your guide",
    de: "Ihr Reiseführer",
    it: "La vostra guida",
  },
  "UI.lg.openGuide": {
    sl: "Odpri vodnik",
    en: "Open guide",
    de: "Reiseführer öffnen",
    it: "Apri la guida",
  },
  "UI.lg.tour.view": {
    sl: "360° ogled",
    en: "360° tour",
    de: "360°-Rundgang",
    it: "Tour a 360°",
  },
  "UI.lg.tour.hint": {
    sl: "Povlecite za pogled naokoli",
    en: "Drag to look around",
    de: "Ziehen, um sich umzusehen",
    it: "Trascina per guardarti intorno",
  },
  "UI.lg.nav.home": {
    sl: "Domov",
    en: "Home",
    de: "Start",
    it: "Home",
  },
  "UI.lg.nav.stay": {
    sl: "Nastanitev",
    en: "Accommodation",
    de: "Unterkunft",
    it: "Alloggio",
  },
  "UI.lg.nav.offer": {
    sl: "Ponudba",
    en: "Offers",
    de: "Angebot",
    it: "Offerta",
  },
  "UI.lg.nav.area": {
    sl: "Okolica",
    en: "Surroundings",
    de: "Umgebung",
    it: "Dintorni",
  },
  "UI.lg.nav.program": {
    sl: "Program",
    en: "Programme",
    de: "Programm",
    it: "Programma",
  },
  "UI.lg.nav.messages": {
    sl: "Sporočila",
    en: "Messages",
    de: "Nachrichten",
    it: "Messaggi",
  },
  "UI.lg.msg.closed": {
    sl: "Ta pogovor je zaprt.",
    en: "This conversation is closed.",
    de: "Diese Unterhaltung ist geschlossen.",
    it: "Questa conversazione è chiusa.",
  },
  "UI.lg.msg.empty": {
    sl: "Pošljite vprašanje gostitelju. Odgovor se bo prikazal tukaj.",
    en: "Send your host a question. Their reply will appear here.",
    de: "Senden Sie Ihrem Gastgeber eine Frage. Die Antwort erscheint hier.",
    it: "Invia una domanda al tuo host. La risposta apparirà qui.",
  },
  "UI.lg.msg.placeholder": {
    sl: "Napišite sporočilo…",
    en: "Write a message…",
    de: "Nachricht schreiben…",
    it: "Scrivi un messaggio…",
  },
  "UI.lg.msg.send": {
    sl: "Pošlji sporočilo",
    en: "Send message",
    de: "Nachricht senden",
    it: "Invia messaggio",
  },
  "UI.lg.msg.you": {
    sl: "Vi",
    en: "You",
    de: "Sie",
    it: "Tu",
  },
  "UI.lg.msg.sendError": {
    sl: "Sporočila ni bilo mogoče poslati. Poskusite znova.",
    en: "The message could not be sent. Please try again.",
    de: "Die Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
    it: "Impossibile inviare il messaggio. Riprova.",
  },
  "UI.lg.msg.rateLimit": {
    sl: "Poslali ste preveč sporočil naenkrat. Počakajte minuto in poskusite znova.",
    en: "You sent too many messages at once. Wait a minute and try again.",
    de: "Sie haben zu viele Nachrichten auf einmal gesendet. Warten Sie eine Minute und versuchen Sie es erneut.",
    it: "Hai inviato troppi messaggi insieme. Attendi un minuto e riprova.",
  },
  "UI.lg.msg.accessRequired": {
    sl: "Za pošiljanje sporočil vpišite ime ter parcelo, sobo ali apartma. Če je nastanitev zaščitena, vpišite tudi geslo.",
    en: "To send messages, enter your name and pitch, room or apartment. If the property is protected, also enter the password.",
    de: "Geben Sie zum Senden von Nachrichten Ihren Namen und Ihren Stellplatz, Ihr Zimmer oder Apartment ein. Wenn die Unterkunft geschützt ist, geben Sie auch das Passwort ein.",
    it: "Per inviare messaggi, inserisci il nome e la piazzola, la camera o l'appartamento. Se la struttura è protetta, inserisci anche la password.",
  },
  "UI.lg.msg.invalidPassword": {
    sl: "Napačno geslo. Prijavite se znova.",
    en: "Wrong password. Sign in again.",
    de: "Falsches Passwort. Melden Sie sich erneut an.",
    it: "Password errata. Accedi di nuovo.",
  },
  "UI.lg.msg.signIn": {
    sl: "Prijava za sporočila",
    en: "Sign in for messages",
    de: "Für Nachrichten anmelden",
    it: "Accedi per i messaggi",
  },
  "UI.lg.nav.messagesUnavailable": {
    sl: "na voljo v naslednjem koraku",
    en: "available in the next step",
    de: "im nächsten Schritt verfügbar",
    it: "disponibile nel prossimo passaggio",
  },
  "UI.lg.home.today": {
    sl: "Danes",
    en: "Today",
    de: "Heute",
    it: "Oggi",
  },
  "UI.lg.home.allProgram": {
    sl: "ves program",
    en: "full programme",
    de: "ganzes Programm",
    it: "programma completo",
  },
  "UI.lg.home.forYou": {
    sl: "Za vas",
    en: "For you",
    de: "Für Sie",
    it: "Per voi",
  },
  "UI.lg.home.allOffers": {
    sl: "vsa ponudba",
    en: "all offers",
    de: "alle Angebote",
    it: "tutte le offerte",
  },
  "UI.lg.exploreTitle": {
    sl: "Odkrij okolico",
    en: "Explore the area",
    de: "Umgebung entdecken",
    it: "Scopri i dintorni",
  },
  "UI.lg.nearby": {
    sl: "Najbližje",
    en: "Nearest",
    de: "In der Nähe",
    it: "Più vicini",
  },
  "UI.lg.search.title": {
    sl: "Iskanje",
    en: "Search",
    de: "Suche",
    it: "Cerca",
  },
  "UI.lg.search.placeholder": {
    sl: "Poiščite vsebino",
    en: "Search the guide",
    de: "Im Reiseführer suchen",
    it: "Cerca nella guida",
  },
  "UI.lg.search.empty": {
    sl: "Ni zadetkov.",
    en: "No results.",
    de: "Keine Ergebnisse.",
    it: "Nessun risultato.",
  },
  "UI.lg.nav.primary": {
    sl: "Glavna navigacija",
    en: "Main navigation",
    de: "Hauptnavigation",
    it: "Navigazione principale",
  },
  "UI.lg.language": {
    sl: "Jezik: {lang}",
    en: "Language: {lang}",
    de: "Sprache: {lang}",
    it: "Lingua: {lang}",
  },
  "UI.lg.languagePicker.title": {
    sl: "Izberite jezik",
    en: "Choose a language",
    de: "Sprache auswählen",
    it: "Scegli la lingua",
  },
  "UI.lg.welcome.title": {
    sl: "Dobrodošli",
    en: "Welcome",
    de: "Willkommen",
    it: "Benvenuti",
  },
  "UI.lg.welcome.description": {
    sl: "Za naročila in sporočila potrebujemo vaše podatke in geslo, ki vam ga je povedal gostitelj.",
    en: "For orders and messages, we need your details and the password your host gave you.",
    de: "Für Bestellungen und Nachrichten benötigen wir Ihre Daten und das Passwort, das Sie von Ihrem Gastgeber erhalten haben.",
    it: "Per ordini e messaggi abbiamo bisogno dei tuoi dati e della password che ti ha fornito l’host.",
  },
  "UI.lg.welcome.unit": {
    sl: "Parcela / soba / apartma · obvezno",
    en: "Pitch / room / apartment · required",
    de: "Stellplatz / Zimmer / Apartment · erforderlich",
    it: "Piazzola / camera / appartamento · obbligatorio",
  },
  "UI.lg.welcome.unitPlaceholder": {
    sl: "npr. B-14",
    en: "e.g. B-14",
    de: "z. B. B-14",
    it: "ad es. B-14",
  },
  "UI.lg.welcome.name": {
    sl: "Ime in priimek · obvezno",
    en: "Full name · required",
    de: "Vor- und Nachname · erforderlich",
    it: "Nome e cognome · obbligatorio",
  },
  "UI.lg.welcome.namePlaceholder": {
    sl: "npr. Ana Novak",
    en: "e.g. Ana Novak",
    de: "z. B. Ana Novak",
    it: "ad es. Ana Novak",
  },
  "UI.lg.welcome.phone": {
    sl: "Telefon · obvezno",
    en: "Phone · required",
    de: "Telefon · erforderlich",
    it: "Telefono · obbligatorio",
  },
  "UI.lg.welcome.phonePlaceholder": {
    sl: "npr. +386 41 998 660",
    en: "+1 234 567 8900",
    de: "+49 151 0000000",
    it: "+39 300 000 0000",
  },
  "UI.lg.welcome.password": {
    sl: "Geslo · obvezno",
    en: "Password · required",
    de: "Passwort · erforderlich",
    it: "Password · obbligatorio",
  },
  "UI.lg.welcome.passwordPlaceholder": {
    sl: "geslo, ki vam ga je povedal gostitelj",
    en: "the password your host gave you",
    de: "das Passwort, das Sie von Ihrem Gastgeber erhalten haben",
    it: "la password che ti ha fornito l’host",
  },
  "UI.lg.welcome.save": {
    sl: "Shrani",
    en: "Save",
    de: "Speichern",
    it: "Salva",
  },
  "UI.lg.welcome.later": {
    sl: "Pozneje — najprej si samo ogledam",
    en: "Later — I just want to look around first",
    de: "Später — ich möchte mich zuerst nur umsehen",
    it: "Più tardi — per ora voglio solo dare un’occhiata",
  },
  "UI.lg.greeting.generic": {
    sl: "Dobrodošli",
    en: "Welcome",
    de: "Willkommen",
    it: "Benvenuti",
  },
  "UI.lg.greeting.named": {
    sl: "{name}, dobrodošli",
    en: "Welcome, {name}",
    de: "Willkommen, {name}",
    it: "Benvenuto/a, {name}",
  },
  "UI.lg.greeting.ordersTo": {
    sl: "naročila gredo na:",
    en: "orders go to:",
    de: "Bestellungen gehen an:",
    it: "gli ordini vanno a:",
  },
  "UI.lg.greeting.change": {
    sl: "spremeni",
    en: "change",
    de: "ändern",
    it: "modifica",
  },
  "UI.lg.action.call": {
    sl: "Pokliči",
    en: "Call",
    de: "Anrufen",
    it: "Chiama",
  },
  "UI.lg.action.directions": {
    sl: "Kje je",
    en: "Where is it?",
    de: "Wo ist es?",
    it: "Dov’è?",
  },
  "UI.lg.action.website": {
    sl: "Spletna stran",
    en: "Website",
    de: "Webseite",
    it: "Sito web",
  },
  "UI.lg.action.back": {
    sl: "Nazaj",
    en: "Back",
    de: "Zurück",
    it: "Indietro",
  },
  "UI.lg.action.maps": {
    sl: "Google Maps",
    en: "Google Maps",
    de: "Google Maps",
    it: "Google Maps",
  },
  "UI.lg.action.copy": {
    sl: "Kopiraj",
    en: "Copy",
    de: "Kopieren",
    it: "Copia",
  },
  "UI.lg.action.report": {
    sl: "Prijavi napako",
    en: "Report a problem",
    de: "Problem melden",
    it: "Segnala un problema",
  },
  "UI.lg.action.route": {
    sl: "Vodenje po trasi",
    en: "Route guidance",
    de: "Routenführung",
    it: "Guida sul percorso",
  },
  "UI.lg.action.gpx": {
    sl: "Prenesi GPX",
    en: "Download GPX",
    de: "GPX herunterladen",
    it: "Scarica GPX",
  },
  "UI.lg.hours.alwaysValue": {
    sl: "24/7",
    en: "24/7",
    de: "24/7",
    it: "24/7",
  },
  "UI.lg.hours.alwaysLabel": {
    sl: "odprto",
    en: "open",
    de: "geöffnet",
    it: "aperto",
  },
  "UI.lg.hours.openUntil": {
    sl: "odprto do",
    en: "open until",
    de: "geöffnet bis",
    it: "aperto fino alle",
  },
  "UI.lg.hours.title": {
    sl: "Odpiralni čas",
    en: "Opening hours",
    de: "Öffnungszeiten",
    it: "Orari di apertura",
  },
  "UI.lg.hours.closed": {
    sl: "zaprto",
    en: "closed",
    de: "geschlossen",
    it: "chiuso",
  },
  "UI.lg.hours.opensAt": {
    sl: "odpre se ob",
    en: "opens at",
    de: "öffnet um",
    it: "apre alle",
  },
  "UI.lg.fromSignIn": {
    sl: "iz prijave",
    en: "from sign-in",
    de: "aus der Anmeldung",
    it: "dalla registrazione",
  },
  "UI.lg.wifi.network": {
    sl: "Ime omrežja",
    en: "Network name",
    de: "Netzwerkname",
    it: "Nome della rete",
  },
  "UI.lg.wifi.password": {
    sl: "Geslo",
    en: "Password",
    de: "Passwort",
    it: "Password",
  },
  "UI.lg.wifi.scan": {
    sl: "Skenirajte s kamero",
    en: "Scan with your camera",
    de: "Mit der Kamera scannen",
    it: "Scansiona con la fotocamera",
  },
  "UI.lg.notices.title": {
    sl: "Obvestila",
    en: "Notices",
    de: "Mitteilungen",
    it: "Avvisi",
  },
  "UI.lg.notices.empty": {
    sl: "Ni novih obvestil.",
    en: "There are no new notices.",
    de: "Es gibt keine neuen Mitteilungen.",
    it: "Non ci sono nuovi avvisi.",
  },
  "UI.lg.notices.today": {
    sl: "Danes",
    en: "Today",
    de: "Heute",
    it: "Oggi",
  },
  "UI.lg.notices.yesterday": {
    sl: "Včeraj",
    en: "Yesterday",
    de: "Gestern",
    it: "Ieri",
  },
  "UI.lg.notices.new": {
    sl: "novo",
    en: "new",
    de: "neu",
    it: "nuovo",
  },
  "UI.lg.helpEmergency": {
    sl: "Pomoč in nujni primeri",
    en: "Help and emergencies",
    de: "Hilfe und Notfälle",
    it: "Aiuto ed emergenze",
  },
  "UI.lg.order.title": {
    sl: "Naročilo",
    en: "Order",
    de: "Bestellung",
    it: "Ordine",
  },
  "UI.lg.order.soldOut": {
    sl: "Razprodano",
    en: "Sold out",
    de: "Ausverkauft",
    it: "Esaurito",
  },
  "UI.lg.order.qty": {
    sl: "Količina",
    en: "Quantity",
    de: "Menge",
    it: "Quantità",
  },
  "UI.lg.order.unit": {
    sl: "Soba / parcela (obvezno)",
    en: "Room / pitch (required)",
    de: "Zimmer / Stellplatz (erforderlich)",
    it: "Camera / piazzola (obbligatorio)",
  },
  "UI.lg.order.name": {
    sl: "Ime in priimek",
    en: "Full name",
    de: "Vor- und Nachname",
    it: "Nome e cognome",
  },
  "UI.lg.order.phone": {
    sl: "Telefon (obvezno)",
    en: "Phone (required)",
    de: "Telefon (erforderlich)",
    it: "Telefono (obbligatorio)",
  },
  "UI.lg.order.password": {
    sl: "Geslo",
    en: "Password",
    de: "Passwort",
    it: "Password",
  },
  "UI.lg.order.note": {
    sl: "Opomba (neobvezno)",
    en: "Note (optional)",
    de: "Notiz (optional)",
    it: "Nota (opzionale)",
  },
  "UI.lg.order.submit": {
    sl: "Pošlji naročilo",
    en: "Send order",
    de: "Bestellung senden",
    it: "Invia ordine",
  },
  "UI.lg.order.success": {
    sl: "Naročilo poslano",
    en: "Order sent",
    de: "Bestellung gesendet",
    it: "Ordine inviato",
  },
  "UI.lg.order.successDesc": {
    sl: "Gostitelj bo naročilo potrdil v najkrajšem možnem času. Sledite mu pod 'Moja naročila'.",
    en: "The host will confirm the order as soon as possible. Track it under 'My orders'.",
    de: "Der Gastgeber wird die Bestellung so schnell wie möglich bestätigen. Verfolgen Sie sie unter 'Meine Bestellungen'.",
    it: "L'ospite confermerà l'ordine il prima possibile. Seguilo in 'I miei ordini'.",
  },
  "UI.lg.order.thankYou": {
    sl: "Hvala za vaše naročilo.",
    en: "Thank you for your order.",
    de: "Vielen Dank für Ihre Bestellung.",
    it: "Grazie per il tuo ordine.",
  },
  "UI.lg.order.successNext": {
    sl: "Gostitelj bo naročilo potrdil. Prevzem pri gostitelju.",
    en: "The host will confirm the order. Pickup at the host.",
    de: "Der Gastgeber bestätigt die Bestellung. Abholung beim Gastgeber.",
    it: "L'host confermerà l'ordine. Ritiro presso l'host.",
  },
  "UI.lg.order.backToGuide": {
    sl: "Nazaj v vodnik",
    en: "Back to the guide",
    de: "Zurück zum Reiseführer",
    it: "Torna alla guida",
  },
  "UI.lg.order.myOrders": {
    sl: "Moja naročila",
    en: "My orders",
    de: "Meine Bestellungen",
    it: "I miei ordini",
  },
  "UI.lg.order.entryOpen": {
    sl: "{count} v obdelavi",
    en: "{count} open",
    de: "{count} offen",
    it: "{count} in elaborazione",
  },
  "UI.lg.order.entryClosed": {
    sl: "{count} zaključenih",
    en: "{count} completed",
    de: "{count} abgeschlossen",
    it: "{count} completati",
  },
  "UI.lg.order.status.novo": {
    sl: "V obdelavi",
    en: "Processing",
    de: "In Bearbeitung",
    it: "In elaborazione",
  },
  "UI.lg.order.status.potrjeno": {
    sl: "Potrjeno",
    en: "Confirmed",
    de: "Bestätigt",
    it: "Confermato",
  },
  "UI.lg.order.status.prevzeto": {
    sl: "Prevzeto",
    en: "Completed",
    de: "Abgeschlossen",
    it: "Completato",
  },
  "UI.lg.order.status.zavrnjeno": {
    sl: "Zavrnjeno",
    en: "Declined",
    de: "Abgelehnt",
    it: "Rifiutato",
  },
  "UI.lg.order.statusNote": {
    sl: "Opomba gostitelja",
    en: "Host note",
    de: "Hinweis des Gastgebers",
    it: "Nota dell'host",
  },
  "UI.lg.order.empty": {
    sl: "Nimate še nobenih naročil.",
    en: "You have no orders yet.",
    de: "Sie haben noch keine Bestellungen.",
    it: "Non hai ancora ordini.",
  },
  "UI.lg.order.pickupDefault": {
    sl: "Prevzem pri gostitelju.",
    en: "Pickup at the host.",
    de: "Abholung beim Gastgeber.",
    it: "Ritiro presso l'ospite.",
  },
  "UI.lg.order.pickupExplicit": {
    sl: "Prevzem",
    en: "Pickup",
    de: "Abholung",
    it: "Ritiro",
  },
  "UI.lg.order.error": {
    sl: "Naročilo ni bilo poslano. Preverite podatke in poskusite znova.",
    en: "The order was not sent. Check your details and try again.",
    de: "Die Bestellung wurde nicht gesendet. Prüfen Sie Ihre Angaben und versuchen Sie es erneut.",
    it: "L'ordine non è stato inviato. Controlla i dati e riprova.",
  },
  "UI.lg.order.retry": {
    sl: "Poskusi znova",
    en: "Retry",
    de: "Erneut versuchen",
    it: "Riprova",
  },
  "UI.lg.order.qtyInc": {
    sl: "Povečaj količino",
    en: "Increase quantity",
    de: "Menge erhöhen",
    it: "Aumenta quantità",
  },
  "UI.lg.order.qtyDec": {
    sl: "Zmanjšaj količino",
    en: "Decrease quantity",
    de: "Menge verringern",
    it: "Riduci quantità",
  },
  "UI.lg.order.validation.required": {
    sl: "To polje je obvezno.",
    en: "This field is required.",
    de: "Dieses Feld ist erforderlich.",
    it: "Questo campo è obbligatorio.",
  },
  "UI.lg.order.validation.phoneDigits": {
    sl: "Telefonska številka mora vsebovati vsaj 6 števk.",
    en: "The phone number must contain at least 6 digits.",
    de: "Die Telefonnummer muss mindestens 6 Ziffern enthalten.",
    it: "Il numero di telefono deve contenere almeno 6 cifre.",
  },
  "UI.lg.order.validation.password": {
    sl: "Napačno geslo",
    en: "Wrong password",
    de: "Falsches Passwort",
    it: "Password errata",
  },
  "UI.lg.order.placeholder.phone": {
    sl: "+386 41 000 000",
    en: "+1 234 567 8900",
    de: "+49 151 0000000",
    it: "+39 300 000 0000",
  },
  "UI.lg.order.placeholder.note": {
    sl: "Posebne želje...",
    en: "Special requests...",
    de: "Sonderwünsche...",
    it: "Richieste speciali...",
  },
  "UI.lg.order.ref": {
    sl: "Ref:",
    en: "Ref:",
    de: "Ref:",
    it: "Rif:",
  },
  "UI.lg.order.loading": {
    sl: "Nalagam...",
    en: "Loading...",
    de: "Wird geladen...",
    it: "Caricamento in corso...",
  },
  "UI.lg.order.failedQuery": {
    sl: "Napaka pri nalaganju naročil.",
    en: "Failed to load orders.",
    de: "Bestellungen konnten nicht geladen werden.",
    it: "Impossibile caricare gli ordini.",
  },
  "UI.lg.order.price": {
    sl: "Cena",
    en: "Price",
    de: "Preis",
    it: "Prezzo",
  },
  "UI.lg.order.created": {
    sl: "Oddano",
    en: "Placed",
    de: "Aufgegeben",
    it: "Inviato",
  },
} as const satisfies Record<string, Record<UiLanguage, string>>;

function livingGuideUiFor(language: UiLanguage): Record<string, string> {
  return Object.fromEntries(
    Object.entries(LIVING_GUIDE_UI).map(([key, values]) => [
      key,
      values[language],
    ]),
  );
}

const LIVING_GUIDE_UI_BY_LANGUAGE: Record<
  UiLanguage,
  Record<string, string>
> = {
  sl: livingGuideUiFor("sl"),
  en: livingGuideUiFor("en"),
  de: livingGuideUiFor("de"),
  it: livingGuideUiFor("it"),
};

const BINDING_GUEST_SIGN_IN_KEYS = new Set([
  "UI.lg.welcome.title",
  "UI.lg.welcome.description",
  "UI.lg.welcome.unit",
  "UI.lg.welcome.unitPlaceholder",
  "UI.lg.welcome.name",
  "UI.lg.welcome.namePlaceholder",
  "UI.lg.welcome.phone",
  "UI.lg.welcome.phonePlaceholder",
  "UI.lg.welcome.password",
  "UI.lg.welcome.passwordPlaceholder",
  "UI.lg.welcome.save",
  "UI.lg.welcome.later",
]);

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
  "UI.contact.intro":
    "Vprašanje, rezervacija ali priporočilo — odgovorimo v nekaj minutah.",
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
  ...LIVING_GUIDE_UI_BY_LANGUAGE.sl,
};

/** Slovene difficulty values as stored in content → UI keys. */
export const DIFFICULTY_KEYS: Record<string, string> = {
  Lahka: "UI.difficulty.easy",
  Zmerna: "UI.difficulty.mod",
  Zahtevna: "UI.difficulty.hard",
};

/** Built-in Slovene plural forms (4 CLDR forms: one, two, few, other). */
export const SL_PLURALS: Record<string, Record<string, string>> = {
  reviews: {
    one: "{n} ocena",
    two: "{n} oceni",
    few: "{n} ocene",
    other: "{n} ocen",
  },
  info: {
    one: "{n} informacija",
    two: "{n} informaciji",
    few: "{n} informacije",
    other: "{n} informacij",
  },
  experiences: {
    one: "{n} doživetje",
    two: "{n} doživetji",
    few: "{n} doživetja",
    other: "{n} doživetij",
  },
  places: {
    one: "{n} kraj",
    two: "{n} kraja",
    few: "{n} kraji",
    other: "{n} krajev",
  },
  routes: {
    one: "{n} pot",
    two: "{n} poti",
    few: "{n} poti",
    other: "{n} poti",
  },
  products: {
    one: "{n} izdelek",
    two: "{n} izdelka",
    few: "{n} izdelki",
    other: "{n} izdelkov",
  },
  rules: {
    one: "{n} pravilo",
    two: "{n} pravili",
    few: "{n} pravila",
    other: "{n} pravil",
  },
  events: {
    one: "{n} dogodek",
    two: "{n} dogodka",
    few: "{n} dogodki",
    other: "{n} dogodkov",
  },
  entries: {
    one: "{n} vnos",
    two: "{n} vnosa",
    few: "{n} vnosi",
    other: "{n} vnosov",
  },
  options: {
    one: "{n} možnost",
    two: "{n} možnosti",
    few: "{n} možnosti",
    other: "{n} možnosti",
  },
  apartments: {
    one: "{n} apartma",
    two: "{n} apartmaja",
    few: "{n} apartmaji",
    other: "{n} apartmajev",
  },
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

/** UI string lookup: tenant translation → language built-in → Slovene → key. */
export function makeT(
  tenant: TenantLike | null | undefined,
  lang: string,
): UiTranslator {
  const language: UiLanguage =
    lang === "en" || lang === "de" || lang === "it" ? lang : "sl";
  const overlay = lang !== "sl" ? (tenant?.ui ?? {}) : {};
  return (key: string, variables?: UiVariables): string => {
    const languageBuiltIn = LIVING_GUIDE_UI_BY_LANGUAGE[language][key];
    let value =
      (BINDING_GUEST_SIGN_IN_KEYS.has(key)
        ? languageBuiltIn
        : overlay[key] ?? languageBuiltIn) ??
      SL_UI[key] ??
      key;
    if (variables) {
      for (const [name, replacement] of Object.entries(variables)) {
        value = value.replaceAll(`{${name}}`, String(replacement));
      }
    }
    return value;
  };
}

/**
 * Pluralised phrase via Intl.PluralRules — never an if/else chain.
 * Slovene has 4 forms; the language's own rules pick the right one.
 */
export function plural(
  tenant: TenantLike | null | undefined,
  lang: string,
  key: string,
  n: number,
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
  enabled: string[] | null | undefined,
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
  } catch {
    /* private mode */
  }
  const nav = (navigator.language || "").slice(0, 2).toLowerCase();
  if (ok(nav)) return nav;
  return langs.includes("sl") ? "sl" : (langs[0] ?? "sl");
}

/** Once the tenant is known, an un-enabled language silently becomes Slovene. */
export function clampLang(
  lang: string,
  enabled: string[] | null | undefined,
): string {
  if (!enabled?.length) return lang;
  return enabled.includes(lang) ? lang : "sl";
}

/** Remember the guest's explicit choice for this accommodation. */
export function rememberLang(slug: string, lang: string): void {
  try {
    localStorage.setItem(LS_PREFIX + slug, lang);
  } catch {
    /* private mode */
  }
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
  enabled: string[] | null | undefined,
): void {
  document.documentElement.lang = lang;
  document
    .querySelectorAll("link[data-s360-hreflang]")
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
