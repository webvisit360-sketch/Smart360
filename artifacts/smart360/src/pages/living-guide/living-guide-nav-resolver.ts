export type NavItem = "home" | "stay" | "offer" | "explore" | "program" | "messages";

export interface NavState {
  resolved: NavItem[];
  omitted: NavItem[];
  hasSiteMap: boolean;
}

export function shouldShowLivingGuideBottomNav(screen: string): boolean {
  return screen !== "cover" && screen !== "site-map";
}

function visible<T extends { isVisible?: boolean; deletedAt?: unknown }>(
  rows: T[] | null | undefined,
): T[] {
  return (rows ?? []).filter(
    (row) => row.isVisible !== false && !row.deletedAt,
  );
}

export function itemEventTimestamp(item: Record<string, unknown>): number | null {
  const value =
    item.eventStart ??
    item.startsAt ??
    item.startAt ??
    item.startDate ??
    null;
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function findDatedEventDestination(
  sections: any[] | null | undefined,
): { section: any; category: any } | null {
  for (const section of visible<any>(sections)) {
    for (const category of visible<any>(section.categories)) {
      const isEventSurface =
        category.layout === "events" ||
        section.key === "events" ||
        section.key === "program";
      if (
        isEventSurface &&
        visible<any>(category.items).some(
          (item: Record<string, unknown>) => itemEventTimestamp(item) !== null,
        )
      ) {
        return { section, category };
      }
    }
  }
  return null;
}

function sectionHasRenderableContent(section: any): boolean {
  return visible<any>(section?.categories).some(
    (category: any) => visible<any>(category?.items).length > 0,
  );
}

export function getLivingGuideAvailableFeatures(
  sections: any[] | null | undefined,
): Set<NavItem> {
  const available = new Set<NavItem>(["home", "messages"]);
  const visibleSections = visible<any>(sections);

  if (
    visibleSections.some(
      (section: any) =>
        section.key === "stay" && sectionHasRenderableContent(section),
    )
  ) {
    available.add("stay");
  }
  if (
    visibleSections.some(
      (section: any) =>
        section.key === "offer" && sectionHasRenderableContent(section),
    )
  ) {
    available.add("offer");
  }
  if (
    visibleSections.some(
      (section: any) =>
        (section.key === "explore" || section.key === "services") &&
        sectionHasRenderableContent(section),
    )
  ) {
    available.add("explore");
  }
  if (findDatedEventDestination(visibleSections)) {
    available.add("program");
  }

  return available;
}

export function resolveLivingGuideNav(
  storedNav: NavItem[] | null | undefined,
  validFeatures: Set<NavItem>,
  hasSitePlanImages: boolean
): NavState {
  const PRESET_MELI_PU: NavItem[] = ["home", "stay", "offer", "explore", "messages"];
  const allPossible: NavItem[] = ["home", "stay", "offer", "explore", "program", "messages"];

  // Actual valid ensures we don't accidentally consider a feature valid if it's not known
  const actualValid = allPossible.filter(f => validFeatures.has(f) || f === "home" || f === "messages");

  let baseNav: NavItem[] = storedNav ? [...storedNav] : PRESET_MELI_PU;

  // Enforce "home" is always first and present exactly once
  baseNav = baseNav.filter(item => item !== "home");
  baseNav.unshift("home");

  // Keep only valid, unique entries. De-duplicating before backfill means a
  // malformed legacy value cannot accidentally leave the bar below five slots.
  let resolved = Array.from(
    new Set(baseNav.filter(item => actualValid.includes(item))),
  );

  // If we have fewer than 5 slots and there are valid features left, backfill them
  if (resolved.length < 5 && actualValid.length > resolved.length) {
    for (const feat of actualValid) {
      if (!resolved.includes(feat)) {
        resolved.push(feat);
        if (resolved.length === 5) break;
      }
    }
  }

  resolved = resolved.slice(0, 5);

  const omitted = actualValid.filter(f => !resolved.includes(f));

  return {
    resolved,
    omitted,
    hasSiteMap: hasSitePlanImages
  };
}