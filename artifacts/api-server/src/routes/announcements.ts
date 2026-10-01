import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { and, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db, tenantsTable, tenantAliasesTable, tenantAnnouncementsTable } from "@workspace/db";
import {
  GetGuestAnnouncementsParams, GetGuestAnnouncementsResponse,
  GetTenantAnnouncementsParams, GetTenantAnnouncementsResponse,
  CreateTenantAnnouncementParams, CreateTenantAnnouncementResponse,
  UpdateTenantAnnouncementParams, UpdateTenantAnnouncementResponse,
  DeleteTenantAnnouncementParams, UploadTenantAnnouncementImageParams,
  UploadTenantAnnouncementImageResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/adminAuth";
import { announcementContentError, parseAnnouncementWrite } from "../lib/announcementHelpers";
import { admitTenantUpload, storePhotoVariants } from "./storage";
import { invalidateMediaUsage } from "../lib/mediaUsage";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const noStore = (res: Response) => {
  res.set("Cache-Control", "no-store");
  res.locals["skipAdminMutationInvalidation"] = true;
};
const serialize = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
const missing = (res: Response) => res.status(404).json({ error: "Obvestilo ali nastanitev ni na voljo." });

async function livingTenant(id: string) {
  const [tenant] = await db.select().from(tenantsTable)
    .where(and(eq(tenantsTable.id, id), eq(tenantsTable.guestUiMode, "living-guide")));
  return tenant;
}

async function imageBelongsToTenant(imageUrl: string | null | undefined, tenantId: string): Promise<boolean> {
  if (!imageUrl?.startsWith("/api/storage/img/")) return true;
  const slug = imageUrl.split("/")[4];
  const [tenant] = await db.select({ id: tenantsTable.id }).from(tenantsTable)
    .where(and(eq(tenantsTable.id, tenantId), eq(tenantsTable.slug, slug!)));
  if (tenant) return true;
  const [alias] = await db.select({ slug: tenantAliasesTable.slug }).from(tenantAliasesTable)
    .where(and(eq(tenantAliasesTable.tenantId, tenantId), eq(tenantAliasesTable.slug, slug!)));
  return !!alias;
}

router.get("/guest/:slug/announcements", async (req, res): Promise<void> => {
  noStore(res);
  const params = GetGuestAnnouncementsParams.safeParse(req.params);
  if (!params.success) { missing(res); return; }
  const slug = params.data.slug;
  const [direct] = await db.select({ id: tenantsTable.id }).from(tenantsTable)
    .where(and(eq(tenantsTable.slug, slug), eq(tenantsTable.isPublished, true),
      eq(tenantsTable.guestUiMode, "living-guide")));
  let tenantId = direct?.id;
  if (!tenantId) {
    const [alias] = await db.select({ id: tenantsTable.id }).from(tenantAliasesTable)
      .innerJoin(tenantsTable, eq(tenantAliasesTable.tenantId, tenantsTable.id))
      .where(and(eq(tenantAliasesTable.slug, slug), eq(tenantsTable.isPublished, true),
        eq(tenantsTable.guestUiMode, "living-guide")));
    tenantId = alias?.id;
  }
  if (!tenantId) { missing(res); return; }
  const announcements = await db.select().from(tenantAnnouncementsTable).where(and(
    eq(tenantAnnouncementsTable.tenantId, tenantId),
    isNull(tenantAnnouncementsTable.deletedAt),
    lte(tenantAnnouncementsTable.validFrom, sql`now()`),
    or(isNull(tenantAnnouncementsTable.validTo), sql`now() <= ${tenantAnnouncementsTable.validTo}`),
  )).orderBy(desc(tenantAnnouncementsTable.createdAt), desc(tenantAnnouncementsTable.id));
  res.json(GetGuestAnnouncementsResponse.parse(serialize({ announcements })));
});

router.get("/admin/tenants/:tenantId/announcements", requireAdmin, async (req, res): Promise<void> => {
  noStore(res);
  const params = GetTenantAnnouncementsParams.safeParse(req.params);
  if (!params.success || !await livingTenant(params.data.tenantId)) { missing(res); return; }
  const announcements = await db.select().from(tenantAnnouncementsTable)
    .where(and(eq(tenantAnnouncementsTable.tenantId, params.data.tenantId), isNull(tenantAnnouncementsTable.deletedAt)))
    .orderBy(desc(tenantAnnouncementsTable.createdAt), desc(tenantAnnouncementsTable.id));
  res.json(GetTenantAnnouncementsResponse.parse(serialize({ announcements })));
});

router.post("/admin/tenants/:tenantId/announcements", requireAdmin, async (req, res): Promise<void> => {
  noStore(res);
  const params = CreateTenantAnnouncementParams.safeParse(req.params);
  if (!params.success || !await livingTenant(params.data.tenantId)) { missing(res); return; }
  const parsed = parseAnnouncementWrite(req.body);
  if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
  const data = { ...parsed.data, validFrom: parsed.data.validFrom ?? new Date(), validTo: parsed.data.validTo ?? null };
  const error = announcementContentError(data);
  if (error) { res.status(400).json({ error }); return; }
  if (!await imageBelongsToTenant(data.imageUrl, params.data.tenantId)) { missing(res); return; }
  const [announcement] = await db.insert(tenantAnnouncementsTable)
    .values({ ...data, tenantId: params.data.tenantId }).returning();
  res.status(201).json(CreateTenantAnnouncementResponse.parse(serialize({ announcement })));
});

router.patch("/admin/tenants/:tenantId/announcements/:announcementId", requireAdmin, async (req, res): Promise<void> => {
  noStore(res);
  const params = UpdateTenantAnnouncementParams.safeParse(req.params);
  if (!params.success || !await livingTenant(params.data.tenantId)) { missing(res); return; }
  const parsed = parseAnnouncementWrite(req.body, true);
  if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
  if (!await imageBelongsToTenant(parsed.data.imageUrl, params.data.tenantId)) { missing(res); return; }
  const where = and(eq(tenantAnnouncementsTable.id, params.data.announcementId),
    eq(tenantAnnouncementsTable.tenantId, params.data.tenantId), isNull(tenantAnnouncementsTable.deletedAt));
  const result = await db.transaction(async (tx) => {
    const [previous] = await tx.select().from(tenantAnnouncementsTable).where(where).for("update");
    if (!previous) return { missing: true } as const;
    const error = announcementContentError({ ...previous, ...parsed.data });
    if (error) return { error } as const;
    const [announcement] = await tx.update(tenantAnnouncementsTable)
      .set({ ...parsed.data, updatedAt: new Date() }).where(where).returning();
    return { announcement } as const;
  });
  if ("missing" in result) { missing(res); return; }
  if ("error" in result) { res.status(400).json({ error: result.error }); return; }
  res.json(UpdateTenantAnnouncementResponse.parse(serialize({ announcement: result.announcement })));
});

router.delete("/admin/tenants/:tenantId/announcements/:announcementId", requireAdmin, async (req, res): Promise<void> => {
  noStore(res);
  const params = DeleteTenantAnnouncementParams.safeParse(req.params);
  if (!params.success || !await livingTenant(params.data.tenantId)) { missing(res); return; }
  const [removed] = await db.update(tenantAnnouncementsTable).set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tenantAnnouncementsTable.id, params.data.announcementId),
      eq(tenantAnnouncementsTable.tenantId, params.data.tenantId), isNull(tenantAnnouncementsTable.deletedAt)))
    .returning({ id: tenantAnnouncementsTable.id });
  if (!removed) { missing(res); return; }
  res.status(204).end();
});

router.post("/admin/tenants/:tenantId/announcements/image", requireAdmin, (req, res, next) => {
  noStore(res);
  upload.single("file")(req, res, (error: unknown) => {
    if (error) { res.status(400).json({ error: "Slika mora biti manjša od 20 MB." }); return; }
    next();
  });
}, async (req, res): Promise<void> => {
  const params = UploadTenantAnnouncementImageParams.safeParse(req.params);
  const tenant = params.success ? await livingTenant(params.data.tenantId) : null;
  if (!tenant) { missing(res); return; }
  if (!req.file) { res.status(400).json({ error: "Izberite sliko." }); return; }
  try {
    const meta = await sharp(req.file.buffer).metadata();
    if (!meta.width || !meta.height || meta.width * meta.height > 60_000_000) throw new Error("Invalid dimensions");
  } catch {
    res.status(400).json({ error: "Datoteka ni veljavna ali dovolj majhna slika." }); return;
  }
  const admission = await admitTenantUpload(tenant.id, tenant.mediaQuotaBytes, req.file.size);
  if (!admission.ok) { res.status(413).json({ error: "Prostor za medije te nastanitve je poln." }); return; }
  try {
    const name = `${tenant.slug}-obvestilo-${randomUUID()}.jpg`;
    await storePhotoVariants(tenant.slug, name, req.file.buffer);
    invalidateMediaUsage();
    res.status(201).json(UploadTenantAnnouncementImageResponse.parse({ imageUrl: `/api/storage/img/${tenant.slug}/${name}` }));
  } finally {
    admission.release();
  }
});

export default router;