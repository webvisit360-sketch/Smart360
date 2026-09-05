import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  tenantsTable,
  sectionsTable,
  categoriesTable,
  itemsTable,
  itemCategoryAttachmentsTable,
  itemDistanceProposalsTable,
  mediaTable,
  translationsTable,
  type Tenant,
  type Section,
  type Category,
  type Item,
  type MediaRow,
} from "@workspace/db";

/**
 * The three content scopes. These are the ONLY visibility rules:
 * - guestScope: what guests see — published AND not soft-deleted.
 * - adminScope: what the admin lists show — everything not soft-deleted,
 *   INCLUDING hidden entries (rendered greyed out with a "Skrito" badge),
 *   otherwise a hidden category could never be switched back on.
 * - trashScope: only soft-deleted rows — the "Nedavno izbrisano" list.
 */
type Scoped = { isVisible: boolean; deletedAt?: Date | null };

export function guestScope(row: Scoped): boolean {
  return row.isVisible && !row.deletedAt;
}

export function adminScope(row: { deletedAt?: Date | null }): boolean {
  return !row.deletedAt;
}

export function trashScope(row: { deletedAt?: Date | null }): boolean {
  return !!row.deletedAt;
}

export type SitePlanImageEntry = {
  id: string;
  tenantId: string | null;
  url: string;
  caption: string | null;
  position: number;
  width: number | null;
  height: number | null;
};

// latitude/longitude/resolvedAddress come from the APPROVED distance proposal
// (if any): guests need the reviewed point and address so the Maps action
// opens the exact NAMED place instead of an ambiguous search or a bare pin.
export type ItemWithMedia = Item & {
  // Raw provenance (including the upstream download URL) is operator audit
  // data, never guest content. Attribution fields remain public.
  media: Array<Omit<MediaRow, "provenanceJson" | "provenanceProvider" | "provenanceFile">>;
  latitude: number | null;
  longitude: number | null;
  resolvedAddress: string | null;
};
export type CategoryContent = Category & { items: ItemWithMedia[] };
export type SectionContent = Section & { categories: CategoryContent[] };
export type TenantContentTree = Omit<Tenant, "orderPassword"> & {
  orderPasswordConfigured: boolean;
  sections: SectionContent[];
  sitePlanImages: SitePlanImageEntry[];
};

function indexedBodyParts(body: unknown): string[] | null {
  if (typeof body !== "string" || body.trim() === "") return null;

  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed) && parsed.every((part) => typeof part === "string")) {
      return [...parsed];
    }
  } catch {
    /* Normalized rich text is stored as consecutive HTML paragraphs. */
  }

  const parts: string[] = [];
  const paragraph = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi;
  let cursor = 0;
  for (const match of body.matchAll(paragraph)) {
    const index = match.index ?? 0;
    if (body.slice(cursor, index).trim() !== "") return null;
    parts.push(match[1]);
    cursor = index + match[0].length;
  }

  return parts.length > 0 && body.slice(cursor).trim() === "" ? parts : null;
}

function hasMeaningfulContent(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasMeaningfulContent);
  if (typeof value !== "string") return value != null;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.some(hasMeaningfulContent);
  } catch {
    // Plain or rich text continues below.
  }
  return trimmed
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim().length > 0;
}

export function applyTranslationFields<T extends { id: string }>(
  row: T,
  translations: Record<string, string>,
): T {
  const merged: Record<string, unknown> = { ...row };
  // Sub-indexed fields ("body[3]", "bullets[2]") patch one element of the
  // source array. Rich-text bodies may now be normalized HTML paragraphs
  // rather than their original JSON array, so recover those paragraph slots
  // before applying translations. A missing translation keeps the source
  // paragraph and never creates an empty block.
  let bodyArr: string[] | null = null;
  let bulletsArr: string[] | null = null;
  for (const [field, value] of Object.entries(translations)) {
    if (!hasMeaningfulContent(value)) continue;
    const sub = field.match(/^(body|bullets)\[(\d+)\]$/);
    if (sub) {
      const idx = Number(sub[2]);
      if (sub[1] === "body") {
        if (!bodyArr) bodyArr = indexedBodyParts(merged["body"]);
        if (!bodyArr) bodyArr = [];
        if (idx >= bodyArr.length) bodyArr.length = idx + 1;
        bodyArr[idx] = value;
      } else {
        const src = merged["bullets"];
        if (!bulletsArr && Array.isArray(src)) bulletsArr = [...src];
        if (bulletsArr && idx < bulletsArr.length) bulletsArr[idx] = value;
      }
      continue;
    }
    if (field in merged) merged[field] = value;
  }
  if (bodyArr) merged["body"] = JSON.stringify(bodyArr);
  if (bulletsArr) merged["bullets"] = bulletsArr;
  return merged as T;
}

export async function buildTenantContent(
  tenant: Tenant,
  opts: { visibleOnly: boolean; lang?: string | undefined },
): Promise<TenantContentTree> {
  const sections = await db
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.tenantId, tenant.id))
    .orderBy(asc(sectionsTable.position));

  const sectionIds = sections.map((s) => s.id);
  const categories = sectionIds.length
    ? await db
        .select()
        .from(categoriesTable)
        .where(inArray(categoriesTable.sectionId, sectionIds))
        .orderBy(asc(categoriesTable.position))
    : [];

  const categoryIds = categories.map((c) => c.id);
  const attachments = categoryIds.length
    ? await db.select().from(itemCategoryAttachmentsTable)
        .where(inArray(itemCategoryAttachmentsTable.categoryId, categoryIds))
    : [];
  const items = categoryIds.length
    ? await db
        .select()
        .from(itemsTable)
        .where(inArray(itemsTable.categoryId, categoryIds))
        .orderBy(asc(itemsTable.position))
    : [];

  const itemIds = items.map((i) => i.id);
  const media = itemIds.length
    ? await db
        .select()
        .from(mediaTable)
        .where(inArray(mediaTable.itemId, itemIds))
        .orderBy(asc(mediaTable.position))
    : [];

  let tenantOut: Tenant = tenant;
  let sectionsOut = sections;
  let categoriesOut = categories;
  let itemsOut = items;

  const lang = opts.lang?.toLowerCase();
  if (lang) {
    const recordIds = [
      tenant.id,
      ...sectionIds,
      ...categoryIds,
      ...itemIds,
    ];
    const translations = recordIds.length
      ? await db
          .select()
          .from(translationsTable)
          .where(inArray(translationsTable.recordId, recordIds))
      : [];
    const fallbackByRecord = new Map<string, Record<string, string>>();
    const requestedByRecord = new Map<string, Record<string, string>>();
    const fallbackPriority = ["en", "de", "it"];
    for (const t of [...translations].sort(
      (a, b) =>
        fallbackPriority.indexOf(a.lang.toLowerCase()) -
        fallbackPriority.indexOf(b.lang.toLowerCase()),
    )) {
      if (!hasMeaningfulContent(t.value)) continue;
      const target =
        t.lang.toLowerCase() === lang ? requestedByRecord : fallbackByRecord;
      const rec = target.get(t.recordId) ?? {};
      if (!(t.field in rec)) rec[t.field] = t.value;
      target.set(t.recordId, rec);
    }
    const apply = <T extends { id: string }>(row: T): T => {
      const fallback = fallbackByRecord.get(row.id) ?? {};
      const source = row as Record<string, unknown>;
      const neededFallback = Object.fromEntries(
        Object.entries(fallback).filter(([field]) => {
          const base = field.replace(/\[\d+\]$/, "");
          const value = source[base];
          return !hasMeaningfulContent(value);
        }),
      );
      const withFallback = applyTranslationFields(row, neededFallback);
      const requested = requestedByRecord.get(row.id);
      return requested
        ? applyTranslationFields(withFallback, requested)
        : withFallback;
    };
    tenantOut = apply(tenant);
    sectionsOut = sections.map(apply);
    categoriesOut = categories.map(apply);
    itemsOut = items.map(apply);
  }

  if (opts.visibleOnly) {
    // Guest queries: published AND not deleted, at every level.
    sectionsOut = sectionsOut.filter((s) => guestScope(s));
    categoriesOut = categoriesOut.filter((c) => guestScope(c));
    itemsOut = itemsOut.filter((i) => guestScope(i));
  } else {
    // Admin tree: hidden entries stay visible (greyed, "Skrito"); only
    // soft-deleted rows are excluded — they live in the trash list.
    categoriesOut = categoriesOut.filter(adminScope);
    itemsOut = itemsOut.filter(adminScope);
  }

  // Fetch site-plan images for this tenant (ordered, image-only, tenant-scoped).
  const sitePlanRows = await db
    .select()
    .from(mediaTable)
    .where(
      and(
        eq(mediaTable.tenantId, tenant.id),
        eq(mediaTable.purpose, "site-plan"),
        isNull(mediaTable.itemId),
      ),
    )
    .orderBy(asc(mediaTable.position));

  const sitePlanImages: SitePlanImageEntry[] = sitePlanRows.map((row) => ({
    id: row.id,
    tenantId: row.tenantId ?? null,
    url: row.url,
    caption: row.alt ?? null,
    position: row.position,
    width: row.width ?? null,
    height: row.height ?? null,
  }));

  // Approved review coordinates, keyed by item. Only approved proposals may
  // reach guests — pending/failed candidates stay admin-only.
  const approvedCoords = itemIds.length
    ? await db
        .select({
          itemId: itemDistanceProposalsTable.itemId,
          latitude: itemDistanceProposalsTable.latitude,
          longitude: itemDistanceProposalsTable.longitude,
          resolvedAddress: itemDistanceProposalsTable.resolvedAddress,
        })
        .from(itemDistanceProposalsTable)
        .where(
          and(
            inArray(itemDistanceProposalsTable.itemId, itemIds),
            eq(itemDistanceProposalsTable.status, "approved"),
          ),
        )
    : [];
  const coordsByItem = new Map(
    approvedCoords.map((p) => [p.itemId, p] as const),
  );

  const mediaByItem = new Map<string, Array<Omit<MediaRow, "provenanceJson" | "provenanceProvider" | "provenanceFile">>>();
  for (const m of media) {
    if (!m.itemId) continue;
    const arr = mediaByItem.get(m.itemId) ?? [];
    const {
      provenanceJson: _provenanceJson,
      provenanceProvider: _provenanceProvider,
      provenanceFile: _provenanceFile,
      ...attributionSafe
    } = m;
    arr.push(attributionSafe);
    mediaByItem.set(m.itemId, arr);
  }
  const itemsByCategory = new Map<string, ItemWithMedia[]>();
  const addToCategory = (i: typeof itemsOut[number], categoryId: string) => {
    const arr = itemsByCategory.get(categoryId) ?? [];
    if (arr.some((row) => row.id === i.id)) return;
    const coords = coordsByItem.get(i.id);
    arr.push({
      ...i,
      // Existing consumers understand categoryId. An attached projection
      // therefore reports the category through which it was reached.
      categoryId,
      media: mediaByItem.get(i.id) ?? [],
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      resolvedAddress: coords?.resolvedAddress?.trim() || null,
    });
    itemsByCategory.set(categoryId, arr);
  };
  for (const i of itemsOut) {
    addToCategory(i, i.categoryId);
    for (const attachment of attachments) {
      if (attachment.itemId === i.id) addToCategory(i, attachment.categoryId);
    }
  }
  const categoriesBySection = new Map<string, CategoryContent[]>();
  for (const c of categoriesOut) {
    const arr = categoriesBySection.get(c.sectionId) ?? [];
    arr.push({ ...c, items: itemsByCategory.get(c.id) ?? [] });
    categoriesBySection.set(c.sectionId, arr);
  }
  const orderPasswordConfigured = Boolean(tenantOut.orderPassword?.trim());
  const { orderPassword: _orderPassword, ...safeTenant } = tenantOut;

  return {
    ...safeTenant,
    orderPasswordConfigured,
    sitePlanImages,
    sections: sectionsOut.map((s) => ({
      ...s,
      categories: categoriesBySection.get(s.id) ?? [],
    })),
  };
}
