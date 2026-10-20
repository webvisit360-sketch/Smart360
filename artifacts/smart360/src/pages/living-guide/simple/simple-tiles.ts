// Pure model: builds the Enostaven one-page tile structure from the tenant's
// actual published sections/categories plus runtime features. No hardcoded
// category list — only runtime features (notices, weather, SOS…) are fixed.
import type { SimpleIconKey } from "./simple-icons";
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

const RULES: [RegExp, SimpleIconKey][] = [
  [/welcome|dobrodo|willkommen|benvenut|bienvenue|welkom|dobrodoš/, "house"],
  [/wi-?fi|wlan/, "wifi"],
  [/park/, "parking"],
  [/door|vrata|entrance|vhod/, "door"],
  [/klim|air ?con|\bac\b|aircon/, "ac"],
  [/check|prijava|odjava/, "clock"],
  [/rule|red\b|hišni|house-?rules/, "doc"],
  [/instruct|navodil|appliance|manual/, "gear"],
  [/apartm|appart|ferienwohn/, "bed"],
  [/room|sob|accommod|nastanit|units?/, "building"],
  [/beach|plaž|strand|spiagg|plage/, "beach"],
  [/hike|pohod|walk|wander/, "hike"],
  [/bike|kolo|kolesar|cycl/, "bike"],
  [/trip|izlet|excurs|ausflug/, "trips"],
  [/program|event|dogod/, "calendar"],
  [/sight|znamenit|attract|poi/, "mountain"],
  [/local|domač|product|izdelk|farm/, "bag"],
];

export function simpleCategoryIcon(category: any, sectionKey: string): SimpleIconKey {
  // Explicit button names take precedence over generic/stale category keys.
  const label = (category?.label ?? category?.title ?? "").trim().toLowerCase();
  if (/^apartmaji$|^apartments$|^appartamenti$|^appartements$|^appartementen$|^apartmani$|^ferienwohnungen$/.test(label)) return "bed";
  if (/^nastanitev$/.test(label)) return "building";
  if (/^vhodna vrata$/.test(label)) return "door";
  if (/^domači izdelki$/.test(label)) return "bag";
  const hay = `${category?.key ?? ""} ${category?.label ?? category?.title ?? ""}`.toLowerCase();
  if (category?.layout === "wifi") return "wifi";
  if (category?.layout === "events") return "calendar";
  for (const [re, icon] of RULES) if (re.test(label)) return icon;
  for (const [re, icon] of RULES) if (re.test(hay)) return icon;
  if (category?.layout === "apartments") return "bed";
  if (category?.layout === "routes") return "hike";
  if (category?.layout === "products") return sectionKey === "offer" ? "cart" : "bag";
  if (sectionKey === "offer") return "cart";
  if (sectionKey === "explore" || sectionKey === "services") return "pin";
  return "doc";
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
