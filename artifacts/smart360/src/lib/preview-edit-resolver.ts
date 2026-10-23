/**
 * Pure mapping from a clicked guest-preview element chain to an admin data
 * source. Admin-only: the guest app is never modified. The DOM bridge turns
 * real elements into `PreviewNode`s (data-testid, href, tag, React keys/props
 * ids); this module validates every candidate id against the tenant's own
 * content tree, so translated text labels are never used as identifiers.
 */

export type PreviewField = "title" | "body" | "bullets" | "media" | "price" | "phone";
export type AppearancePart = "hero" | "logo" | "cover";
export type ContactField = "phone" | "whatsapp" | "viber" | "instagram" | "email" | "address";

export type PreviewTarget =
  | { kind: "item"; id: string; categoryId: string; field: PreviewField | null }
  | { kind: "category"; id: string }
  | { kind: "section"; id: string }
  | { kind: "contact"; field: ContactField }
  | { kind: "weather" }
  | { kind: "wifi" }
  | { kind: "announcement"; id: string | null }
  | { kind: "appearance"; part: AppearancePart };

export type PreviewResolution = {
  target: PreviewTarget;
  label: string;
  /** false = no direct source; the nearest editable parent was chosen. */
  explicit: boolean;
  allowed: boolean;
  /** Index into the chain of the element that carries the source. */
  nodeIndex: number;
};

export type PreviewNode = {
  tag: string;
  testId?: string | null;
  href?: string | null;
  className?: string | null;
  isImage?: boolean;
  /** Element (or its owning component) renders the item's bullet rows. */
  bulletList?: boolean;
  /** Candidate ids from React keys/props; validated against the index. */
  ids?: string[];
  /** Candidate section keys (props.section.key). */
  sectionKeys?: string[];
};

export type ContentIndex = {
  items: Map<string, { categoryId: string; title: string; phone: string; hasBullets: boolean }>;
  categories: Map<string, { sectionId: string; label: string }>;
  sections: Map<string, { key: string; title: string }>;
  sectionByKey: Map<string, string>;
};

export type PreviewPermissions = {
  isOperator: boolean;
  canManageContent: boolean;
  /** Location fields (map link, coordinates, map query) — hidden for concierge. */
  canEditIdentity: boolean;
  /** Appearance tab (hero, logo, cover) — operator and self-service only. */
  canEditAppearance: boolean;
};

export type ResolveContext = {
  index: ContentIndex;
  contacts: { phone?: string | null };
  announcementIds: Set<string>;
  pathname: string;
  slug: string;
  permissions: PreviewPermissions;
  announcementsAvailable: boolean;
};

type RawSection = {
  id?: unknown; key?: unknown; title?: unknown;
  categories?: Array<{ id?: unknown; label?: unknown; items?: Array<{ id?: unknown; title?: unknown; phone?: unknown; bullets?: unknown }> }>;
};

export function buildContentIndex(sections: unknown): ContentIndex {
  const index: ContentIndex = { items: new Map(), categories: new Map(), sections: new Map(), sectionByKey: new Map() };
  for (const section of (Array.isArray(sections) ? sections : []) as RawSection[]) {
    if (typeof section?.id !== "string") continue;
    const key = typeof section.key === "string" ? section.key : "";
    index.sections.set(section.id, { key, title: typeof section.title === "string" ? section.title : key });
    if (key) index.sectionByKey.set(key, section.id);
    for (const category of section.categories ?? []) {
      if (typeof category?.id !== "string") continue;
      index.categories.set(category.id, { sectionId: section.id, label: typeof category.label === "string" ? category.label : "Kategorija" });
      for (const item of category.items ?? []) {
        if (typeof item?.id !== "string") continue;
        index.items.set(item.id, {
          categoryId: category.id,
          title: typeof item.title === "string" && item.title.trim() ? item.title : "Neimenovan vnos",
          phone: typeof item.phone === "string" ? item.phone : "",
          hasBullets: Array.isArray(item.bullets) && item.bullets.some((b) => typeof b === "string" && b.trim() !== ""),
        });
      }
    }
  }
  return index;
}

const digits = (value: string | null | undefined) => String(value ?? "").replace(/\D/g, "");

export function contactFieldFromHref(href: string | null | undefined): ContactField | null {
  if (!href) return null;
  const h = href.trim().toLowerCase();
  if (h.startsWith("tel:")) return "phone";
  if (h.startsWith("mailto:")) return "email";
  if (h.startsWith("viber:")) return "viber";
  if (h.includes("wa.me/") || h.includes("whatsapp.com") || h.startsWith("whatsapp:")) return "whatsapp";
  if (h.includes("instagram.com")) return "instagram";
  if (h.startsWith("geo:") || h.includes("google.com/maps") || h.includes("maps.google.") ||
      h.includes("maps.apple.com") || h.includes("goo.gl/maps") || h.includes("maps.app.goo.gl")) return "address";
  return null;
}

/** Guest route → nearest editable parent (category/item/section). */
export function routeTarget(pathname: string, slug: string, index: ContentIndex): PreviewTarget | null {
  const base = (pathname.split("?")[0] ?? "").split("/").filter(Boolean).map((part) => {
    try { return decodeURIComponent(part); } catch { return part; }
  });
  const at = base.indexOf(slug);
  const rest = at >= 0 ? base.slice(at + 1) : base;
  if (rest[0] === "c" && rest[1]) {
    if (rest[2] === "i" && rest[3] && index.items.has(rest[3])) {
      return { kind: "item", id: rest[3], categoryId: index.items.get(rest[3])!.categoryId, field: null };
    }
    if (index.categories.has(rest[1])) return { kind: "category", id: rest[1] };
  }
  if (rest[0] === "s" && rest[1]) {
    const id = index.sectionByKey.get(rest[1]);
    if (id) return { kind: "section", id };
  }
  return null;
}

const TITLE_CLASS = /(^|[-_\s])(title|name|heading|headline)([-_\s]|$)/;
const MEDIA_CLASS = /(^|[-_\s])(photo|media|gallery|img|image|picture|thumb)([-_\s]|$)/;
const BULLET_CLASS = /(bullet|lg2-step|rule-row|lg2-steps)/;

/**
 * Closest semantic target wins: nodes are walked from the clicked element
 * outwards and, per node, text semantics are checked before media, so a
 * title laid over a hero photo resolves to the title.
 */
export function fieldFromNodes(nodes: PreviewNode[], item: { phone: string; hasBullets: boolean }): PreviewField | null {
  // A paragraph inside a bullet row is a bullet: bullet containers win over
  // the generic text check, but only below the entry's own node.
  if (nodes.some((node) => node.bulletList || BULLET_CLASS.test((node.className ?? "").toLowerCase()))) {
    return item.hasBullets ? "bullets" : "body";
  }
  for (const node of nodes) {
    const cls = (node.className ?? "").toLowerCase();
    const tag = node.tag.toLowerCase();
    if (tag === "img" || tag === "video" || tag === "picture") return "media";
    if (node.href?.toLowerCase().startsWith("tel:") && item.phone && digits(node.href) === digits(item.phone)) return "phone";
    if (/price/.test(cls)) return "price";
    if (/^h[1-4]$/.test(tag) || TITLE_CLASS.test(cls)) return "title";
    if (tag === "li" || tag === "ul" || tag === "ol" || tag === "p" || /(body|rich|desc|text|prose)/.test(cls)) return "body";
    if (node.isImage || MEDIA_CLASS.test(cls)) return "media";
  }
  return null;
}

/** Home/cover elements without their own record → appearance settings. */
export function appearancePart(nodes: PreviewNode[]): { part: AppearancePart; direct: boolean } {
  for (const node of nodes) {
    const cls = `${node.className ?? ""} ${node.testId ?? ""}`.toLowerCase();
    if (/logo/.test(cls)) return { part: "logo", direct: true };
    if (/(hero|cover-photo|cover-tour)/.test(cls) || (node.isImage && /cover/.test(cls))) return { part: "hero", direct: node.tag === "IMG" || Boolean(node.isImage) };
    if (/(screen-cover|screen-simple-cover|lg2-cover)/.test(cls)) return { part: "cover", direct: false };
  }
  return { part: "cover", direct: false };
}

const FIELD_LABEL: Record<PreviewField, string> = {
  title: "naslov", body: "opis", bullets: "alineje", media: "fotografije", price: "cena", phone: "telefon",
};
const CONTACT_LABEL: Record<ContactField, string> = {
  phone: "Telefon", whatsapp: "WhatsApp", viber: "Viber", instagram: "Instagram", email: "E-pošta", address: "Naslov / lokacija",
};

export function targetLabel(target: PreviewTarget, index: ContentIndex): string {
  switch (target.kind) {
    case "item": {
      const title = index.items.get(target.id)?.title ?? "Vnos";
      return target.field ? `${title} · ${FIELD_LABEL[target.field]}` : title;
    }
    case "category": return `Kategorija ${index.categories.get(target.id)?.label ?? ""}`.trim();
    case "section": return `Sekcija ${index.sections.get(target.id)?.title ?? ""}`.trim();
    case "contact": return `Stik: ${CONTACT_LABEL[target.field]}`;
    case "weather": return "Vreme · lokacija";
    case "wifi": return "WiFi";
    case "announcement": return target.id ? "Obvestilo" : "Obvestila";
    case "appearance": return target.part === "logo" ? "Videz · logotip" : target.part === "hero" ? "Videz · naslovnica" : "Videz vodnika";
  }
}

/** Existing permission matrix: concierge → contact controls only. */
export function targetAllowed(target: PreviewTarget, p: PreviewPermissions, announcementsAvailable = true): boolean {
  if (target.kind === "appearance") return p.isOperator || p.canEditAppearance;
  if (target.kind === "weather" || (target.kind === "contact" && target.field === "address")) {
    return p.isOperator || p.canEditIdentity;
  }
  if (target.kind === "contact") return true;
  if (target.kind === "announcement") return announcementsAvailable && (p.isOperator || p.canManageContent);
  return p.isOperator || p.canManageContent;
}

function announcementFromTestId(testId: string, ctx: ResolveContext): PreviewTarget | null {
  const card = /^card-announcement-(.+)$/.exec(testId);
  if (card) return { kind: "announcement", id: ctx.announcementIds.has(card[1]!) ? card[1]! : null };
  if (/^(announcement-|announcements-|button-home-announcements|badge-announcement|dot-announcements)/.test(testId)) {
    return { kind: "announcement", id: null };
  }
  return null;
}

function idTarget(id: string, ctx: ResolveContext): PreviewTarget | null {
  // Program occurrences are keyed `${item.id}-${YYYY-MM-DD}`; strip the date.
  const clean = id.replace(/^(event|fallback|tile|cat|item|section)-/, "").replace(/^[csi]-/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "");
  const undated = id.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  const candidates = [id, undated, clean];
  for (const candidate of candidates) {
    const item = ctx.index.items.get(candidate);
    if (item) return { kind: "item", id: candidate, categoryId: item.categoryId, field: null };
  }
  for (const candidate of candidates) {
    if (ctx.index.categories.has(candidate)) return { kind: "category", id: candidate };
  }
  for (const candidate of candidates) {
    if (ctx.index.sections.has(candidate)) return { kind: "section", id: candidate };
    const byKey = ctx.index.sectionByKey.get(candidate);
    if (byKey) return { kind: "section", id: byKey };
  }
  return null;
}

const TILE_TESTID = /^(?:tile|program-card|order-cta)-(.+)$/;

/** Number of ancestors above the clicked element still treated as "direct". */
const DIRECT_DEPTH = 4;

export function resolvePreviewTarget(chain: PreviewNode[], ctx: ResolveContext): PreviewResolution | null {
  const finish = (target: PreviewTarget, explicit: boolean, nodeIndex: number): PreviewResolution => ({
    target,
    label: targetLabel(target, ctx.index),
    explicit,
    allowed: targetAllowed(target, ctx.permissions, ctx.announcementsAvailable),
    nodeIndex,
  });

  for (let i = 0; i < chain.length; i++) {
    const node = chain[i]!;
    const testId = node.testId ?? "";

    // 1. Contact links: tenant contact unless it is the entry's own phone.
    const contact = contactFieldFromHref(node.href);
    if (contact) {
      const isTenantPhone = contact !== "phone" || !ctx.contacts.phone || digits(node.href) === digits(ctx.contacts.phone);
      if (isTenantPhone) return finish({ kind: "contact", field: contact }, true, i);
    }

    // 2. Stable guest test ids.
    if (testId) {
      const announcement = announcementFromTestId(testId, ctx);
      if (announcement?.kind === "announcement") {
        return finish(announcement, announcement.id !== null || !/^card-announcement-/.test(testId), i);
      }
      if (/weather/.test(testId)) return finish({ kind: "weather" }, true, i);
      if (testId === "button-home-wifi") return finish({ kind: "wifi" }, true, i);
      const navKey = /^nav-(.+)$/.exec(testId)?.[1];
      const sectionId = navKey ? ctx.index.sectionByKey.get(navKey) : undefined;
      if (sectionId) return finish({ kind: "section", id: sectionId }, true, i);
    }

  }

  // 3. Record identity, deepest record first: an entry always wins over the
  //    category/section whose props wrap it (a card's own key may sit above
  //    composites that carry the parent category).
  for (let i = 0; i < chain.length; i++) {
    const tileId = TILE_TESTID.exec(chain[i]!.testId ?? "")?.[1];
    for (const id of [...(tileId ? [tileId] : []), ...(chain[i]!.ids ?? [])]) {
      if (ctx.announcementIds.has(id)) return finish({ kind: "announcement", id }, i <= DIRECT_DEPTH, i);
      const target = idTarget(id, ctx);
      if (target?.kind === "item") {
        const resolved = withField(target, chain.slice(0, i + 1), ctx);
        return finish(resolved, i <= DIRECT_DEPTH || (resolved.kind === "item" && resolved.field !== null), i);
      }
    }
  }

  // 4. Detail route is authoritative for its entry: anything on an entry
  //    detail screen belongs to that entry, never to its category.
  const route = routeTarget(ctx.pathname, ctx.slug, ctx.index);
  if (route?.kind === "item") {
    const resolved = withField(route, chain, ctx);
    return finish(resolved, resolved.kind === "item" && resolved.field !== null, 0);
  }

  for (let i = 0; i < chain.length; i++) {
    const node = chain[i]!;
    const simple = /^simple-section-(.+)$/.exec(node.testId ?? "");
    const simpleId = simple ? ctx.index.sectionByKey.get(simple[1]!) : undefined;
    if (simpleId) return finish({ kind: "section", id: simpleId }, i <= DIRECT_DEPTH, i);
    const tileId = TILE_TESTID.exec(node.testId ?? "")?.[1];
    for (const id of [...(tileId ? [tileId] : []), ...(node.ids ?? [])]) {
      const target = idTarget(id, ctx);
      if (target) return finish(target, i <= DIRECT_DEPTH, i);
    }
    for (const key of node.sectionKeys ?? []) {
      const id = ctx.index.sectionByKey.get(key);
      if (id) return finish({ kind: "section", id }, i <= DIRECT_DEPTH, i);
    }
  }

  // Route fallback: the category/section screen the guest is on.
  if (route) return finish(route, false, chain.length - 1);

  // 5. Nearest editable settings parent: guide appearance (hero/logo/cover).
  const appearance = appearancePart(chain);
  return finish({ kind: "appearance", part: appearance.part }, appearance.direct, 0);
}

function withField(target: PreviewTarget, nodes: PreviewNode[], ctx: ResolveContext): PreviewTarget {
  if (target.kind !== "item") return target;
  const item = ctx.index.items.get(target.id);
  return { ...target, field: fieldFromNodes(nodes, { phone: item?.phone ?? "", hasBullets: item?.hasBullets ?? false }) };
}

export function sameTarget(a: PreviewTarget | null, b: PreviewTarget | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function tooltipText(resolution: PreviewResolution | null): string {
  if (!resolution) return "Ni urejljivega vira";
  if (!resolution.allowed) return `${resolution.label} — v vašem načinu upravljanja ni na voljo`;
  return resolution.explicit
    ? `Uredi: ${resolution.label}`
    : `Uredi nadrejeni: ${resolution.label} (element nima lastnega vira)`;
}
