/**
 * Living Guide CHECKPOINT 4 — Site-plan images admin routes.
 *
 * All site-plan media rows:
 *   - purpose = 'site-plan'
 *   - tenantId is set, itemId IS NULL (enforced by DB CHECK)
 *   - kind = 'image' (image-only; videos are rejected at upload)
 *   - caption stored in the existing alt column
 *
 * Routes here are upload-EXCLUSIVE from the OpenAPI contract:
 *   POST /admin/tenants/:id/site-plan-images/upload  — outside OpenAPI (multipart)
 *
 * The other four endpoints ARE in the OpenAPI contract and use the generated
 * Zod bodies/responses:
 *   GET    /admin/tenants/:id/site-plan-images
 *   POST   /admin/tenants/:id/site-plan-images/reorder
 *   PATCH  /admin/site-plan-images/:id
 *   DELETE /admin/site-plan-images/:id
 */
import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import multer from "multer";
import sharp from "sharp";
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
} from "drizzle-orm";
import { db, mediaTable, tenantsTable } from "@workspace/db";
import { requireAdmin } from "../lib/adminAuth";
import {
  admitUpload,
  formatGb,
  type Admission,
} from "../lib/mediaUsage";
import {
  ObjectStorageService,
  objectStorageClient,
} from "../lib/objectStorage";
import { IMG_WIDTHS, storePhotoVariants } from "./storage";
import { orientedImageDimensions } from "../lib/mediaDimensions";
import { invalidateMediaUsage } from "../lib/mediaUsage";
import {
  ListSitePlanImagesResponse,
  UpdateSitePlanImageBody,
  UpdateSitePlanImageResponse,
  ReorderSitePlanImagesBody,
} from "@workspace/api-zod";

const router: IRouter = Router();
router.use("/admin", requireAdmin);

function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** Map a raw media row to the SitePlanImage API shape. */
function toSitePlanImage(row: typeof mediaTable.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId!,
    url: row.url,
    caption: row.alt ?? null,
    position: row.position,
    width: row.width ?? null,
    height: row.height ?? null,
  };
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const parts = normalized.split("/");
  return {
    bucketName: parts[1] ?? "",
    objectName: parts.slice(2).join("/"),
  };
}

async function deleteStoredPhotoVariants(url: string): Promise<void> {
  const match =
    /^\/api\/storage\/img\/([a-z0-9-]+)\/([\w.-]+)$/i.exec(url);
  if (!match) return;
  const slug = match[1]!;
  const file = match[2]!;
  const searchPath =
    new ObjectStorageService().getPublicObjectSearchPaths()[0];
  if (!searchPath) return;
  await Promise.all(
    IMG_WIDTHS.map(async (width) => {
      const { bucketName, objectName } = parseObjectPath(
        `${searchPath}/media/${slug}/${width}/${file}`,
      );
      await objectStorageClient
        .bucket(bucketName)
        .file(objectName)
        .delete({ ignoreNotFound: true });
    }),
  );
}

// ---------------------------------------------------------------------------
// GET /admin/tenants/:id/site-plan-images
// ---------------------------------------------------------------------------
router.get("/admin/tenants/:id/site-plan-images", async (req, res): Promise<void> => {
  const tenantId = firstParam(req.params["id"]);
  const [tenant] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  const rows = await db
    .select()
    .from(mediaTable)
    .where(
      and(
        eq(mediaTable.tenantId, tenantId),
        eq(mediaTable.purpose, "site-plan"),
        eq(mediaTable.kind, "image"),
        isNotNull(mediaTable.tenantId),
        isNull(mediaTable.itemId),
      ),
    )
    .orderBy(asc(mediaTable.position));
  res.json(ListSitePlanImagesResponse.parse(rows.map(toSitePlanImage)));
});

// ---------------------------------------------------------------------------
// POST /admin/tenants/:id/site-plan-images/reorder
// ---------------------------------------------------------------------------
router.post(
  "/admin/tenants/:id/site-plan-images/reorder",
  async (req, res): Promise<void> => {
    const tenantId = firstParam(req.params["id"]);
    const parsed = ReorderSitePlanImagesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { ids } = parsed.data;
    if (ids.length === 0) {
      res.status(400).json({ error: "ids must be non-empty" });
      return;
    }
    if (new Set(ids).size !== ids.length) {
      res.status(400).json({ error: "ids must be unique" });
      return;
    }
    const [tenant] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }
    // Verify all ids are site-plan rows belonging to this tenant.
    const rows = await db
      .select({ id: mediaTable.id, purpose: mediaTable.purpose, itemId: mediaTable.itemId, tenantId: mediaTable.tenantId })
      .from(mediaTable)
      .where(inArray(mediaTable.id, ids));
    if (rows.length !== ids.length) {
      res.status(400).json({ error: "One or more ids not found" });
      return;
    }
    for (const row of rows) {
      if (row.purpose !== "site-plan") {
        res.status(400).json({ error: `Row ${row.id} is not a site-plan image` });
        return;
      }
      if (row.itemId !== null) {
        res.status(400).json({ error: `Row ${row.id} is item-scoped and cannot be reordered here` });
        return;
      }
      if (row.tenantId !== tenantId) {
        res.status(400).json({ error: `Row ${row.id} does not belong to this tenant` });
        return;
      }
    }
    // Verify the ids are ALL site-plan images for this tenant (complete set).
    const allSitePlan = await db
      .select({ id: mediaTable.id })
      .from(mediaTable)
      .where(
        and(
          eq(mediaTable.tenantId, tenantId),
          eq(mediaTable.purpose, "site-plan"),
          isNull(mediaTable.itemId),
        ),
      );
    if (allSitePlan.length !== ids.length) {
      res.status(400).json({ error: "ids must include every site-plan image of the tenant" });
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
  },
);

// ---------------------------------------------------------------------------
// PATCH /admin/site-plan-images/:id  — update caption
// ---------------------------------------------------------------------------
router.patch("/admin/site-plan-images/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const parsed = UpdateSitePlanImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Verify the row is a site-plan image (not an item row).
  const [existing] = await db
    .select()
    .from(mediaTable)
    .where(eq(mediaTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (existing.purpose !== "site-plan") {
    res.status(400).json({ error: "This is not a site-plan image" });
    return;
  }
  if (existing.itemId !== null) {
    res.status(400).json({ error: "Site-plan rows cannot be item-scoped" });
    return;
  }
  if (existing.kind !== "image" || existing.tenantId === null) {
    res.status(400).json({ error: "Malformed site-plan row" });
    return;
  }
  const caption =
    parsed.data.caption !== undefined ? parsed.data.caption ?? null : existing.alt;
  const [updated] = await db
    .update(mediaTable)
    .set({ alt: caption })
    .where(eq(mediaTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(UpdateSitePlanImageResponse.parse(toSitePlanImage(updated)));
});

// ---------------------------------------------------------------------------
// DELETE /admin/site-plan-images/:id
// ---------------------------------------------------------------------------
router.delete("/admin/site-plan-images/:id", async (req, res): Promise<void> => {
  const id = firstParam(req.params["id"]);
  const [existing] = await db
    .select()
    .from(mediaTable)
    .where(eq(mediaTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (existing.purpose !== "site-plan") {
    res.status(400).json({ error: "This is not a site-plan image" });
    return;
  }
  if (existing.itemId !== null) {
    res.status(400).json({ error: "Site-plan rows cannot be item-scoped" });
    return;
  }
  if (existing.kind !== "image" || existing.tenantId === null) {
    res.status(400).json({ error: "Malformed site-plan row" });
    return;
  }
  const [sharedReference] = await db
    .select({ id: mediaTable.id })
    .from(mediaTable)
    .where(and(eq(mediaTable.url, existing.url), ne(mediaTable.id, id)))
    .limit(1);
  await db.transaction(async (tx) => {
    if (!sharedReference) {
      await deleteStoredPhotoVariants(existing.url);
    }
    await tx.delete(mediaTable).where(eq(mediaTable.id, id));
  });
  invalidateMediaUsage();
  res.sendStatus(204);
});

// ---------------------------------------------------------------------------
// POST /admin/tenants/:id/site-plan-images/upload  — multipart, OUTSIDE OpenAPI
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max for site-plan images
});

async function tenantSlugsForId(tenantId: string): Promise<string[]> {
  const { tenantAliasesTable } = await import("@workspace/db");
  const [current, aliases] = await Promise.all([
    db
      .select({ slug: tenantsTable.slug })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId)),
    db
      .select({ slug: tenantAliasesTable.slug })
      .from(tenantAliasesTable)
      .where(eq(tenantAliasesTable.tenantId, tenantId)),
  ]);
  return [...current, ...aliases].map((r) => r.slug);
}

router.post(
  "/admin/tenants/:id/site-plan-images/upload",
  requireAdmin,
  upload.single("file"),
  async (req, res): Promise<void> => {
    const tenantId = firstParam(req.params["id"]);
    if (!req.file) {
      res.status(400).json({ error: "file is required" });
      return;
    }
    const [tenant] = await db
      .select({ id: tenantsTable.id, slug: tenantsTable.slug, quotaBytes: tenantsTable.mediaQuotaBytes })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }
    // Image-only guard — reject videos or non-image files early.
    if (req.file.mimetype.startsWith("video/")) {
      res.status(400).json({ error: "Site-plan images must be images, not videos." });
      return;
    }

    // Validate image dimensions with EXIF orientation.
    let mediaWidth: number | null = null;
    let mediaHeight: number | null = null;
    try {
      const meta = await sharp(req.file.buffer).metadata();
      const dimensions = orientedImageDimensions(meta);
      if (!dimensions || dimensions.width * dimensions.height > 60_000_000) {
        res.status(400).json({ error: "Neveljavna ali prevelika slika." });
        return;
      }
      mediaWidth = dimensions.width;
      mediaHeight = dimensions.height;
    } catch {
      res.status(400).json({ error: "Datoteka ni veljavna slika." });
      return;
    }

    // Quota check.
    const slugs = await tenantSlugsForId(tenant.id);
    const admission: Admission = await admitUpload(tenant.id, slugs, tenant.quotaBytes, req.file.size);
    if (!admission.ok) {
      res.status(400).json({
        error: `Prostor za medije te namestitve je poln (${formatGb(admission.usedBytes)} / ${formatGb(admission.quotaBytes)}). Novo nalaganje ni mogoče.`,
      });
      return;
    }
    res.once("finish", admission.release);

    // Immutable UUID names keep parallel uploads independent. Position is
    // allocated separately under the tenant row lock below.
    const name = `site-plan-${randomUUID()}.jpg`;
    const url = `/api/storage/img/${tenant.slug}/${name}`;
    try {
      await storePhotoVariants(tenant.slug, name, req.file.buffer);
    } catch (err) {
      await deleteStoredPhotoVariants(url).catch(() => undefined);
      req.log.error({ err }, "site-plan photo upload failed");
      res.status(500).json({ error: "Upload failed" });
      return;
    }

    // Insert the media row.
    let media: typeof mediaTable.$inferSelect | undefined;
    try {
      [media] = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT 1 FROM ${tenantsTable} WHERE ${tenantsTable.id} = ${tenantId} FOR UPDATE`,
        );
        return tx
          .insert(mediaTable)
          .values({
            tenantId,
            itemId: null,
            url,
            kind: "image",
            purpose: "site-plan",
            width: mediaWidth,
            height: mediaHeight,
            position: sql<number>`(select coalesce(max(${mediaTable.position}), -1) + 1 from ${mediaTable} where ${mediaTable.tenantId} = ${tenantId} and ${mediaTable.purpose} = 'site-plan')`,
          })
          .returning();
      });
    } catch (err) {
      await deleteStoredPhotoVariants(url).catch(() => undefined);
      req.log.error({ err }, "site-plan row insert failed");
      res.status(500).json({ error: "Upload failed" });
      return;
    }
    invalidateMediaUsage();
    res.status(201).json(toSitePlanImage(media));
  },
);

export default router;
