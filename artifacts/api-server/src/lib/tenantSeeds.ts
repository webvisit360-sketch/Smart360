import { db, sectionsTable, categoriesTable } from "@workspace/db";

/**
 * Default content seeded for a NEW tenant by type (Instruction #28 CP2b):
 * "type (kamp / hotel / apartmaji), which seeds the default sections,
 * categories, groups and bottom bar."
 *
 * The seed creates the four canonical sections (stay / offer / explore /
 * services — the same keys the reference tenant uses, so every existing
 * guest-side feature detection works) and a starter set of EMPTY categories
 * with stable keys, sprite icons and explicit group assignments
 * (`exploreGroup` is the general within-section group column).
 *
 * The bottom bar needs no rows: the legacy themes derive it from sections in
 * order, and the Living Guide resolver derives its five keys from actual
 * content features when `livingGuideNav` is NULL.
 *
 * Icons must exist in the guest sprite (sprite-icon.ts). Categories start
 * empty — the owner or host fills them; nothing here reaches guests until
 * the tenant is published anyway.
 */

export const TENANT_TYPES = ["kamp", "hotel", "apartmaji"] as const;
export type TenantType = (typeof TENANT_TYPES)[number];

type CategorySeed = {
  key: string;
  label: string;
  icon: string;
  layout: string;
  group: string;
};

type SectionSeed = {
  key: string;
  title: string;
  icon: string;
  categories: CategorySeed[];
};

/** Categories every type shares in Okolica (explore) and Storitve. */
const EXPLORE_CATEGORIES: CategorySeed[] = [
  { key: "act", label: "Aktivnosti", icon: "waves", layout: "cards", group: "experiences" },
  { key: "trips", label: "Izleti", icon: "map", layout: "cards", group: "experiences" },
  { key: "food", label: "Hrana in pijača", icon: "bread", layout: "cards", group: "food_drink" },
  { key: "hike", label: "Pohodi in kolesarjenje", icon: "pin", layout: "cards", group: "nature_trails" },
  { key: "sights", label: "Znamenitosti", icon: "star", layout: "cards", group: "sights" },
];

const SERVICE_CATEGORIES: CategorySeed[] = [
  { key: "shops", label: "Trgovine", icon: "cart", layout: "list", group: "services" },
  { key: "health", label: "Zdravje", icon: "cross", layout: "list", group: "services" },
  { key: "transport", label: "Prevozi", icon: "car", layout: "list", group: "services" },
];

function staySeed(type: TenantType): SectionSeed {
  const shared: CategorySeed[] = [
    { key: "welcome", label: "Dobrodošli", icon: "sparkle", layout: "text", group: "vase_bivanje" },
    { key: "check", label: "Prijava in odjava", icon: "key", layout: "text", group: "prihod_dostop" },
    { key: "park", label: "Parkiranje", icon: "car", layout: "text", group: "prihod_dostop" },
    { key: "wifi", label: "Wi-Fi", icon: "wifi", layout: "text", group: "prakticno" },
    { key: "rules", label: "Hišni red", icon: "rules", layout: "text", group: "prakticno" },
  ];
  if (type === "kamp") {
    return {
      key: "stay",
      title: "Vaš kamp",
      icon: "home",
      categories: [
        shared[0]!,
        { key: "pitch", label: "Vaše mesto", icon: "home", layout: "text", group: "vase_bivanje" },
        { key: "sanitary", label: "Sanitarije", icon: "waves", layout: "text", group: "prakticno" },
        ...shared.slice(1),
      ],
    };
  }
  if (type === "hotel") {
    return {
      key: "stay",
      title: "Vaš hotel",
      icon: "home",
      categories: [
        shared[0]!,
        { key: "room", label: "Vaša soba", icon: "bed", layout: "text", group: "vase_bivanje" },
        { key: "reception", label: "Recepcija", icon: "book", layout: "text", group: "prakticno" },
        ...shared.slice(1),
      ],
    };
  }
  return {
    key: "stay",
    title: "Vaša nastanitev",
    icon: "home",
    categories: [
      shared[0]!,
      { key: "apart", label: "Vaš apartma", icon: "bed", layout: "text", group: "vase_bivanje" },
      ...shared.slice(1),
    ],
  };
}

function offerSeed(type: TenantType): SectionSeed {
  const rent: CategorySeed = { key: "rent", label: "Najem opreme", icon: "bag", layout: "cards", group: "najem" };
  const local: CategorySeed = { key: "local", label: "Domači izdelki", icon: "bread", layout: "cards", group: "domaci_izdelki" };
  const categories: CategorySeed[] =
    type === "kamp"
      ? [rent, { key: "grill", label: "Žar in piknik", icon: "flame", layout: "cards", group: "pri_hisi" }, local]
      : type === "hotel"
        ? [
            { key: "wellness", label: "Wellness", icon: "waves", layout: "cards", group: "pri_hisi" },
            rent,
            local,
          ]
        : [rent, local, { key: "house", label: "Pri hiši", icon: "home", layout: "cards", group: "pri_hisi" }];
  return { key: "offer", title: "Naša ponudba", icon: "bag", categories };
}

export function tenantSeedPlan(type: TenantType): SectionSeed[] {
  return [
    staySeed(type),
    offerSeed(type),
    { key: "explore", title: "Odkrijte okolico", icon: "compass", categories: EXPLORE_CATEGORIES },
    { key: "services", title: "Storitve", icon: "cart", categories: SERVICE_CATEGORIES },
  ];
}

type SeedExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Insert the default structure for a freshly created tenant.
 * One transaction (a savepoint when called inside an outer transaction);
 * positions follow the plan order. Items are NOT created.
 */
export async function seedTenantContent(
  tenantId: string,
  type: TenantType,
  executor: SeedExecutor = db,
): Promise<void> {
  const plan = tenantSeedPlan(type);
  await executor.transaction(async (tx) => {
    for (let s = 0; s < plan.length; s++) {
      const section = plan[s]!;
      const [created] = await tx
        .insert(sectionsTable)
        .values({
          tenantId,
          key: section.key,
          title: section.title,
          icon: section.icon,
          position: s,
        })
        .returning({ id: sectionsTable.id });
      if (section.categories.length === 0) continue;
      await tx.insert(categoriesTable).values(
        section.categories.map((cat, c) => ({
          sectionId: created!.id,
          key: cat.key,
          label: cat.label,
          icon: cat.icon,
          layout: cat.layout,
          exploreGroup: cat.group,
          position: c,
        })),
      );
    }
  });
}
