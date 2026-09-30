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
  "UI.lg.home.more": {
    sl: "več",
    en: "more",
    de: "mehr",
    it: "altro",
  },
  "UI.lg.home.map": {
    sl: "Zemljevid",
    en: "Map",
    de: "Karte",
    it: "Mappa",
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
  "UI.lg.distanceGroup.near": {
    sl: "V bližini",
    en: "Nearby",
    de: "In der Nähe",
    it: "Nelle vicinanze",
  },
  "UI.lg.distanceGroup.excursion": {
    sl: "Izleti",
    en: "Day trips",
    de: "Ausflüge",
    it: "Gite",
  },
  "UI.lg.distanceHint.near": {
    sl: "do 20 min",
    en: "up to 20 min",
    de: "bis 20 Min.",
    it: "fino a 20 min",
  },
  "UI.lg.distanceHint.excursion": {
    sl: "nad 20 min",
    en: "over 20 min",
    de: "über 20 Min.",
    it: "oltre 20 min",
  },
  "UI.lg.categoryFilter.all": {
    sl: "Vse",
    en: "All",
    de: "Alle",
    it: "Tutte",
  },
  "UI.lg.exploreGroup.experiences": {
    sl: "Doživetja",
    en: "Experiences",
    de: "Erlebnisse",
    it: "Esperienze",
  },
  "UI.lg.exploreGroup.foodDrink": {
    sl: "Hrana in pijača",
    en: "Food and drink",
    de: "Essen und Trinken",
    it: "Cibo e bevande",
  },
  "UI.lg.exploreGroup.natureTrails": {
    sl: "Aktivnosti",
    en: "Activities",
    de: "Aktivitäten",
    it: "Attività",
  },
  "UI.lg.exploreGroup.sights": {
    sl: "Znamenitosti",
    en: "Sights",
    de: "Sehenswürdigkeiten",
    it: "Attrazioni",
  },
  "UI.lg.exploreGroup.services": {
    sl: "Storitve",
    en: "Services",
    de: "Dienstleistungen",
    it: "Servizi",
  },
  "UI.lg.offerGroup.najem": {
    sl: "Najem",
    en: "Rental",
    de: "Verleih",
    it: "Noleggio",
  },
  "UI.lg.offerGroup.izletiPrevozi": {
    sl: "Izleti in prevozi",
    en: "Trips and transfers",
    de: "Ausflüge und Transfers",
    it: "Gite e trasferimenti",
  },
  "UI.lg.offerGroup.domaciIzdelki": {
    sl: "Domači izdelki",
    en: "Local products",
    de: "Hausgemachte Produkte",
    it: "Prodotti locali",
  },
  "UI.lg.offerGroup.priHisi": {
    sl: "Pri hiši",
    en: "On site",
    de: "Vor Ort",
    it: "In loco",
  },
  "UI.lg.stayGroup.vaseBivanje": {
    sl: "Vaše bivanje",
    en: "Your stay",
    de: "Ihr Aufenthalt",
    it: "Il vostro soggiorno",
  },
  "UI.lg.stayGroup.prihodDostop": {
    sl: "Prihod in dostop",
    en: "Arrival and access",
    de: "Anreise und Zugang",
    it: "Arrivo e accesso",
  },
  "UI.lg.stayGroup.prakticno": {
    sl: "Praktično",
    en: "Practical",
    de: "Praktisches",
    it: "Info pratiche",
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
  "UI.lg.gpx.title": {
    sl: "GPX sled",
    en: "GPX track",
    de: "GPX-Track",
    it: "Traccia GPX",
  },
  "UI.lg.gpx.cycling": {
    sl: "Kolesarjenje",
    en: "Cycling",
    de: "Radfahren",
    it: "Ciclismo",
  },
  "UI.lg.gpx.hiking": {
    sl: "Pohodništvo",
    en: "Hiking",
    de: "Wandern",
    it: "Escursionismo",
  },
  "UI.lg.gpx.running": {
    sl: "Tek",
    en: "Running",
    de: "Laufen",
    it: "Corsa",
  },
  "UI.lg.gpx.length": {
    sl: "Dolžina",
    en: "Length",
    de: "Länge",
    it: "Lunghezza",
  },
  "UI.lg.gpx.ascent": {
    sl: "Vzpon",
    en: "Ascent",
    de: "Aufstieg",
    it: "Salita",
  },
  "UI.lg.gpx.descent": {
    sl: "Spust",
    en: "Descent",
    de: "Abstieg",
    it: "Discesa",
  },
  "UI.lg.gpx.minElevation": {
    sl: "Najnižja višina",
    en: "Min. elevation",
    de: "Min. Höhe",
    it: "Quota min.",
  },
  "UI.lg.gpx.maxElevation": {
    sl: "Najvišja višina",
    en: "Max. elevation",
    de: "Max. Höhe",
    it: "Quota max.",
  },
  "UI.lg.gpx.estimatedTime": {
    sl: "Čas (ocena)",
    en: "Time (estimate)",
    de: "Zeit (Schätzung)",
    it: "Tempo (stima)",
  },
  "UI.lg.gpx.unavailable": {
    sl: "Ni podatka",
    en: "Unavailable",
    de: "Nicht verfügbar",
    it: "Non disponibile",
  },
  "UI.lg.gpx.profile": {
    sl: "Višinski profil",
    en: "Elevation profile",
    de: "Höhenprofil",
    it: "Profilo altimetrico",
  },
  "UI.lg.gpx.remaining": {
    sl: "še {distance} km",
    en: "{distance} km remaining",
    de: "noch {distance} km",
    it: "ancora {distance} km",
  },
  "UI.lg.gpx.offRoute": {
    sl: "Izven poti",
    en: "Off route",
    de: "Abseits der Route",
    it: "Fuori percorso",
  },
  "UI.lg.gpx.axisDistance": {
    sl: "Razdalja (km)",
    en: "Distance (km)",
    de: "Distanz (km)",
    it: "Distanza (km)",
  },
  "UI.lg.gpx.axisElevation": {
    sl: "Višina (m)",
    en: "Elevation (m)",
    de: "Höhe (m)",
    it: "Quota (m)",
  },
  "UI.lg.gpx.noElevation": {
    sl: "Višinski podatki za to sled niso na voljo.",
    en: "Elevation data is not available for this track.",
    de: "Für diesen Track sind keine Höhendaten verfügbar.",
    it: "I dati altimetrici non sono disponibili per questa traccia.",
  },
  "UI.lg.gpx.partialElevation": {
    sl: "Za nekatere dele sledi višina manjka (prekinitve v profilu).",
    en: "Elevation is missing for parts of the track (gaps in the profile).",
    de: "Für Teile des Tracks fehlt die Höhe (Lücken im Profil).",
    it: "Per alcune parti della traccia manca la quota (interruzioni nel profilo).",
  },
  "UI.lg.gpx.mapLabel": {
    sl: "Zemljevid sledi",
    en: "Track map",
    de: "Track-Karte",
    it: "Mappa della traccia",
  },
  "UI.lg.gpx.mapError": {
    sl: "Zemljevida ni bilo mogoče naložiti.",
    en: "The map could not be loaded.",
    de: "Die Karte konnte nicht geladen werden.",
    it: "Impossibile caricare la mappa.",
  },
  "UI.lg.gpx.start": {
    sl: "Začetek",
    en: "Start",
    de: "Start",
    it: "Partenza",
  },
  "UI.lg.gpx.end": {
    sl: "Cilj",
    en: "Finish",
    de: "Ziel",
    it: "Arrivo",
  },
  "UI.lg.gpx.you": {
    sl: "Vaš položaj",
    en: "Your location",
    de: "Ihr Standort",
    it: "La tua posizione",
  },
  "UI.lg.gpx.northUp": {
    sl: "Sever zgoraj",
    en: "North up",
    de: "Norden oben",
    it: "Nord in alto",
  },
  "UI.lg.gpx.courseUp": {
    sl: "Smer vožnje",
    en: "Direction of travel",
    de: "Fahrtrichtung",
    it: "Direzione di marcia",
  },
  "UI.lg.gpx.showLocation": {
    sl: "Pokaži moj položaj",
    en: "Show my location",
    de: "Meinen Standort zeigen",
    it: "Mostra la mia posizione",
  },
  "UI.lg.gpx.hideLocation": {
    sl: "Skrij moj položaj",
    en: "Hide location",
    de: "Standort ausblenden",
    it: "Nascondi posizione",
  },
  "UI.lg.gpx.geo.denied": {
    sl: "Dostop do lokacije je zavrnjen. Omogočite ga v nastavitvah brskalnika.",
    en: "Location access was denied. Enable it in your browser settings.",
    de: "Standortzugriff verweigert. Aktivieren Sie ihn in den Browser-Einstellungen.",
    it: "Accesso alla posizione negato. Abilitalo nelle impostazioni del browser.",
  },
  "UI.lg.gpx.geo.unavailable": {
    sl: "Lokacije trenutno ni mogoče določiti.",
    en: "Your location is currently unavailable.",
    de: "Ihr Standort ist derzeit nicht verfügbar.",
    it: "La posizione non è al momento disponibile.",
  },
  "UI.lg.gpx.geo.timeout": {
    sl: "Določanje lokacije je trajalo predolgo. Poskusite znova.",
    en: "Finding your location took too long. Try again.",
    de: "Die Standortbestimmung dauerte zu lange. Bitte erneut versuchen.",
    it: "La localizzazione ha richiesto troppo tempo. Riprova.",
  },
  "UI.lg.gpx.geo.unsupported": {
    sl: "Ta naprava ne podpira določanja lokacije.",
    en: "This device does not support location.",
    de: "Dieses Gerät unterstützt keine Standortbestimmung.",
    it: "Questo dispositivo non supporta la localizzazione.",
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
  "UI.lg.price.byAgreement": {
    sl: "Po dogovoru",
    en: "By agreement",
    de: "Nach Vereinbarung",
    it: "Su accordo",
  },
  "UI.lg.order.created": {
    sl: "Oddano",
    en: "Placed",
    de: "Aufgegeben",
    it: "Inviato",
  },
  "UI.lg.siteMap": {
    sl: "Mapa / Tloris",
    en: "Map / Site Plan",
    de: "Karte / Lageplan",
    it: "Mappa / Piantina",
  },
  "UI.lg.siteMapDot": {
    sl: "Prikaži sliko {{index}}",
    en: "Show image {{index}}",
    de: "Bild {{index}} anzeigen",
    it: "Mostra immagine {{index}}",
  },
  "UI.lg.siteMapZoomIn": {
    sl: "Povečaj zemljevid",
    en: "Zoom in on the map",
    de: "Karte vergrößern",
    it: "Ingrandisci la mappa",
  },
  "UI.lg.siteMapZoomOut": {
    sl: "Pomanjšaj zemljevid",
    en: "Zoom out of the map",
    de: "Karte verkleinern",
    it: "Riduci la mappa",
  },
  "UI.lg.siteMapReset": {
    sl: "Ponastavi povečavo",
    en: "Reset map zoom",
    de: "Kartenzoom zurücksetzen",
    it: "Reimposta lo zoom della mappa",
  },
  "UI.lg.more": {
    sl: "Več",
    en: "More",
    de: "Mehr",
    it: "Altro",
  },
  "UI.lg.liveTour.start": {
    sl: "Začni turo",
    en: "Start tour",
    de: "Tour starten",
    it: "Inizia il tour",
  },
  "UI.lg.liveTour.pause": {
    sl: "Premor",
    en: "Pause",
    de: "Pause",
    it: "Pausa",
  },
  "UI.lg.liveTour.resume": {
    sl: "Nadaljuj",
    en: "Resume",
    de: "Fortsetzen",
    it: "Riprendi",
  },
  "UI.lg.liveTour.finish": {
    sl: "Zaključi turo",
    en: "Finish tour",
    de: "Tour beenden",
    it: "Termina il tour",
  },
  "UI.lg.liveTour.reset": {
    sl: "Zapri rezultat",
    en: "Close result",
    de: "Ergebnis schließen",
    it: "Chiudi risultato",
  },
  "UI.lg.liveTour.fullscreen": {
    sl: "Celozaslonski zemljevid",
    en: "Full-screen map",
    de: "Vollbildkarte",
    it: "Mappa a schermo intero",
  },
  "UI.lg.liveTour.exitFullscreen": {
    sl: "Nazaj na vnos",
    en: "Back to entry",
    de: "Zurück zum Eintrag",
    it: "Torna alla scheda",
  },
  "UI.lg.liveTour.net": {
    sl: "Neto čas",
    en: "Net time",
    de: "Nettozeit",
    it: "Tempo netto",
  },
  "UI.lg.liveTour.paused": {
    sl: "Premori",
    en: "Pauses",
    de: "Pausen",
    it: "Pause",
  },
  "UI.lg.liveTour.total": {
    sl: "Skupni čas",
    en: "Total time",
    de: "Gesamtzeit",
    it: "Tempo totale",
  },
  "UI.lg.liveTour.distance": {
    sl: "Prehojena pot",
    en: "Distance covered",
    de: "Zurückgelegte Strecke",
    it: "Distanza percorsa",
  },
  "UI.lg.liveTour.status.moving": {
    sl: "Tura teče",
    en: "Tour running",
    de: "Tour läuft",
    it: "Tour in corso",
  },
  "UI.lg.liveTour.status.autoPaused": {
    sl: "Samodejni premor — stojite",
    en: "Auto-paused — you are standing still",
    de: "Automatische Pause — Sie stehen",
    it: "Pausa automatica — sei fermo",
  },
  "UI.lg.liveTour.status.manualPaused": {
    sl: "Premor",
    en: "Paused",
    de: "Pausiert",
    it: "In pausa",
  },
  "UI.lg.liveTour.status.finished": {
    sl: "Tura zaključena",
    en: "Tour finished",
    de: "Tour beendet",
    it: "Tour terminato",
  },
  "UI.lg.liveTour.wake.requesting": {
    sl: "Zaslon ostaja buden …",
    en: "Keeping the screen awake …",
    de: "Bildschirm bleibt aktiv …",
    it: "Lo schermo resta acceso …",
  },
  "UI.lg.liveTour.wake.held": {
    sl: "Zaslon ostaja med turo buden.",
    en: "The screen stays awake during the tour.",
    de: "Der Bildschirm bleibt während der Tour aktiv.",
    it: "Lo schermo resta acceso durante il tour.",
  },
  "UI.lg.liveTour.wake.unavailableTitle": {
    sl: "Zaslon naj ostane prižgan",
    en: "Keep the screen on",
    de: "Bildschirm eingeschaltet lassen",
    it: "Tieni lo schermo acceso",
  },
  "UI.lg.liveTour.wake.ios": {
    sl: "Nastavitve → Zaslon in svetlost → Samodejno zaklepanje → Nikoli (po turi vrnite nazaj).",
    en: "Settings → Display & Brightness → Auto-Lock → Never (switch it back after the tour).",
    de: "Einstellungen → Anzeige & Helligkeit → Automatische Sperre → Nie (nach der Tour zurückstellen).",
    it: "Impostazioni → Schermo e luminosità → Blocco automatico → Mai (ripristinalo dopo il tour).",
  },
  "UI.lg.liveTour.wake.android": {
    sl: "Nastavitve → Zaslon → Časovna omejitev zaslona → izberite daljši čas.",
    en: "Settings → Display → Screen timeout → choose a longer time.",
    de: "Einstellungen → Display → Bildschirm-Timeout → längere Zeit wählen.",
    it: "Impostazioni → Display → Spegnimento schermo → scegli un tempo più lungo.",
  },
  "UI.lg.liveTour.wake.other": {
    sl: "V nastavitvah naprave podaljšajte čas do samodejnega izklopa zaslona in pustite to stran odprto.",
    en: "Extend the automatic screen-off time in your device settings and keep this page open.",
    de: "Verlängern Sie in den Geräteeinstellungen die Zeit bis zur automatischen Bildschirmabschaltung und lassen Sie diese Seite geöffnet.",
    it: "Nelle impostazioni del dispositivo aumenta il tempo di spegnimento automatico dello schermo e lascia aperta questa pagina.",
  },
  "UI.lg.liveTour.privacy": {
    sl: "Položaji, časi in rezultat ostanejo samo na tej napravi. Ničesar ne pošljemo na strežnik.",
    en: "Positions, times and the result stay on this device only. Nothing is sent to a server.",
    de: "Positionen, Zeiten und das Ergebnis bleiben nur auf diesem Gerät. Nichts wird an einen Server gesendet.",
    it: "Posizioni, tempi e risultato restano solo su questo dispositivo. Nulla viene inviato a un server.",
  },
  "UI.lg.calories.kcal": { sl: "Poraba", en: "Energy", de: "Energie", it: "Energia" },
  "UI.lg.calories.approx": { sl: "pribl.", en: "approx.", de: "ca.", it: "circa" },
  "UI.lg.calories.profile": { sl: "Moj profil · Profil", en: "My profile · Profile", de: "Mein Profil · Profil", it: "Il mio profilo · Profilo" },
  "UI.lg.calories.privacy": {
    sl: "Neobvezno. Profil in ocena ostaneta samo v tej napravi; nič se ne pošlje na strežnik ali v GPX. Brez teže ni ocene kcal. Ocena ni zdravstvena meritev.",
    en: "Optional. Profile and estimate stay only on this device; nothing is sent to a server or GPX. No weight means no kcal estimate. Not a medical measurement.",
    de: "Freiwillig. Profil und Schätzung bleiben nur auf diesem Gerät; nichts wird an Server oder GPX gesendet. Ohne Gewicht keine kcal-Schätzung. Keine medizinische Messung.",
    it: "Facoltativo. Profilo e stima restano su questo dispositivo; nulla viene inviato al server o nel GPX. Senza peso nessuna stima kcal. Non è una misurazione medica.",
  },
  "UI.lg.calories.nextTour": { sl: "Spremembe veljajo šele za naslednjo turo; trenutna ocena ostane nespremenjena.", en: "Changes apply to the next tour only; this tour's estimate stays unchanged.", de: "Änderungen gelten erst für die nächste Tour; diese Schätzung bleibt unverändert.", it: "Le modifiche valgono solo dal prossimo tour; questa stima non cambia." },
  "UI.lg.calories.storage": { sl: "Shramba ni na voljo. Profil velja le do zaprtja strani.", en: "Storage unavailable. Profile lasts only until this page closes.", de: "Speicher nicht verfügbar. Das Profil gilt nur bis zum Schließen der Seite.", it: "Archivio non disponibile. Il profilo resta solo fino alla chiusura della pagina." },
  "UI.lg.calories.age": { sl: "Starost (leta)", en: "Age (years)", de: "Alter (Jahre)", it: "Età (anni)" },
  "UI.lg.calories.sex": { sl: "Spol", en: "Sex", de: "Geschlecht", it: "Sesso" },
  "UI.lg.calories.weight": { sl: "Teža (kg)", en: "Weight (kg)", de: "Gewicht (kg)", it: "Peso (kg)" },
  "UI.lg.calories.female": { sl: "Ženska", en: "Female", de: "Weiblich", it: "Femmina" },
  "UI.lg.calories.male": { sl: "Moški", en: "Male", de: "Männlich", it: "Maschio" },
  "UI.lg.calories.bike": { sl: "Vrsta kolesa", en: "Bike type", de: "Fahrradtyp", it: "Tipo di bici" },
  "UI.lg.calories.road": { sl: "Cestno", en: "Road", de: "Rennrad", it: "Da corsa" },
  "UI.lg.calories.mtb": { sl: "Gorsko", en: "Mountain", de: "Mountainbike", it: "Mountain bike" },
  "UI.lg.calories.trekking-city": { sl: "Treking-mestno", en: "Trekking / city", de: "Trekking / Stadt", it: "Trekking / città" },
  "UI.lg.calories.electric": { sl: "Električno", en: "Electric", de: "E-Bike", it: "Elettrica" },
  "UI.lg.calories.assist": { sl: "Pomoč motorja", en: "Motor assist", de: "Motorunterstützung", it: "Assistenza motore" },
  "UI.lg.calories.low": { sl: "Nizka", en: "Low", de: "Niedrig", it: "Bassa" },
  "UI.lg.calories.medium": { sl: "Srednja", en: "Medium", de: "Mittel", it: "Media" },
  "UI.lg.calories.high": { sl: "Visoka", en: "High", de: "Hoch", it: "Alta" },
  "UI.lg.calories.optional": { sl: "Ni izbrano", en: "Not selected", de: "Nicht ausgewählt", it: "Non selezionato" },
  "UI.lg.calories.save": { sl: "Shrani", en: "Save", de: "Speichern", it: "Salva" },
  "UI.lg.calories.skip": { sl: "Preskoči", en: "Skip", de: "Überspringen", it: "Salta" },
  "UI.lg.calories.cancel": { sl: "Prekliči", en: "Cancel", de: "Abbrechen", it: "Annulla" },
  "UI.lg.freeTour.title": {
    sl: "Posnemi svojo turo",
    en: "Record your own tour",
    de: "Eigene Tour aufzeichnen",
    it: "Registra il tuo giro",
  },
  "UI.lg.freeTour.intro": {
    sl: "Zabeležite novo kolesarsko, pohodniško ali tekaško pot. Brez vnaprej naložene sledi.",
    en: "Record a new route by bike, on foot or running. No preloaded track needed.",
    de: "Zeichnen Sie eine neue Route mit dem Rad, zu Fuß oder beim Laufen auf. Kein vorab geladener Track nötig.",
    it: "Registra un nuovo percorso in bici, a piedi o di corsa. Nessuna traccia precaricata.",
  },
  "UI.lg.freeTour.chooseActivity": {
    sl: "Izberite dejavnost",
    en: "Choose an activity",
    de: "Aktivität wählen",
    it: "Scegli l’attività",
  },
  "UI.lg.freeTour.start": {
    sl: "Začni snemanje",
    en: "Start recording",
    de: "Aufzeichnung starten",
    it: "Avvia registrazione",
  },
  "UI.lg.freeTour.ascent": {
    sl: "Vzpon (GPS, približno)",
    en: "Ascent (GPS, approx.)",
    de: "Aufstieg (GPS, ca.)",
    it: "Salita (GPS, circa)",
  },
  "UI.lg.freeTour.gpsApprox": {
    sl: "višina (GPS, približno)",
    en: "elevation (GPS, approx.)",
    de: "Höhe (GPS, ca.)",
    it: "quota (GPS, circa)",
  },
  "UI.lg.freeTour.profileWaiting": {
    sl: "Višinski profil se prikaže, ko GPS sporoči višino.",
    en: "The elevation profile appears once GPS reports altitude.",
    de: "Das Höhenprofil erscheint, sobald GPS eine Höhe meldet.",
    it: "Il profilo altimetrico appare quando il GPS rileva la quota.",
  },
  "UI.lg.freeTour.summaryTitle": {
    sl: "Vaša posneta tura",
    en: "Your recorded tour",
    de: "Ihre aufgezeichnete Tour",
    it: "Il tuo giro registrato",
  },
  "UI.lg.freeTour.routeName": {
    sl: "Moja tura",
    en: "My tour",
    de: "Meine Tour",
    it: "Il mio giro",
  },
  "UI.lg.freeTour.mapWaiting": {
    sl: "Pot se izriše, ko prispe prvi natančen GPS položaj.",
    en: "Your path appears after the first accurate GPS fix.",
    de: "Ihr Weg erscheint nach der ersten genauen GPS-Position.",
    it: "Il percorso appare dopo la prima posizione GPS precisa.",
  },
  "UI.lg.freeTour.omittedSegments": {
    sl: "Zaradi omejitve pomnilnika je izpuščenih {count} vmesnih odsekov sledi. Časi in razdalja so ohranjeni, izvoz vsebuje le ohranjene točke.",
    en: "Due to the memory limit, {count} middle track segments were omitted. Times and distance are kept; the export contains retained points only.",
    de: "Wegen der Speichergrenze wurden {count} mittlere Track-Abschnitte ausgelassen. Zeiten und Distanz bleiben erhalten; der Export enthält nur die behaltenen Punkte.",
    it: "Per il limite di memoria sono stati omessi {count} segmenti intermedi della traccia. Tempi e distanza restano; l’esportazione contiene solo i punti conservati.",
  },
  "UI.lg.liveTour.background": {
    sl: "Brskalnik beleži pot le, dokler je ta stran odprta in zaslon prižgan. Če zaklenete telefon ali preklopite aplikacijo, se sled lahko prekine.",
    en: "The browser records only while this page is open and the screen is on. Locking the phone or switching apps may interrupt the track.",
    de: "Der Browser zeichnet nur auf, solange diese Seite geöffnet und der Bildschirm an ist. Sperren oder App-Wechsel kann den Track unterbrechen.",
    it: "Il browser registra solo finché questa pagina è aperta e lo schermo acceso. Bloccare il telefono o cambiare app può interrompere la traccia.",
  },
  "UI.lg.liveTour.summaryTitle": {
    sl: "Vaša tura",
    en: "Your tour",
    de: "Ihre Tour",
    it: "Il tuo tour",
  },
  "UI.lg.liveTour.downloadImage": {
    sl: "Prenesi sliko",
    en: "Download image",
    de: "Bild herunterladen",
    it: "Scarica immagine",
  },
  "UI.lg.liveTour.downloadGpx": {
    sl: "Prenesi GPX ture",
    en: "Download tour GPX",
    de: "Tour-GPX herunterladen",
    it: "Scarica GPX del tour",
  },
  "UI.lg.liveTour.exporting": {
    sl: "Pripravljam …",
    en: "Preparing …",
    de: "Wird vorbereitet …",
    it: "Preparazione …",
  },
  "UI.lg.liveTour.exportError": {
    sl: "Izvoza ni bilo mogoče ustvariti. Rezultat ostaja shranjen — poskusite znova.",
    en: "The export could not be created. Your result is kept — please try again.",
    de: "Der Export konnte nicht erstellt werden. Ihr Ergebnis bleibt erhalten — bitte erneut versuchen.",
    it: "Impossibile creare l'esportazione. Il risultato resta salvato — riprova.",
  },
  "UI.lg.liveTour.planned": {
    sl: "Načrtovana sled",
    en: "Planned track",
    de: "Geplanter Track",
    it: "Traccia prevista",
  },
  "UI.lg.liveTour.recorded": {
    sl: "Vaša pot",
    en: "Your path",
    de: "Ihr Weg",
    it: "Il tuo percorso",
  },
  "UI.lg.liveTour.schematic": {
    sl: "Shematski prikaz poti · ni zemljevid",
    en: "Schematic route diagram · not a map",
    de: "Schematische Routenskizze · keine Karte",
    it: "Schema del percorso · non è una mappa",
  },
  "UI.lg.liveTour.waitingGps": {
    sl: "Čakam na signal GPS …",
    en: "Waiting for GPS signal …",
    de: "Warte auf GPS-Signal …",
    it: "In attesa del segnale GPS …",
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
