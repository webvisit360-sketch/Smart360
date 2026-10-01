import type { Cardinal, SosLang } from "./sos-model";

export interface SosDict {
  cardTitle: string;
  cardText: string;
  cardButton: string;
  eyebrow: string;
  title: string;
  sub: string;
  coordsLabel: string;
  altitude: string;
  accuracy: string;
  updated: string;
  unknown: string;
  ago: (s: number) => string;
  fresh: string;
  near: (dist: string, dir: string, name: string) => string;
  dir: Record<Cardinal, string>;
  call: string;
  callReassurance: string;
  copy: string;
  share: string;
  sms: string;
  smsHint: string;
  smsManual: string;
  copied: string;
  copyFailed: string;
  manualCopy: string;
  guide: [string, string][];
  privacy: [string, string];
  acquiringTitle: string;
  acquiringSub: string;
  acquiringError: string;
  poorTitle: string;
  poorSub: (acc: number) => string;
  improving: string;
  staleTitle: string;
  staleSub: (s: number) => string;
  deniedTitle: string;
  deniedSub: string;
  deniedReassurance: string;
  unsupportedTitle: string;
  unsupportedSub: string;
  os: { ios: string[]; android: string[]; desktop: string[] };
  osLabel: { ios: string; android: string; desktop: string };
  retry: string;
  close: string;
  mapButton: string;
}

const sl: SosDict = {
  cardTitle: "Kje sem? — lokacija za reševalce",
  cardText: "Ob klicu na 112 preberite operaterju svoje koordinate. Prikažemo jih z GPS-om vaše naprave.",
  cardButton: "Pokaži mojo lokacijo",
  eyebrow: "SOS",
  title: "Moja lokacija",
  sub: "Podatki za klic 112",
  coordsLabel: "Koordinate (WGS84)",
  altitude: "Nadm. višina",
  accuracy: "Natančnost",
  updated: "Osveženo",
  unknown: "neznano",
  ago: (s) => `pred ${s} s`,
  fresh: "GPS aktiven — koordinate se osvežujejo",
  near: (d, dir, n) => `pribl. ${d} ${dir} od ${n}`,
  dir: { N: "severno", NE: "severovzhodno", E: "vzhodno", SE: "jugovzhodno", S: "južno", SW: "jugozahodno", W: "zahodno", NW: "severozahodno" },
  call: "Pokliči 112",
  callReassurance: "Ob klicu na 112 sodobni telefoni samodejno pošljejo vašo lokacijo reševalcem. Koordinate zgoraj so potrditev in rezerva.",
  copy: "Kopiraj koordinate",
  share: "Deli lokacijo",
  sms: "SMS na 112",
  smsHint: "Za SMS z lokacijo počakajte na GPS.",
  smsManual: "Odpre osnutek SMS-a. Sporočilo pošljete sami.",
  copied: "Koordinate so kopirane.",
  copyFailed: "Kopiranje ni uspelo. Označite in kopirajte besedilo ročno:",
  manualCopy: "Besedilo za ročno kopiranje",
  guide: [
    ["Kje ste", " — operater praviloma že vidi vašo lokacijo. Za potrditev počasi preberite koordinate z zaslona."],
    ["Kaj se je zgodilo", " in koliko je poškodovanih."],
    ["Ne prekinite klica", ", dokler operater ne reče, da lahko."],
  ],
  privacy: ["Lokacija se prebere samo na vaši napravi in samo na tem zaslonu.", "Ničesar ne pošljemo na strežnik."],
  acquiringTitle: "Pridobivam lokacijo …",
  acquiringSub: "Iščem GPS signal — po možnosti stopite pod odprto nebo.",
  acquiringError: "Signal še ni na voljo. Poskušam znova …",
  poorTitle: "Pridobivam natančno lokacijo …",
  poorSub: (a) => `Trenutna natančnost ± ${a} m — počakajte nekaj sekund, po možnosti pod odprtim nebom.`,
  improving: "natančnost se izboljšuje",
  staleTitle: "Lokacija ni več sveža",
  staleSub: (s) => `Zadnja lokacija je stara ${s} s. Čakam na novo meritev …`,
  deniedTitle: "Dostop do lokacije je zavrnjen",
  deniedSub: "Spletna stran ne more odpreti sistemskih nastavitev. Lokacijo vklopite takole:",
  deniedReassurance: "Zavrnitev lokacije v brskalniku ne prepreči samodejnega posredovanja lokacije ob klicu na 112, ki ga sodobni telefoni praviloma omogočajo. Ne odlašajte s klicem.",
  unsupportedTitle: "Lokacija ni na voljo",
  unsupportedSub: "Ta brskalnik ne podpira določanja lokacije. Klic 112 deluje.",
  os: {
    ios: ["Odprite Nastavitve → Zasebnost in varnost → Lokacijske storitve in jih vklopite.", "Pri brskalniku (Safari) izberite »Med uporabo aplikacije«.", "Vrnite se sem in pritisnite »Poskusi znova«."],
    android: ["Povlecite z vrha zaslona in vklopite »Lokacija«.", "V brskalniku tapnite ključavnico ob naslovu → Dovoljenja → Lokacija → Dovoli.", "Pritisnite »Poskusi znova«."],
    desktop: ["Kliknite ikono ključavnice ob naslovu strani.", "Pri »Lokacija« izberite »Dovoli«.", "Osvežite stran ali pritisnite »Poskusi znova«."],
  },
  osLabel: { ios: "iPhone / iPad", android: "Android", desktop: "Računalnik" },
  retry: "Poskusi znova",
  close: "Zapri",
  mapButton: "SOS — moja lokacija",
};

const en: SosDict = {
  cardTitle: "Where am I? — location for rescuers",
  cardText: "When calling 112, read your coordinates to the operator. We show them using your device's GPS.",
  cardButton: "Show my location",
  eyebrow: "SOS",
  title: "My location",
  sub: "Details for the 112 call",
  coordsLabel: "Coordinates (WGS84)",
  altitude: "Altitude",
  accuracy: "Accuracy",
  updated: "Updated",
  unknown: "unknown",
  ago: (s) => `${s} s ago`,
  fresh: "GPS active — coordinates are updating",
  near: (d, dir, n) => `approx. ${d} ${dir} of ${n}`,
  dir: { N: "north", NE: "northeast", E: "east", SE: "southeast", S: "south", SW: "southwest", W: "west", NW: "northwest" },
  call: "Call 112",
  callReassurance: "When you call 112, modern phones automatically send your location to rescuers. The coordinates above are confirmation and a backup.",
  copy: "Copy coordinates",
  share: "Share location",
  sms: "SMS to 112",
  smsHint: "Wait for GPS to include your location in the SMS.",
  smsManual: "Opens an SMS draft. You send the message yourself.",
  copied: "Coordinates copied.",
  copyFailed: "Copy failed. Select and copy the text manually:",
  manualCopy: "Text for manual copy",
  guide: [
    ["Where you are", " — the operator usually already sees your location. Read the coordinates from the screen slowly to confirm."],
    ["What happened", " and how many people are injured."],
    ["Don't hang up", " until the operator says you can."],
  ],
  privacy: ["Your location is read only on your device and only on this screen.", "Nothing is sent to a server."],
  acquiringTitle: "Getting your location …",
  acquiringSub: "Searching for GPS signal — move under open sky if possible.",
  acquiringError: "No signal yet. Retrying …",
  poorTitle: "Getting a precise location …",
  poorSub: (a) => `Current accuracy ± ${a} m — wait a few seconds, ideally under open sky.`,
  improving: "accuracy is improving",
  staleTitle: "Location is no longer fresh",
  staleSub: (s) => `Last fix is ${s} s old. Waiting for a new reading …`,
  deniedTitle: "Location access denied",
  deniedSub: "A web page can't open system settings. Turn location on like this:",
  deniedReassurance: "Denying location access in the browser does not block automatic location sharing during a 112 call, which modern phones usually support. Don't hesitate to call.",
  unsupportedTitle: "Location unavailable",
  unsupportedSub: "This browser doesn't support geolocation. Calling 112 still works.",
  os: {
    ios: ["Open Settings → Privacy & Security → Location Services and turn it on.", "For your browser (Safari), choose \"While Using the App\".", "Come back here and tap \"Try again\"."],
    android: ["Swipe down from the top and turn on \"Location\".", "In the browser, tap the lock next to the address → Permissions → Location → Allow.", "Tap \"Try again\"."],
    desktop: ["Click the lock icon next to the page address.", "Set \"Location\" to \"Allow\".", "Reload the page or click \"Try again\"."],
  },
  osLabel: { ios: "iPhone / iPad", android: "Android", desktop: "Computer" },
  retry: "Try again",
  close: "Close",
  mapButton: "SOS — my location",
};

const de: SosDict = {
  cardTitle: "Wo bin ich? — Standort für Rettungskräfte",
  cardText: "Lesen Sie beim Notruf 112 dem Disponenten Ihre Koordinaten vor. Wir zeigen sie über das GPS Ihres Geräts an.",
  cardButton: "Meinen Standort zeigen",
  eyebrow: "SOS",
  title: "Mein Standort",
  sub: "Angaben für den Notruf 112",
  coordsLabel: "Koordinaten (WGS84)",
  altitude: "Höhe",
  accuracy: "Genauigkeit",
  updated: "Aktualisiert",
  unknown: "unbekannt",
  ago: (s) => `vor ${s} s`,
  fresh: "GPS aktiv — Koordinaten werden aktualisiert",
  near: (d, dir, n) => `ca. ${d} ${dir} von ${n}`,
  dir: { N: "nördlich", NE: "nordöstlich", E: "östlich", SE: "südöstlich", S: "südlich", SW: "südwestlich", W: "westlich", NW: "nordwestlich" },
  call: "112 anrufen",
  callReassurance: "Wenn Sie die 112 anrufen, senden moderne Telefone Ihren Standort automatisch an die Rettungskräfte. Die Koordinaten oben dienen als Bestätigung und Reserve.",
  copy: "Koordinaten kopieren",
  share: "Standort teilen",
  sms: "SMS an 112",
  smsHint: "Warten Sie auf GPS für den Standort in der SMS.",
  smsManual: "Öffnet einen SMS-Entwurf. Sie senden die Nachricht selbst.",
  copied: "Koordinaten kopiert.",
  copyFailed: "Kopieren fehlgeschlagen. Text markieren und manuell kopieren:",
  manualCopy: "Text zum manuellen Kopieren",
  guide: [
    ["Wo Sie sind", " — der Disponent sieht Ihren Standort in der Regel bereits. Lesen Sie zur Bestätigung die Koordinaten langsam vom Bildschirm vor."],
    ["Was passiert ist", " und wie viele verletzt sind."],
    ["Legen Sie nicht auf", ", bis der Disponent es erlaubt."],
  ],
  privacy: ["Der Standort wird nur auf Ihrem Gerät und nur auf diesem Bildschirm gelesen.", "Nichts wird an einen Server gesendet."],
  acquiringTitle: "Standort wird ermittelt …",
  acquiringSub: "Suche GPS-Signal — gehen Sie möglichst unter freien Himmel.",
  acquiringError: "Noch kein Signal. Neuer Versuch …",
  poorTitle: "Genauer Standort wird ermittelt …",
  poorSub: (a) => `Aktuelle Genauigkeit ± ${a} m — warten Sie einige Sekunden, möglichst unter freiem Himmel.`,
  improving: "Genauigkeit wird besser",
  staleTitle: "Standort nicht mehr aktuell",
  staleSub: (s) => `Letzte Messung ist ${s} s alt. Warte auf neue Messung …`,
  deniedTitle: "Standortzugriff verweigert",
  deniedSub: "Eine Webseite kann die Systemeinstellungen nicht öffnen. So aktivieren Sie den Standort:",
  deniedReassurance: "Die verweigerte Standortfreigabe im Browser verhindert nicht die automatische Standortübermittlung beim Notruf 112, die moderne Telefone in der Regel unterstützen. Zögern Sie nicht anzurufen.",
  unsupportedTitle: "Standort nicht verfügbar",
  unsupportedSub: "Dieser Browser unterstützt keine Standortbestimmung. Der Notruf 112 funktioniert.",
  os: {
    ios: ["Öffnen Sie Einstellungen → Datenschutz & Sicherheit → Ortungsdienste und aktivieren Sie sie.", "Wählen Sie beim Browser (Safari) „Beim Verwenden der App“.", "Kehren Sie zurück und tippen Sie auf „Erneut versuchen“."],
    android: ["Wischen Sie von oben nach unten und aktivieren Sie „Standort“.", "Im Browser auf das Schloss neben der Adresse tippen → Berechtigungen → Standort → Zulassen.", "Tippen Sie auf „Erneut versuchen“."],
    desktop: ["Klicken Sie auf das Schloss neben der Seitenadresse.", "Stellen Sie „Standort“ auf „Zulassen“.", "Laden Sie die Seite neu oder klicken Sie „Erneut versuchen“."],
  },
  osLabel: { ios: "iPhone / iPad", android: "Android", desktop: "Computer" },
  retry: "Erneut versuchen",
  close: "Schließen",
  mapButton: "SOS — mein Standort",
};

const it: SosDict = {
  cardTitle: "Dove sono? — posizione per i soccorritori",
  cardText: "Quando chiami il 112, leggi all'operatore le tue coordinate. Le mostriamo con il GPS del tuo dispositivo.",
  cardButton: "Mostra la mia posizione",
  eyebrow: "SOS",
  title: "La mia posizione",
  sub: "Dati per la chiamata al 112",
  coordsLabel: "Coordinate (WGS84)",
  altitude: "Altitudine",
  accuracy: "Precisione",
  updated: "Aggiornato",
  unknown: "sconosciuta",
  ago: (s) => `${s} s fa`,
  fresh: "GPS attivo — le coordinate si aggiornano",
  near: (d, dir, n) => `circa ${d} ${dir} da ${n}`,
  dir: { N: "a nord", NE: "a nord-est", E: "a est", SE: "a sud-est", S: "a sud", SW: "a sud-ovest", W: "a ovest", NW: "a nord-ovest" },
  call: "Chiama il 112",
  callReassurance: "Quando chiami il 112, i telefoni moderni inviano automaticamente la tua posizione ai soccorritori. Le coordinate sopra sono una conferma e una riserva.",
  copy: "Copia coordinate",
  share: "Condividi posizione",
  sms: "SMS al 112",
  smsHint: "Attendi il GPS per includere la posizione nell'SMS.",
  smsManual: "Apre una bozza SMS. Invii tu il messaggio.",
  copied: "Coordinate copiate.",
  copyFailed: "Copia non riuscita. Seleziona e copia il testo manualmente:",
  manualCopy: "Testo da copiare manualmente",
  guide: [
    ["Dove sei", " — di solito l'operatore vede già la tua posizione. Leggi lentamente le coordinate dallo schermo per confermarla."],
    ["Cosa è successo", " e quanti sono i feriti."],
    ["Non riattaccare", " finché l'operatore non lo dice."],
  ],
  privacy: ["La posizione viene letta solo sul tuo dispositivo e solo in questa schermata.", "Non inviamo nulla al server."],
  acquiringTitle: "Rilevamento della posizione …",
  acquiringSub: "Ricerca del segnale GPS — se possibile spostati all'aperto.",
  acquiringError: "Ancora nessun segnale. Nuovo tentativo …",
  poorTitle: "Rilevamento della posizione precisa …",
  poorSub: (a) => `Precisione attuale ± ${a} m — attendi qualche secondo, possibilmente all'aperto.`,
  improving: "la precisione sta migliorando",
  staleTitle: "La posizione non è più aggiornata",
  staleSub: (s) => `L'ultima posizione risale a ${s} s fa. In attesa di una nuova misura …`,
  deniedTitle: "Accesso alla posizione negato",
  deniedSub: "Una pagina web non può aprire le impostazioni di sistema. Attiva la posizione così:",
  deniedReassurance: "Negare la posizione nel browser non impedisce l'invio automatico della posizione durante una chiamata al 112, che i telefoni moderni di solito supportano. Non esitare a chiamare.",
  unsupportedTitle: "Posizione non disponibile",
  unsupportedSub: "Questo browser non supporta la geolocalizzazione. La chiamata al 112 funziona.",
  os: {
    ios: ["Apri Impostazioni → Privacy e sicurezza → Localizzazione e attivala.", "Per il browser (Safari) scegli «Mentre usi l'app».", "Torna qui e tocca «Riprova»."],
    android: ["Scorri dall'alto e attiva «Posizione».", "Nel browser tocca il lucchetto accanto all'indirizzo → Autorizzazioni → Posizione → Consenti.", "Tocca «Riprova»."],
    desktop: ["Fai clic sul lucchetto accanto all'indirizzo della pagina.", "Imposta «Posizione» su «Consenti».", "Ricarica la pagina o fai clic su «Riprova»."],
  },
  osLabel: { ios: "iPhone / iPad", android: "Android", desktop: "Computer" },
  retry: "Riprova",
  close: "Chiudi",
  mapButton: "SOS — la mia posizione",
};

export const SOS_DICT: Record<SosLang, SosDict> = { sl, en, de, it };

export function sosLang(lang: string | null | undefined): SosLang {
  const l = (lang ?? "").slice(0, 2).toLowerCase();
  return l === "en" || l === "de" || l === "it" ? l : "sl";
}

export function sosT(lang: string | null | undefined): SosDict {
  return SOS_DICT[sosLang(lang)];
}
