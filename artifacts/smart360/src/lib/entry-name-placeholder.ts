export type EntryPlaceholderCategory = {
  key?: string | null;
  label?: string | null;
  name?: string | null;
};

export type EntryPlaceholderSection = "stay" | "offer" | "explore" | "services" | string;

const FALLBACK = "npr. ime vnosa";

const stayByKey: Record<string, string> = {
  apart: "npr. Apartma 1",
  welcome: "npr. Dobrodošli pri nas",
  city: "npr. Ljubno ob Savinji",
  sanitary: "npr. Sanitarni objekt",
  check: "npr. Prijava in odjava",
  park: "npr. Parkirišče ob recepciji",
  wifi: "npr. Wi-Fi omrežje",
  house: "npr. Hišni red",
  loc: "npr. Kako do nas",
  gate: "npr. Uporaba vhodnih vrat",
  equip: "npr. Uporaba klime",
  pool: "npr. Bazen",
};

const offerByKey: Record<string, string> = {
  sup: "npr. Najem SUP deske",
  scooter: "npr. Najem skuterja",
  fitness: "npr. Uporaba zunanjega fitnesa",
  grill: "npr. Najem žara",
  boat: "npr. Izlet s čolnom",
  ferry: "npr. Ladijski prevoz",
  games: "npr. Izposoja družabnih iger",
  oil: "npr. Domače oljčno olje",
  ice: "npr. Sladoled",
  equipment: "npr. Najem kolesa",
  picnic: "npr. Najem žara",
  homemade: "npr. Domača marmelada",
};

const exploreByKey: Record<string, string> = {
  breakfast: "npr. Kavarna v centru",
  culinary: "npr. Gostilna Rogovilc",
  pizza: "npr. Pizzeria Peruzza",
  night: "npr. Pub Ljubno",
  act: "npr. Rafting na Savinji",
  hike: "npr. Pohod na Raduho",
  bike: "npr. Kolesarska pot ob Savinji",
  beach: "npr. Plaža ob Savinji",
  culture: "npr. Flosarski muzej",
  nature: "npr. Slap Rinka",
  trips: "npr. Izlet na Golte",
  shops: "npr. Trgovina Ljubno",
  bakery: "npr. Pekarna Mozirje",
  gas: "npr. Bencinski servis Mozirje",
  atm: "npr. Bankomat v centru",
  pharm: "npr. Lekarna Mozirje",
  hosp: "npr. Zdravstveni dom Mozirje",
  events: "npr. Flosarski bal",
};

function normalize(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sl")
    .replace(/&/g, " in ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const stayByLabel: Record<string, string> = {
  apartmaji: stayByKey.apart,
  dobrodosli: stayByKey.welcome,
  "vase mesto": stayByKey.city,
  sanitarije: stayByKey.sanitary,
  "prijava in odjava": stayByKey.check,
  parkiranje: stayByKey.park,
  parkirisce: stayByKey.park,
  "wi fi": stayByKey.wifi,
  wifi: stayByKey.wifi,
  "hisni red": stayByKey.house,
  lokacija: stayByKey.loc,
  "navodila za ograjo": stayByKey.gate,
  "navodila za opremo": stayByKey.equip,
  bazen: stayByKey.pool,
};

const offerByLabel: Record<string, string> = {
  "sup deska": offerByKey.sup,
  skuter: offerByKey.scooter,
  "zunanji fitnes": offerByKey.fitness,
  zar: offerByKey.grill,
  "zar in piknik": offerByKey.picnic,
  "coln s skiperjem": offerByKey.boat,
  "ladijski prevoz": offerByKey.ferry,
  "druzabne igre": offerByKey.games,
  "oljcno olje": offerByKey.oil,
  "sladoled 24 7": offerByKey.ice,
  "najem opreme": offerByKey.equipment,
  "domaci izdelki": offerByKey.homemade,
};

const exploreByLabel: Record<string, string> = {
  zajtrk: exploreByKey.breakfast,
  kulinarika: exploreByKey.culinary,
  picerije: exploreByKey.pizza,
  "nocno zivljenje": exploreByKey.night,
  aktivnosti: exploreByKey.act,
  pohodnistvo: exploreByKey.hike,
  kolesarjenje: exploreByKey.bike,
  plaze: exploreByKey.beach,
  "kulturna dediscina": exploreByKey.culture,
  "naravna dediscina": exploreByKey.nature,
  izleti: exploreByKey.trips,
  trgovine: exploreByKey.shops,
  pekarne: exploreByKey.bakery,
  "bencinski servisi": exploreByKey.gas,
  "bencinske crpalke": exploreByKey.gas,
  bankomati: exploreByKey.atm,
  lekarne: exploreByKey.pharm,
  zdravstvo: exploreByKey.hosp,
  dogodki: exploreByKey.events,
};

/**
 * Gives item-name fields one consistent Slovenian example. Canonical keys win
 * inside their section; labels only cover known legacy aliases. Custom and
 * unknown categories deliberately never inherit a misleading generic example.
 */
export function entryNamePlaceholder(
  category: EntryPlaceholderCategory | null | undefined,
  sectionKey: EntryPlaceholderSection | null | undefined,
): string {
  const key = normalize(category?.key);
  const label = normalize(category?.label ?? category?.name);
  if (key.startsWith("host custom")) return FALLBACK;

  if (sectionKey === "stay") return stayByKey[key] || stayByLabel[label] || FALLBACK;
  if (sectionKey === "offer") return offerByKey[key] || offerByLabel[label] || FALLBACK;
  if (sectionKey === "explore" || sectionKey === "services") {
    return exploreByKey[key] || exploreByLabel[label] || FALLBACK;
  }
  return FALLBACK;
}
