import {
  findDatedEventDestination,
  itemEventTimestamp,
} from "./living-guide-nav-resolver";

const FALLBACK_CATEGORY_LABELS = new Set([
  "kolesarjenje",
  "pohodništvo",
  "izleti",
  "kulturna dediščina",
  "naravna dediščina",
]);

function visible<T extends { isVisible?: boolean; deletedAt?: unknown }>(
  rows: T[] | null | undefined,
): T[] {
  return (rows ?? []).filter(
    (row) => row.isVisible !== false && !row.deletedAt,
  );
}

function normalizedLabel(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase("sl")
    : "";
}

function firstImage(media: any[] | null | undefined): any | null {
  return (
    (media ?? []).find(
      (entry) =>
        entry?.kind === "image" ||
        (entry?.kind == null && typeof entry?.url === "string"),
    ) ?? null
  );
}

export function resolveHomeHeroMedia(
  livingGuideHeroUrl: unknown,
  sections: any[] | null | undefined,
): any | null {
  if (
    typeof livingGuideHeroUrl === "string" &&
    livingGuideHeroUrl.trim().length > 0
  ) {
    return { kind: "image", url: livingGuideHeroUrl.trim() };
  }

  for (const section of visible<any>(sections)) {
    for (const category of visible<any>(section.categories)) {
      for (const item of visible<any>(category.items)) {
        const image = firstImage(item.media);
        if (image) return image;
      }
    }
  }
  return null;
}

export type HomeTodayEntry = {
  id: string;
  categoryId: string;
  categoryLabel: string;
  detail: string;
  item: any;
  media: any | null;
  sortValue: number;
};

function usefulDetail(item: any): string {
  return [item?.distance, item?.duration]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .map((value) => value.trim())
    .join(" · ");
}

function isSameLocalDay(timestamp: number, now: Date): boolean {
  const date = new Date(timestamp);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function selectHomeTodayEntries(
  sections: any[] | null | undefined,
  now = new Date(),
): { hasProgramme: boolean; entries: HomeTodayEntry[] } {
  const visibleSections = visible<any>(sections);
  const hasProgramme = findDatedEventDestination(visibleSections) !== null;
  const entries: HomeTodayEntry[] = [];

  for (const section of visibleSections) {
    for (const category of visible<any>(section.categories)) {
      const categoryLabel =
        typeof category.label === "string" ? category.label.trim() : "";
      const isProgrammeSurface =
        category.layout === "events" ||
        section.key === "events" ||
        section.key === "program";

      for (const item of visible<any>(category.items)) {
        const detail = usefulDetail(item);
        if (!detail) continue;

        if (hasProgramme) {
          if (!isProgrammeSurface) continue;
          const timestamp = itemEventTimestamp(item);
          if (timestamp === null || !isSameLocalDay(timestamp, now)) continue;
          entries.push({
            id: `event-${item.id}`,
            categoryId: category.id,
            categoryLabel,
            detail,
            item,
            media: firstImage(item.media),
            sortValue: timestamp,
          });
          continue;
        }

        if (!FALLBACK_CATEGORY_LABELS.has(normalizedLabel(categoryLabel))) {
          continue;
        }
        entries.push({
          id: `fallback-${item.id}`,
          categoryId: category.id,
          categoryLabel,
          detail,
          item,
          media: firstImage(item.media),
          sortValue:
            typeof item.distanceMeters === "number"
              ? item.distanceMeters
              : Number.POSITIVE_INFINITY,
        });
      }
    }
  }

  entries.sort((a, b) => a.sortValue - b.sortValue);
  return { hasProgramme, entries };
}