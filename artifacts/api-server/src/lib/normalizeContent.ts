import { eq } from "drizzle-orm";
import {
  db,
  tenantsTable,
  sectionsTable,
  categoriesTable,
  itemsTable,
  translationsTable,
  pluralFormsTable,
} from "@workspace/db";
import { sanitizeBody, sanitizePlain } from "./sanitizeBody";

/**
 * Enkratna normalizacija VSE obstoječe vsebine skozi isti sanitizer, ki ga
 * uporabljajo poti za shranjevanje (cleanContentFields / prevodni PUT).
 * Razlog: vsebina, ki je bila v bazo zapisana mimo sanitizerja (seed,
 * kloniranje, uvoz), nosi <b>/<i>/&nbsp; — prvi ročni popravek v adminu bi
 * jo pretvoril v <strong>/<em> in kopiji (razvojna/produkcija) bi spet
 * lezli narazen polje za poljem. Idempotentno: drugi zagon vrne 0 sprememb.
 */

export type NormalizeChange = {
  table: string;
  id: string;
  field: string;
  before: string;
  after: string;
};

/** Rich (HTML) polja — enako pravilo za izvorno vsebino IN prevode. */
export function isRichField(field: string): boolean {
  return (
    field === "body" ||
    field.startsWith("body[") ||
    field === "noteText" ||
    field.startsWith("noteText[")
  );
}

/** body je lahko JSON-seznam odstavkov — saniraj vsak niz, null pusti. */
function sanitizeBodyColumn(raw: string): string {
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return JSON.stringify(
        arr.map((p) => (typeof p === "string" ? sanitizeBody(p) : p)),
      );
    }
  } catch {
    /* navaden niz */
  }
  return sanitizeBody(raw);
}

export async function normalizeAllContent(): Promise<{
  count: number;
  changes: NormalizeChange[];
  tenantIds: string[];
}> {
  const changes: NormalizeChange[] = [];
  const changedTenantIds = new Set<string>();
  const track = (
    table: string,
    id: string,
    field: string,
    before: string | null | undefined,
    after: string | null | undefined,
  ) => {
    if (before == null || after == null || before === after) return false;
    changes.push({ table, id, field, before, after });
    return true;
  };

  // tenants: gola besedilna polja (PATCH najemnika sanitizer sicer obide)
  const tenants = await db.select().from(tenantsTable);
  for (const t of tenants) {
    const upd: Record<string, string> = {};
    for (const f of ["name", "subtitle", "coverTitle", "coverSubtitle"] as const) {
      const v = t[f];
      if (typeof v !== "string") continue;
      const clean = sanitizePlain(v);
      if (track("tenants", t.id, f, v, clean)) upd[f] = clean;
    }
    if (Object.keys(upd).length) {
      await db
        .update(tenantsTable)
        .set({ ...upd, hasUnpublishedChanges: true })
        .where(eq(tenantsTable.id, t.id));
      changedTenantIds.add(t.id);
    }
  }

  const sections = await db.select().from(sectionsTable);
  const sectionTenantIds = new Map(sections.map((section) => [section.id, section.tenantId]));
  for (const s of sections) {
    const upd: Record<string, string> = {};
    for (const f of ["title", "subtitle"] as const) {
      const v = s[f];
      if (typeof v !== "string") continue;
      const clean = sanitizePlain(v);
      if (track("sections", s.id, f, v, clean)) upd[f] = clean;
    }
    if (Object.keys(upd).length) {
      await db.update(sectionsTable).set(upd).where(eq(sectionsTable.id, s.id));
      changedTenantIds.add(s.tenantId);
    }
  }

  const categories = await db.select().from(categoriesTable);
  const categoryTenantIds = new Map(
    categories.map((category) => [category.id, sectionTenantIds.get(category.sectionId)]),
  );
  for (const c of categories) {
    const clean = sanitizePlain(c.label);
    if (track("categories", c.id, "label", c.label, clean)) {
      await db
        .update(categoriesTable)
        .set({ label: clean })
        .where(eq(categoriesTable.id, c.id));
      const tenantId = categoryTenantIds.get(c.id);
      if (tenantId) changedTenantIds.add(tenantId);
    }
  }

  // items: ista polja in ista pravila kot cleanContentFields
  const items = await db.select().from(itemsTable);
  const itemTenantIds = new Map(
    items.map((item) => [item.id, categoryTenantIds.get(item.categoryId)]),
  );
  for (const i of items) {
    const upd: Record<string, unknown> = {};
    for (const f of ["title", "price", "priceUnit", "phone", "distance", "noteType"] as const) {
      const v = i[f];
      if (typeof v !== "string") continue;
      const clean = sanitizePlain(v);
      if (track("items", i.id, f, v, clean)) upd[f] = clean;
    }
    if (typeof i.noteText === "string") {
      const clean = sanitizeBody(i.noteText);
      if (track("items", i.id, "noteText", i.noteText, clean)) upd["noteText"] = clean;
    }
    if (typeof i.body === "string") {
      const clean = sanitizeBodyColumn(i.body);
      if (track("items", i.id, "body", i.body, clean)) upd["body"] = clean;
    }
    if (Array.isArray(i.bullets)) {
      const clean = i.bullets.map((b) => (typeof b === "string" ? sanitizePlain(b) : b));
      if (JSON.stringify(clean) !== JSON.stringify(i.bullets)) {
        changes.push({
          table: "items",
          id: i.id,
          field: "bullets",
          before: JSON.stringify(i.bullets),
          after: JSON.stringify(clean),
        });
        upd["bullets"] = clean;
      }
    }
    if (Object.keys(upd).length) {
      await db.update(itemsTable).set(upd).where(eq(itemsTable.id, i.id));
      const tenantId = itemTenantIds.get(i.id);
      if (tenantId) changedTenantIds.add(tenantId);
    }
  }

  // prevodi: rich po istem pravilu kot izvorno polje (body*, noteText*)
  for (const tr of await db.select().from(translationsTable)) {
    const clean = isRichField(tr.field)
      ? sanitizeBody(tr.value)
      : sanitizePlain(tr.value);
    if (track("translations", tr.id, `${tr.model}.${tr.field}/${tr.lang}`, tr.value, clean)) {
      await db
        .update(translationsTable)
        .set({ value: clean })
        .where(eq(translationsTable.id, tr.id));
      const tenantId =
        tr.model === "tenant" || tr.model === "ui"
          ? tr.recordId
          : tr.model === "section"
            ? sectionTenantIds.get(tr.recordId)
            : tr.model === "category"
              ? categoryTenantIds.get(tr.recordId)
              : tr.model === "item"
                ? itemTenantIds.get(tr.recordId)
                : undefined;
      if (tenantId) changedTenantIds.add(tenantId);
    }
  }

  for (const p of await db.select().from(pluralFormsTable)) {
    const clean = sanitizePlain(p.value);
    if (track("plural_forms", p.id, `${p.key}.${p.form}/${p.lang}`, p.value, clean)) {
      await db
        .update(pluralFormsTable)
        .set({ value: clean })
        .where(eq(pluralFormsTable.id, p.id));
      if (p.tenantId) changedTenantIds.add(p.tenantId);
      else for (const tenant of tenants) changedTenantIds.add(tenant.id);
    }
  }

  return { count: changes.length, changes, tenantIds: [...changedTenantIds] };
}
