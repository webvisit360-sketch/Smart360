import { randomUUID } from "node:crypto";
import type { File } from "@google-cloud/storage";
import { ObjectStorageService, objectStorageClient } from "./objectStorage";
import { gpxEnvironment, gpxObjectFile } from "../routes/gpx";
import { invalidateMediaUsage } from "./mediaUsage";

export class TenantDuplicateError extends Error {}

/** No writes during discovery/admission. Each copied object gets a unique name. */
export async function planTenantFiles(data: unknown, sourceId: string, targetId: string, slug: string) {
  const storage = new ObjectStorageService();
  const path = storage.getPublicObjectSearchPaths()[0].replace(/^\/|\/$/g, "").split("/");
  const bucket = objectStorageClient.bucket(path.shift()!);
  const prefix = path.join("/");
  const serialized = JSON.stringify(data);
  const replacements = new Map<string, string>();
  const copies: { source: File; target: File; size: number; generation: string }[] = [];
  const urls = new Set(serialized.match(/\/api\/storage\/(?:img|video)\/[a-zA-Z0-9-]+\/[\w.-]+/g) ?? []);
  for (const url of urls) {
    const [, , , kind, oldSlug, filename] = url.split("/");
    const newName = `${randomUUID()}-${filename}`;
    const widths = kind === "img" ? ["200", "620", "1400"] : ["video"];
    let found = 0;
    for (const width of widths) {
      const source = bucket.file(`${prefix}/media/${oldSlug}/${width}/${filename}`);
      try {
        const [meta] = await source.getMetadata();
        copies.push({ source, target: bucket.file(`${prefix}/media/${slug}/${width}/${newName}`),
          size: Number(meta.size), generation: String(meta.generation) });
        found++;
      } catch (e) {
        if ((e as { code?: number }).code !== 404) throw e;
      }
    }
    if (!found) throw new TenantDuplicateError(`Manjka datoteka ${filename}. Podvajanje ni bilo izvedeno.`);
    replacements.set(url, `/api/storage/${kind}/${slug}/${newName}`);
  }
  const gpxIds = new Map<string, string>();
  function findGpx(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(findGpx); return; }
    const obj = value as Record<string, any>;
    if (obj.gpxRoute) {
      if (obj.gpxRoute.environment !== gpxEnvironment()) throw new TenantDuplicateError("GPX pripada drugemu okolju.");
      gpxIds.set(obj.gpxRoute.fileId, gpxIds.get(obj.gpxRoute.fileId) ?? randomUUID());
    }
    Object.values(obj).forEach(findGpx);
  }
  findGpx(data);
  for (const [oldId, newId] of gpxIds) {
    const source = gpxObjectFile(gpxEnvironment(), sourceId, oldId);
    const [meta] = await source.getMetadata();
    copies.push({ source, target: gpxObjectFile(gpxEnvironment(), targetId, newId),
      size: Number(meta.size), generation: String(meta.generation) });
  }
  const bytes = copies.reduce((sum, copy) => sum + copy.size, 0);
  if (!Number.isSafeInteger(bytes)) throw new TenantDuplicateError("Velikosti datotek ni mogoče preveriti.");
  const attempted: File[] = [];
  return {
    bytes,
    count: copies.length,
    manifest: copies.map(({ target }) => ({ bucket: target.bucket.name, name: target.name })),
    rewrite<T>(value: T): T {
      const walk = (v: any): any => {
        if (v instanceof Date) return v;
        if (typeof v === "string") {
          if (gpxIds.has(v)) return gpxIds.get(v);
          for (const [from, to] of [...replacements].sort((a, b) => b[0].length - a[0].length)) v = v.split(from).join(to);
          return v;
        }
        if (Array.isArray(v)) return v.map(walk);
        if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
        return v;
      };
      return walk(value);
    },
    async copy() {
      for (const entry of copies) {
        attempted.push(entry.target);
        // Read the generation admitted above, not a concurrently replaced object.
        await entry.source.bucket.file(entry.source.name, { generation: entry.generation })
          .copy(entry.target, { preconditionOpts: { ifGenerationMatch: 0 } });
      }
      invalidateMediaUsage();
    },
    async rollback() {
      const failures = [];
      for (const file of attempted) {
        let failure: unknown;
        for (let retry = 0; retry < 3; retry++) {
          try { await file.delete({ ignoreNotFound: true }); failure = undefined; break; }
          catch (e) { failure = e; }
        }
        if (failure) failures.push(failure);
      }
      invalidateMediaUsage();
      if (failures.length) throw new AggregateError(failures, "Odstranjevanje začasnih datotek ni uspelo.");
    },
  };
}