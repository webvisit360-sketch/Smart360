import {
  db,
  tenantsTable,
  tenantAliasesTable,
  mediaTable,
  sectionsTable,
  itemsTable,
  translationsTable,
} from "@workspace/db";
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

/** All objects under media/, parsed into slug + file name. */
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
    if (o.updated && Date.now() - new Date(o.updated).getTime() < MIN_AGE_MS) continue;
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

export async function cleanupExecute(
  slugs: string[] | null,
  orphansOnly: boolean,
): Promise<{ freedBytes: number; deletedFiles: number }> {
  // Re-computed NOW — never trust a preview the admin looked at minutes ago.
  const { groups, bucketName } = await findRemovable(slugs, orphansOnly);
  let freedBytes = 0;
  let deletedFiles = 0;
  const bucket = objectStorageClient.bucket(bucketName);
  for (const g of groups.values()) {
    for (const path of g.paths) {
      await bucket.file(path).delete({ ignoreNotFound: true });
    }
    freedBytes += g.files.reduce((s, f) => s + f.bytes, 0);
    deletedFiles += 1;
  }
  if (deletedFiles > 0) invalidateMediaUsage();
  return { freedBytes, deletedFiles };
}
