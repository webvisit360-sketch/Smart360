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
  ListTranslationsResponse,
  UpsertTranslationBody,
  UpsertTranslationResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/adminAuth";
import { logChange } from "../lib/changelog";

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
    .values({ ...parsed.data, position, tenantId })
    .returning();
  await logChange({
    tenantId,
    tenantName: tenant.name,
    action: "create",
    entity: "section",
    detail: parsed.data.title,
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
  const [section] = await db
    .update(sectionsTable)
    .set(parsed.data)
    .where(eq(sectionsTable.id, id))
    .returning();
  if (!section) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ctx = await tenantNameForSection(section.id);
  await logChange({
    ...ctx,
    action: "update",
    entity: "section",
    detail: section.title,
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
      .values({ ...parsed.data, position, sectionId })
      .returning();
    const ctx = await tenantNameForSection(sectionId);
    await logChange({
      ...ctx,
      action: "create",
      entity: "category",
      detail: parsed.data.label,
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
  const [category] = await db
    .update(categoriesTable)
    .set(parsed.data)
    .where(eq(categoriesTable.id, id))
    .returning();
  if (!category) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const ctx = await tenantNameForSection(category.sectionId);
  await logChange({
    ...ctx,
    action: "update",
    entity: "category",
    detail: category.label,
  });
  res.json(UpdateCategoryResponse.parse(category));
});

router.delete("/admin/categories/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [category] = await db
    .delete(categoriesTable)
    .where(eq(categoriesTable.id, id))
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
    .values({ ...parsed.data, position, categoryId })
    .returning();
  const ctx = await tenantNameForSection(category.sectionId);
  await logChange({
    ...ctx,
    action: "create",
    entity: "item",
    detail: parsed.data.title ?? category.label,
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
  const [item] = await db
    .update(itemsTable)
    .set(parsed.data)
    .where(eq(itemsTable.id, id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Not found" });
    return;
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
    detail: item.title ?? undefined,
  });
  res.json(UpdateItemResponse.parse(await itemWithMedia(item)));
});

router.delete("/admin/items/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [item] = await db
    .delete(itemsTable)
    .where(eq(itemsTable.id, id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await logChange({
    action: "delete",
    entity: "item",
    detail: item.title ?? undefined,
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
  await logChange({
    action: "duplicate",
    entity: "item",
    detail: item!.title ?? undefined,
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
  res.status(201).json(AddItemMediaResponse.parse(media));
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
  res.json({ ok: true });
});

// ---------- Translations ----------

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
  if (match) {
    if (value === "") {
      await db
        .delete(translationsTable)
        .where(eq(translationsTable.id, match.id));
    } else {
      await db
        .update(translationsTable)
        .set({ value })
        .where(eq(translationsTable.id, match.id));
    }
  } else if (value !== "") {
    await db
      .insert(translationsTable)
      .values({ model, recordId, field, lang, value });
  }
  res.json(UpsertTranslationResponse.parse({ ok: true }));
});

export default router;
