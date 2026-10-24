const NAV_SECTION_KEYS = new Set(["stay", "offer", "explore"]);
const vis = (rows: any[] | null | undefined) =>
  (rows ?? []).filter(r => r?.isVisible !== false && !r?.deletedAt);
export type HomeSectionLink = { key: string; label: string; categoryCount: number };
/** Extra sections use the existing generic section grid, not extra nav slots. */
export function homeSectionLinks(sections: any[] | null | undefined): HomeSectionLink[] {
  const seen = new Set<string>();
  const out: HomeSectionLink[] = [];
  for (const s of vis(sections)) {
    if (!s?.key || NAV_SECTION_KEYS.has(s.key) || seen.has(s.key)) continue;
    const categories = vis(s.categories).filter(c => vis(c.items).length > 0 || c.layout === "events");
    if (!categories.length) continue;
    seen.add(s.key);
    out.push({ key:s.key, label:String(s.label ?? s.title ?? s.key), categoryCount:categories.length });
  }
  return out;
}
