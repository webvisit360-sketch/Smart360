import { db, pool, tenantsTable, tenantCopyJobsTable, tenantSlugReservationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { objectStorageClient } from "./objectStorage";
import { gpxEnvironment } from "../routes/gpx";
import { TenantDuplicateError } from "./tenantCopyFiles";
import { invalidateMediaUsage } from "./mediaUsage";

/** Cross-process exclusion, released by PostgreSQL even after SIGKILL.
 * Use the same connection for the lifetime of the lock; never a pooled query.
 */
export async function withCopyLock<T>(id: string, work: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT pg_try_advisory_lock(hashtextextended($1, 360)) AS locked", [id]);
    if (!result.rows[0].locked) throw new TenantDuplicateError("Kopiranje ali čiščenje še poteka. Poskusite znova pozneje.");
    return await work();
  } finally {
    // Destroy, rather than pool, this dedicated session. Also releases its lock.
    client.release(true);
  }
}

/** Caller MUST own the copy lock. Files first, DB last: failures stay retryable. */
export async function removeIncompleteCopyLocked(id: string) {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, id));
  const [job] = await db.select().from(tenantCopyJobsTable).where(eq(tenantCopyJobsTable.tenantId, id));
  if (!tenant && !job) return; // already cleaned
  if (tenant?.copyState !== "copying" || tenant.isPublished || !job || job.environment !== gpxEnvironment()) {
    throw new TenantDuplicateError("Odstraniti je mogoče samo nedokončano kopijo v tem okolju.");
  }
  for (const object of job.objectManifest) {
    const file = objectStorageClient.bucket(object.bucket).file(object.name);
    await file.delete({ ignoreNotFound: true });
    if ((await file.exists())[0]) throw new Error("Datoteka po čiščenju še obstaja.");
  }
  await db.transaction(async tx => {
    await tx.delete(tenantCopyJobsTable).where(eq(tenantCopyJobsTable.tenantId, id));
    // This URL has never been published; no redirect/history needs preserving.
    await tx.delete(tenantSlugReservationsTable).where(eq(tenantSlugReservationsTable.tenantId, id));
    await tx.delete(tenantsTable).where(eq(tenantsTable.id, id));
  });
  invalidateMediaUsage();
}

export const cleanupIncompleteCopy = (id: string) => withCopyLock(id, () => removeIncompleteCopyLocked(id));