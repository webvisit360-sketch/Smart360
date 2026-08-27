import { Router, type IRouter } from "express";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  sectionsTable,
  categoriesTable,
  itemsTable,
  mediaTable,
  translationsTable,
  tenantsTable,
} from "@workspace/db";
import {
  CreateSectionBody,
  CreateSectionResponse,
  UpdateSectionBody,
  UpdateSectionResponse,
  ReorderSectionsBody,
  CreateCategoryBody,
  CreateCategoryResponse,
  UpdateCategoryBody,
  UpdateCategoryResponse,
  ReorderCategoriesBody,
  CreateItemBody,
  CreateItemResponse,
  UpdateItemBody,
  UpdateItemResponse,
  DuplicateItemResponse,
  ReorderItemsBody,
  AddItemMediaBody,
  AddItemMediaResponse,
  ReorderMediaBody,
  UpdateMediaBody,
  UpdateMediaResponse,
  ListTranslationsResponse,
  UpsertTranslationBody,
  UpsertTranslationResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/adminAuth";
import { currentActor } from "../lib/actorContext";
import { logChange } from "../lib/changelog";
import { sanitizeBody, sanitizePlain, sanitizeUrl } from "../lib/sanitizeBody";
import { isRichField, normalizeAllContent } from "../lib/normalizeContent";
import { invalidateTenantCache } from "./publicTenants";

/**
 * Server-side sanitization of every guest-facing string, regardless of what
 * the client sent (Word paste, scripts, styles). `body` keeps the small
 * rich-text allowlist; every other string field is stripped to plain text.
 */
function cleanContentFields<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data };
  for (const key of [
    "title", "label", "sublabel", "subtitle",
    "noteType", "price", "priceUnit", "phone", "hours", "distance",
  ]) {
    if (typeof out[key] === "string") out[key] = sanitizePlain(out[key] as string);
  }
  // noteText ("Nasvet gostitelja") is rendered as HTML in the guest app,
  // so it keeps the same rich-text allowlist as body.
  if (typeof out["noteText"] === "string") out["noteText"] = sanitizeBody(out["noteText"] as string);
  if (Array.isArray(out["bullets"])) {
    out["bullets"] = (out["bullets"] as unknown[]).map((b) =>
      typeof b === "string" ? sanitizePlain(b) : b,
    );
  }
  for (const key of ["website", "mapUrl"]) {
    if (typeof out[key] === "string") out[key] = sanitizeUrl(out[key] as string) || null;
  }
  if (typeof out["body"] === "string") out["body"] = sanitizeBody(out["body"] as string);
  return out as T;
}

const router: IRouter = Router();
router.use("/admin", requireAdmin);

function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

async function tenantNameForSection(
  sectionId: string,
): Promise<{ tenantId: string; tenantName: string } | null> {
  const [row] = await db
    .select({ tenantId: tenantsTable.id, tenantName: tenantsTable.name })
    .from(sectionsTable)
    .innerJoin(tenantsTable, eq(sectionsTable.tenantId, tenantsTable.id))
    .where(eq(sectionsTable.id, sectionId));
  return row ?? null;
}

async function tenantContextForCategory(categoryId: string) {
  const [row] = await db
    .select({ tenantId: tenantsTable.id, tenantName: tenantsTable.name })
    .from(categoriesTable)
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .innerJoin(tenantsTable, eq(sectionsTable.tenantId, tenantsTable.id))
    .where(eq(categoriesTable.id, categoryId));
  return row ?? null;
}

async function tenantContextForItem(itemId: string) {
  const [row] = await db
    .select({ tenantId: tenantsTable.id, tenantName: tenantsTable.name, title: itemsTable.title })
    .from(itemsTable)
    .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .innerJoin(tenantsTable, eq(sectionsTable.tenantId, tenantsTable.id))
    .where(eq(itemsTable.id, itemId));
  return row ?? null;
}

async function translationAuditContext(
  model: string,
  recordId: string,
): Promise<{ tenantId: string; tenantName: string; title: string } | null> {
  if (model === "tenant") {
    const [row] = await db.select({ tenantId: tenantsTable.id, tenantName: tenantsTable.name, title: tenantsTable.name })
      .from(tenantsTable).where(eq(tenantsTable.id, recordId));
    return row ?? null;
  }
  if (model === "section") {
    const [row] = await db.select({ tenantId: tenantsTable.id, tenantName: tenantsTable.name, title: sectionsTable.title })
      .from(sectionsTable).innerJoin(tenantsTable, eq(sectionsTable.tenantId, tenantsTable.id))
      .where(eq(sectionsTable.id, recordId));
    return row ?? null;
  }
  if (model === "category") {
    const [row] = await db.select({ tenantId: tenantsTable.id, tenantName: tenantsTable.name, title: categoriesTable.label })
      .from(categoriesTable).innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .innerJoin(tenantsTable, eq(sectionsTable.tenantId, tenantsTable.id)).where(eq(categoriesTable.id, recordId));
    return row ?? null;
  }
  if (model === "item") {
    const [row] = await db.select({ tenantId: tenantsTable.id, tenantName: tenantsTable.name, title: itemsTable.title })
      .from(itemsTable).innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .innerJoin(tenantsTable, eq(sectionsTable.tenantId, tenantsTable.id)).where(eq(itemsTable.id, recordId));
    return row ? { ...row, title: row.title ?? "Item" } : null;
  }
  return null;
}

/** Titles and visibility are safe audit metadata; never put content bodies here. */
function contentUpdateDetail(
  before: { title?: string | null; label?: string | null; isVisible?: boolean },
  after: { title?: string | null; label?: string | null; isVisible?: boolean },
): string | undefined {
  const name = after.title ?? after.label ?? before.title ?? before.label ?? undefined;
  if (before.isVisible !== undefined && before.isVisible !== after.isVisible) {
    return `${name ?? "Vnos"}: ${before.isVisible ? "vidno" : "skrito"} → ${after.isVisible ? "vidno" : "skrito"}`;
  }
  const oldName = before.title ?? before.label;
  const newName = after.title ?? after.label;
  return oldName !== newName && oldName && newName ? `${oldName} → ${newName}` : name;
}

function auditLabel(value: string | null | undefined): string {
  return (value ?? "Vnos").replace(/\s+/g, " ").trim().slice(0, 120) || "Vnos";
}

function auditSummary(verb: string, label?: string | null, language?: string): string {
  return [verb, auditLabel(label), language].filter(Boolean).join(" · ");
}

/** Field names, not values, drive the audit wording: content itself never enters it. */
export function contentMutationSummary(
  entity: "section" | "category" | "item",
  patch: object,
  label: string | null | undefined,
): string {
  const fields = new Set(Object.keys(patch));
  const noun = entity === "section" ? "razdelka" : entity === "category" ? "kategorije" : "vnosa";
  let change = "Spremenjeni podatki";
  if (fields.has("isVisible")) change = "Spremenjena vidnost";
  else if (["title", "label", "subtitle", "sublabel"].some((key) => fields.has(key))) change = "Spremenjen naslov";
  else if (["body", "noteText", "bullets"].some((key) => fields.has(key))) change = "Spremenjeno besedilo";
  else if (["phone", "hours", "website", "mapUrl"].some((key) => fields.has(key))) change = "Spremenjeni kontaktni podatki";
  else if (["price", "priceUnit"].some((key) => fields.has(key))) change = "Spremenjena cena";
  return auditSummary(`${change} ${noun}`, label);
}

export function mediaMutationSummary(
  patch: object,
  itemTitle: string | null | undefined,
): string {
  const fields = new Set(Object.keys(patch));
  const change = fields.has("position") ? "Spremenjen vrstni red predstavnosti"
    : ["focusX", "focusY"].some((key) => fields.has(key)) ? "Spremenjen izrez predstavnosti"
    : ["width", "height", "durationSec", "posterUrl"].some((key) => fields.has(key)) ? "Spremenjeni podatki predstavnosti"
    : "Spremenjeni podatki predstavnosti";
  return auditSummary(change, itemTitle);
}

function languageLabel(lang: string): string {
  return ({ sl: "slovenščina", en: "angleščina", de: "nemščina", it: "italijanščina" } as Record<string, string>)[lang] ?? auditLabel(lang);
}

// ---------- Sections ----------

router.post("/admin/tenants/:id/sections", async (req, res): Promise<void> => {
  const tenantId = firstParam(req.params["id"]);
  const parsed = CreateSectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  const existing = await db
    .select({ position: sectionsTable.position })
    .from(sectionsTable)
    .where(eq(sectionsTable.tenantId, tenantId));
  const position =
    parsed.data.position ??
    (existing.length ? Math.max(...existing.map((s) => s.position)) + 1 : 0);
  const [section] = await db
    .insert(sectionsTable)
    .values({ ...cleanContentFields(parsed.data), position, tenantId })
    .returning();
  await logChange({
    tenantId,
    tenantName: tenant.name,
    action: "create",
    entity: "section",
    detail: parsed.data.title,
    summary: auditSummary("Ustvarjen razdelek", section!.title),
  });
  res.status(201).json(CreateSectionResponse.parse(section));
});

router.patch("/admin/sections/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const parsed = UpdateSectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [prevSection] = await db
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.id, id));
  const [section] = await db
    .update(sectionsTable)
    .set(cleanContentFields(parsed.data))
    .where(eq(sectionsTable.id, id))
    .returning();
  if (!section) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (prevSection) {
    await markStaleForChange("section", prevSection, section, section.id);
  }
  const ctx = await tenantNameForSection(section.id);
  await logChange({
    ...ctx,
    action: "update",
    entity: "section",
    detail: contentUpdateDetail(prevSection ?? {}, section),
    summary: contentMutationSummary("section", parsed.data, section.title),
  });
  res.json(UpdateSectionResponse.parse(section));
});

router.delete("/admin/sections/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const ctx = await tenantNameForSection(id);
  const [section] = await db
    .delete(sectionsTable)
    .where(eq(sectionsTable.id, id))
    .returning();
  if (!section) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await logChange({
    ...ctx,
    action: "delete",
    entity: "section",
    detail: section.title,
    summary: auditSummary("Odstranjen razdelek", section.title),
  });
  res.sendStatus(204);
});

router.post("/admin/sections/reorder", async (req, res): Promise<void> => {
  const parsed = ReorderSectionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { ids } = parsed.data;
  if (new Set(ids).size !== ids.length || ids.length === 0) {
    res.status(400).json({ error: "ids must be unique and non-empty" });
    return;
  }
  const rows = await db
    .select({ id: sectionsTable.id, parent: sectionsTable.tenantId })
    .from(sectionsTable)
    .where(inArray(sectionsTable.id, ids));
  const parents = new Set(rows.map((r) => r.parent));
  if (rows.length !== ids.length || parents.size !== 1) {
    res.status(400).json({ error: "ids must all belong to the same tenant" });
    return;
  }
  const siblings = await db
    .select({ id: sectionsTable.id })
    .from(sectionsTable)
    .where(eq(sectionsTable.tenantId, [...parents][0]!));
  if (siblings.length !== ids.length) {
    res.status(400).json({ error: "ids must include every section of the tenant" });
    return;
  }
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(sectionsTable)
        .set({ position: i })
        .where(eq(sectionsTable.id, ids[i]!));
    }
  });
  const ctx = await tenantNameForSection(ids[0]!);
  await logChange({ ...ctx, action: "reorder", entity: "section", detail: `${ids.length} sections`, summary: "Spremenjen vrstni red razdelkov" });
  res.json({ ok: true });
});

// ---------- Categories ----------

router.post(
  "/admin/sections/:id/categories",
  async (req, res): Promise<void> => {
    const sectionId = firstParam(req.params["id"]);
    const parsed = CreateCategoryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [section] = await db
      .select()
      .from(sectionsTable)
      .where(eq(sectionsTable.id, sectionId));
    if (!section) {
      res.status(404).json({ error: "Section not found" });
      return;
    }
    const existing = await db
      .select({ position: categoriesTable.position })
      .from(categoriesTable)
      .where(eq(categoriesTable.sectionId, sectionId));
    const position =
      parsed.data.position ??
      (existing.length ? Math.max(...existing.map((c) => c.position)) + 1 : 0);
    const [category] = await db
      .insert(categoriesTable)
      .values({ ...cleanContentFields(parsed.data), position, sectionId })
      .returning();
    const ctx = await tenantNameForSection(sectionId);
    await logChange({
      ...ctx,
      action: "create",
      entity: "category",
      detail: parsed.data.label,
      summary: auditSummary("Ustvarjena kategorija", category!.label),
    });
    res.status(201).json(CreateCategoryResponse.parse(category));
  },
);

router.patch("/admin/categories/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [prevCategory] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, id));
  const [category] = await db
    .update(categoriesTable)
    .set(cleanContentFields(parsed.data))
    .where(eq(categoriesTable.id, id))
    .returning();
  if (!category) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (prevCategory) {
    await markStaleForChange("category", prevCategory, category, category.id);
  }
  const ctx = await tenantNameForSection(category.sectionId);
  await logChange({
    ...ctx,
    action: "update",
    entity: "category",
    detail: contentUpdateDetail(prevCategory ?? {}, category),
    summary: contentMutationSummary("category", parsed.data, category.label),
  });
  res.json(UpdateCategoryResponse.parse(category));
});

// Soft delete: the category moves to the trash ("Nedavno izbrisano") and can
// be restored for 30 days. Permanent removal happens via purge.
router.delete("/admin/categories/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [category] = await db
    .update(categoriesTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(categoriesTable.id, id), isNull(categoriesTable.deletedAt)))
    .returning();
  if (!category) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ctx = await tenantNameForSection(category.sectionId);
  await logChange({
    ...ctx,
    action: "delete",
    entity: "category",
    detail: category.label,
    summary: auditSummary("Premaknjena v koš kategorija", category.label),
  });
  res.sendStatus(204);
});

router.post("/admin/categories/reorder", async (req, res): Promise<void> => {
  const parsed = ReorderCategoriesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { ids } = parsed.data;
  if (new Set(ids).size !== ids.length || ids.length === 0) {
    res.status(400).json({ error: "ids must be unique and non-empty" });
    return;
  }
  const rows = await db
    .select({ id: categoriesTable.id, parent: categoriesTable.sectionId })
    .from(categoriesTable)
    .where(inArray(categoriesTable.id, ids));
  const parents = new Set(rows.map((r) => r.parent));
  if (rows.length !== ids.length || parents.size !== 1) {
    res.status(400).json({ error: "ids must all belong to the same section" });
    return;
  }
  // Soft-deleted siblings live in the trash and are not part of the visible order.
  const siblings = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(and(eq(categoriesTable.sectionId, [...parents][0]!), isNull(categoriesTable.deletedAt)));
  if (siblings.length !== ids.length) {
    res.status(400).json({ error: "ids must include every category of the section" });
    return;
  }
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(categoriesTable)
        .set({ position: i })
        .where(eq(categoriesTable.id, ids[i]!));
    }
  });
  const ctx = await tenantContextForCategory(ids[0]!);
  await logChange({ ...ctx, action: "reorder", entity: "category", detail: `${ids.length} categories`, summary: "Spremenjen vrstni red kategorij" });
  res.json({ ok: true });
});

// ---------- Items ----------

async function itemWithMedia(
  item: typeof itemsTable.$inferSelect,
): Promise<Record<string, unknown>> {
  const media = await db
    .select()
    .from(mediaTable)
    .where(eq(mediaTable.itemId, item.id))
    .orderBy(asc(mediaTable.position));
  return { ...item, media };
}

router.post("/admin/categories/:id/items", async (req, res): Promise<void> => {
  const categoryId = firstParam(req.params["id"]);
  const parsed = CreateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId));
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const existing = await db
    .select({ position: itemsTable.position })
    .from(itemsTable)
    .where(eq(itemsTable.categoryId, categoryId));
  const position =
    parsed.data.position ??
    (existing.length ? Math.max(...existing.map((i) => i.position)) + 1 : 0);
  const [item] = await db
    .insert(itemsTable)
    .values({ ...cleanContentFields(parsed.data), position, categoryId })
    .returning();
  const ctx = await tenantNameForSection(category.sectionId);
  await logChange({
    ...ctx,
    action: "create",
    entity: "item",
    detail: parsed.data.title ?? category.label,
    summary: auditSummary("Ustvarjen vnos", item!.title ?? category.label),
  });
  res.status(201).json(CreateItemResponse.parse(await itemWithMedia(item!)));
});

router.patch("/admin/items/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const parsed = UpdateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [prevItem] = await db
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.id, id));
  const [item] = await db
    .update(itemsTable)
    .set(cleanContentFields(parsed.data))
    .where(eq(itemsTable.id, id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (prevItem) {
    await markStaleForChange("item", prevItem, item, item.id);
  }
  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, item.categoryId));
  const ctx = category ? await tenantNameForSection(category.sectionId) : null;
  await logChange({
    ...ctx,
    action: "update",
    entity: "item",
    detail: contentUpdateDetail(prevItem ?? {}, item),
    summary: contentMutationSummary("item", parsed.data, item.title),
  });
  res.json(UpdateItemResponse.parse(await itemWithMedia(item)));
});

// Soft delete: the item moves to the trash and can be restored for 30 days.
router.delete("/admin/items/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [item] = await db
    .update(itemsTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(itemsTable.id, id), isNull(itemsTable.deletedAt)))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ctx = await tenantContextForItem(item.id);
  await logChange({
    ...ctx,
    action: "delete",
    entity: "item",
    detail: item.title ?? undefined,
    summary: auditSummary("Premaknjen v koš vnos", item.title),
  });
  res.sendStatus(204);
});

router.post("/admin/items/:id/duplicate", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [source] = await db
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.id, id));
  if (!source) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const { id: _id, ...rest } = source;
  // Shift later siblings down to keep the duplicate adjacent and positions unique.
  await db
    .update(itemsTable)
    .set({ position: sql`${itemsTable.position} + 1` })
    .where(
      sql`${itemsTable.categoryId} = ${source.categoryId} and ${itemsTable.position} > ${source.position}`,
    );
  const [item] = await db
    .insert(itemsTable)
    .values({
      ...rest,
      title: source.title ? `${source.title} (kopija)` : source.title,
      position: source.position + 1,
    })
    .returning();
  const media = await db
    .select()
    .from(mediaTable)
    .where(eq(mediaTable.itemId, id))
    .orderBy(asc(mediaTable.position));
  if (media.length) {
    await db.insert(mediaTable).values(
      media.map(({ id: _m, itemId: _i, ...mediaRest }) => ({
        ...mediaRest,
        itemId: item!.id,
      })),
    );
  }
  const ctx = await tenantContextForItem(item!.id);
  await logChange({
    ...ctx,
    action: "duplicate",
    entity: "item",
    detail: item!.title ?? undefined,
    summary: auditSummary("Podvojen vnos", item!.title),
  });
  res.status(201).json(DuplicateItemResponse.parse(await itemWithMedia(item!)));
});

router.post("/admin/items/reorder", async (req, res): Promise<void> => {
  const parsed = ReorderItemsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { ids } = parsed.data;
  if (new Set(ids).size !== ids.length || ids.length === 0) {
    res.status(400).json({ error: "ids must be unique and non-empty" });
    return;
  }
  const rows = await db
    .select({ id: itemsTable.id, parent: itemsTable.categoryId })
    .from(itemsTable)
    .where(inArray(itemsTable.id, ids));
  const parents = new Set(rows.map((r) => r.parent));
  if (rows.length !== ids.length || parents.size !== 1) {
    res.status(400).json({ error: "ids must all belong to the same category" });
    return;
  }
  // Soft-deleted siblings live in the trash and are not part of the visible order.
  const siblings = await db
    .select({ id: itemsTable.id })
    .from(itemsTable)
    .where(and(eq(itemsTable.categoryId, [...parents][0]!), isNull(itemsTable.deletedAt)));
  if (siblings.length !== ids.length) {
    res.status(400).json({ error: "ids must include every item of the category" });
    return;
  }
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(itemsTable)
        .set({ position: i })
        .where(eq(itemsTable.id, ids[i]!));
    }
  });
  const ctx = await tenantContextForItem(ids[0]!);
  await logChange({ ...ctx, action: "reorder", entity: "item", detail: `${ids.length} items`, summary: "Spremenjen vrstni red vnosov" });
  res.json({ ok: true });
});

// ---------- Media ----------

router.post("/admin/items/:id/media", async (req, res): Promise<void> => {
  const itemId = firstParam(req.params["id"]);
  const parsed = AddItemMediaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.id, itemId));
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  const existing = await db
    .select({ position: mediaTable.position })
    .from(mediaTable)
    .where(eq(mediaTable.itemId, itemId));
  const position =
    parsed.data.position ??
    (existing.length ? Math.max(...existing.map((m) => m.position)) + 1 : 0);
  const [media] = await db
    .insert(mediaTable)
    .values({ ...parsed.data, position, itemId })
    .returning();
  const ctx = await tenantContextForItem(itemId);
  await logChange({ ...ctx, action: "create", entity: "media", detail: item.title ?? "Media added", summary: auditSummary("Dodana predstavnost", item.title) });
  res.status(201).json(AddItemMediaResponse.parse(media));
});

// Žariščna točka izreza (izrez-wifi-eposta.md §1a): odstotka, ki povesta,
// katera točka fotografije mora ostati vidna v vsakem okvirju.
router.patch("/admin/media/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const parsed = UpdateMediaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [before] = await db.select().from(mediaTable).where(eq(mediaTable.id, id));
  const [media] = await db
    .update(mediaTable)
    .set(parsed.data)
    .where(eq(mediaTable.id, id))
    .returning();
  if (!media) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ctx = media.itemId ? await tenantContextForItem(media.itemId) : null;
  await logChange({
    ...ctx,
    action: "update",
    entity: "media",
    detail: before?.position !== media.position ? "Media position updated" : "Media metadata updated",
    summary: mediaMutationSummary(parsed.data, ctx?.title),
  });
  res.json(UpdateMediaResponse.parse(media));
});

router.delete("/admin/media/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [media] = await db
    .delete(mediaTable)
    .where(eq(mediaTable.id, id))
    .returning();
  if (!media) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ctx = media.itemId ? await tenantContextForItem(media.itemId) : null;
  await logChange({ ...ctx, action: "delete", entity: "media", detail: "Media removed", summary: auditSummary("Odstranjena predstavnost", ctx?.title) });
  res.sendStatus(204);
});

router.post("/admin/media/reorder", async (req, res): Promise<void> => {
  const parsed = ReorderMediaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { ids } = parsed.data;
  if (new Set(ids).size !== ids.length || ids.length === 0) {
    res.status(400).json({ error: "ids must be unique and non-empty" });
    return;
  }
  const rows = await db
    .select({ id: mediaTable.id, parent: mediaTable.itemId })
    .from(mediaTable)
    .where(inArray(mediaTable.id, ids));
  const parents = new Set(rows.map((r) => r.parent));
  if (rows.length !== ids.length || parents.size !== 1) {
    res.status(400).json({ error: "ids must all belong to the same item" });
    return;
  }
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(mediaTable)
        .set({ position: i })
        .where(eq(mediaTable.id, ids[i]!));
    }
  });
  const ctx = rows[0]!.parent ? await tenantContextForItem(rows[0]!.parent) : null;
  await logChange({ ...ctx, action: "reorder", entity: "media", detail: `${ids.length} media`, summary: auditSummary("Spremenjen vrstni red predstavnosti", ctx?.title) });
  res.json({ ok: true });
});

// ---------- Translations ----------

/**
 * Mark existing translations of changed source fields as STALE — never
 * delete them. The admin shows "izvirnik se je spremenil" and keeps the old
 * translation visible; losing an afternoon of translation work because the
 * source moved a comma is the worse failure.
 */
async function markStaleForChange(
  model: "tenant" | "section" | "category" | "item",
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  recordId: string
): Promise<void> {
  const changed: string[] = [];
  for (const key of Object.keys(after)) {
    if (key in before && before[key] !== after[key]) changed.push(key);
  }
  if (!changed.length) return;
  const rows = await db
    .select()
    .from(translationsTable)
    .where(
      and(
        eq(translationsTable.recordId, recordId),
        eq(translationsTable.stale, false)
      )
    );
  const staleIds = rows
    .filter((r) => r.model === model)
    .filter((r) =>
      changed.some((f) => r.field === f || r.field.startsWith(`${f}[`))
    )
    .map((r) => r.id);
  if (staleIds.length) {
    await db
      .update(translationsTable)
      .set({ stale: true })
      .where(inArray(translationsTable.id, staleIds));
  }
}

router.get("/admin/translations", async (req, res): Promise<void> => {
  const model =
    typeof req.query["model"] === "string" ? req.query["model"] : undefined;
  const recordId =
    typeof req.query["recordId"] === "string"
      ? req.query["recordId"]
      : undefined;
  if (!model || !recordId) {
    res.status(400).json({ error: "model and recordId are required" });
    return;
  }
  const rows = await db
    .select()
    .from(translationsTable)
    .where(
      inArray(translationsTable.recordId, [recordId]),
    );
  res.json(
    ListTranslationsResponse.parse(rows.filter((r) => r.model === model)),
  );
});

router.put("/admin/translations", async (req, res): Promise<void> => {
  const parsed = UpsertTranslationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { model, recordId, field, lang, value } = parsed.data;
  const existing = await db
    .select()
    .from(translationsTable)
    .where(eq(translationsTable.recordId, recordId));
  const match = existing.find(
    (t) => t.model === model && t.field === field && t.lang === lang,
  );
  // body/noteText and their paragraphs are rich text like the source field
  // (noteText is rendered as HTML in the guest app — plain bi mu slekel oznake).
  const rich = isRichField(field);
  const clean = rich ? sanitizeBody(value) : sanitizePlain(value);
  if (match) {
    if (value === "") {
      await db
        .delete(translationsTable)
        .where(eq(translationsTable.id, match.id));
    } else {
      await db
        .update(translationsTable)
        .set({ value: clean, stale: false, updatedAt: new Date() })
        .where(eq(translationsTable.id, match.id));
    }
  } else if (value !== "") {
    await db.insert(translationsTable).values({
      model,
      recordId,
      field,
      lang,
      value: clean,
    });
  }
  invalidateTenantCache();
  const ctx = await translationAuditContext(model, recordId);
  await logChange({
    ...ctx,
    action: value === "" ? "delete" : match ? "update" : "create",
    entity: "translation",
    detail: `${ctx?.title ?? model} · ${lang} · ${field}`,
    summary: auditSummary(value === "" ? "Odstranjen prevod" : "Spremenjeno besedilo", ctx?.title, languageLabel(lang)),
  });
  res.json(UpsertTranslationResponse.parse({ ok: true }));
});

// ---------- Vzdrževanje ----------

/**
 * Enkratna normalizacija vse vsebine skozi sanitizer (b→strong, i→em, …).
 * Idempotentno — drugi zagon vrne 0. Vrne seznam spremenjenih polj in število.
 */
router.post("/admin/maintenance/normalize-content", async (_req, res): Promise<void> => {
  const { count, changes } = await normalizeAllContent();
  // Samo metapodatki — vrednosti lahko vsebujejo WiFi gesla in kontakte,
  // zato ne sodijo v centralne dnevnike.
  for (const c of changes) {
    console.log(`[normalize-content] ${c.table} ${c.id} ${c.field}`);
  }
  await logChange({
    action: "maintenance",
    entity: "normalize-content",
    detail: `Normalizacija vsebine: ${count} spremenjenih polj`,
    summary: "Normalizirana vsebina vodnika",
  });
  invalidateTenantCache();
  res.json({
    ok: true,
    count,
    changes: changes.map((c) => ({ table: c.table, id: c.id, field: c.field })),
  });
});

// ---------- Trash ("Nedavno izbrisano") ----------

const TRASH_DAYS = 30;

/** Permanently remove entries deleted more than 30 days ago (lazy purge). */
async function purgeExpired(tenantId: string): Promise<void> {
  const cutoff = new Date(Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000);
  const sectionIds = (
    await db
      .select({ id: sectionsTable.id })
      .from(sectionsTable)
      .where(eq(sectionsTable.tenantId, tenantId))
  ).map((s) => s.id);
  if (sectionIds.length === 0) return;
  const catIds = (
    await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(inArray(categoriesTable.sectionId, sectionIds))
  ).map((c) => c.id);
  await db.transaction(async (tx) => {
    if (catIds.length > 0) {
      await tx
        .delete(itemsTable)
        .where(
          and(
            inArray(itemsTable.categoryId, catIds),
            sql`${itemsTable.deletedAt} < ${cutoff}`,
          ),
        );
    }
    await tx
      .delete(categoriesTable)
      .where(
        and(
          inArray(categoriesTable.sectionId, sectionIds),
          sql`${categoriesTable.deletedAt} < ${cutoff}`,
        ),
      );
  });
}

router.get("/admin/tenants/:id/trash", async (req, res): Promise<void> => {
  const tenantId = firstParam(req.params["id"]);
  const [tenant] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  // Expiry cleanup is permanent deletion, so it must never run inside a
  // client request. Smart360 performs it when an operator opens the trash.
  if (currentActor()?.kind === "owner") {
    await purgeExpired(tenantId);
  }
  const categories = await db
    .select({
      id: categoriesTable.id,
      label: categoriesTable.label,
      sectionTitle: sectionsTable.title,
      deletedAt: categoriesTable.deletedAt,
    })
    .from(categoriesTable)
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(
      and(
        eq(sectionsTable.tenantId, tenantId),
        sql`${categoriesTable.deletedAt} IS NOT NULL`,
      ),
    );
  // Items deleted directly (their category is still alive); items that went to
  // the trash together with their category are represented by the category row.
  const items = await db
    .select({
      id: itemsTable.id,
      title: itemsTable.title,
      categoryLabel: categoriesTable.label,
      deletedAt: itemsTable.deletedAt,
    })
    .from(itemsTable)
    .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(
      and(
        eq(sectionsTable.tenantId, tenantId),
        sql`${itemsTable.deletedAt} IS NOT NULL`,
        isNull(categoriesTable.deletedAt),
      ),
    );
  res.json({
    categories: categories.map((c) => ({
      ...c,
      deletedAt: c.deletedAt?.toISOString() ?? null,
    })),
    items: items.map((i) => ({
      ...i,
      deletedAt: i.deletedAt?.toISOString() ?? null,
    })),
    retentionDays: TRASH_DAYS,
  });
});

router.post("/admin/categories/:id/restore", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [category] = await db
    .update(categoriesTable)
    .set({ deletedAt: null })
    .where(and(eq(categoriesTable.id, id), sql`${categoriesTable.deletedAt} IS NOT NULL`))
    .returning();
  if (!category) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ctx = await tenantNameForSection(category.sectionId);
  await logChange({ ...ctx, action: "restore", entity: "category", detail: category.label, summary: auditSummary("Obnovljena kategorija", category.label) });
  res.json({ ok: true });
});

router.post("/admin/items/:id/restore", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [item] = await db
    .update(itemsTable)
    .set({ deletedAt: null })
    .where(and(eq(itemsTable.id, id), sql`${itemsTable.deletedAt} IS NOT NULL`))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // If the parent category is itself in the trash, bring it back too —
  // otherwise the restored item would be invisible everywhere.
  await db
    .update(categoriesTable)
    .set({ deletedAt: null })
    .where(and(eq(categoriesTable.id, item.categoryId), sql`${categoriesTable.deletedAt} IS NOT NULL`));
  const ctx = await tenantContextForItem(item.id);
  await logChange({ ...ctx, action: "restore", entity: "item", detail: item.title ?? undefined, summary: auditSummary("Obnovljen vnos", item.title) });
  res.json({ ok: true });
});

router.delete("/admin/categories/:id/purge", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [category] = await db
    .delete(categoriesTable)
    .where(and(eq(categoriesTable.id, id), sql`${categoriesTable.deletedAt} IS NOT NULL`))
    .returning();
  if (!category) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ctx = await tenantNameForSection(category.sectionId);
  await logChange({ ...ctx, action: "purge", entity: "category", detail: category.label, summary: auditSummary("Trajno odstranjena kategorija", category.label) });
  res.sendStatus(204);
});

router.delete("/admin/items/:id/purge", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [item] = await db
    .delete(itemsTable)
    .where(and(eq(itemsTable.id, id), sql`${itemsTable.deletedAt} IS NOT NULL`))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ctx = await tenantContextForItem(item.id);
  await logChange({ ...ctx, action: "purge", entity: "item", detail: item.title ?? undefined, summary: auditSummary("Trajno odstranjen vnos", item.title) });
  res.sendStatus(204);
});

export default router;
