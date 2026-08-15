import { Router, type IRouter } from "express";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  tenantsTable,
  sectionsTable,
  categoriesTable,
  itemsTable,
  mediaTable,
  changelogTable,
} from "@workspace/db";
import {
  GetAdminOverviewResponse,
  ListTenantsResponse,
  CreateTenantBody,
  CreateTenantResponse,
  GetTenantResponse,
  UpdateTenantBody,
  UpdateTenantResponse,
  DuplicateTenantBody,
  DuplicateTenantResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/adminAuth";
import { logChange } from "../lib/changelog";
import { buildTenantContent } from "../lib/contentTree";

function serialize<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

const router: IRouter = Router();
router.use("/admin", requireAdmin);

function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

router.get("/admin/overview", async (_req, res): Promise<void> => {
  const [tenantCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where ${tenantsTable.isPublished})::int`,
    })
    .from(tenantsTable);
  const [itemCounts] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(itemsTable);
  const recentChanges = await db
    .select()
    .from(changelogTable)
    .orderBy(desc(changelogTable.createdAt))
    .limit(20);
  res.json(
    GetAdminOverviewResponse.parse(serialize({
      tenantsCount: tenantCounts?.total ?? 0,
      publishedCount: tenantCounts?.published ?? 0,
      itemsCount: itemCounts?.total ?? 0,
      recentChanges,
    })),
  );
});

router.get("/admin/tenants", async (_req, res): Promise<void> => {
  const tenants = await db
    .select()
    .from(tenantsTable)
    .orderBy(asc(tenantsTable.name));
  res.json(ListTenantsResponse.parse(serialize(tenants)));
});

router.post("/admin/tenants", async (req, res): Promise<void> => {
  const parsed = CreateTenantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { slug, name, subtitle, fromTemplate } = parsed.data;
  const [existing] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));
  if (existing) {
    res.status(409).json({ error: "Slug already exists" });
    return;
  }

  if (fromTemplate) {
    const [template] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.isTemplate, true));
    if (template) {
      const created = await copyTenant(template.id, {
        slug,
        name,
        copyContent: false,
      });
      if (subtitle !== undefined) {
        await db
          .update(tenantsTable)
          .set({ subtitle })
          .where(eq(tenantsTable.id, created.id));
        created.subtitle = subtitle;
      }
      await logChange({
        tenantId: created.id,
        tenantName: name,
        action: "create",
        entity: "tenant",
        detail: "iz predloge",
      });
      res.status(201).json(CreateTenantResponse.parse(serialize(created)));
      return;
    }
  }

  const [tenant] = await db
    .insert(tenantsTable)
    .values({ slug, name, subtitle: subtitle ?? null })
    .returning();
  await logChange({
    tenantId: tenant!.id,
    tenantName: name,
    action: "create",
    entity: "tenant",
  });
  res.status(201).json(CreateTenantResponse.parse(serialize(tenant)));
});

router.get("/admin/tenants/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, id));
  if (!tenant) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const tree = await buildTenantContent(tenant, { visibleOnly: false });
  res.json(GetTenantResponse.parse(serialize(tree)));
});

/** Enforces documented ranges/enums from ui/urejevalnik-naslovnice.md; returns error message or null. */
function validateThemeCoverFields(data: Record<string, unknown>): string | null {
  const inRange = (v: unknown, min: number, max: number) =>
    v === undefined || (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max);
  if (data["theme"] !== undefined && !["mediterran", "swipe"].includes(String(data["theme"])))
    return "theme must be 'mediterran' or 'swipe'";
  if (data["coverAlign"] !== undefined && !["left", "center"].includes(String(data["coverAlign"])))
    return "coverAlign must be 'left' or 'center'";
  if (data["coverTextColor"] !== undefined && !/^#[0-9a-fA-F]{6}$/.test(String(data["coverTextColor"])))
    return "coverTextColor must be a hex color like #FFFFFF";
  if (!inRange(data["coverTitleSize"], 24, 84)) return "coverTitleSize must be 24-84";
  if (!inRange(data["coverTitleOpacity"], 20, 100)) return "coverTitleOpacity must be 20-100";
  if (!inRange(data["coverSubSize"], 12, 40)) return "coverSubSize must be 12-40";
  if (!inRange(data["coverSubOpacity"], 20, 100)) return "coverSubOpacity must be 20-100";
  if (!inRange(data["coverMetaSize"], 12, 32)) return "coverMetaSize must be 12-32";
  if (!inRange(data["coverMetaOpacity"], 20, 100)) return "coverMetaOpacity must be 20-100";
  if (!inRange(data["coverVeil"], 0, 60)) return "coverVeil must be 0-60";
  return null;
}

router.patch("/admin/tenants/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const parsed = UpdateTenantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const invalid = validateThemeCoverFields(parsed.data);
  if (invalid) {
    res.status(400).json({ error: invalid });
    return;
  }
  const [tenant] = await db
    .update(tenantsTable)
    .set(parsed.data)
    .where(eq(tenantsTable.id, id))
    .returning();
  if (!tenant) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await logChange({
    tenantId: tenant.id,
    tenantName: tenant.name,
    action: "update",
    entity: "tenant",
  });
  res.json(UpdateTenantResponse.parse(serialize(tenant)));
});

router.delete("/admin/tenants/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [tenant] = await db
    .delete(tenantsTable)
    .where(eq(tenantsTable.id, id))
    .returning();
  if (!tenant) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await logChange({
    tenantName: tenant.name,
    action: "delete",
    entity: "tenant",
  });
  res.sendStatus(204);
});

router.post("/admin/tenants/:id/duplicate", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const parsed = DuplicateTenantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { slug, name, copyContent } = parsed.data;
  const [existing] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));
  if (existing) {
    res.status(409).json({ error: "Slug already exists" });
    return;
  }
  const [source] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, id));
  if (!source) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const created = await copyTenant(id, {
    slug,
    name,
    copyContent: copyContent ?? true,
  });
  await logChange({
    tenantId: created.id,
    tenantName: name,
    action: "duplicate",
    entity: "tenant",
    detail: `kopija`,
  });
  res.status(201).json(DuplicateTenantResponse.parse(serialize(created)));
});

async function copyTenant(
  sourceId: string,
  opts: { slug: string; name: string; copyContent: boolean },
): Promise<typeof tenantsTable.$inferSelect> {
  const [source] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, sourceId));
  if (!source) throw new Error("Source tenant not found");

  const { id: _id, updatedAt: _u, ...rest } = source;
  const [created] = await db
    .insert(tenantsTable)
    .values({
      ...rest,
      slug: opts.slug,
      name: opts.name,
      isTemplate: false,
      isPublished: false,
    })
    .returning();

  const sections = await db
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.tenantId, sourceId))
    .orderBy(asc(sectionsTable.position));

  for (const section of sections) {
    const { id: oldSectionId, tenantId: _t, ...sectionRest } = section;
    const [newSection] = await db
      .insert(sectionsTable)
      .values({ ...sectionRest, tenantId: created!.id })
      .returning();
    const categories = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.sectionId, oldSectionId))
      .orderBy(asc(categoriesTable.position));
    for (const category of categories) {
      const { id: oldCategoryId, sectionId: _s, ...categoryRest } = category;
      const [newCategory] = await db
        .insert(categoriesTable)
        .values({ ...categoryRest, sectionId: newSection!.id })
        .returning();
      if (!opts.copyContent) continue;
      const items = await db
        .select()
        .from(itemsTable)
        .where(eq(itemsTable.categoryId, oldCategoryId))
        .orderBy(asc(itemsTable.position));
      const oldItemIds = items.map((i) => i.id);
      const media = oldItemIds.length
        ? await db
            .select()
            .from(mediaTable)
            .where(inArray(mediaTable.itemId, oldItemIds))
        : [];
      for (const item of items) {
        const { id: oldItemId, categoryId: _c, ...itemRest } = item;
        const [newItem] = await db
          .insert(itemsTable)
          .values({ ...itemRest, categoryId: newCategory!.id })
          .returning();
        const itemMedia = media.filter((m) => m.itemId === oldItemId);
        if (itemMedia.length) {
          await db.insert(mediaTable).values(
            itemMedia.map(({ id: _m, itemId: _i, ...mediaRest }) => ({
              ...mediaRest,
              itemId: newItem!.id,
            })),
          );
        }
      }
    }
  }
  return created!;
}

export default router;
