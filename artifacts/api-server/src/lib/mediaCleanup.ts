import {
  db,
  tenantsTable,
  tenantAliasesTable,
  mediaTable,
  sectionsTable,
  itemsTable,
  translationsTable,
  cleanupRunsTable,
  type CleanupRunFile,
} from "@workspace/db";
import { desc, eq, isNull, lt, and } from "drizzle-orm";
import { ObjectStorageService, objectStorageClient } from "./objectStorage.js";
import { invalidateMediaUsage } from "./mediaUsage.js";

/**
 * Explicit storage cleanup (never automatic, never on a schedule).
 *
 * References are COMPUTED from the database at call time, not stored as a
 * counter that could drift: an object is referenced when any media row
 * (url / posterUrl) or any tenant column (heroUrl / logoUrl / logoSquareUrl)
 * anywhere points at it. Duplicating a tenant copies media rows (+1 ref),
 * deleting a media row removes one (−1 ref) — a file is removable only when
 * NO row in the whole system references it. Logo icon derivatives
 * (<id>-ikona-*.png, used by the PWA manifest) are protected as long as
 * their -kvadrat.png sibling is referenced.
 *
 * Execution re-computes the reference set immediately before deleting, so a
 * stale preview can never delete something that got referenced in between.
 */

export type CleanupFile = {
  slug: string;
  name: string;
  bytes: number;
  kind: "image" | "video";
  thumbUrl: string | null;
  lastModified: string | null;
};

export type CleanupPreview = {
  totalBytes: number;
  files: CleanupFile[];
};

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  return { bucketName: parts[1] ?? "", objectName: parts.slice(2).join("/") };
}

/** "/api/storage/img/<slug>/<file>" or ".../video/<slug>/<file>" -> "slug/file". */
function refKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/^\/api\/storage\/(?:img|video)\/([^/]+)\/([^/?#]+)/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * Every "slug/file" pair referenced by any DB row, across ALL tenants.
 * MUST cover every column that can hold a storage URL — media.url,
 * media.posterUrl, sections.imageUrl, tenants.heroUrl/logoUrl/logoSquareUrl,
 * plus free-text columns that may EMBED storage URLs (items.body,
 * items.noteText, translations.value). A column missed here means cleanup
 * deletes live files. When adding a new *_url or rich-text column anywhere
 * in the schema, extend this list in the same change.
 */
async function getReferencedKeys(): Promise<Set<string>> {
  const [mediaRows, sectionRows, itemRows, translationRows, tenantRows] = await Promise.all([
    db.select({ url: mediaTable.url, posterUrl: mediaTable.posterUrl }).from(mediaTable),
    db.select({ imageUrl: sectionsTable.imageUrl }).from(sectionsTable),
    db.select({ body: itemsTable.body, noteText: itemsTable.noteText }).from(itemsTable),
    db.select({ value: translationsTable.value }).from(translationsTable),
    db
      .select({
        heroUrl: tenantsTable.heroUrl,
        logoUrl: tenantsTable.logoUrl,
        logoSquareUrl: tenantsTable.logoSquareUrl,
      })
      .from(tenantsTable),
  ]);
  const keys = new Set<string>();
  const add = (url: string | null | undefined) => {
    const k = refKeyFromUrl(url);
    if (k) keys.add(k);
  };
  for (const r of mediaRows) {
    add(r.url);
    add(r.posterUrl);
  }
  for (const s of sectionRows) add(s.imageUrl);
  // Rich text / translations may EMBED storage URLs anywhere in the string.
  const embedded = /\/api\/storage\/(?:img|video)\/([^/\s"'<>]+)\/([^/\s"'<>?#)]+)/g;
  const scan = (text: string | null | undefined) => {
    if (!text || !text.includes("/api/storage/")) return;
    for (const m of text.matchAll(embedded)) keys.add(`${m[1]}/${m[2]}`);
  };
  for (const i of itemRows) {
    scan(i.body);
    scan(i.noteText);
  }
  for (const t of translationRows) scan(t.value);
  for (const t of tenantRows) {
    add(t.heroUrl);
    add(t.logoUrl);
    add(t.logoSquareUrl);
    // The PWA manifest serves <id>-ikona-{512,192,maskable-512,180}.png next
    // to the referenced -kvadrat.png — keep the whole icon family alive.
    const sq = refKeyFromUrl(t.logoSquareUrl);
    if (sq?.endsWith("-kvadrat.png")) {
      const base = sq.slice(0, -"-kvadrat.png".length);
      for (const suffix of ["ikona-512", "ikona-192", "ikona-maskable-512", "ikona-180"]) {
        keys.add(`${base}-${suffix}.png`);
      }
    }
  }
  return keys;
}

type BucketObject = {
  slug: string;
  name: string; // file name (last path segment)
  fullPath: string; // object name in the bucket
  bytes: number;
  updated: string | null;
};

/** All objects under media/, parsed into slug + file name (trash/ excluded by prefix). */
async function listBucketObjects(): Promise<{ bucketName: string; prefix: string; objects: BucketObject[] }> {
  const storage = new ObjectStorageService();
  const searchPath = storage.getPublicObjectSearchPaths()[0];
  if (!searchPath) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set");
  const { bucketName, objectName: prefix } = parseObjectPath(`${searchPath}/media/`);
  const [files] = await objectStorageClient.bucket(bucketName).getFiles({ prefix });
  const objects: BucketObject[] = [];
  for (const f of files) {
    const rel = f.name.slice(prefix.length); // <slug>/(200|620|1400|video)/<file>
    const parts = rel.split("/");
    if (parts.length < 3) continue;
    const slug = parts[0]!;
    const name = parts[parts.length - 1]!;
    if (!slug || !name) continue;
    objects.push({
      slug,
      name,
      fullPath: f.name,
      bytes: Number(f.metadata.size ?? 0),
      updated: typeof f.metadata.updated === "string" ? f.metadata.updated : null,
    });
  }
  return { bucketName, prefix, objects };
}

const VIDEO_NAME = /\.(mp4|webm|mov|m4v)$/i;

// The bucket is SHARED between development and the published deployment, but
// each environment only sees its own database when computing references. A
// file uploaded in one environment can look unreferenced in the other. The
// age guard keeps recent uploads out of the candidate list entirely; older
// cross-environment references must stay in sync via publish.
const MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Slugs that belong to a live tenant (current slug or alias). */
export async function getLiveSlugSet(): Promise<Set<string>> {
  const [tenants, aliases] = await Promise.all([
    db.select({ slug: tenantsTable.slug }).from(tenantsTable),
    db.select({ slug: tenantAliasesTable.slug }).from(tenantAliasesTable),
  ]);
  return new Set([...tenants, ...aliases].map((r) => r.slug));
}

/**
 * Unreferenced files, grouped per logical file (all width derivatives of one
 * photo count as one entry). `slugs` limits the scan to those prefixes;
 * `orphansOnly` instead selects prefixes that belong to NO live tenant.
 */
async function findRemovable(
  slugs: string[] | null,
  orphansOnly: boolean,
  minAgeMs: number = MIN_AGE_MS, // overridable only from server-side tests, never via HTTP
): Promise<{ groups: Map<string, { files: CleanupFile[]; paths: string[] }>; bucketName: string }> {
  const [referenced, listing, liveSlugs] = await Promise.all([
    getReferencedKeys(),
    listBucketObjects(),
    getLiveSlugSet(),
  ]);
  const wanted = slugs ? new Set(slugs) : null;
  const groups = new Map<string, { files: CleanupFile[]; paths: string[] }>();
  const byKey = new Map<string, { bytes: number; updated: string | null; paths: string[]; slug: string; name: string }>();
  for (const o of listing.objects) {
    if (orphansOnly ? liveSlugs.has(o.slug) : wanted ? !wanted.has(o.slug) : false) continue;
    const key = `${o.slug}/${o.name}`;
    if (referenced.has(key)) continue;
    if (o.updated && Date.now() - new Date(o.updated).getTime() < minAgeMs) continue;
    const g = byKey.get(key) ?? { bytes: 0, updated: null, paths: [], slug: o.slug, name: o.name };
    g.bytes += o.bytes;
    g.paths.push(o.fullPath);
    if (!g.updated || (o.updated && o.updated > g.updated)) g.updated = o.updated;
    byKey.set(key, g);
  }
  for (const [key, g] of byKey) {
    const isVideo = VIDEO_NAME.test(g.name);
    groups.set(key, {
      files: [
        {
          slug: g.slug,
          name: g.name,
          bytes: g.bytes,
          kind: isVideo ? "video" : "image",
          thumbUrl: isVideo ? null : `/api/storage/img/${g.slug}/${g.name}?w=200`,
          lastModified: g.updated,
        },
      ],
      paths: g.paths,
    });
  }
  return { groups, bucketName: listing.bucketName };
}

export async function cleanupPreview(slugs: string[] | null, orphansOnly: boolean): Promise<CleanupPreview> {
  const { groups } = await findRemovable(slugs, orphansOnly);
  const files: CleanupFile[] = [];
  for (const g of groups.values()) files.push(...g.files);
  files.sort((a, b) => b.bytes - a.bytes);
  return { totalBytes: files.reduce((s, f) => s + f.bytes, 0), files };
}

/**
 * Cleanup EXECUTION is allowed only in production. The bucket is shared
 * between development and the published deployment while each environment
 * has its own database — computing "unused" from the dev DB while deleting
 * from the shared bucket is exactly the incident that deleted live files.
 * Preview stays available everywhere (read-only); moving files is prod-only.
 */
export const CLEANUP_EXECUTE_ENABLED = process.env.NODE_ENV === "production";

const TRASH_PREFIX = "trash/";
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

async function getBucket() {
  const storage = new ObjectStorageService();
  const searchPath = storage.getPublicObjectSearchPaths()[0];
  if (!searchPath) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set");
  const { bucketName } = parseObjectPath(searchPath);
  return objectStorageClient.bucket(bucketName);
}

export async function cleanupExecute(
  slugs: string[] | null,
  orphansOnly: boolean,
  opts?: { minAgeMs?: number; actor?: string },
): Promise<{ freedBytes: number; deletedFiles: number; runId: string | null }> {
  // Re-computed NOW — never trust a preview the admin looked at minutes ago.
  const { groups, bucketName } = await findRemovable(slugs, orphansOnly, opts?.minAgeMs);
  const bucket = objectStorageClient.bucket(bucketName);

  // NEVER hard-delete: every object moves to trash/<runId>/<original path>
  // and stays restorable for 30 days via the Koš list.
  const [run] = await db
    .insert(cleanupRunsTable)
    .values({
      actor: opts?.actor ?? "admin",
      scope: orphansOnly ? "orphans" : "tenant",
      tenantSlug: slugs?.[0] ?? null,
    })
    .returning();
  const runId = run!.id;

  let freedBytes = 0;
  let deletedFiles = 0;
  const auditFiles: CleanupRunFile[] = [];
  for (const [key, g] of groups) {
    // CRASH SAFETY: record the INTENT (key + paths) in the audit row BEFORE
    // moving anything. If the process dies mid-move, the run still lists the
    // file, restore handles half-moved state (trash OR original, whichever
    // exists), and purge sweeps the whole trash/<runId>/ prefix.
    const bytes = g.files.reduce((s, f) => s + f.bytes, 0);
    auditFiles.push({ key, bytes, paths: [...g.paths], restoredAt: null });
    freedBytes += bytes;
    deletedFiles += 1;
    await db
      .update(cleanupRunsTable)
      .set({ fileCount: deletedFiles, totalBytes: freedBytes, files: auditFiles })
      .where(eq(cleanupRunsTable.id, runId));
    for (const path of g.paths) {
      try {
        await bucket.file(path).move(`${TRASH_PREFIX}${runId}/${path}`);
      } catch (err) {
        if ((err as { code?: number }).code !== 404) throw err;
      }
    }
  }
  if (deletedFiles > 0) invalidateMediaUsage();
  // Lazy retention: purge trash older than 30 days on each (prod-only) run.
  await purgeExpiredTrash().catch(() => {});
  return { freedBytes, deletedFiles, runId };
}

/** Delete trash objects of runs older than 30 days; mark them purged. */
export async function purgeExpiredTrash(): Promise<number> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_MS);
  const expired = await db
    .select()
    .from(cleanupRunsTable)
    .where(and(isNull(cleanupRunsTable.purgedAt), lt(cleanupRunsTable.createdAt, cutoff)));
  if (expired.length === 0) return 0;
  const bucket = await getBucket();
  let purged = 0;
  for (const run of expired) {
    // CLAIM the run first (conditional update) so a concurrent restore that
    // starts afterwards sees purgedAt and refuses with 410 — never a silent
    // "restored" of an object that purge is deleting underneath it.
    const claimed = await db
      .update(cleanupRunsTable)
      .set({ purgedAt: new Date() })
      .where(and(eq(cleanupRunsTable.id, run.id), isNull(cleanupRunsTable.purgedAt)))
      .returning({ id: cleanupRunsTable.id });
    if (claimed.length === 0) continue;
    const [files] = await bucket.getFiles({ prefix: `${TRASH_PREFIX}${run.id}/` });
    for (const f of files) await f.delete({ ignoreNotFound: true });
    purged += 1;
  }
  return purged;
}

export type CleanupRunSummary = {
  id: string;
  createdAt: string;
  actor: string;
  scope: string;
  tenantSlug: string | null;
  fileCount: number;
  totalBytes: number;
  purged: boolean;
  files: { key: string; bytes: number; restored: boolean }[];
};

/** Audit list: most recent cleanup runs, newest first. */
export async function listCleanupRuns(limit = 50): Promise<CleanupRunSummary[]> {
  const runs = await db
    .select()
    .from(cleanupRunsTable)
    .orderBy(desc(cleanupRunsTable.createdAt))
    .limit(limit);
  return runs.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    actor: r.actor,
    scope: r.scope,
    tenantSlug: r.tenantSlug,
    fileCount: r.fileCount,
    totalBytes: r.totalBytes,
    purged: r.purgedAt !== null,
    files: r.files.map((f) => ({ key: f.key, bytes: f.bytes, restored: f.restoredAt !== null })),
  }));
}

/**
 * Restore files of a run from trash back to their original bucket paths.
 * `key` limits the restore to one logical file; omitted = whole run.
 */
export async function restoreFromTrash(
  runId: string,
  key: string | null,
): Promise<{ restoredFiles: number } | { error: "not_found" | "purged" }> {
  const [run] = await db.select().from(cleanupRunsTable).where(eq(cleanupRunsTable.id, runId));
  if (!run) return { error: "not_found" };
  if (run.purgedAt) return { error: "purged" };
  const bucket = await getBucket();
  let restoredFiles = 0;
  const files = run.files.map((f) => ({ ...f }));
  for (const f of files) {
    if (key && f.key !== key) continue;
    if (f.restoredAt) continue;
    // A path counts as back-in-place when either the trash copy moved back
    // or the original already exists (half-moved run, or a NEW file was
    // uploaded at the same path — which we must NEVER overwrite with the
    // stale trashed copy).
    let inPlace = 0;
    for (const path of f.paths) {
      const [destExists] = await bucket.file(path).exists();
      if (destExists) {
        inPlace += 1;
        continue;
      }
      try {
        await bucket.file(`${TRASH_PREFIX}${runId}/${path}`).move(path);
        inPlace += 1;
      } catch (err) {
        if ((err as { code?: number }).code !== 404) throw err;
        // trash copy gone (e.g. purged concurrently) — NOT restored
      }
    }
    if (inPlace === 0) continue; // nothing came back — don't claim success
    f.restoredAt = new Date().toISOString();
    restoredFiles += 1;
  }
  if (restoredFiles > 0) {
    // Conditional on purgedAt still null: if purge claimed the run while we
    // worked, the audit keeps the purged truth; files we DID move back are
    // safe either way (purge only deletes under the trash prefix).
    await db
      .update(cleanupRunsTable)
      .set({ files })
      .where(and(eq(cleanupRunsTable.id, runId), isNull(cleanupRunsTable.purgedAt)));
    invalidateMediaUsage();
  }
  return { restoredFiles };
}
