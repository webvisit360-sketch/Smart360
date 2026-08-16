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
import { checkSlugAvailability } from "../lib/slug";
import { checkTenantMedia, dropBrokenReferences } from "../lib/mediaCheck";
import { invalidateTenantCache } from "./publicTenants";
import { tenantAliasesTable } from "@workspace/db";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { guestUrl, guestQrSvg } from "../lib/guestUrl";
import { WORDMARK_SVG } from "../lib/wordmark";

/** Public guest address for a slug (dev domain now, smart360.info later). */
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
  const verdict = await checkSlugAvailability(slug);
  if (!verdict.available) {
    res.status(409).json({ error: `slug ${verdict.reason}` });
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
      invalidateTenantCache(); // a public 404 may have been negatively cached for this slug
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
  invalidateTenantCache();
  await logChange({
    tenantId: tenant!.id,
    tenantName: name,
    action: "create",
    entity: "tenant",
  });
  res.status(201).json(CreateTenantResponse.parse(serialize(tenant)));
});

router.get("/admin/slug-check", async (req, res): Promise<void> => {
  const slug = String(req.query["slug"] ?? "").trim().toLowerCase();
  const tenantId = req.query["tenantId"] ? String(req.query["tenantId"]) : undefined;
  const verdict = await checkSlugAvailability(slug, tenantId);
  res.json({ slug, available: verdict.available, reason: verdict.reason });
});

router.get("/admin/tenants/:id/qr.png", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [tenant] = await db
    .select({ slug: tenantsTable.slug })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, id));
  if (!tenant) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const png = await QRCode.toBuffer(guestUrl(tenant.slug), {
    type: "png",
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  res.setHeader("Content-Type", "image/png");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="smart360-${tenant.slug}-qr.png"`,
  );
  res.send(png);
});

// A6 label PDF — same card as the guest "Natisni nalepko" output (paket 14):
// wordmark 38 mm, QR 62 mm, name, bilingual caption, address in blue.
router.get("/admin/tenants/:id/label.pdf", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [tenant] = await db
    .select({ slug: tenantsTable.slug, name: tenantsTable.name })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, id));
  if (!tenant) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const MM = 72 / 25.4;
  const pageW = 105 * MM;
  const url = guestUrl(tenant.slug);
  const qrSvg = await guestQrSvg(url);

  const doc = new PDFDocument({ size: [pageW, 148 * MM], margin: 8 * MM });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="smart360-${tenant.slug}-nalepka-a6.pdf"`,
  );
  doc.pipe(res);

  // Wordmark: 38 mm wide, aspect 4712:858.
  const wmW = 38 * MM;
  const wmH = (wmW * 858) / 4712;
  let y = 14 * MM;
  SVGtoPDF(doc, WORDMARK_SVG.replace("<svg ", '<svg fill="#3B78DC" '), (pageW - wmW) / 2, y, {
    width: wmW,
    height: wmH,
    preserveAspectRatio: "xMidYMid meet",
  });
  y += wmH + 6 * MM;

  const qrW = 62 * MM;
  SVGtoPDF(doc, qrSvg, (pageW - qrW) / 2, y, {
    width: qrW,
    height: qrW,
    preserveAspectRatio: "xMidYMid meet",
  });
  y += qrW + 5 * MM;

  doc.font("Helvetica-Bold").fontSize(16).fillColor("#14201F");
  doc.text(tenant.name, 8 * MM, y, { width: pageW - 16 * MM, align: "center" });
  y = doc.y + 2 * MM;
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#14201F");
  doc.text("Skenirajte za vse o nastanitvi in okolici", 8 * MM, y, {
    width: pageW - 16 * MM,
    align: "center",
  });
  doc.font("Helvetica-Oblique").fontSize(9.5).fillColor("#6B7876");
  doc.text("Scan for everything about your stay", 8 * MM, doc.y + 1, {
    width: pageW - 16 * MM,
    align: "center",
  });
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#3B78DC");
  doc.text(url.replace(/^https?:\/\//, ""), 8 * MM, doc.y + 4 * MM, {
    width: pageW - 16 * MM,
    align: "center",
  });
  doc.end();
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
  const publicUrl = guestUrl(tenant.slug);
  const qrSvg = await guestQrSvg(publicUrl);
  res.json(GetTenantResponse.parse(serialize({ ...tree, publicUrl, qrSvg })));
});

/** Enforces documented ranges/enums from ui/urejevalnik-naslovnice.md; returns error message or null. */
function validateThemeCoverFields(data: Record<string, unknown>): string | null {
  const inRange = (v: unknown, min: number, max: number) =>
    v === undefined || v === null || (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max);
  if (data["theme"] !== undefined && !["mediterran", "swipe"].includes(String(data["theme"])))
    return "theme must be 'mediterran' or 'swipe'";
  if (data["coverAlign"] !== undefined && data["coverAlign"] !== null && !["left", "center"].includes(String(data["coverAlign"])))
    return "coverAlign must be 'left' or 'center'";
  if (data["coverTextColor"] !== undefined && data["coverTextColor"] !== null && !/^#[0-9a-fA-F]{6}$/.test(String(data["coverTextColor"])))
    return "coverTextColor must be a hex color like #FFFFFF";
  for (const key of ["navColorCover", "navColor", "navColorOn"]) {
    if (data[key] !== undefined && !/^#[0-9a-fA-F]{6}$/.test(String(data[key])))
      return `${key} must be a hex color like #FFFFFF`;
  }
  if (!inRange(data["coverTitleSize"], 24, 84)) return "coverTitleSize must be 24-84";
  if (!inRange(data["coverTitleOpacity"], 20, 100)) return "coverTitleOpacity must be 20-100";
  if (!inRange(data["coverSubSize"], 12, 40)) return "coverSubSize must be 12-40";
  if (!inRange(data["coverSubOpacity"], 20, 100)) return "coverSubOpacity must be 20-100";
  if (!inRange(data["coverMetaSize"], 12, 32)) return "coverMetaSize must be 12-32";
  if (!inRange(data["coverMetaOpacity"], 20, 100)) return "coverMetaOpacity must be 20-100";
  if (!inRange(data["coverVeil"], 0, 60)) return "coverVeil must be 0-60";
  if (!inRange(data["tileVeil"], 0, 60)) return "tileVeil must be 0-60";
  if (!inRange(data["textScale"], 80, 200)) return "textScale must be 80-200";
  // First-screen logo placement (logotip-stranke-naslovnica.md §3).
  if (!inRange(data["logoW"], 8, 60)) return "logoW must be 8-60";
  if (!inRange(data["logoX"], 0, 100)) return "logoX must be 0-100";
  if (!inRange(data["logoY"], 0, 100)) return "logoY must be 0-100";
  if (!inRange(data["logoOpacity"], 20, 100)) return "logoOpacity must be 20-100";
  if (data["textFont"] !== undefined && data["textFont"] !== null &&
      !["figtree", "system", "georgia", "verdana", "menlo"].includes(String(data["textFont"])))
    return "textFont must be one of figtree, system, georgia, verdana, menlo";
  if (data["textColor"] !== undefined && data["textColor"] !== null && !/^#[0-9a-fA-F]{6}$/.test(String(data["textColor"])))
    return "textColor must be a hex color like #14201F";
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
  const [before] = await db
    .select({ slug: tenantsTable.slug })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, id));
  if (!before) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const newSlug = (parsed.data as Record<string, unknown>)["slug"];
  if (typeof newSlug === "string" && newSlug !== before.slug) {
    const verdict = await checkSlugAvailability(newSlug, id);
    if (!verdict.available) {
      res.status(409).json({ error: `slug ${verdict.reason}` });
      return;
    }
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
  if (typeof newSlug === "string" && newSlug !== before.slug) {
    // Keep the old address working forever: permanent alias -> 301.
    await db
      .insert(tenantAliasesTable)
      .values({ slug: before.slug, tenantId: id })
      .onConflictDoNothing();
    // If the tenant reclaimed one of its own old slugs, drop that alias.
    await db
      .delete(tenantAliasesTable)
      .where(eq(tenantAliasesTable.slug, newSlug));
  }
  invalidateTenantCache();
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
  invalidateTenantCache();
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
  const dupVerdict = await checkSlugAvailability(slug);
  if (!dupVerdict.available) {
    res.status(409).json({ error: `slug ${dupVerdict.reason}` });
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
  invalidateTenantCache(); // a public 404 may have been negatively cached for this slug
  // Duplication hygiene: the copy must not inherit references to files that
  // no longer exist or don't fit the field (e.g. opaque JPEG as transparent
  // logo). Re-check everything against the CURRENT bucket and drop misses.
  const dropped = await dropBrokenReferences(created.id);
  const [fresh] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, created.id));
  await logChange({
    tenantId: created.id,
    tenantName: name,
    action: "duplicate",
    entity: "tenant",
    detail: dropped.length ? `kopija (izpuščenih ${dropped.length} neveljavnih referenc)` : `kopija`,
  });
  res.status(201).json(
    DuplicateTenantResponse.parse({
      tenant: serialize(fresh ?? created),
      dropped: dropped.map(({ field, label, url, reason, adminPath }) => ({ field, label, url, reason, adminPath })),
    }),
  );
});

router.get("/admin/tenants/:id/media-check", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [exists] = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.id, id));
  if (!exists) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const issues = await checkTenantMedia(id);
  res.json({
    issues: issues.map(({ field, label, url, reason, adminPath }) => ({ field, label, url, reason, adminPath })),
  });
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
