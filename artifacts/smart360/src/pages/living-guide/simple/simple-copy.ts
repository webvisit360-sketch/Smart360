// Runtime labels for Enostaven (sections + runtime-feature tiles), 7 languages.
type L = "sl" | "en" | "de" | "it" | "fr" | "nl" | "hr";
const C = {
  guide: { sl: "Vaš vodnik", en: "Your guide", de: "Ihr Reiseführer", it: "La vostra guida", fr: "Votre guide", nl: "Uw gids", hr: "Vaš vodič" },
  language: { sl: "JEZIK", en: "LANGUAGE", de: "SPRACHE", it: "LINGUA", fr: "LANGUE", nl: "TAAL", hr: "JEZIK" },
  home: { sl: "Domov", en: "Home", de: "Start", it: "Home", fr: "Accueil", nl: "Start", hr: "Početna" },
  stay: { sl: "Nastanitev", en: "Your stay", de: "Unterkunft", it: "Alloggio", fr: "Hébergement", nl: "Verblijf", hr: "Smještaj" },
  offer: { sl: "Ponudba", en: "Offer", de: "Angebot", it: "Offerta", fr: "Offre", nl: "Aanbod", hr: "Ponuda" },
  explore: { sl: "Okolica", en: "Surroundings", de: "Umgebung", it: "Dintorni", fr: "Alentours", nl: "Omgeving", hr: "Okolica" },
  messages: { sl: "Sporočila", en: "Messages", de: "Nachrichten", it: "Messaggi", fr: "Messages", nl: "Berichten", hr: "Poruke" },
  notices: { sl: "Obvestila", en: "Notices", de: "Mitteilungen", it: "Avvisi", fr: "Annonces", nl: "Mededelingen", hr: "Obavijesti" },
  weather: { sl: "Vreme", en: "Weather", de: "Wetter", it: "Meteo", fr: "Météo", nl: "Weer", hr: "Vrijeme" },
  sos: { sl: "Pomoč in SOS", en: "Help and SOS", de: "Hilfe und SOS", it: "Aiuto e SOS", fr: "Aide et SOS", nl: "Hulp en SOS", hr: "Pomoć i SOS" },
  contact: { sl: "Kontakt", en: "Contact", de: "Kontakt", it: "Contatto", fr: "Contact", nl: "Contact", hr: "Kontakt" },
  install: { sl: "Dodaj na začetni zaslon", en: "Add to home screen", de: "Zum Startbildschirm hinzufügen", it: "Aggiungi alla schermata Home", fr: "Ajouter à l’écran d’accueil", nl: "Toevoegen aan beginscherm", hr: "Dodaj na početni zaslon" },
  about: { sl: "O vodniku", en: "About the guide", de: "Über den Reiseführer", it: "Informazioni sulla guida", fr: "À propos du guide", nl: "Over de gids", hr: "O vodiču" },
  orders: { sl: "Naročilo", en: "Order", de: "Bestellung", it: "Ordine", fr: "Commande", nl: "Bestelling", hr: "Narudžba" },
  record: { sl: "Posnemi turo", en: "Record a tour", de: "Tour aufzeichnen", it: "Registra un tour", fr: "Enregistrer un parcours", nl: "Tocht opnemen", hr: "Snimi turu" },
  map: { sl: "Zemljevid", en: "Map", de: "Karte", it: "Mappa", fr: "Carte", nl: "Kaart", hr: "Karta" },
  back: { sl: "Nazaj", en: "Back", de: "Zurück", it: "Indietro", fr: "Retour", nl: "Terug", hr: "Natrag" },
  footer: { sl: "Digitalni vodnik poganja Smart360 · smart360.info", en: "Digital guide powered by Smart360 · smart360.info", de: "Digitaler Reiseführer von Smart360 · smart360.info", it: "Guida digitale di Smart360 · smart360.info", fr: "Guide numérique propulsé par Smart360 · smart360.info", nl: "Digitale gids door Smart360 · smart360.info", hr: "Digitalni vodič pokreće Smart360 · smart360.info" },
} as const;
export type SimpleCopyKey = keyof typeof C;
export const SIMPLE_COPY = C;
export function simpleCopy(key: SimpleCopyKey, lang: string): string {
  const row = C[key] as Record<L, string>;
  return row[(lang in row ? lang : "sl") as L];
}
