import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, itemsTable, categoriesTable, sectionsTable, tenantsTable } from "@workspace/db";
import { ObjectStorageService, objectStorageClient } from "../lib/objectStorage";
import { parseGpx, MAX_GPX_BYTES } from "../lib/gpxParser";
import { readPublishedContent } from "../lib/publishedSnapshots";
import { resolveGuestContentTree } from "../lib/contentTree";
import { requireAdmin } from "../lib/adminAuth";

const router: IRouter = Router();
type GpxRoute = NonNullable<typeof itemsTable.$inferSelect.gpxRoute>;
const storage = new ObjectStorageService();
type UploadDependencies = {
  database: Pick<typeof db, "select" | "update">;
  objectFile: typeof gpxObjectFile;
};
let uploadDependencies: UploadDependencies = { database: db, objectFile: gpxObjectFile };
/** In-process fixture only: never substitute persistence in a deployed service. */
export function setGpxUploadDependenciesForTests(deps: UploadDependencies | null): void {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("GPX fixture overrides are forbidden in production");
  }
  uploadDependencies = deps ?? { database: db, objectFile: gpxObjectFile };
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_GPX_BYTES, files: 1, fields: 1 } });
const routeKeys = new Set([
  "version", "fileId", "filename", "environment", "byteSize", "sha256", "activity",
  "segments", "profile", "distanceKm", "ascentM", "descentM",
  "minElevationM", "maxElevationM", "durationMinutes",
]);
const pointKeys = new Set(["lat", "lon"]);
const profileKeys = new Set(["distanceKm", "elevationM", "segment"]);
function exactKeys(value: object, keys: ReadonlySet<string>): boolean {
  return Object.keys(value).length === keys.size && Object.keys(value).every((key) => keys.has(key));
}

export function gpxEnvironment(): "development" | "production" {
  return process.env.NODE_ENV === "production" || Boolean(process.env.REPLIT_DEPLOYMENT)
    ? "production" : "development";
}

/** Server-generated keys only: never derive any part of an object key from an uploaded name or request path. */
export function gpxObjectFile(environment: "development" | "production", tenantId: string, fileId: string) {
  if (!uuid.test(tenantId) || !uuid.test(fileId)) throw new Error("Invalid GPX object identity");
  const dir = storage.getPrivateObjectDir().replace(/\/+$/, "");
  const [_, bucket, ...prefix] = dir.split("/");
  if (!bucket) throw new Error("Invalid PRIVATE_OBJECT_DIR");
  return objectStorageClient.bucket(bucket).file([...prefix, "gpx", environment, tenantId, `${fileId}.gpx`].join("/"));
}

/** Defend download and guest payload against malformed/oversized legacy snapshot JSON. */
export function isBoundedGpxRoute(route: unknown): route is GpxRoute {
  if (!route || typeof route !== "object" || Array.isArray(route) || !exactKeys(route, routeKeys)) return false;
  const r = route as Record<string, unknown>;
  const number = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  const nullableNumber = (n: unknown) => n === null || number(n);
  const valid = r.version === 1 && typeof r.fileId === "string" && uuid.test(r.fileId)
    && typeof r.filename === "string" && r.filename.length > 0 && r.filename.length <= 255
    && !/[\x00-\x1f\x7f]/.test(r.filename as string)
    && Buffer.from(r.filename as string, "utf8").toString("utf8") === r.filename
    && (r.environment === "production" || r.environment === "development")
    && number(r.byteSize) && (r.byteSize as number) > 0 && (r.byteSize as number) <= MAX_GPX_BYTES
    && typeof r.sha256 === "string" && /^[a-f0-9]{64}$/.test(r.sha256)
    && (r.activity === "cycling" || r.activity === "hiking" || r.activity === "running")
    && Array.isArray(r.segments) && r.segments.length >= 1 && r.segments.length <= 100
    && r.segments.reduce((count: number, segment: unknown) =>
      count + (Array.isArray(segment) ? segment.length : 401), 0) <= 400
    && r.segments.every((segment: unknown) => Array.isArray(segment) && segment.length >= 2 && segment.length <= 400
      && segment.every((point: unknown) => {
        if (!point || typeof point !== "object" || Array.isArray(point) || !exactKeys(point, pointKeys)) return false;
        const p = point as Record<string, unknown>;
        return number(p.lat) && number(p.lon) && (p.lat as number) >= -90
          && (p.lat as number) <= 90 && (p.lon as number) >= -180 && (p.lon as number) <= 180;
      }))
    && Array.isArray(r.profile) && r.profile.length <= 300
    && r.profile.every((point: unknown) => {
      if (!point || typeof point !== "object" || Array.isArray(point) || !exactKeys(point, profileKeys)) return false;
      const p = point as Record<string, unknown>;
      return number(p.distanceKm) && (p.distanceKm as number) >= 0
        && nullableNumber(p.elevationM) && Number.isInteger(p.segment)
        && (p.segment as number) >= 0 && (p.segment as number) < (r.segments as unknown[]).length;
    })
    && number(r.distanceKm) && (r.distanceKm as number) >= 0
    && ["ascentM", "descentM", "minElevationM", "maxElevationM", "durationMinutes"]
      .every((key) => nullableNumber(r[key]));
  if (!valid) return false;
  try {
    return Buffer.byteLength(JSON.stringify(route), "utf8") <= 64 * 1024;
  } catch {
    return false;
  }
}

/** RFC 5987 UTF-8 name with an ASCII-only fallback for older clients. */
export function gpxAttachmentHeader(filename: string): string {
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="route.gpx"; filename*=UTF-8''${encoded}`;
}

function uploadedFilename(originalname: string): string {
  // Busboy defaults multipart filename bytes to latin1, whereas browsers send
  // UTF-8. Decode only a lossless valid UTF-8 sequence; keep legacy latin1.
  const decoded = Buffer.from(originalname, "latin1").toString("utf8");
  const name = decoded.includes("\ufffd") || Buffer.from(decoded, "utf8").toString("latin1") !== originalname
    ? originalname : decoded;
  return name.replace(/[\/\\\x00-\x1f\x7f]/g, "_").slice(0, 255) || "route.gpx";
}

function param(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

// Actor gate runs before this router and binds a host's item to their tenant.
// The host onboarding form uses its own authenticated /admin/host/onboarding/save
// session endpoint, not an anonymous upload token.
router.post("/admin/items/:id/gpx", requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  upload.single("file")(req, res, (error: unknown) => {
    if (error) {
      res.status(error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? 413 : 400)
        .json({ error: error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
          ? "Datoteka GPX presega omejitev 5 MB."
          : "Nalaganje datoteke GPX ni veljavno. Dovoljena je ena datoteka in ena izbira dejavnosti." });
      return;
    }
    next();
  });
}, async (req, res): Promise<void> => {
  const id = param(req.params["id"]);
  if (!uuid.test(id)) { res.status(404).json({ error: "Vnos ni najden." }); return; }
  const file = req.file;
  const requestedActivity: unknown = req.body?.activity;
  if (!file || !file.buffer.length || !["cycling", "hiking", "running", "tek"].includes(requestedActivity as string)) {
    res.status(400).json({ error: "Izberite datoteko GPX in dejavnost (kolesarjenje, pohodništvo ali tek)." });
    return;
  }
  const activity = requestedActivity === "tek" ? "running" : requestedActivity as "cycling" | "hiking" | "running";
  const [owner] = await uploadDependencies.database.select({ tenantId: sectionsTable.tenantId })
    .from(itemsTable).innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(eq(itemsTable.id, id));
  if (!owner) { res.status(404).json({ error: "Vnos ni najden." }); return; }
  let derived: ReturnType<typeof parseGpx>;
  try {
    derived = parseGpx(file.buffer, activity);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error && error.message.startsWith("Neveljavna datoteka GPX:")
      ? error.message : "Datoteka GPX ni veljavna." });
    return;
  }
  const route: GpxRoute = {
    ...derived, version: 1, fileId: randomUUID(),
    filename: uploadedFilename(file.originalname),
    environment: gpxEnvironment(), byteSize: file.buffer.length,
    sha256: createHash("sha256").update(file.buffer).digest("hex"), activity,
  };
  if (!isBoundedGpxRoute(route)) {
    res.status(400).json({ error: "Pot GPX presega dovoljeno velikost prikaza (400 točk, 64 KB)." });
    return;
  }
  let object: ReturnType<typeof gpxObjectFile>;
  try {
    object = uploadDependencies.objectFile(route.environment, owner.tenantId, route.fileId);
    await object.save(file.buffer, { contentType: "application/gpx+xml", resumable: false });
  } catch (error) {
    req.log.error({ error }, "GPX private storage upload failed");
    res.status(500).json({ error: "Datoteke GPX ni bilo mogoče shraniti. Poskusite znova." });
    return;
  }
  // A failed DB write leaves an unreferenced new object; never remove old
  // objects here: the published snapshot can still refer to the old version.
  try {
    const [updated] = await uploadDependencies.database.update(itemsTable).set({ gpxRoute: route })
      .where(eq(itemsTable.id, id)).returning({ id: itemsTable.id });
    if (!updated) {
      await object.delete({ ignoreNotFound: true }).catch(() => undefined);
      res.status(404).json({ error: "Vnos ni najden." });
      return;
    }
  } catch (error) {
    await object.delete({ ignoreNotFound: true }).catch(() => undefined);
    req.log.error({ error }, "GPX item update failed");
    res.status(500).json({ error: "Poti GPX ni bilo mogoče shraniti. Poskusite znova." });
    return;
  }
  res.json(route);
});

router.delete("/admin/items/:id/gpx", requireAdmin, async (req, res): Promise<void> => {
  const id = param(req.params["id"]);
  if (!uuid.test(id)) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db.update(itemsTable).set({ gpxRoute: null })
    .where(eq(itemsTable.id, id)).returning({ id: itemsTable.id });
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  // Never delete the original here: an existing published snapshot still serves it.
  res.sendStatus(204);
});

/** Snapshot-only lookup. No draft row, preview flag, or arbitrary private path is consulted. */
export function publishedGpxForItem(snapshot: Awaited<ReturnType<typeof readPublishedContent>>,
  itemId: string, fileId: string): GpxRoute | null {
  const tree = snapshot.languages?.sl?.tree;
  if (!tree || !Array.isArray(tree.sections)) return null;
  for (const section of resolveGuestContentTree(tree).sections) {
    for (const category of section.categories) {
      for (const item of category.items) {
        if (item.id === itemId && isBoundedGpxRoute(item.gpxRoute) && item.gpxRoute.fileId === fileId) {
          return item.gpxRoute;
        }
      }
    }
  }
  return null;
}

router.get("/public/tenants/:slug/items/:itemId/gpx/:fileId", async (req, res): Promise<void> => {
  const slug = param(req.params["slug"]);
  const itemId = param(req.params["itemId"]);
  const fileId = param(req.params["fileId"]);
  if (!uuid.test(itemId) || !uuid.test(fileId)) { res.status(404).json({ error: "Not found" }); return; }
  const [tenant] = await db.select({ id: tenantsTable.id, isPublished: tenantsTable.isPublished })
    .from(tenantsTable).where(eq(tenantsTable.slug, slug));
  if (!tenant?.isPublished) { res.status(404).json({ error: "Not found" }); return; }
  const snapshot = await readPublishedContent(tenant.id);
  const route = publishedGpxForItem(snapshot, itemId, fileId);
  if (!route || route.environment !== gpxEnvironment()) {
    res.status(404).json({ error: "Not found" }); return;
  }
  const object = gpxObjectFile(route.environment, tenant.id, route.fileId);
  try {
    const [bytes] = await object.download();
    if (bytes.length !== route.byteSize || createHash("sha256").update(bytes).digest("hex") !== route.sha256) {
      throw new Error("Published GPX original failed integrity check");
    }
    res.set("Content-Type", "application/gpx+xml");
    res.set("Cache-Control", "public, max-age=60");
    res.set("Content-Disposition", gpxAttachmentHeader(route.filename));
    res.send(bytes);
  } catch (error) {
    if ((error as { code?: number }).code === 404) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw error;
  }
});

export default router;