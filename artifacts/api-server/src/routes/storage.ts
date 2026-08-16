import { Router, type IRouter } from "express";
import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import {
  db,
  itemsTable,
  categoriesTable,
  sectionsTable,
  tenantsTable,
  tenantAliasesTable,
  mediaTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/adminAuth";
import {
  getMediaUsageBySlug,
  invalidateMediaUsage,
  admitUpload,
  formatGb,
  type Admission,
} from "../lib/mediaUsage";
import {
  ObjectStorageService,
  objectStorageClient,
} from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();

// The widths every photo is stored in. Admin thumbnails use 200,
// tiles use 620, gallery/lightbox uses 1400. Never store phone originals.
export const IMG_WIDTHS = [200, 620, 1400] as const;
const JPEG_QUALITY: Record<number, number> = { 200: 60, 620: 65, 1400: 75 };

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
  const wParam = String(req.query["w"] ?? "");
  const w = wParam === "200" ? 200 : wParam === "620" ? 620 : 1400;
  try {
    // Fall back across widths rather than serving a broken image — older
    // photos have no 200 px derivative, logos are stored only under 620.
    let object = await storage.searchPublicObject(`media/${slug}/${w}/${file}`);
    if (!object) {
      for (const alt of IMG_WIDTHS.filter((x) => x !== w)) {
        object = await storage.searchPublicObject(`media/${slug}/${alt}/${file}`);
        if (object) break;
      }
    }
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
// Video pipeline (admin-slicice-in-video.md): the item gallery is ONE ordered
// list of photos AND videos. Videos are transcoded to H.264/AAC mp4 with the
// moov atom at the front (faststart — iOS refuses to start playing without
// it), capped at 1080p and 3 minutes; a poster frame at 1 s becomes a JPEG
// with the same width variants as photos (so a video can be the tile).
// ---------------------------------------------------------------------------
const execFileP = promisify(execFile);
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const VIDEO_MAX_SECONDS = 180;

// Transcodes run ONE at a time: ffmpeg on a 100 MB clip can eat a core and
// hundreds of MB of RAM, and nothing stops an admin from dropping ten files
// at once. The admin UI also serialises uploads, this is the backstop.
let videoLock: Promise<void> = Promise.resolve();
function withVideoLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = videoLock.then(fn);
  videoLock = run.then(() => undefined, () => undefined);
  return run;
}
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

function isVideoUpload(file: Express.Multer.File): boolean {
  return file.mimetype.startsWith("video/") || VIDEO_EXT.test(file.originalname);
}

/** Readable object names: meli-pu_apart_04 instead of IMG_6207. */
export function mediaBaseName(slug: string, itemTitle: string | null, seq: number): string {
  const item = (itemTitle ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "vnos";
  // Short suffix keeps names unique when photos are deleted and re-added.
  const uniq = randomUUID().slice(0, 4);
  return `${slug}_${item}_${String(seq).padStart(2, "0")}-${uniq}`;
}

async function ffprobeMeta(path: string): Promise<{
  durationSec: number; width: number; height: number; vcodec: string;
}> {
  const { stdout } = await execFileP("ffprobe", [
    "-v", "error", "-print_format", "json",
    "-show_format", "-show_streams", path,
  ]);
  const meta = JSON.parse(stdout);
  const v = (meta.streams ?? []).find((s: { codec_type?: string }) => s.codec_type === "video");
  if (!v) throw new Error("no video stream");
  return {
    durationSec: Number(meta.format?.duration ?? v.duration ?? 0),
    width: Number(v.width ?? 0),
    height: Number(v.height ?? 0),
    vcodec: String(v.codec_name ?? ""),
  };
}

/**
 * Transcode + poster + upload. Returns URLs and duration for the media row.
 */
export async function storeVideo(
  slug: string,
  base: string,
  original: Buffer,
  originalName: string,
): Promise<{ url: string; posterUrl: string; durationSec: number }> {
  const searchPath = storage.getPublicObjectSearchPaths()[0];
  if (!searchPath) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set");
  const dir = await mkdtemp(join(tmpdir(), "s360video-"));
  const ext = (originalName.match(VIDEO_EXT)?.[1] ?? "mp4").toLowerCase();
  const inPath = join(dir, `in.${ext}`);
  const outPath = join(dir, "out.mp4");
  const posterPath = join(dir, "poster.jpg");
  try {
    await writeFile(inPath, original);
    const probe = await ffprobeMeta(inPath);
    if (!probe.durationSec || probe.durationSec > VIDEO_MAX_SECONDS) {
      throw Object.assign(
        new Error(`Video je predolg (${Math.round(probe.durationSec)} s). Omejitev je 3 minute.`),
        { status: 400 },
      );
    }
    if (probe.width * probe.height > 4096 * 4096) {
      throw Object.assign(
        new Error("Video ima preveliko ločljivost. Omejitev je 4K."),
        { status: 400 },
      );
    }
    // Transcode: H.264/AAC, max 1080p, even dimensions, faststart.
    await execFileP("ffmpeg", [
      "-y", "-i", inPath,
      "-vf", "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      outPath,
    ], { timeout: 10 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 });
    // Poster frame at 1 s (or 0 s when the clip is shorter).
    const posterAt = probe.durationSec > 1.2 ? "1" : "0";
    await execFileP("ffmpeg", [
      "-y", "-ss", posterAt, "-i", outPath,
      "-frames:v", "1", "-q:v", "3", posterPath,
    ], { timeout: 60 * 1000, maxBuffer: 16 * 1024 * 1024 });

    const finalMeta = await ffprobeMeta(outPath);
    const videoName = `${base}.mp4`;
    const posterName = `${base}-poster.jpg`;
    const videoBuf = await readFile(outPath);
    const { bucketName, objectName } = parseObjectPath(
      `${searchPath}/media/${slug}/video/${videoName}`,
    );
    await objectStorageClient
      .bucket(bucketName)
      .file(objectName)
      .save(videoBuf, { contentType: "video/mp4" });
    await storePhotoVariants(slug, posterName, await readFile(posterPath));
    return {
      url: `/api/storage/video/${slug}/${videoName}`,
      posterUrl: `/api/storage/img/${slug}/${posterName}`,
      durationSec: finalMeta.durationSec,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// GET /storage/video/:slug/:file — serve a stored video WITH Range support.
// iOS Safari sends Range requests and will not play (or seek) without 206s.
// ---------------------------------------------------------------------------
router.get("/storage/video/:slug/:file", async (req, res): Promise<void> => {
  const slug = String(req.params["slug"] ?? "");
  const file = String(req.params["file"] ?? "");
  if (!/^[a-z0-9-]+$/i.test(slug) || !/^[\w.-]+$/.test(file)) {
    res.status(400).json({ error: "Bad path" });
    return;
  }
  try {
    const object = await storage.searchPublicObject(`media/${slug}/video/${file}`);
    if (!object) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [meta] = await object.getMetadata();
    const size = Number(meta.size ?? 0);
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    let start = 0;
    let end = size - 1;
    if (range && size > 0 && (range[1] || range[2])) {
      start = range[1] ? parseInt(range[1], 10) : Math.max(0, size - parseInt(range[2]!, 10));
      end = range[1] && range[2] ? Math.min(parseInt(range[2], 10), size - 1) : end;
      if (start > end || start >= size) {
        res.status(416).setHeader("Content-Range", `bytes */${size}`).end();
        return;
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    }
    res.setHeader("Content-Length", String(end - start + 1));
    const stream = object.createReadStream({ start, end });
    stream.on("error", () => { if (!res.headersSent) res.status(500); res.end(); });
    stream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "storage video serve failed");
    if (!res.headersSent) res.status(500).json({ error: "Storage error" });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/items/:id/media/upload — manager uploads a photo OR video for
// an item. Photos are resized to the serving widths (never stores the phone
// original, EXIF stripped after auto-rotate); videos are transcoded (above).
// A media row is appended; position 0 is the tile image (poster for videos).
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VIDEO_MAX_BYTES },
});

/** All slugs a tenant has ever had — media objects stay under old prefixes. */
async function tenantSlugs(tenantId: string): Promise<string[]> {
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

/** Quota admission for one upload; see mediaUsage.admitUpload. */
async function admitTenantUpload(
  tenantId: string,
  quotaBytes: number,
  incomingBytes: number,
): Promise<Admission> {
  return admitUpload(tenantId, await tenantSlugs(tenantId), quotaBytes, incomingBytes);
}

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
      .select({
        itemId: itemsTable.id,
        slug: tenantsTable.slug,
        tenantId: tenantsTable.id,
        quotaBytes: tenantsTable.mediaQuotaBytes,
      })
      .from(itemsTable)
      .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .innerJoin(tenantsTable, eq(sectionsTable.tenantId, tenantsTable.id))
      .where(eq(itemsTable.id, itemId));
    if (!row) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    // Soft quota: refuse NEW uploads at 100 %, never touch existing content.
    // Counts every slug the tenant has ever had (renames keep old prefixes)
    // and reserves the incoming bytes so parallel uploads can't slip under.
    const admission = await admitTenantUpload(row.tenantId, row.quotaBytes, req.file.size);
    if (!admission.ok) {
      res.status(400).json({
        error: `Prostor za medije te namestitve je poln (${formatGb(admission.usedBytes)} / ${formatGb(admission.quotaBytes)}). Novo nalaganje ni mogoče — povečajte kvoto ali se obrnite na skrbnika.`,
      });
      return;
    }
    res.once("finish", admission.release);
    const [{ title: itemTitle }] = await db
      .select({ title: itemsTable.title })
      .from(itemsTable)
      .where(eq(itemsTable.id, itemId));
    const [{ n: seq }] = (await db
      .select({ n: sql<number>`coalesce(max(${mediaTable.position}), -1) + 2` })
      .from(mediaTable)
      .where(eq(mediaTable.itemId, itemId))) as [{ n: number }];
    const base = mediaBaseName(row.slug, itemTitle ?? null, Number(seq));

    const video = isVideoUpload(req.file);
    let url: string;
    let posterUrl: string | null = null;
    let durationSec: number | null = null;
    if (video) {
      try {
        const file = req.file;
        const out = await withVideoLock(() =>
          storeVideo(row.slug, base, file.buffer, file.originalname),
        );
        url = out.url;
        posterUrl = out.posterUrl;
        durationSec = out.durationSec;
      } catch (err) {
        const status = (err as { status?: number }).status ?? 500;
        req.log.error({ err }, "video upload failed");
        res.status(status).json({
          error: status === 400
            ? (err as Error).message
            : "Obdelava videa ni uspela. Podprti so mp4, webm in mov do 100 MB in 3 minute.",
        });
        return;
      }
    } else {
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
      const name = `${base}.jpg`;
      try {
        await storePhotoVariants(row.slug, name, req.file.buffer);
      } catch (err) {
        req.log.error({ err }, "photo upload failed");
        res.status(500).json({ error: "Upload failed" });
        return;
      }
      url = `/api/storage/img/${row.slug}/${name}`;
    }
    // Atomic position allocation: wrap in a transaction and lock the item row
    // with SELECT … FOR UPDATE so that concurrent uploads for the same item
    // serialise here. Without the lock every concurrent INSERT reads the same
    // max(position) snapshot and they all land on the same slot.
    const [media] = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT 1 FROM ${itemsTable} WHERE ${itemsTable.id} = ${itemId} FOR UPDATE`,
      );
      return tx
        .insert(mediaTable)
        .values({
          itemId,
          url,
          kind: video ? "video" : "image",
          posterUrl,
          durationSec,
          position: sql<number>`(select coalesce(max(${mediaTable.position}), -1) + 1 from ${mediaTable} where ${mediaTable.itemId} = ${itemId})`,
        })
        .returning();
    });
    invalidateMediaUsage();
    res.status(201).json(media);
  },
);

// ---------------------------------------------------------------------------
// GET /admin/storage/usage — object-storage consumption per tenant, largest
// first, plus the grand total. Numbers come from a bucket listing (cached
// 5 min), so they reflect what is actually stored — including objects still
// referenced by duplicated tenants.
// ---------------------------------------------------------------------------
router.get("/admin/storage/usage", requireAdmin, async (_req, res): Promise<void> => {
  const [bySlug, tenants, aliases] = await Promise.all([
    getMediaUsageBySlug(),
    db
      .select({
        tenantId: tenantsTable.id,
        slug: tenantsTable.slug,
        name: tenantsTable.name,
        quotaBytes: tenantsTable.mediaQuotaBytes,
      })
      .from(tenantsTable),
    db
      .select({ slug: tenantAliasesTable.slug, tenantId: tenantAliasesTable.tenantId })
      .from(tenantAliasesTable),
  ]);
  // A tenant's usage covers every slug it has ever had (media objects stay
  // under the prefix they were uploaded to; renames don't move them).
  const slugsByTenant = new Map<string, Set<string>>();
  for (const t of tenants) slugsByTenant.set(t.tenantId, new Set([t.slug]));
  for (const a of aliases) slugsByTenant.get(a.tenantId)?.add(a.slug);
  const rows = tenants
    .map((t) => {
      let usedBytes = 0;
      for (const s of slugsByTenant.get(t.tenantId) ?? []) usedBytes += bySlug.get(s) ?? 0;
      return {
        tenantId: t.tenantId,
        slug: t.slug,
        name: t.name,
        usedBytes,
        quotaBytes: t.quotaBytes,
      };
    })
    .sort((a, b) => b.usedBytes - a.usedBytes);
  // Total counts EVERYTHING under media/ — also orphaned prefixes whose
  // tenant was deleted — so it matches the storage bill, not just the list.
  let totalBytes = 0;
  for (const v of bySlug.values()) totalBytes += v;
  res.json({ totalBytes, tenants: rows });
});

// ---------------------------------------------------------------------------
// Tenant logo pipeline (logotip-melipu.md / logotip-stranke-naslovnica.md).
// ONE upload, TWO derivatives, both kept:
//   logoUrl       trimmed to the artwork, longest side 480, PNG WITH alpha
//                 -> first-screen logo (.brandlogo) sitting on a photo
//   logoSquareUrl 384x384 PNG on WHITE, artwork at 72 % of the canvas
//                 -> round host avatar (.host__av) and tip thumbnail (.tip img)
// Never the square white file on a photo: a white box there reads as a bug.
// ---------------------------------------------------------------------------
export async function storeLogoVariants(
  slug: string,
  original: Buffer,
): Promise<{ logoUrl: string; logoSquareUrl: string; warning?: string }> {
  const searchPath = storage.getPublicObjectSearchPaths()[0];
  if (!searchPath) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set");

  const meta = await sharp(original).metadata();
  const hasAlpha = Boolean(meta.hasAlpha);

  // a) trim: to the alpha bounding box, or to the uniform border colour
  //    (corner-pixel, tolerance 12) when the file is opaque.
  const trimmed = await sharp(original)
    .rotate()
    .ensureAlpha()
    .trim({ threshold: 12 })
    .png()
    .toBuffer();

  // b) transparent source: longest side 480, keep alpha.
  const transparent = await sharp(trimmed)
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  // Square-on-white composer: artwork centred at `pct` of the canvas.
  // 72 % for avatars/icons; 60 % for the maskable icon, because Android
  // may crop up to 20 % per side.
  const onWhite = async (canvas: number, pct: number): Promise<Buffer> => {
    const inner = Math.round(canvas * pct);
    const art = await sharp(trimmed)
      .resize({ width: inner, height: inner, fit: "inside" })
      .toBuffer();
    const artMeta = await sharp(art).metadata();
    const left = Math.round((canvas - (artMeta.width ?? inner)) / 2);
    const top = Math.round((canvas - (artMeta.height ?? inner)) / 2);
    return sharp({
      create: { width: canvas, height: canvas, channels: 3, background: "#ffffff" },
    })
      .composite([{ input: art, left, top }])
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer();
  };

  // c) square avatar (.host__av / .tip img).
  const square = await onWhite(384, 0.72);

  // d) home-screen icons: a guest installs the APARTMENT and must recognise
  //    it on a crowded home screen — tenant artwork, not the Smart360 mark.
  const icon512 = await onWhite(512, 0.72);
  const icon192 = await onWhite(192, 0.72);
  const iconMask512 = await onWhite(512, 0.6);
  const icon180 = await onWhite(180, 0.72);

  const id = randomUUID();
  const files: Array<[string, Buffer]> = [
    [`${id}-prosojni.png`, transparent],
    [`${id}-kvadrat.png`, square],
    [`${id}-ikona-512.png`, icon512],
    [`${id}-ikona-192.png`, icon192],
    [`${id}-ikona-maskable-512.png`, iconMask512],
    [`${id}-ikona-180.png`, icon180],
  ];
  for (const [name, buf] of files) {
    // Stored once under the 620 folder; the serve route's width fallback
    // finds it for ?w=1400 requests too.
    const { bucketName, objectName } = parseObjectPath(
      `${searchPath}/media/${slug}/620/${name}`,
    );
    await objectStorageClient
      .bucket(bucketName)
      .file(objectName)
      .save(buf, { contentType: "image/png" });
  }
  const result = {
    logoUrl: `/api/storage/img/${slug}/${id}-prosojni.png`,
    logoSquareUrl: `/api/storage/img/${slug}/${id}-kvadrat.png`,
  };
  return hasAlpha
    ? result
    : {
        ...result,
        warning:
          "Logotip nima prosojnega ozadja — na fotografiji bo viden bel okvir.",
      };
}

// ---------------------------------------------------------------------------
// POST /admin/tenants/:id/hero/upload  — replace the tenant hero image.
// POST /admin/tenants/:id/logo/upload  — replace the tenant logo image.
// Hero resizes to 620/1400 via storePhotoVariants; the logo derives the
// transparent + square pair via storeLogoVariants. Both update the DB.
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
    .select({
      id: tenantsTable.id,
      slug: tenantsTable.slug,
      quotaBytes: tenantsTable.mediaQuotaBytes,
    })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  // Hero/logo replacements write new objects too — same quota as the gallery.
  const admission = await admitTenantUpload(tenant.id, tenant.quotaBytes, req.file.size);
  if (!admission.ok) {
    res.status(400).json({
      error: `Prostor za medije te namestitve je poln (${formatGb(admission.usedBytes)} / ${formatGb(admission.quotaBytes)}). Novo nalaganje ni mogoče — povečajte kvoto.`,
    });
    return;
  }
  res.once("finish", admission.release);
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
  let patch: Partial<typeof tenantsTable.$inferInsert>;
  let warning: string | undefined;
  try {
    if (column === "logoUrl") {
      const out = await storeLogoVariants(tenant.slug, req.file.buffer);
      patch = { logoUrl: out.logoUrl, logoSquareUrl: out.logoSquareUrl };
      warning = out.warning;
    } else {
      const name = `${randomUUID()}.jpg`;
      await storePhotoVariants(tenant.slug, name, req.file.buffer);
      patch = { heroUrl: `/api/storage/img/${tenant.slug}/${name}` };
    }
  } catch (err) {
    req.log.error({ err }, "tenant image upload failed");
    res.status(500).json({ error: "Upload failed" });
    return;
  }
  invalidateMediaUsage();
  const [updated] = await db
    .update(tenantsTable)
    .set(patch)
    .where(eq(tenantsTable.id, tenantId))
    .returning({
      heroUrl: tenantsTable.heroUrl,
      logoUrl: tenantsTable.logoUrl,
      logoSquareUrl: tenantsTable.logoSquareUrl,
    });
  res.status(200).json({
    heroUrl: updated?.heroUrl,
    logoUrl: updated?.logoUrl,
    logoSquareUrl: updated?.logoSquareUrl,
    ...(warning ? { warning } : {}),
  });
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
