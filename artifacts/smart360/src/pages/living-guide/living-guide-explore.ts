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
    adminLabel: "Aktivnosti",
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
  });
}

export type ExploreItemEntry = {
  item: Record<string, unknown>;
  category: Record<string, unknown>;
};

export type ExploreDistanceSection = {
  key: "near" | "excursion" | "unclassified";
  labelKey: "UI.lg.distanceGroup.near" | "UI.lg.distanceGroup.excursion" | null;
  items: ExploreItemEntry[];
};

export const EXPLORE_ALL_CATEGORY_KEY = "all";

export function activeExploreCategories(categories: unknown): any[] {
  return visibleRows(categories);
}

export function exploreItemsForCategory(
  categories: unknown,
  categoryId: string,
): ExploreItemEntry[] {
  const activeCategories = activeExploreCategories(categories);
  const selectedCategories =
    categoryId === EXPLORE_ALL_CATEGORY_KEY
      ? activeCategories
      : activeCategories.filter((category) => category.id === categoryId);

  return selectedCategories.flatMap((category) =>
    visibleRows(category.items).map((item) => ({ item, category })),
  );
}

const NEAR_DURATION_MINUTES = 20;
const NEAR_DISTANCE_METERS = 20_000;

function nonNegativeFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function localizedNumber(value: string): number | null {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function storedRoadDistanceMeters(item: Record<string, unknown>): number | null {
  const numeric = nonNegativeFinite(item.distanceMeters);
  if (numeric !== null) return numeric;
  if (typeof item.distance !== "string") return null;

  const normalized = item.distance.toLowerCase();
  const kilometers = normalized.match(/(\d+(?:[.,]\d+)?)\s*km\b/);
  if (kilometers?.[1]) {
    const value = localizedNumber(kilometers[1]);
    return value === null ? null : value * 1_000;
  }
  const meters = normalized.match(/(\d+(?:[.,]\d+)?)\s*m\b/);
  return meters?.[1] ? localizedNumber(meters[1]) : null;
}

export function storedTravelDurationMinutes(item: Record<string, unknown>): number | null {
  const seconds = nonNegativeFinite(item.travelDurationSeconds);
  if (seconds !== null) return seconds / 60;
  if (typeof item.duration !== "string") return null;

  const normalized = item.duration.toLowerCase();
  const hours = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours|ura|ure|ur|stunde|stunden|ora|ore)\b/,
  );
  const minutes = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(?:min|mins|minute|minutes|minuta|minute|minut|minuten|minuto|minuti)\b/,
  );
  if (!hours && !minutes) return null;
  const hourValue = hours?.[1] ? localizedNumber(hours[1]) : 0;
  const minuteValue = minutes?.[1] ? localizedNumber(minutes[1]) : 0;
  if (hourValue === null || minuteValue === null) return null;
  return hourValue * 60 + minuteValue;
}

function distanceRange(
  item: Record<string, unknown>,
): "near" | "excursion" | null {
  if (item.range === "near" || item.range === "excursion") {
    return item.range;
  }
  const durationMinutes = storedTravelDurationMinutes(item);
  if (durationMinutes !== null) {
    return durationMinutes <= NEAR_DURATION_MINUTES ? "near" : "excursion";
  }
  const distanceMeters = storedRoadDistanceMeters(item);
  if (distanceMeters !== null) {
    return distanceMeters <= NEAR_DISTANCE_METERS ? "near" : "excursion";
  }
  return null;
}

export function groupExploreItemsByDistance(
  entries: ExploreItemEntry[],
): ExploreDistanceSection[] {
  const indexed = entries.map((entry, index) => ({
    entry,
    index,
    range: distanceRange(entry.item),
    distanceMeters: storedRoadDistanceMeters(entry.item),
  }));
  const byDistance = (
    a: (typeof indexed)[number],
    b: (typeof indexed)[number],
  ) =>
    (a.distanceMeters ?? Number.POSITIVE_INFINITY) -
      (b.distanceMeters ?? Number.POSITIVE_INFINITY) ||
    a.index - b.index;
  const sections: ExploreDistanceSection[] = [];
  const near = indexed.filter((row) => row.range === "near").sort(byDistance);
  const excursion = indexed
    .filter((row) => row.range === "excursion")
    .sort(byDistance);
  const unclassified = indexed.filter((row) => row.range === null);

  if (near.length) {
    sections.push({
      key: "near",
      labelKey: "UI.lg.distanceGroup.near",
      items: near.map((row) => row.entry),
    });
  }
  if (excursion.length) {
    sections.push({
      key: "excursion",
      labelKey: "UI.lg.distanceGroup.excursion",
      items: excursion.map((row) => row.entry),
    });
  }
  if (unclassified.length) {
    sections.push({
      key: "unclassified",
      labelKey: null,
      items: unclassified.map((row) => row.entry),
    });
  }
  return sections;
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

/** Standing guest-copy rule, shared by all Living Guide card/detail surfaces. */
export function suppressesGuestDescription(category: any): boolean {
  return category?.exploreGroup === "food_drink" ||
    /\b(culinary|food|restaurant|gostil|restavr|hrana|pijača|shop|trgov|pharmacy|lekar|health|zdrav)\b/i
      .test(`${category?.key ?? ""} ${category?.label ?? ""}`);
}

export function exploreItemDescription(item: any, category?: any): string {
  if (suppressesGuestDescription(category)) return "";
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