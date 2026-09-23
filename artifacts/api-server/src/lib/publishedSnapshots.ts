import { createHash } from "node:crypto";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import {
  categoriesTable,
  changelogTable,
  db,
  publishedSnapshotsTable,
  sectionsTable,
  tenantsTable,
  runWithDatabase,
  type Db,
  type Tenant,
} from "@workspace/db";
import { buildTenantContent, type TenantContentTree } from "./contentTree";
import { getUiAndPlurals } from "./translationKeys";

export type PublishedLanguage = {
  tree: TenantContentTree;
  ui: Record<string, string>;
  plurals: Record<string, Record<string, string>>;
};
export type PublishedContent = {
  languages: Record<string, PublishedLanguage>;
  /** Server-only gate credential, never included in the public payload. */
  guestAccess: { orderPassword: string | null };
};
export type PublicationChanges = {
  token: string;
  total: number;
  added: string[];
  changed: string[];
  removed: string[];
};

export async function ensurePublishedSnapshotSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS published_snapshots (
      tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      content jsonb NOT NULL,
      published_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function buildDraftPublication(tenant: Tenant): Promise<PublishedContent> {
  const languages: Record<string, PublishedLanguage> = {};
  for (const lang of new Set(["sl", "en", "de", "it", ...(tenant.languages ?? [])])) {
    const tree = await buildTenantContent(tenant, { visibleOnly: true, lang: lang === "sl" ? undefined : lang });
    const { ui, plurals } = await getUiAndPlurals(tenant.id, lang);
    languages[lang] = { tree, ui, plurals };
  }
  return JSON.parse(JSON.stringify({ languages, guestAccess: { orderPassword: tenant.orderPassword } })) as PublishedContent;
}

export async function readPublishedContent(tenantId: string): Promise<PublishedContent> {
  const [row] = await db.select().from(publishedSnapshotsTable)
    .where(eq(publishedSnapshotsTable.tenantId, tenantId));
  if (!row) throw new Error("Objavljeni posnetek manjka. Objavljanje ni bilo inicializirano.");
  return row.content as unknown as PublishedContent;
}

/** Fail closed: a published file is retained until a later publish drops its reference. */
export async function publishedSnapshotReferences(url: string): Promise<boolean> {
  const rows = await db.select({ content: publishedSnapshotsTable.content }).from(publishedSnapshotsTable);
  return rows.some((row) => JSON.stringify(row.content).includes(url));
}

/** Called within the same tenant-locked transaction as the publish flag. */
export async function replacePublishedSnapshot(tenant: Tenant): Promise<void> {
  const content = await buildDraftPublication(tenant);
  await db.insert(publishedSnapshotsTable).values({
    tenantId: tenant.id, content: content as unknown as Record<string, unknown>, publishedAt: new Date(),
  }).onConflictDoUpdate({
    target: publishedSnapshotsTable.tenantId,
    set: { content: content as unknown as Record<string, unknown>, publishedAt: new Date() },
  });
}

/** Only missing rows are inserted: restarts NEVER publish pending drafts. */
export async function initializePublishedSnapshots(): Promise<void> {
  const missing = await db.select({ id: tenantsTable.id }).from(tenantsTable)
    .leftJoin(publishedSnapshotsTable, eq(tenantsTable.id, publishedSnapshotsTable.tenantId))
    .where(isNull(publishedSnapshotsTable.tenantId));
  for (const tenant of missing) await ensureTenantPublication(tenant.id);
}

export async function ensureTenantPublication(tenantId: string): Promise<void> {
  await db.transaction(async (tx) => runWithDatabase(tx as unknown as Db, async () => {
    const [tenant] = await db.select().from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId)).for("update");
    if (!tenant) throw new Error("Namestitev ni najdena.");
    const [existing] = await db.select().from(publishedSnapshotsTable)
      .where(eq(publishedSnapshotsTable.tenantId, tenantId));
    if (!existing) await replacePublishedSnapshot(tenant);
  }), { isolationLevel: "repeatable read" });
}

const ignored = new Set([
  "createdAt", "updatedAt", "deletedAt", "lastPublishedAt", "firstPublishedAt",
  "hasUnpublishedChanges", "isPublished", "creatorDraft", "creatorOriginRegion",
  "mediaQuotaBytes", "orderNotifyEmail", "messageNotifyEmail", "notificationChannel",
  "notificationWhatsappPhone", "orderPasswordConfigured", "renewsAt", "isTemplate",
  "hostAnsweredMessageCount", "hostResponseMedianMinutes",
]);
const fieldLabels: Record<string, string> = {
  name: "Ime", title: "Naslov", label: "Naziv", body: "Opis", subtitle: "Podnaslov",
  wifiSsid: "WiFi omrežje", wifiPass: "WiFi geslo", wifiEnc: "WiFi zaščita",
  orderPassword: "Geslo za naročila in sporočila",
  heroUrl: "Naslovna fotografija", livingGuideHeroUrl: "Fotografija Domov", imageUrl: "Fotografija",
  logoUrl: "Logotip", logoSquareUrl: "Logotip", url: "Fotografija", posterUrl: "Predogled",
  caption: "Opis fotografije", alt: "Opis fotografije", email: "E-pošta", phone: "Telefon",
  address: "Naslov namestitve", website: "Spletna stran", languages: "Jeziki", theme: "Tema",
  isVisible: "Vidnost", position: "Vrstni red", distanceMeters: "Razdalja", duration: "Trajanje",
  hours: "Odpiralni čas", noteText: "Opomba", mapUrl: "Lokacija", tourUrl: "Virtualni ogled",
};
function empty(value: unknown): boolean {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !ignored.has(key)).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, canonical(item)]));
  return value;
}
function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
export function publicationToken(draft: PublishedContent, published: PublishedContent): string {
  return digest({ draft, published });
}

/** IDs, not array indices, identify content. Values (including passwords) never enter labels. */
export function comparePublications(draft: PublishedContent, published: PublishedContent): PublicationChanges {
  type Change = { kind: "added" | "changed" | "removed"; line: string; transition: string; entity: boolean };
  // Labels are presentation, never identity: distinct same-name entities and
  // fields must survive. Paths include stable row IDs, not array positions.
  const changes = new Map<string, Change>();
  const sourceChanges = new Map<string, Change>();
  const walk = (
    before: unknown, after: unknown, context: string, path: string[],
    target: Map<string, Change>, field = "",
  ): void => {
    if (digest(before ?? null) === digest(after ?? null)) return;
    const record = (kind: Change["kind"], line: string, at = path, old = before, next = after, entity = false) => {
      target.set(JSON.stringify(at), { kind, line, transition: digest([old ?? null, next ?? null]), entity });
    };
    if (Array.isArray(before) && Array.isArray(after) &&
      [...before, ...after].every((entry) => entry && typeof entry === "object" && "id" in entry)) {
      const oldRows = new Map(before.map((entry) => [entry.id, entry]));
      const newRows = new Map(after.map((entry) => [entry.id, entry]));
      const entityLabel = (entry: Record<string, unknown>) => {
        const title = String(entry.title ?? entry.label ?? entry.name ?? "").replace(/<[^>]*>/g, "").trim();
        return field === "media" || field === "sitePlanImages"
          ? `Fotografija: ${context}${title ? ` — ${title}` : ""} (${String(entry.id).slice(0, 8)})`
          : title || context;
      };
      for (const [id, entry] of oldRows) {
        const rowPath = [...path, `id:${id}`];
        if (!newRows.has(id)) record("removed", entityLabel(entry), rowPath, entry, null, true);
        else walk(entry, newRows.get(id), entityLabel(newRows.get(id)), rowPath, target);
      }
      for (const [id, entry] of newRows) if (!oldRows.has(id)) {
        record("added", entityLabel(entry), [...path, `id:${id}`], null, entry, true);
      }
      return;
    }
    if (before && after && !Array.isArray(before) && !Array.isArray(after) &&
      typeof before === "object" && typeof after === "object") {
      const old = before as Record<string, unknown>, next = after as Record<string, unknown>;
      for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
        if (ignored.has(key) || key === "id" || key.endsWith("Id")) continue;
        walk(old[key], next[key], context, [...path, key], target, key);
      }
      return;
    }
    const label = fieldLabels[field];
    const line = label ? `${label}${context ? `: ${context}` : ""}` : `Spremembe v razdelku ${context || "Nastavitve"}`;
    record(empty(after) && !empty(before) ? "removed" : "changed", line);
  };
  walk(published.languages.sl?.tree, draft.languages.sl?.tree, "", ["tree"], sourceChanges);
  for (const [path, change] of sourceChanges) changes.set(`sl:${path}`, change);
  for (const lang of new Set([...Object.keys(draft.languages), ...Object.keys(published.languages)])) {
    const before = published.languages[lang], after = draft.languages[lang];
    if (lang !== "sl") {
      const localized = new Map<string, Change>();
      walk(before?.tree, after?.tree, "", ["tree"], localized);
      for (const [path, change] of localized) {
        const source = sourceChanges.get(path);
        // Entity presence is language-independent. For field edits, suppress
        // ONLY the same path with the same before→after values (source fallback).
        if (source?.kind === change.kind &&
          ((source.entity && change.entity) || source.transition === change.transition)) continue;
        changes.set(`${lang}:${path}`, { ...change, line: `${change.line} — prevod (${lang})` });
      }
    }
    walk(before?.ui, after?.ui, `Besedila vmesnika (${lang})`, [lang, "ui"], changes);
    walk(before?.plurals, after?.plurals, `Množinske oblike (${lang})`, [lang, "plurals"], changes);
  }
  walk(published.guestAccess, draft.guestAccess, "", ["guestAccess"], changes);
  const result = { added: [] as string[], changed: [] as string[], removed: [] as string[] };
  for (const change of changes.values()) result[change.kind].push(change.line);
  return { token: publicationToken(draft, published), total: changes.size, ...result };
}

/**
 * Adds draft-only structural category creations to the guest-tree diff and
 * binds those rows into the confirmation token. This must be used by both the
 * preview and the publish transaction so a rename/delete after confirmation
 * cannot be published with an older token.
 */
export async function publicationChangesForTenant(
  tenantId: string,
  draft: PublishedContent,
  published: PublishedContent,
): Promise<PublicationChanges> {
  const changes = comparePublications(draft, published);
  const [snapshot] = await db.select({ publishedAt: publishedSnapshotsTable.publishedAt })
    .from(publishedSnapshotsTable).where(eq(publishedSnapshotsTable.tenantId, tenantId));
  const categoryCreates = snapshot
    ? await db.select({ operationKey: changelogTable.operationKey }).from(changelogTable).where(and(
        eq(changelogTable.tenantId, tenantId),
        eq(changelogTable.entity, "category"),
        eq(changelogTable.action, "create"),
        gt(changelogTable.createdAt, snapshot.publishedAt),
      ))
    : [];
  const categoryIds = categoryCreates.flatMap(({ operationKey }) => {
    const match = operationKey?.match(/^category-create:([0-9a-f-]{36})$/i);
    return match?.[1] ? [match[1]] : [];
  });
  const currentCreatedCategories = categoryIds.length
    ? await db.select({ id: categoriesTable.id, label: categoriesTable.label }).from(categoriesTable)
        .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
        .where(and(
          eq(sectionsTable.tenantId, tenantId),
          inArray(categoriesTable.id, categoryIds),
          isNull(categoriesTable.deletedAt),
        ))
    : [];
  currentCreatedCategories.sort((a, b) => a.id.localeCompare(b.id));
  for (const { label } of currentCreatedCategories) {
    if (!changes.added.includes(label)) changes.added.push(label);
  }
  changes.total = changes.added.length + changes.changed.length + changes.removed.length;
  changes.token = digest({
    guestPublicationToken: changes.token,
    createdCategories: currentCreatedCategories,
  });
  return changes;
}

export async function previewPublication(tenantId: string): Promise<PublicationChanges> {
  await ensureTenantPublication(tenantId);
  return db.transaction(async (tx) => runWithDatabase(tx as unknown as Db, async () => {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).for("update");
    if (!tenant) throw new Error("Namestitev ni najdena.");
    return publicationChangesForTenant(
      tenantId,
      await buildDraftPublication(tenant),
      await readPublishedContent(tenantId),
    );
  }), { isolationLevel: "repeatable read" });
}