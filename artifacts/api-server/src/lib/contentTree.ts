import { asc, eq, inArray } from "drizzle-orm";
import {
  db,
  tenantsTable,
  sectionsTable,
  categoriesTable,
  itemsTable,
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

export type ItemWithMedia = Item & { media: MediaRow[] };
export type CategoryContent = Category & { items: ItemWithMedia[] };
export type SectionContent = Section & { categories: CategoryContent[] };
export type TenantContentTree = Tenant & { sections: SectionContent[] };

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
  if (lang && lang !== "sl") {
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
    const byRecord = new Map<string, Record<string, string>>();
    for (const t of translations) {
      if (t.lang.toLowerCase() !== lang) continue;
      const rec = byRecord.get(t.recordId) ?? {};
      rec[t.field] = t.value;
      byRecord.set(t.recordId, rec);
    }
    const apply = <T extends { id: string }>(row: T): T => {
      const rec = byRecord.get(row.id);
      if (!rec) return row;
      const merged: Record<string, unknown> = { ...row };
      // Sub-indexed fields ("body[3]", "bullets[2]") patch one element of the
      // array — a missing translation leaves that paragraph in Slovene, so a
      // half-translated item never shows an empty block.
      let bodyArr: string[] | null = null;
      let bulletsArr: string[] | null = null;
      for (const [field, value] of Object.entries(rec)) {
        if (value === "") continue;
        const sub = field.match(/^(body|bullets)\[(\d+)\]$/);
        if (sub) {
          const idx = Number(sub[2]);
          if (sub[1] === "body") {
            if (!bodyArr) {
              try {
                const parsed = JSON.parse(String(merged["body"] ?? "null"));
                bodyArr = Array.isArray(parsed) ? [...parsed] : null;
              } catch {
                bodyArr = null;
              }
            }
            if (bodyArr && idx < bodyArr.length) bodyArr[idx] = value;
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

  const mediaByItem = new Map<string, MediaRow[]>();
  for (const m of media) {
    if (!m.itemId) continue;
    const arr = mediaByItem.get(m.itemId) ?? [];
    arr.push(m);
    mediaByItem.set(m.itemId, arr);
  }
  const itemsByCategory = new Map<string, ItemWithMedia[]>();
  for (const i of itemsOut) {
    const arr = itemsByCategory.get(i.categoryId) ?? [];
    arr.push({ ...i, media: mediaByItem.get(i.id) ?? [] });
    itemsByCategory.set(i.categoryId, arr);
  }
  const categoriesBySection = new Map<string, CategoryContent[]>();
  for (const c of categoriesOut) {
    const arr = categoriesBySection.get(c.sectionId) ?? [];
    arr.push({ ...c, items: itemsByCategory.get(c.id) ?? [] });
    categoriesBySection.set(c.sectionId, arr);
  }
  return {
    ...tenantOut,
    sections: sectionsOut.map((s) => ({
      ...s,
      categories: categoriesBySection.get(s.id) ?? [],
    })),
  };
}
