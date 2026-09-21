import { createHash } from "node:crypto";
import { eq, isNull, sql } from "drizzle-orm";
import { db, publishedSnapshotsTable, tenantsTable, runWithDatabase, type Db, type Tenant } from "@workspace/db";
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
  const added = new Set<string>(), changed = new Set<string>(), removed = new Set<string>();
  const walk = (before: unknown, after: unknown, context: string, field = ""): void => {
    if (digest(before ?? null) === digest(after ?? null)) return;
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
        if (!newRows.has(id)) removed.add(entityLabel(entry));
        else walk(entry, newRows.get(id), entityLabel(newRows.get(id)));
      }
      for (const [id, entry] of newRows) if (!oldRows.has(id)) added.add(entityLabel(entry));
      return;
    }
    if (before && after && !Array.isArray(before) && !Array.isArray(after) &&
      typeof before === "object" && typeof after === "object") {
      const old = before as Record<string, unknown>, next = after as Record<string, unknown>;
      for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
        if (ignored.has(key) || key === "id" || key.endsWith("Id")) continue;
        walk(old[key], next[key], context, key);
      }
      return;
    }
    const label = fieldLabels[field];
    const line = label ? `${label}${context ? `: ${context}` : ""}` : `Spremembe v razdelku ${context || "Nastavitve"}`;
    if (empty(after) && !empty(before)) removed.add(line);
    else changed.add(line);
  };
  for (const lang of new Set([...Object.keys(draft.languages), ...Object.keys(published.languages)])) {
    const before = published.languages[lang], after = draft.languages[lang];
    // Shared source fields repeat in fallback language trees; count them once.
    walk(before?.tree, after?.tree, "");
    walk(before?.ui, after?.ui, `Besedila vmesnika (${lang})`);
    walk(before?.plurals, after?.plurals, `Množinske oblike (${lang})`);
  }
  walk(published.guestAccess, draft.guestAccess, "");
  return { token: publicationToken(draft, published), total: added.size + changed.size + removed.size,
    added: [...added], changed: [...changed], removed: [...removed] };
}

export async function previewPublication(tenantId: string): Promise<PublicationChanges> {
  await ensureTenantPublication(tenantId);
  return db.transaction(async (tx) => runWithDatabase(tx as unknown as Db, async () => {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).for("update");
    if (!tenant) throw new Error("Namestitev ni najdena.");
    return comparePublications(await buildDraftPublication(tenant), await readPublishedContent(tenantId));
  }), { isolationLevel: "repeatable read" });
}