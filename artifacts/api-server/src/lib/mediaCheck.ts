import {
  db,
  tenantsTable,
  sectionsTable,
  categoriesTable,
  itemsTable,
  mediaTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { ObjectStorageService, objectStorageClient } from "./objectStorage.js";

/**
 * Consistency checker for media references ("Preveri datoteke").
 *
 * Validates every storage reference of ONE tenant against the bucket as it is
 * NOW: the file must exist, its content type must match the field (image vs
 * video), and the transparent-logo field must actually hold a PNG with an
 * alpha channel (an opaque JPEG there renders as a white box on the cover).
 *
 * The same checker powers duplication hygiene: `dropBrokenReferences` removes
 * references the checker flags, so a duplicate never inherits stale pointers
 * from its source. Non-storage URLs (legacy /images/... or external) are
 * skipped — they cannot be verified against the bucket.
 */

export type MediaIssueReason = "missing" | "wrong_type" | "no_alpha";

export type MediaIssue = {
  /** Machine field id, e.g. "tenant.logoUrl", "section.imageUrl", "media.url". */
  field: string;
  /** Human label in Slovenian, names the place ("Sekcija »Razišči« — slika"). */
  label: string;
  url: string;
  reason: MediaIssueReason;
  adminPath: string;
  /** Internal handle so dropBrokenReferences knows what to clear. */
  target:
    | {
        kind: "tenant";
        column:
          | "heroUrl"
          | "livingGuideHeroUrl"
          | "logoUrl"
          | "logoSquareUrl";
      }
    | { kind: "section"; id: string }
    | { kind: "mediaUrl"; id: string }
    | { kind: "mediaPoster"; id: string };
};

const STORAGE_URL = /^\/api\/storage\/(img|video)\/([^/]+)\/([^/?#]+)/;
const IMAGE_FOLDERS = ["620", "1400", "200"];

type BucketIndex = Map<string, Map<string, { folders: Set<string>; contentType: string | null }>>;

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  return { bucketName: parts[1] ?? "", objectName: parts.slice(2).join("/") };
}

/** One listing per check: slug -> file name -> folders + contentType. */
async function indexBucket(): Promise<{ index: BucketIndex; bucketName: string; prefix: string }> {
  const storage = new ObjectStorageService();
  const searchPath = storage.getPublicObjectSearchPaths()[0];
  if (!searchPath) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set");
  const { bucketName, objectName: prefix } = parseObjectPath(`${searchPath}/media/`);
  const [files] = await objectStorageClient.bucket(bucketName).getFiles({ prefix });
  const index: BucketIndex = new Map();
  for (const f of files) {
    const parts = f.name.slice(prefix.length).split("/");
    if (parts.length < 3) continue;
    const [slug, folder] = [parts[0]!, parts[1]!];
    const name = parts[parts.length - 1]!;
    let bySlug = index.get(slug);
    if (!bySlug) index.set(slug, (bySlug = new Map()));
    let entry = bySlug.get(name);
    if (!entry) bySlug.set(name, (entry = { folders: new Set(), contentType: null }));
    entry.folders.add(folder);
    if (typeof f.metadata.contentType === "string") entry.contentType = f.metadata.contentType;
  }
  return { index, bucketName, prefix };
}

type Ctx = { index: BucketIndex; bucketName: string; prefix: string };

/** null = OK (or unverifiable non-storage URL), otherwise the failure reason. */
async function checkUrl(
  ctx: Ctx,
  url: string | null | undefined,
  expect: "image" | "video" | "logo-alpha",
): Promise<MediaIssueReason | null> {
  if (!url) return null;
  const m = url.match(STORAGE_URL);
  if (!m) return null; // legacy /images/... or external — cannot verify
  const [, route, slug, name] = m as unknown as [string, "img" | "video", string, string];
  const entry = ctx.index.get(slug)?.get(name);
  if (!entry) return "missing";
  const wantVideo = expect === "video";
  if (wantVideo !== (route === "video")) return "wrong_type";
  if (wantVideo) {
    if (!entry.folders.has("video")) return "missing";
    if (entry.contentType && !entry.contentType.startsWith("video/")) return "wrong_type";
    return null;
  }
  const folder = IMAGE_FOLDERS.find((f) => entry.folders.has(f));
  if (!folder) return "missing";
  if (entry.contentType && !entry.contentType.startsWith("image/")) return "wrong_type";
  if (expect === "logo-alpha") {
    if (entry.contentType && entry.contentType !== "image/png") return "no_alpha";
    try {
      const [buf] = await objectStorageClient
        .bucket(ctx.bucketName)
        .file(`${ctx.prefix}${slug}/${folder}/${name}`)
        .download();
      const meta = await sharp(buf).metadata();
      if (!meta.hasAlpha) return "no_alpha";
    } catch {
      return "missing";
    }
  }
  return null;
}

const REASON_LABEL: Record<MediaIssueReason, string> = {
  missing: "datoteka ne obstaja",
  wrong_type: "napačna vrsta datoteke",
  no_alpha: "logotip ni prosojen (brez alfa kanala)",
};

export function reasonLabel(reason: MediaIssueReason): string {
  return REASON_LABEL[reason];
}

export async function checkTenantMedia(tenantId: string): Promise<MediaIssue[]> {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) throw new Error("Tenant not found");
  const ctx: Ctx = await indexBucket().then(({ index, bucketName, prefix }) => ({ index, bucketName, prefix }));
  const adminPath = `/admin/tenants/${tenantId}`;
  const issues: MediaIssue[] = [];
  const push = async (
    field: string,
    label: string,
    url: string | null | undefined,
    expect: "image" | "video" | "logo-alpha",
    target: MediaIssue["target"],
  ) => {
    const reason = await checkUrl(ctx, url, expect);
    if (reason && url) issues.push({ field, label, url, reason, adminPath, target });
  };

  await push("tenant.heroUrl", "Naslovna fotografija", tenant.heroUrl, "image", { kind: "tenant", column: "heroUrl" });
  await push(
    "tenant.livingGuideHeroUrl",
    "Fotografija Domov v Living Guide",
    tenant.livingGuideHeroUrl,
    "image",
    { kind: "tenant", column: "livingGuideHeroUrl" },
  );
  await push("tenant.logoUrl", "Logotip (prosojni, na naslovnici)", tenant.logoUrl, "logo-alpha", { kind: "tenant", column: "logoUrl" });
  await push("tenant.logoSquareUrl", "Logotip (kvadratni)", tenant.logoSquareUrl, "image", { kind: "tenant", column: "logoSquareUrl" });

  const sections = await db.select().from(sectionsTable).where(eq(sectionsTable.tenantId, tenantId));
  for (const s of sections) {
    await push("section.imageUrl", `Sekcija »${s.title}« — slika`, s.imageUrl, "image", { kind: "section", id: s.id });
  }

  const sectionIds = sections.map((s) => s.id);
  const categories = sectionIds.length
    ? await db.select().from(categoriesTable).where(inArray(categoriesTable.sectionId, sectionIds))
    : [];
  // Soft-deleted (trash) rows are INCLUDED: they keep their media rows, get
  // copied on duplication, and count as references for cleanup — so their
  // broken pointers must surface here too.
  const categoryIds = categories.map((c) => c.id);
  const items = categoryIds.length
    ? await db.select().from(itemsTable).where(inArray(itemsTable.categoryId, categoryIds))
    : [];
  const itemById = new Map(items.map((i) => [i.id, i]));
  const itemIds = items.map((i) => i.id);
  const mediaRows = itemIds.length
    ? await db.select().from(mediaTable).where(inArray(mediaTable.itemId, itemIds))
    : [];
  for (const m of mediaRows) {
    const itemTitle = (m.itemId && itemById.get(m.itemId)?.title) || "brez naslova";
    const isVideo = m.kind === "video";
    await push(
      "media.url",
      `Vnos »${itemTitle}« — ${isVideo ? "video" : "fotografija"}`,
      m.url,
      isVideo ? "video" : "image",
      { kind: "mediaUrl", id: m.id },
    );
    if (isVideo) {
      await push("media.posterUrl", `Vnos »${itemTitle}« — plakat videa`, m.posterUrl, "image", {
        kind: "mediaPoster",
        id: m.id,
      });
    }
  }
  return issues;
}

/**
 * Duplication hygiene: remove every reference the checker flags so a fresh
 * duplicate never points at files that are gone or of the wrong type. Media
 * rows with a broken url are DELETED; broken poster/tenant/section fields are
 * cleared. Returns what was dropped so the admin knows what to re-upload.
 */
export async function dropBrokenReferences(tenantId: string): Promise<MediaIssue[]> {
  const issues = await checkTenantMedia(tenantId);
  for (const issue of issues) {
    const t = issue.target;
    if (t.kind === "tenant") {
      await db.update(tenantsTable).set({ [t.column]: null }).where(eq(tenantsTable.id, tenantId));
    } else if (t.kind === "section") {
      await db.update(sectionsTable).set({ imageUrl: null }).where(eq(sectionsTable.id, t.id));
    } else if (t.kind === "mediaUrl") {
      await db.delete(mediaTable).where(eq(mediaTable.id, t.id));
    } else {
      await db.update(mediaTable).set({ posterUrl: null }).where(eq(mediaTable.id, t.id));
    }
  }
  return issues;
}
