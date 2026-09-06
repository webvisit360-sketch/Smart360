import {
  categoriesTable,
  db,
  sectionsTable,
  tenantsTable,
  translationsTable,
} from "@workspace/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * The owner's shared skeleton is the current Apartmaji Meli Pu structure.
 *
 * New tenants receive this structure exactly. Existing approved tenants are
 * synchronized additively: missing keys are appended, while existing sections,
 * categories, translations, positions, visibility and content are never
 * updated, moved or deleted.
 *
 * Empty categories remain guest-invisible through the normal guest renderer.
 */

export const TENANT_TYPES = ["kamp", "hotel", "apartmaji"] as const;
export type TenantType = (typeof TENANT_TYPES)[number];

export type SeedNames = {
  sl: string;
  en: string;
  de: string;
  it: string;
};

export type CategorySeed = {
  key: string;
  names: SeedNames;
  icon: string;
  layout: string;
  group: string;
};

export type GroupSeed = {
  key: string;
  names: SeedNames;
};

export type SectionSeed = {
  key: string;
  names: SeedNames;
  icon: string;
  groups: GroupSeed[];
  categories: CategorySeed[];
};

const names = (sl: string, en: string, de: string, it: string): SeedNames => ({
  sl,
  en,
  de,
  it,
});

const STAY_GROUPS: GroupSeed[] = [
  { key: "vase_bivanje", names: names("Vaše bivanje", "Your stay", "Ihr Aufenthalt", "Il vostro soggiorno") },
  { key: "prihod_dostop", names: names("Prihod in dostop", "Arrival and access", "Anreise und Zugang", "Arrivo e accesso") },
  { key: "prakticno", names: names("Praktično", "Practical", "Praktisches", "Info pratiche") },
];

const OFFER_GROUPS: GroupSeed[] = [
  { key: "najem", names: names("Najem", "Rental", "Verleih", "Noleggio") },
  { key: "izleti_prevozi", names: names("Izleti in prevozi", "Trips and transfers", "Ausflüge und Transfers", "Gite e trasferimenti") },
  { key: "domaci_izdelki", names: names("Domači izdelki", "Local products", "Hausgemachte Produkte", "Prodotti locali") },
  { key: "pri_hisi", names: names("Pri hiši", "On site", "Vor Ort", "In loco") },
];

const EXPLORE_GROUPS: GroupSeed[] = [
  { key: "experiences", names: names("Doživetja", "Experiences", "Erlebnisse", "Esperienze") },
  { key: "food_drink", names: names("Hrana in pijača", "Food and drink", "Essen und Trinken", "Cibo e bevande") },
  { key: "nature_trails", names: names("Aktivnosti", "Activities", "Aktivitäten", "Attività") },
  { key: "sights", names: names("Znamenitosti", "Sights", "Sehenswürdigkeiten", "Attrazioni") },
];

const SERVICE_GROUPS: GroupSeed[] = [
  { key: "services", names: names("Storitve", "Services", "Dienstleistungen", "Servizi") },
];

export const MELI_PU_SKELETON: SectionSeed[] = [
  {
    key: "stay",
    names: names("Vaša nastanitev", "Your stay", "Ihr Aufenthalt", "Il vostro soggiorno"),
    icon: "home",
    groups: STAY_GROUPS,
    categories: [
      { key: "welcome", names: names("Dobrodošli", "Welcome", "Willkommen", "Benvenuti"), icon: "welcome", layout: "text", group: "vase_bivanje" },
      { key: "apart", names: names("Apartmaji", "Apartments", "Apartments", "Appartamenti"), icon: "apart", layout: "apartments", group: "vase_bivanje" },
      { key: "loc", names: names("Lokacija", "Location", "Anfahrt", "Come arrivare"), icon: "pin", layout: "text", group: "prihod_dostop" },
      { key: "park", names: names("Parkirišče", "Parking", "Parkplatz", "Parcheggio"), icon: "park", layout: "text", group: "prihod_dostop" },
      {
        key: "gate",
        names: names(
          "Navodila za ograjo",
          "Fence instructions",
          "Anweisungen für den Zaun",
          "Istruzioni per la recinzione",
        ),
        icon: "gate",
        layout: "text",
        group: "prihod_dostop",
      },
      { key: "equip", names: names("Navodila za opremo", "How things work", "Geräte bedienen", "Come funziona"), icon: "gear", layout: "tabs", group: "prakticno" },
      { key: "check", names: names("Prijava / Odjava", "Check-in / Check-out", "Check-in / Check-out", "Check-in / Check-out"), icon: "clock", layout: "tabs", group: "prihod_dostop" },
      { key: "wifi", names: names("WiFi", "WiFi", "WLAN", "WiFi"), icon: "wifi", layout: "wifi", group: "prakticno" },
      { key: "house", names: names("Hišni red", "House rules", "Hausordnung", "Regolamento"), icon: "doc", layout: "rules", group: "prakticno" },
      { key: "pool", names: names("Bazen", "Swimming pool", "Pool", "Piscina"), icon: "pool", layout: "rules", group: "vase_bivanje" },
    ],
  },
  {
    key: "offer",
    names: names("Naša ponudba", "What we offer", "Unser Angebot", "La nostra offerta"),
    icon: "bag",
    groups: OFFER_GROUPS,
    categories: [
      { key: "sup", names: names("SUP deska", "SUP board", "SUP-Board", "Tavola SUP"), icon: "sup", layout: "products", group: "najem" },
      { key: "scooter", names: names("Skuter", "Scooter", "Roller", "Scooter"), icon: "scooter", layout: "products", group: "najem" },
      { key: "fitness", names: names("Zunanji fitnes", "Outdoor gym", "Outdoor-Gym", "Palestra all'aperto"), icon: "dumb", layout: "text", group: "pri_hisi" },
      { key: "grill", names: names("Žar", "Barbecue", "Grill", "Barbecue"), icon: "grill", layout: "text", group: "pri_hisi" },
      { key: "boat", names: names("Čoln s skiperjem", "Boat with a skipper", "Boot mit Skipper", "Barca con skipper"), icon: "boat", layout: "products", group: "izleti_prevozi" },
      { key: "ferry", names: names("Ladijski prevoz", "Boat line", "Schiffslinie", "Linea marittima"), icon: "ferry", layout: "products", group: "izleti_prevozi" },
      { key: "games", names: names("Družabne igre", "Games", "Spiele", "Giochi"), icon: "dice", layout: "text", group: "pri_hisi" },
      { key: "oil", names: names("Oljčno olje", "Olive oil", "Olivenöl", "Olio d'oliva"), icon: "drop", layout: "products", group: "domaci_izdelki" },
      { key: "ice", names: names("Sladoled 24/7", "Ice cream 24/7", "Eis rund um die Uhr", "Gelato 24/7"), icon: "ice", layout: "text", group: "domaci_izdelki" },
    ],
  },
  {
    key: "explore",
    names: names("Odkrij okolico", "Explore the area", "Die Umgebung entdecken", "Scopri i dintorni"),
    icon: "compass",
    groups: EXPLORE_GROUPS,
    categories: [
      { key: "breakfast", names: names("Zajtrk", "Breakfast", "Frühstück", "Colazione"), icon: "coffee", layout: "poi", group: "food_drink" },
      { key: "culinary", names: names("Kulinarika", "Where to eat", "Essen gehen", "Dove mangiare"), icon: "fork", layout: "poi", group: "food_drink" },
      { key: "night", names: names("Nočno življenje", "Nightlife", "Nachtleben", "Vita notturna"), icon: "cocktail", layout: "poi", group: "food_drink" },
      { key: "pizza", names: names("Picerije", "Pizzerias", "Pizzerien", "Pizzerie"), icon: "pizza", layout: "poi", group: "food_drink" },
      { key: "act", names: names("Aktivnosti", "Things to do", "Aktivitäten", "Attività"), icon: "star", layout: "poi", group: "experiences" },
      { key: "hike", names: names("Pohodništvo", "Hiking", "Wandern", "Escursioni a piedi"), icon: "hike", layout: "routes", group: "nature_trails" },
      { key: "bike", names: names("Kolesarjenje", "Cycling", "Radfahren", "In bicicletta"), icon: "bike", layout: "routes", group: "nature_trails" },
      { key: "beach", names: names("Plaže", "Beaches", "Strände", "Spiagge"), icon: "beach", layout: "poi", group: "nature_trails" },
      { key: "culture", names: names("Kulturna dediščina", "Heritage", "Kulturerbe", "Patrimonio culturale"), icon: "culture", layout: "poi", group: "sights" },
      { key: "nature", names: names("Naravna dediščina", "Nature", "Naturerbe", "Patrimonio naturale"), icon: "nature", layout: "poi", group: "sights" },
      { key: "trips", names: names("Izleti", "Day trips", "Ausflüge", "Gite"), icon: "map", layout: "poi", group: "experiences" },
      { key: "events", names: names("Dogodki", "What's on", "Veranstaltungen", "Eventi"), icon: "party", layout: "events", group: "experiences" },
    ],
  },
  {
    key: "services",
    names: names("Storitve v bližini", "Nearby services", "Dienste in der Nähe", "Servizi nelle vicinanze"),
    icon: "cart",
    groups: SERVICE_GROUPS,
    categories: [
      { key: "shops", names: names("Trgovine", "Shops", "Geschäfte", "Negozi"), icon: "cart", layout: "poi", group: "services" },
      { key: "bakery", names: names("Pekarne", "Bakeries", "Bäckereien", "Panetterie"), icon: "bread", layout: "poi", group: "services" },
      { key: "gas", names: names("Bencinske črpalke", "Petrol stations", "Tankstellen", "Distributori di carburante"), icon: "gas", layout: "poi", group: "services" },
      { key: "atm", names: names("Bankomati", "Cash machines", "Geldautomaten", "Bancomat"), icon: "atm", layout: "poi", group: "services" },
      { key: "pharm", names: names("Lekarne", "Pharmacies", "Apotheken", "Farmacie"), icon: "pharm", layout: "poi", group: "services" },
      { key: "hosp", names: names("Bolnišnica", "Hospital", "Krankenhaus", "Ospedale"), icon: "hosp", layout: "poi", group: "services" },
    ],
  },
];

export function tenantSeedPlan(_type: TenantType): SectionSeed[] {
  return MELI_PU_SKELETON;
}

type SeedExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type TenantSkeletonSyncResult = {
  tenantId: string;
  addedSections: number;
  addedCategories: number;
  addedTranslations: number;
};

const translationValues = (
  model: "section" | "category",
  recordId: string,
  field: "title" | "label",
  seedNames: SeedNames,
) => (["en", "de", "it"] as const).map((lang) => ({
  model,
  recordId,
  field,
  lang,
  value: seedNames[lang],
  stale: false,
}));

/**
 * Additive shared-skeleton synchronizer.
 *
 * This is the durable propagation rule for future skeleton changes: add a
 * section/category to MELI_PU_SKELETON and this function appends the missing
 * key to approved existing tenants. Existing rows and content are immutable
 * from this path.
 */
export async function ensureTenantSkeleton(
  tenantId: string,
  type: TenantType,
  executor: SeedExecutor = db,
): Promise<TenantSkeletonSyncResult> {
  return executor.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(
      hashtextextended(${`tenant-skeleton:${tenantId}`}, 0)
    )`);

    const result: TenantSkeletonSyncResult = {
      tenantId,
      addedSections: 0,
      addedCategories: 0,
      addedTranslations: 0,
    };
    const plan = tenantSeedPlan(type);
    const existingSections = await tx
      .select({
        id: sectionsTable.id,
        key: sectionsTable.key,
        position: sectionsTable.position,
      })
      .from(sectionsTable)
      .where(eq(sectionsTable.tenantId, tenantId))
      .orderBy(asc(sectionsTable.position));
    let nextSectionPosition =
      existingSections.reduce((max, section) => Math.max(max, section.position), -1) + 1;

    for (const sectionSeed of plan) {
      let section = existingSections.find((row) => row.key === sectionSeed.key);
      if (!section) {
        const [inserted] = await tx
          .insert(sectionsTable)
          .values({
            tenantId,
            key: sectionSeed.key,
            title: sectionSeed.names.sl,
            icon: sectionSeed.icon,
            position: nextSectionPosition,
          })
          .returning({
            id: sectionsTable.id,
            key: sectionsTable.key,
            position: sectionsTable.position,
          });
        section = inserted!;
        existingSections.push(section);
        nextSectionPosition += 1;
        result.addedSections += 1;
        const values = translationValues("section", section.id, "title", sectionSeed.names);
        await tx.insert(translationsTable).values(values).onConflictDoNothing();
        result.addedTranslations += values.length;
      }

      const existingCategories = await tx
        .select({
          id: categoriesTable.id,
          key: categoriesTable.key,
          position: categoriesTable.position,
        })
        .from(categoriesTable)
        .where(eq(categoriesTable.sectionId, section.id))
        .orderBy(asc(categoriesTable.position));
      let nextCategoryPosition =
        existingCategories.reduce((max, category) => Math.max(max, category.position), -1) + 1;

      for (const categorySeed of sectionSeed.categories) {
        if (existingCategories.some((row) => row.key === categorySeed.key)) continue;
        const [inserted] = await tx
          .insert(categoriesTable)
          .values({
            sectionId: section.id,
            key: categorySeed.key,
            label: categorySeed.names.sl,
            icon: categorySeed.icon,
            layout: categorySeed.layout,
            exploreGroup: categorySeed.group,
            position: nextCategoryPosition,
          })
          .returning({ id: categoriesTable.id, key: categoriesTable.key, position: categoriesTable.position });
        existingCategories.push(inserted!);
        nextCategoryPosition += 1;
        result.addedCategories += 1;
        const values = translationValues("category", inserted!.id, "label", categorySeed.names);
        await tx.insert(translationsTable).values(values).onConflictDoNothing();
        result.addedTranslations += values.length;
      }
    }

    return result;
  });
}

/** New tenants use the same additive implementation in an empty transaction. */
export async function seedTenantContent(
  tenantId: string,
  type: TenantType,
  executor: SeedExecutor = db,
): Promise<void> {
  await ensureTenantSkeleton(tenantId, type, executor);
}

const APPROVED_EXISTING_TENANTS = [
  { id: "1bf40460-bca8-418a-b01d-974b436ef3b0", name: "Piknik prostor in kamp Gril" },
  { id: "177e633a-6030-4eca-8ce8-e0a0afdff599", name: "Piknik prostor in kamp Gril" },
  { id: "e0303a50-aeba-4ff2-a919-1e2558df55f3", name: "Camping MENINA" },
] as const;

async function ensureMeliPuGateTranslations(): Promise<number> {
  return db.transaction(async (tx) => {
    const [tenant] = await tx
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, "meli-pu"))
      .limit(1);
    if (!tenant) return 0;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(
      hashtextextended(${`tenant-skeleton:${tenant.id}`}, 0)
    )`);
    const [stay] = await tx
      .select({ id: sectionsTable.id })
      .from(sectionsTable)
      .where(and(eq(sectionsTable.tenantId, tenant.id), eq(sectionsTable.key, "stay")))
      .limit(1);
    if (!stay) return 0;
    const [gate] = await tx
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(and(
        eq(categoriesTable.sectionId, stay.id),
        eq(categoriesTable.key, "gate"),
        eq(categoriesTable.label, "Navodila za ograjo"),
      ))
      .limit(1);
    if (!gate) return 0;

    const gateSeed = MELI_PU_SKELETON
      .find((section) => section.key === "stay")!
      .categories.find((category) => category.key === "gate")!;
    const existing = await tx
      .select({
        id: translationsTable.id,
        lang: translationsTable.lang,
        stale: translationsTable.stale,
      })
      .from(translationsTable)
      .where(and(
        eq(translationsTable.model, "category"),
        eq(translationsTable.recordId, gate.id),
        eq(translationsTable.field, "label"),
        inArray(translationsTable.lang, ["en", "de", "it"]),
      ));
    const desired = translationValues("category", gate.id, "label", gateSeed.names);
    const missing = desired.filter((row) => !existing.some((current) => current.lang === row.lang));
    if (missing.length > 0) {
      await tx.insert(translationsTable).values(missing).onConflictDoNothing();
    }
    let repaired = missing.length;
    for (const current of existing) {
      if (!current.stale) continue;
      const replacement = desired.find((row) => row.lang === current.lang);
      if (!replacement) continue;
      await tx
        .update(translationsTable)
        .set({ value: replacement.value, stale: false })
        .where(and(
          eq(translationsTable.id, current.id),
          eq(translationsTable.stale, true),
        ));
      repaired += 1;
    }
    return repaired;
  });
}

/**
 * Runs at startup for the explicitly approved existing tenants only.
 * Adding a future row to MELI_PU_SKELETON propagates additively on next start.
 */
export async function runSharedTenantSkeletonSyncAtStartup(): Promise<void> {
  try {
    const tenants = await db
      .select({ id: tenantsTable.id, name: tenantsTable.name, tenantType: tenantsTable.tenantType })
      .from(tenantsTable)
      .where(inArray(tenantsTable.id, APPROVED_EXISTING_TENANTS.map((tenant) => tenant.id)));
    for (const tenant of tenants) {
      const approved = APPROVED_EXISTING_TENANTS.find((candidate) => candidate.id === tenant.id);
      if (!approved || tenant.name !== approved.name) {
        logger.error(
          { tenantId: tenant.id, actualName: tenant.name, expectedName: approved?.name },
          "[tenantSkeleton] approved tenant identity mismatch — skipped",
        );
        continue;
      }
      const type = (TENANT_TYPES as readonly string[]).includes(tenant.tenantType ?? "")
        ? tenant.tenantType as TenantType
        : "apartmaji";
      const result = await ensureTenantSkeleton(tenant.id, type);
      logger.info({ tenantName: tenant.name, ...result }, "[tenantSkeleton] additive sync complete");
    }
    const gateTranslations = await ensureMeliPuGateTranslations();
    logger.info({ addedTranslations: gateTranslations }, "[tenantSkeleton] Meli Pu gate translation sync complete");
  } catch (err) {
    logger.error({ err }, "[tenantSkeleton] additive startup sync failed (boot continues)");
  }
}