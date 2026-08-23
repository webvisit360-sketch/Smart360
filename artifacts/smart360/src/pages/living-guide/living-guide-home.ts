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
  "cycling",
  "hiking",
  "day trips",
  "heritage",
  "nature",
  "radfahren",
  "wandern",
  "ausflüge",
  "kulturerbe",
  "naturerbe",
  "in bicicletta",
  "escursioni a piedi",
  "gite",
  "patrimonio culturale",
  "patrimonio naturale",
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

const HOME_EXCERPT_LIMIT = 72;

function plainText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function shortExcerpt(item: any): string {
  const candidates = [
    item?.body,
    item?.noteText,
    ...(Array.isArray(item?.bullets) ? item.bullets : []),
  ];
  const source = candidates.map(plainText).find(Boolean) ?? "";
  if (source.length <= HOME_EXCERPT_LIMIT) return source;

  const clipped = source.slice(0, HOME_EXCERPT_LIMIT - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  const boundary = lastSpace >= HOME_EXCERPT_LIMIT / 2 ? lastSpace : clipped.length;
  return `${clipped.slice(0, boundary).trimEnd()}…`;
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

function cardDetail(item: any): string {
  return [item?.distance, item?.duration, shortExcerpt(item)]
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
        const title =
          typeof item?.title === "string" ? item.title.trim() : "";
        const media = firstImage(item.media);
        if (!title || !media) continue;
        const detail = cardDetail(item);

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
            media,
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
          media,
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