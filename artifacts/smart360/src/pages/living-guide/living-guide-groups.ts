/**
 * Ponudba / Nastanitev category groups (spec: ponudba-nastanitev, prototype
 * #v-shop / #v-grid). The mapping category → group is host-editable DATA in
 * `category.exploreGroup` — the column holds the category's group within its
 * OWN section; the key sets below are disjoint from the Okolica groups and
 * from each other. A category whose stored value is not a known key for its
 * section (e.g. the column default 'experiences') falls back to the FIRST
 * group so content can never silently disappear.
 */

export type SectionGroupDef = {
  key: string;
  labelKey: string;
  adminLabel: string;
};

export const OFFER_GROUPS: ReadonlyArray<SectionGroupDef> = [
  { key: "najem", labelKey: "UI.lg.offerGroup.najem", adminLabel: "Najem" },
  { key: "izleti_prevozi", labelKey: "UI.lg.offerGroup.izletiPrevozi", adminLabel: "Izleti in prevozi" },
  { key: "domaci_izdelki", labelKey: "UI.lg.offerGroup.domaciIzdelki", adminLabel: "Domači izdelki" },
  { key: "pri_hisi", labelKey: "UI.lg.offerGroup.priHisi", adminLabel: "Pri hiši" },
];

export const STAY_GROUPS: ReadonlyArray<SectionGroupDef> = [
  { key: "vase_bivanje", labelKey: "UI.lg.stayGroup.vaseBivanje", adminLabel: "Vaše bivanje" },
  { key: "prihod_dostop", labelKey: "UI.lg.stayGroup.prihodDostop", adminLabel: "Prihod in dostop" },
  { key: "prakticno", labelKey: "UI.lg.stayGroup.prakticno", adminLabel: "Praktično" },
];

/** Group set for the admin category editor, by section key. */
export function sectionGroupDefs(sectionKey: string | undefined): ReadonlyArray<SectionGroupDef> | null {
  if (sectionKey === "offer") return OFFER_GROUPS;
  if (sectionKey === "stay") return STAY_GROUPS;
  return null;
}

function visibleRows(rows: unknown): any[] {
  return Array.isArray(rows)
    ? rows.filter((row) => row?.isVisible !== false)
    : [];
}

export function populatedSectionGroups(
  categories: unknown,
  defs: ReadonlyArray<SectionGroupDef>,
) {
  const visibleCategories = visibleRows(categories);
  const known = new Set(defs.map((def) => def.key));
  const groupOf = (category: any) =>
    known.has(category?.exploreGroup) ? category.exploreGroup : defs[0]!.key;
  return defs.map((def) => {
    const groupCategories = visibleCategories.filter(
      (category) => groupOf(category) === def.key,
    );
    return {
      ...def,
      categories: groupCategories,
      items: groupCategories.flatMap((category) =>
        visibleRows(category.items).map((item) => ({ item, category })),
      ),
    };
  });
}
