import { ObjectStorageService, objectStorageClient } from "./objectStorage.js";

/**
 * Per-tenant media usage and soft-quota admission.
 *
 * Usage is computed straight from object storage (one listing of the media/
 * prefix, sizes summed per slug prefix). The bucket is the source of truth —
 * no byte counters in the DB to drift out of sync. A tenant's usage is the
 * sum over ALL slugs it has ever had (current slug + tenant_aliases), so a
 * slug rename cannot zero out its counted usage.
 *
 * Admission is concurrency-safe within this process: admitUpload() checks
 * used + pending reservations against the quota and reserves the incoming
 * bytes until the upload settles, so parallel requests cannot all slip under
 * the limit by reading the same cached number. (Single API process — an
 * in-memory reservation table is sufficient.)
 */

const TTL_MS = 5 * 60 * 1000;

let cache: { at: number; bySlug: Map<string, number> } | null = null;
let inflight: Promise<Map<string, number>> | null = null;
// Bumped by invalidateMediaUsage(); a listing started before the bump must
// not repopulate the cache with pre-upload numbers.
let generation = 0;

/** Pending (admitted but not yet stored) bytes, keyed by tenant id. */
const pendingByTenant = new Map<string, number>();

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  return { bucketName: parts[1] ?? "", objectName: parts.slice(2).join("/") };
}

async function listUsage(): Promise<Map<string, number>> {
  const storage = new ObjectStorageService();
  const searchPath = storage.getPublicObjectSearchPaths()[0];
  if (!searchPath) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set");
  const { bucketName, objectName } = parseObjectPath(`${searchPath}/media/`);
  const [files] = await objectStorageClient
    .bucket(bucketName)
    .getFiles({ prefix: objectName });
  const bySlug = new Map<string, number>();
  for (const f of files) {
    // objectName: <prefix>/media/<slug>/(200|620|1400|video)/<file>
    const rel = f.name.slice(objectName.length);
    const slug = rel.split("/")[0];
    if (!slug) continue;
    const size = Number(f.metadata.size ?? 0);
    bySlug.set(slug, (bySlug.get(slug) ?? 0) + size);
  }
  return bySlug;
}

export async function getMediaUsageBySlug(): Promise<Map<string, number>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.bySlug;
  if (!inflight) {
    const startedAt = generation;
    inflight = listUsage()
      .then((bySlug) => {
        if (generation === startedAt) cache = { at: Date.now(), bySlug };
        return bySlug;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function invalidateMediaUsage(): void {
  cache = null;
  generation++;
}

/** Bytes used by a tenant = sum over every slug it has ever had. */
export async function getUsedBytes(slugs: string[]): Promise<number> {
  const bySlug = await getMediaUsageBySlug();
  let used = 0;
  for (const s of new Set(slugs)) used += bySlug.get(s) ?? 0;
  return used;
}

export type Admission =
  | { ok: true; release: () => void }
  | { ok: false; usedBytes: number; quotaBytes: number };

/**
 * Soft-quota admission for ONE upload. Refuses when the tenant is at 100 %
 * (counting other in-flight uploads); otherwise reserves the incoming bytes.
 * Callers MUST call release() when the upload settles (success or failure),
 * and invalidateMediaUsage() after a successful store.
 */
export async function admitUpload(
  tenantId: string,
  slugs: string[],
  quotaBytes: number,
  incomingBytes: number,
): Promise<Admission> {
  const used = await getUsedBytes(slugs);
  const pending = pendingByTenant.get(tenantId) ?? 0;
  if (used + pending >= quotaBytes) {
    return { ok: false, usedBytes: used + pending, quotaBytes };
  }
  pendingByTenant.set(tenantId, pending + incomingBytes);
  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      const p = (pendingByTenant.get(tenantId) ?? 0) - incomingBytes;
      if (p <= 0) pendingByTenant.delete(tenantId);
      else pendingByTenant.set(tenantId, p);
    },
  };
}

export function formatGb(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
}
