// Pure model: builds the Enostaven one-page tile structure from the tenant's
// actual published sections/categories plus runtime features. No hardcoded
// category list — only runtime features (notices, weather, SOS…) are fixed.
import type { SimpleIconKey } from "./simple-icons";
import { resolveCategoryTileIcon } from "@workspace/category-icons";
import { simpleCopy, type SimpleCopyKey } from "./simple-copy";
import { normalizeSystemTileVisibility } from "../system-tile-visibility";
import { programHomeLabel } from "../living-guide-program-model";

export type SimpleTileAction =
  | { kind: "category"; categoryId: string }
  | { kind: "notices" } | { kind: "weather" } | { kind: "sos" } | { kind: "contact" }
  | { kind: "program" } | { kind: "install" } | { kind: "about" } | { kind: "orders" } | { kind: "record" }
  | { kind: "map"; href: string | null; siteMap: boolean } | { kind: "messages" };

export type SimpleTile = { id: string; label: string; icon: SimpleIconKey; action: SimpleTileAction };
export type SimpleSection = { key: string; title: string; tiles: SimpleTile[] };

export type SimpleRuntime = {
  hasWeather: boolean;
  hasContact: boolean;
  installAvailable: boolean;
  hasOrderable: boolean;
  recordingEnabled: boolean;
  mapHref: string | null;
  /** Tenant has the existing in-app map view (site plan); preferred over the external link. */
  hasSiteMap?: boolean;
  /** Per-tenant system tile visibility; absent keys default to visible. */
  systemTileVisibility?: unknown;
  /** House programme has guest-visible published upcoming occurrences. */
  hasProgram?: boolean;
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

  const shown = normalizeSystemTileVisibility(rt.systemTileVisibility);
  const home: SimpleTile[] = ([
    { id: "notices", label: L("notices"), icon: "bell", action: { kind: "notices" } },
    ...(rt.hasWeather ? [{ id: "weather", label: L("weather"), icon: "weather" as const, action: { kind: "weather" } as const }] : []),
    ...(rt.hasProgram ? [{ id: "program", label: programHomeLabel(lang), icon: "calendar" as const, action: { kind: "program" } as const }] : []),
    { id: "sos", label: L("sos"), icon: "sos", action: { kind: "sos" } },
    ...(rt.hasContact ? [{ id: "contact", label: L("contact"), icon: "phone" as const, action: { kind: "contact" } as const }] : []),
    ...(rt.installAvailable ? [{ id: "install", label: L("install"), icon: "install" as const, action: { kind: "install" } as const }] : []),
    { id: "about", label: L("about"), icon: "info", action: { kind: "about" } },
  ] as SimpleTile[]).filter((tile) => shown[tile.id as keyof typeof shown] !== false);
  const offer = [
    ...(rt.hasOrderable ? [{ id: "orders", label: L("orders"), icon: "order" as const, action: { kind: "orders" } as const }] : []),
  ];
  const explore = [
    ...(rt.recordingEnabled ? [{ id: "record", label: L("record"), icon: "record" as const, action: { kind: "record" } as const }] : []),
    ...(rt.hasSiteMap || rt.mapHref ? [{ id: "map", label: L("map"), icon: "pin" as const, action: { kind: "map", href: rt.mapHref, siteMap: Boolean(rt.hasSiteMap) } as const }] : []),
  ];
  const titles: Record<string, SimpleCopyKey> = { stay:"stay", offer:"offer", explore:"explore" };
  const content: SimpleSection[] = vis(sections).map(s => ({
    key:s.key,
    title:titles[s.key] ? L(titles[s.key]) : String(s.label ?? s.title ?? s.key),
    tiles:[...categoryTiles(s), ...(s.key === "offer" ? offer : []), ...(s.key === "explore" ? explore : [])],
  }));
  if (!content.some(s => s.key === "offer") && offer.length) content.push({key:"offer",title:L("offer"),tiles:offer});
  if (!content.some(s => s.key === "explore") && explore.length) content.push({key:"explore",title:L("explore"),tiles:explore});

  const out: SimpleSection[] = [
    { key: "home", title: L("home"), tiles: home },
    ...content,
    { key: "messages", title: L("messages"), tiles: [{ id: "messages", label: L("messages"), icon: "chat", action: { kind: "messages" } }] },
  ];
  return out.filter((s) => s.tiles.length > 0);
}

/** Same precedence as the Living Guide admin: its own hero first, then the tenant hero. */
export function simpleHeroUrl(tenant: any): string | null {
  return tenant?.livingGuideHeroUrl || tenant?.heroUrl || null;
}
