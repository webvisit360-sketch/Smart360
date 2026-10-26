import { TILE_ICON_CATALOG } from "./catalog-data";

export { TILE_ICON_CATALOG };
export const AUTOMATIC_TILE_ICON = "catalog:auto";
export type TileCatalogEntry = (typeof TILE_ICON_CATALOG)[number];
export type TileCatalogId = TileCatalogEntry["id"];

export function normalizeTileLabel(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d").replace(/ß/g, "ss").replace(/œ/g, "oe")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

export function tileCatalogEntry(id?: string | null): TileCatalogEntry | undefined {
  return TILE_ICON_CATALOG.find((entry) => entry.id === id);
}

// Stable pre-catalogue keys preserve the existing runtime tiles and slot styling.
export const LEGACY_TILE_CATALOG: Record<string, string> = {
  bell: "obvestila", weather: "vreme", sos: "pomoc-in-sos", phone: "kontakt",
  install: "dodaj-na-zacetni-zaslon", info: "o-vodniku", house: "dobrodosli",
  building: "nastanitve", bed: "apartmaji", door: "vhodna-vrata",
  ac: "klimatska-naprava", wifi: "wi-fi", doc: "hisni-red", gear: "navodila",
  clock: "prijava-odjava", parking: "parkiranje", cart: "ponudba-s-cenami",
  bag: "domaci-izdelki", order: "narocilo", beach: "plaze", mountain: "znamenitosti",
  hike: "pohodi", bike: "kolesarjenje", record: "posnemi-turo", trips: "izleti",
  calendar: "program", pin: "zemljevid", chat: "sporocila",
};

export function catalogForTileKey(key: string): TileCatalogEntry | undefined {
  if (key === "catalog:hiking") return tileCatalogEntry("catalog:pohodi");
  return tileCatalogEntry(key) ?? tileCatalogEntry(`catalog:${LEGACY_TILE_CATALOG[key]}`);
}

export function tileKeyForCatalog(entry: TileCatalogEntry): string {
  // These two catalogue aliases intentionally share the original pictogram.
  if (entry.id === "catalog:hiking") return "hike";
  if (entry.id === "catalog:map") return "pin";
  return Object.entries(LEGACY_TILE_CATALOG).find(([, slug]) => `catalog:${slug}` === entry.id)?.[0] ?? entry.id;
}

// Earlier catalogue cards have labels but no keyword line. Keep their aliases
// separate from the verbatim imported keyword lists.
const ALIASES: Record<string, string[]> = {
  "catalog:dobrodosli": ["welcome", "willkommen", "benvenut", "bienvenue", "welkom"],
  "catalog:wi-fi": ["wifi", "wlan", "internet"],
  "catalog:parkiranje": ["parkir", "parking", "parkplatz", "parchegg", "stationnement", "parkeren"],
  "catalog:klimatska-naprava": ["air conditioning", "aircon", "klimaanlage", "climatisation"],
  "catalog:prijava-odjava": ["check in", "check out", "prijava", "odjava", "ankunft", "abreise"],
  "catalog:hisni-red": ["house rules", "hausordnung", "regolamento", "règlement", "huisregels", "kućni red"],
  "catalog:navodila": ["instructions", "anleitung", "istruzioni", "instructies", "upute"],
  "catalog:plaze": ["beach", "strand", "spiagg", "plage", "plaž"],
  "catalog:kolesarjenje": ["cycling", "bike", "radfahren", "ciclismo", "vélo", "fietsen", "bicikl"],
  "catalog:izleti": ["excursion", "ausflug", "izlet"],
  "catalog:program": ["event", "dogod", "veranstaltung", "événement", "evenement", "događaj"],
  "catalog:zemljevid": ["lokacija", "location", "standort", "posizione", "localisation", "locatie", "lokacija"],
  "catalog:ponudba-s-cenami": ["cenik", "price list", "preisliste", "listino", "tarifs", "prijslijst", "cjenik", "ponudba"],
  "catalog:sporocila": ["ocenite nas", "delite svojo izkušnjo", "rate us", "share your experience"],
  "catalog:apartmaji": ["apartments", "appartamenti", "appartements", "appartementen", "apartmani", "ferienwohnungen"],
  "catalog:nastanitve": ["nastanitev", "accommodation", "unterkunft", "alloggio", "hébergement", "accommodatie", "smještaj",
    "kulturna dediščina", "cultural heritage", "kulturerbe", "patrimonio culturale", "patrimoine culturel", "cultureel erfgoed", "kulturna baština"],
  "catalog:vhodna-vrata": ["entrance door", "front door", "eingangstür", "porta d'ingresso", "porte d'entrée", "voordeur", "ulazna vrata"],
  "catalog:domaci-izdelki": ["local products", "homemade products", "hausgemachte produkte", "prodotti locali", "produits locaux", "lokale producten", "domaći proizvodi"],
  "catalog:where-to-eat": ["kulinarika", "restaurants", "restavracije", "ristoranti", "restorani"],
  "catalog:scooter": ["skuter"],
  "catalog:outdoor-gym": ["zunanji fitnes"],
  "catalog:boat-line": ["ladijski prevoz"],
  "catalog:hiking": ["pohodništvo"],
  "catalog:ice-cream-24-7": ["sladoled", "ice cream", "eis", "gelato", "glace", "ijs"],
  "catalog:znamenitosti": ["naravna dediščina", "natural heritage", "naturerbe", "patrimonio naturale", "patrimoine naturel", "natuurlijk erfgoed", "prirodna baština"],
};

// Catalogued short stems are curated exact words, never prefixes. Complete
// keyword forms also remain exact-word aliases (e.g. "hiking" alongside "hik").
const MATCHES = TILE_ICON_CATALOG.flatMap((entry) => {
  const stems = [...(entry.stems.length ? entry.stems : [entry.name]), ...(ALIASES[entry.id] ?? [])];
  return [
    ...stems.map((value) => ({ value, exact: false })),
    ...[entry.name, ...entry.keywords].map((value) => ({ value, exact: true })),
  ].map(({ value, exact }) => ({
    entry, exact, words: normalizeTileLabel(value).split(" ").filter(Boolean),
  }));
});

/** Word-prefix only, longest stem then matched-word count; stable catalogue
 * order resolves a complete tie. No edit distance or interior substrings. */
export function matchTileCatalog(label: string): TileCatalogEntry | undefined {
  const words = normalizeTileLabel(label).split(" ").filter(Boolean);
  let winner: TileCatalogEntry | undefined;
  let longest = 0, matchedWords = 0;
  for (const candidate of MATCHES) {
    if (!candidate.words.length) continue;
    const unused = new Set(words.map((_, index) => index));
    const matches = candidate.words.every((stem) => {
      const index = [...unused].find((i) =>
        candidate.exact || stem.length < 4 ? words[i] === stem : words[i].startsWith(stem));
      if (index === undefined) return false;
      unused.delete(index);
      return true;
    });
    if (!matches) continue;
    const length = Math.max(...candidate.words.map((word) => word.length));
    if (length > longest || (length === longest && candidate.words.length > matchedWords)) {
      winner = candidate.entry; longest = length; matchedWords = candidate.words.length;
    }
  }
  return winner;
}

/** Shared by the browser and server fallback audit: explicit overrides win. */
export function resolveCategoryTileIcon(category: { icon?: string | null; label?: string; title?: string }, section: string) {
  const override = tileCatalogEntry(category.icon);
  const entry = override ?? matchTileCatalog(category.label ?? category.title ?? "");
  return { icon: entry ? tileKeyForCatalog(entry) : section === "offer" ? "cart" : "pin", fallback: !entry };
}

export function searchTileCatalog(query: string): readonly TileCatalogEntry[] {
  const normalized = normalizeTileLabel(query);
  return TILE_ICON_CATALOG.filter((entry) =>
    normalizeTileLabel([entry.name, ...entry.keywords, ...entry.stems, ...(ALIASES[entry.id] ?? [])].join(" ")).includes(normalized),
  );
}
