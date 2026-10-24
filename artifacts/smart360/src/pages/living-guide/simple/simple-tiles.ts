// Pure model: builds the Enostaven one-page tile structure from the tenant's
// actual published sections/categories plus runtime features. No hardcoded
// category list — only runtime features (notices, weather, SOS…) are fixed.
import type { SimpleIconKey } from "./simple-icons";
import { resolveCategoryTileIcon } from "@workspace/category-icons";
import { simpleCopy, type SimpleCopyKey } from "./simple-copy";

export type SimpleTileAction =
  | { kind: "category"; categoryId: string }
  | { kind: "notices" } | { kind: "weather" } | { kind: "sos" } | { kind: "contact" }
  | { kind: "install" } | { kind: "about" } | { kind: "orders" } | { kind: "record" }
  | { kind: "map"; href: string | null; siteMap: boolean } | { kind: "messages" };

export type SimpleTile = { id: string; label: string; icon: SimpleIconKey; action: SimpleTileAction };
export type SimpleSection = { key: "home" | "stay" | "offer" | "explore" | "messages"; title: string; tiles: SimpleTile[] };

export type SimpleRuntime = {
  hasWeather: boolean;
  hasContact: boolean;
  installAvailable: boolean;
  hasOrderable: boolean;
  recordingEnabled: boolean;
  mapHref: string | null;
  /** Tenant has the existing in-app map view (site plan); preferred over the external link. */
  hasSiteMap?: boolean;
};

/**
 * Label font size (px) so long labels in all 7 languages fit in at most three
 * lines without clipping: the icon shrinks (flex) and the text gets smaller.
 */
export function simpleLabelSize(label: string): number {
  const longestWord = Math.max(0, ...label.split(/[\s/-]+/).map((w) => w.length));
  if (label.length > 30 || longestWord > 13) return 8;
  if (label.length > 20 || longestWord > 11) return 9;
  return 10;
}

const vis = (rows: any[] | null | undefined) => (rows ?? []).filter((r) => r?.isVisible !== false);

export function simpleCategoryIcon(category: any, sectionKey: string): SimpleIconKey {
  return resolveCategoryTileIcon(category ?? {}, sectionKey).icon as SimpleIconKey;
}

function categoryTiles(section: any): SimpleTile[] {
  return vis(section?.categories)
    .filter((c) => vis(c.items).length > 0 || c.layout === "events")
    .map((c) => ({
      id: `c-${c.id}`,
      label: String(c.label ?? c.title ?? ""),
      icon: simpleCategoryIcon(c, section.key),
      action: { kind: "category", categoryId: c.id } as SimpleTileAction,
    }));
}

export function buildSimpleSections(sections: any[], lang: string, rt: SimpleRuntime): SimpleSection[] {
  const L = (k: SimpleCopyKey) => simpleCopy(k, lang);
  const byKey = (k: string) => vis(sections).filter((s) => s.key === k);

  const home: SimpleTile[] = [
    { id: "notices", label: L("notices"), icon: "bell", action: { kind: "notices" } },
    ...(rt.hasWeather ? [{ id: "weather", label: L("weather"), icon: "weather" as const, action: { kind: "weather" } as const }] : []),
    { id: "sos", label: L("sos"), icon: "sos", action: { kind: "sos" } },
    ...(rt.hasContact ? [{ id: "contact", label: L("contact"), icon: "phone" as const, action: { kind: "contact" } as const }] : []),
    ...(rt.installAvailable ? [{ id: "install", label: L("install"), icon: "install" as const, action: { kind: "install" } as const }] : []),
    { id: "about", label: L("about"), icon: "info", action: { kind: "about" } },
  ];
  const stay = byKey("stay").flatMap(categoryTiles);
  const offer = [
    ...byKey("offer").flatMap(categoryTiles),
    ...(rt.hasOrderable ? [{ id: "orders", label: L("orders"), icon: "order" as const, action: { kind: "orders" } as const }] : []),
  ];
  const explore = [
    ...byKey("explore").flatMap(categoryTiles),
    ...byKey("services").flatMap(categoryTiles),
    ...(rt.recordingEnabled ? [{ id: "record", label: L("record"), icon: "record" as const, action: { kind: "record" } as const }] : []),
    ...(rt.hasSiteMap || rt.mapHref ? [{ id: "map", label: L("map"), icon: "pin" as const, action: { kind: "map", href: rt.mapHref, siteMap: Boolean(rt.hasSiteMap) } as const }] : []),
  ];
  // Any further published section keeps its own tiles under Okolica so no
  // existing content becomes unreachable without a bottom nav.
  const known = new Set(["stay", "offer", "explore", "services"]);
  const other = vis(sections).filter((s) => !known.has(s.key)).flatMap(categoryTiles);

  const out: SimpleSection[] = [
    { key: "home", title: L("home"), tiles: home },
    { key: "stay", title: L("stay"), tiles: stay },
    { key: "offer", title: L("offer"), tiles: offer },
    { key: "explore", title: L("explore"), tiles: [...explore, ...other] },
    { key: "messages", title: L("messages"), tiles: [{ id: "messages", label: L("messages"), icon: "chat", action: { kind: "messages" } }] },
  ];
  return out.filter((s) => s.tiles.length > 0);
}

/** Same precedence as the Living Guide admin: its own hero first, then the tenant hero. */
export function simpleHeroUrl(tenant: any): string | null {
  return tenant?.livingGuideHeroUrl || tenant?.heroUrl || null;
}
