export const EXPLORE_GROUPS = [
  {
    key: "experiences",
    labelKey: "UI.lg.exploreGroup.experiences",
    adminLabel: "Doživetja",
  },
  {
    key: "food_drink",
    labelKey: "UI.lg.exploreGroup.foodDrink",
    adminLabel: "Hrana in pijača",
  },
  {
    key: "nature_trails",
    labelKey: "UI.lg.exploreGroup.natureTrails",
    adminLabel: "Narava in poti",
  },
  {
    key: "sights",
    labelKey: "UI.lg.exploreGroup.sights",
    adminLabel: "Znamenitosti",
  },
  {
    key: "services",
    labelKey: "UI.lg.exploreGroup.services",
    adminLabel: "Storitve",
  },
] as const;

export type ExploreGroupKey = (typeof EXPLORE_GROUPS)[number]["key"];

export function isExploreGroupKey(value: unknown): value is ExploreGroupKey {
  return EXPLORE_GROUPS.some((group) => group.key === value);
}

function visibleRows(rows: unknown): any[] {
  return Array.isArray(rows)
    ? rows.filter((row) => row?.isVisible !== false)
    : [];
}

export function populatedExploreGroups(categories: unknown) {
  const visibleCategories = visibleRows(categories);
  return EXPLORE_GROUPS.map((group) => {
    const groupCategories = visibleCategories.filter(
      (category) => category.exploreGroup === group.key,
    );
    return {
      ...group,
      categories: groupCategories,
      items: groupCategories.flatMap((category) =>
        visibleRows(category.items).map((item) => ({
          item,
          category,
        })),
      ),
    };
  }).filter((group) => group.items.length > 0);
}

function stripMarkup(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|div|li)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function bodyText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((part): part is string => typeof part === "string")
        .map(stripMarkup)
        .filter(Boolean)
        .join(" ");
    }
  } catch {
    // Plain or rich text continues through the safe text-only path below.
  }
  return stripMarkup(value);
}

export function exploreItemDescription(item: any): string {
  const body = bodyText(item?.body);
  if (body) return body;
  if (typeof item?.noteText === "string" && item.noteText.trim()) {
    return stripMarkup(item.noteText);
  }
  if (Array.isArray(item?.bullets)) {
    return item.bullets
      .filter((bullet: unknown): bullet is string => typeof bullet === "string")
      .map(stripMarkup)
      .filter(Boolean)
      .join(" ");
  }
  return "";
}