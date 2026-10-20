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
  "catalog:apartmaji": ["apartments", "appartamenti", "appartements", "appartementen", "apartmani", "ferienwohnungen"],
  "catalog:nastanitve": ["nastanitev", "accommodation", "unterkunft", "alloggio", "hébergement", "accommodatie", "smještaj",
    "kulturna dediščina", "cultural heritage", "kulturerbe", "patrimonio culturale", "patrimoine culturel", "cultureel erfgoed", "kulturna baština"],
  "catalog:vhodna-vrata": ["entrance door", "front door", "eingangstür", "porta d'ingresso", "porte d'entrée", "voordeur", "ulazna vrata"],
  "catalog:domaci-izdelki": ["local products", "homemade products", "hausgemachte produkte", "prodotti locali", "produits locaux", "lokale producten", "domaći proizvodi"],
  "catalog:where-to-eat": ["kulinarika", "restaurants", "restavracije", "ristoranti", "restorani"],
  "catalog:healthcare": ["bolnišnica", "hospital", "krankenhaus", "ospedale", "hôpital", "ziekenhuis", "bolnica"],
  "catalog:scooter": ["skuter"],
  "catalog:outdoor-gym": ["zunanji fitnes"],
  "catalog:boat-line": ["ladijski prevoz"],
  "catalog:hiking": ["pohodništvo"],
  "catalog:ice-cream-24-7": ["sladoled", "ice cream", "eis", "gelato", "glace", "ijs"],
  "catalog:znamenitosti": ["naravna dediščina", "natural heritage", "naturerbe", "patrimonio naturale", "patrimoine naturel", "natuurlijk erfgoed", "prirodna baština"],
};

const MATCHES = TILE_ICON_CATALOG.flatMap((entry) =>
  [entry.name, ...entry.keywords, ...(ALIASES[entry.id] ?? [])].map((keyword) => ({
    entry, keyword: normalizeTileLabel(keyword),
  })),
).sort((a, b) => b.keyword.length - a.keyword.length);

/** Longest substring wins; stable catalogue order breaks ties deterministically. */
export function matchTileCatalog(label: string): TileCatalogEntry | undefined {
  const normalized = normalizeTileLabel(label);
  return MATCHES.find(({ keyword }) => keyword && normalized.includes(keyword))?.entry;
}

export function searchTileCatalog(query: string): readonly TileCatalogEntry[] {
  const normalized = normalizeTileLabel(query);
  return TILE_ICON_CATALOG.filter((entry) =>
    normalizeTileLabel([entry.name, ...entry.keywords, ...(ALIASES[entry.id] ?? [])].join(" ")).includes(normalized),
  );
}
