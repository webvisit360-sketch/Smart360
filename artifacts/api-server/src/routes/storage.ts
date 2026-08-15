import { Router, type IRouter } from "express";
import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import {
  db,
  itemsTable,
  categoriesTable,
  sectionsTable,
  tenantsTable,
  mediaTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/adminAuth";
import {
  ObjectStorageService,
  objectStorageClient,
} from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();

// The two widths every photo is stored in. Tiles/thumbnails use 620,
// gallery/lightbox uses 1400. Never store phone originals.
export const IMG_WIDTHS = [620, 1400] as const;
const JPEG_QUALITY: Record<number, number> = { 620: 65, 1400: 75 };

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  const bucketName = parts[1] ?? "";
  const objectName = parts.slice(2).join("/");
  return { bucketName, objectName };
}

/**
 * Resize one original into the two serving widths and upload both to the
 * public object dir under media/<slug>/<width>/<name>. Honours the EXIF
 * orientation flag (rotate) and strips metadata; never upscales.
 */
export async function storePhotoVariants(
  slug: string,
  name: string,
  original: Buffer,
): Promise<void> {
  const searchPath = storage.getPublicObjectSearchPaths()[0];
  if (!searchPath) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set");
  for (const w of IMG_WIDTHS) {
    const buf = await sharp(original)
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY[w] ?? 70, mozjpeg: true })
      .toBuffer();
    const { bucketName, objectName } = parseObjectPath(
      `${searchPath}/media/${slug}/${w}/${name}`,
    );
    await objectStorageClient
      .bucket(bucketName)
      .file(objectName)
      .save(buf, { contentType: "image/jpeg" });
  }
}

// ---------------------------------------------------------------------------
// GET /storage/img/:slug/:file?w=620|1400 — serve a stored photo variant.
// Unconditionally public (guest app assets), long cache.
// ---------------------------------------------------------------------------
router.get("/storage/img/:slug/:file", async (req, res): Promise<void> => {
  const slug = String(req.params["slug"] ?? "");
  const file = String(req.params["file"] ?? "");
  if (!/^[a-z0-9-]+$/i.test(slug) || !/^[\w.-]+$/.test(file)) {
    res.status(400).json({ error: "Bad path" });
    return;
  }
  const w = req.query["w"] === "620" ? 620 : 1400;
  try {
    const object =
      (await storage.searchPublicObject(`media/${slug}/${w}/${file}`)) ??
      // fall back to the other width rather than a broken image
      (await storage.searchPublicObject(
        `media/${slug}/${w === 620 ? 1400 : 620}/${file}`,
      ));
    if (!object) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const response = await storage.downloadObject(object, 60 * 60 * 24 * 7);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    // Guest photos are public by design; share-cache them regardless of ACL metadata.
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    req.log.error({ err }, "storage img serve failed");
    if (!res.headersSent) res.status(500).json({ error: "Storage error" });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/items/:id/media/upload — manager uploads a photo for an item.
// The server resizes to the two widths (never stores the phone original)
// and appends a media row; position 0 is the tile image.
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post(
  "/admin/items/:id/media/upload",
  requireAdmin,
  upload.single("file"),
  async (req, res): Promise<void> => {
    const itemId = String(req.params["id"] ?? "");
    if (!req.file) {
      res.status(400).json({ error: "file is required" });
      return;
    }
    const [row] = await db
      .select({ itemId: itemsTable.id, slug: tenantsTable.slug })
      .from(itemsTable)
      .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .innerJoin(tenantsTable, eq(sectionsTable.tenantId, tenantsTable.id))
      .where(eq(itemsTable.id, itemId));
    if (!row) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    // Reject non-images / corrupt files with a 400 before touching storage.
    try {
      const meta = await sharp(req.file.buffer).metadata();
      if (!meta.width || !meta.height || meta.width * meta.height > 60_000_000) {
        res.status(400).json({ error: "Neveljavna ali prevelika slika." });
        return;
      }
    } catch {
      res.status(400).json({ error: "Datoteka ni veljavna slika." });
      return;
    }
    const name = `${randomUUID()}.jpg`;
    try {
      await storePhotoVariants(row.slug, name, req.file.buffer);
    } catch (err) {
      req.log.error({ err }, "photo upload failed");
      res.status(500).json({ error: "Upload failed" });
      return;
    }
    // Atomic position allocation: compute max(position)+1 inside the INSERT
    // so parallel uploads cannot claim the same slot.
    const [media] = await db
      .insert(mediaTable)
      .values({
        itemId,
        url: `/api/storage/img/${row.slug}/${name}`,
        position: sql<number>`(select coalesce(max(${mediaTable.position}), -1) + 1 from ${mediaTable} where ${mediaTable.itemId} = ${itemId})`,
      })
      .returning();
    res.status(201).json(media);
  },
);

// ---------------------------------------------------------------------------
// POST /admin/tenants/:id/hero/upload  — replace the tenant hero image.
// POST /admin/tenants/:id/logo/upload  — replace the tenant logo image.
// Both resize to 620/1400 via storePhotoVariants and update the DB column.
// ---------------------------------------------------------------------------
async function handleTenantImageUpload(
  req: import("express").Request,
  res: import("express").Response,
  column: "heroUrl" | "logoUrl",
): Promise<void> {
  const tenantId = String(req.params["id"] ?? "");
  if (!req.file) {
    res.status(400).json({ error: "file is required" });
    return;
  }
  const [tenant] = await db
    .select({ id: tenantsTable.id, slug: tenantsTable.slug })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  // Validate image before touching storage.
  try {
    const meta = await sharp(req.file.buffer).metadata();
    if (!meta.width || !meta.height || meta.width * meta.height > 60_000_000) {
      res.status(400).json({ error: "Neveljavna ali prevelika slika." });
      return;
    }
  } catch {
    res.status(400).json({ error: "Datoteka ni veljavna slika." });
    return;
  }
  const name = `${randomUUID()}.jpg`;
  try {
    await storePhotoVariants(tenant.slug, name, req.file.buffer);
  } catch (err) {
    req.log.error({ err }, "tenant image upload failed");
    res.status(500).json({ error: "Upload failed" });
    return;
  }
  const url = `/api/storage/img/${tenant.slug}/${name}`;
  const patch = column === "heroUrl" ? { heroUrl: url } : { logoUrl: url };
  const [updated] = await db
    .update(tenantsTable)
    .set(patch)
    .where(eq(tenantsTable.id, tenantId))
    .returning({ heroUrl: tenantsTable.heroUrl, logoUrl: tenantsTable.logoUrl });
  res.status(200).json({ heroUrl: updated?.heroUrl, logoUrl: updated?.logoUrl });
}

router.post(
  "/admin/tenants/:id/hero/upload",
  requireAdmin,
  upload.single("file"),
  (req, res): Promise<void> => handleTenantImageUpload(req, res, "heroUrl"),
);

router.post(
  "/admin/tenants/:id/logo/upload",
  requireAdmin,
  upload.single("file"),
  (req, res): Promise<void> => handleTenantImageUpload(req, res, "logoUrl"),
);

export default router;
