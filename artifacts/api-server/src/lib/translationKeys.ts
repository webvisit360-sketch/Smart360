import {
  db,
  translationsTable,
  pluralFormsTable,
  type Tenant,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { buildTenantContent, adminScope } from "./contentTree";

/**
 * Translation keys are PATHS into the tenant's content tree
 * (`DATA.stay.items[2].body[3]`), built by this ONE module for the reader,
 * the exporter, the importer and the admin screen alike. Storage however is
 * by record id + field ("items", <uuid>, "body[3]") — adding an item in the
 * middle of a section renumbers the PATHS but never moves a stored
 * translation to the wrong record.
 *
 * Never translated (spec): mapQuery (Google Maps must find the Slovene name),
 * phone, website, urls/file names, difficulty codes, distances, durations,
 * hours, wifi credentials (stored in body of the wifi layout? no — wifi name
 * and password live in dedicated body fields the guest copies verbatim; body
 * paragraphs of a wifi item ARE translatable text).
 */

export const CONTENT_LANGS = ["en", "de", "it"] as const;
export type ContentLang = (typeof CONTENT_LANGS)[number];

export type KeyEntry = {
  key: string; // DATA.stay.items[2].body[3]
  model: "tenant" | "section" | "category" | "item";
  recordId: string;
  field: string; // "body[3]" — storage field
  source: string; // current Slovene value
  /** true for rich-text (HTML) values — body paragraphs. */
  rich: boolean;
};

/** Parse an item body column: JSON array of paragraphs, or plain text. */
export function parseBody(body: string | null): string[] | string | null {
  if (body == null || body === "") return null;
  try {
    const arr = JSON.parse(body);
    if (Array.isArray(arr) && arr.every((p) => typeof p === "string")) {
      return arr as string[];
    }
  } catch {
    /* plain text body */
  }
  return body;
}

/**
 * The full ordered key list for a tenant — every translatable Slovene field
 * with its path key. Uses the ADMIN scope (hidden rows included, trash
 * excluded) so a translation prepared for a seasonal category is not lost.
 */
export async function buildKeyList(tenant: Tenant): Promise<KeyEntry[]> {
  const tree = await buildTenantContent(tenant, { visibleOnly: false });
  const out: KeyEntry[] = [];
  const push = (
    key: string,
    model: KeyEntry["model"],
    recordId: string,
    field: string,
    source: string | null | undefined,
    rich = false
  ) => {
    if (source == null || String(source).trim() === "") return;
    out.push({ key, model, recordId, field, source: String(source), rich });
  };

  push("CONFIG.name", "tenant", tenant.id, "name", tenant.name);
  push("CONFIG.subtitle", "tenant", tenant.id, "subtitle", tenant.subtitle);
  const address = (tenant as Record<string, unknown>)["address"];
  push("CONFIG.address", "tenant", tenant.id, "address", address as string);

  for (const s of tree.sections) {
    const sp = `DATA.${s.key}`;
    push(`${sp}.title`, "section", s.id, "title", s.title);
    push(`${sp}.subtitle`, "section", s.id, "subtitle", s.subtitle);
    s.categories.filter(adminScope).forEach((c, ci) => {
      const cp = `${sp}.items[${ci}]`;
      push(`${cp}.label`, "category", c.id, "label", c.label);
      c.items.filter(adminScope).forEach((i, ii) => {
        const ip = `${cp}.items[${ii}]`;
        push(`${ip}.title`, "item", i.id, "title", i.title);
        const body = parseBody(i.body);
        if (typeof body === "string") {
          push(`${ip}.body`, "item", i.id, "body", body, true);
        } else if (Array.isArray(body)) {
          body.forEach((p, pi) =>
            push(`${ip}.body[${pi}]`, "item", i.id, `body[${pi}]`, p, true)
          );
        }
        (i.bullets ?? []).forEach((b, bi) =>
          push(`${ip}.bullets[${bi}]`, "item", i.id, `bullets[${bi}]`, b)
        );
        push(`${ip}.noteText`, "item", i.id, "noteText", i.noteText);
        push(`${ip}.priceUnit`, "item", i.id, "priceUnit", i.priceUnit);
      });
    });
  }
  return out;
}

/** Legacy leaf-name aliases used by the original static-site export format. */
const ITEM_LEAF_ALIASES: Record<string, string> = {
  name: "title",
  n: "title",
  unit: "priceUnit",
  meta: "noteText",
  tip: "noteText",
  warn: "noteText",
};

const norm = (s: string) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export type ImportFile = {
  lang: string;
  content?: Record<string, string>;
  ui?: Record<string, string>;
  plurals?: Record<string, Record<string, string>>;
  /** Optional Slovene originals for the same keys — lets the importer align
   *  legacy/ambiguous keys by value instead of guessing. */
  source?: Record<string, string>;
};

export type ImportReport = {
  set: number;
  skippedUnknown: number;
  unchanged: number;
  /** Existing, different translations left alone because overwrite=false. */
  kept: number;
  unknownKeys: string[];
};

/**
 * Import one language file. Content keys are resolved through the SAME key
 * list the exporter produces; legacy alias leaves and (with `source`) value
 * alignment cover the original static-site format. Never deletes anything;
 * without `overwrite` an existing different translation is kept (reported).
 */
export async function importTranslations(
  tenant: Tenant,
  file: ImportFile,
  opts: { overwrite: boolean }
): Promise<ImportReport> {
  const lang = file.lang.toLowerCase();
  const keys = await buildKeyList(tenant);
  const byKey = new Map(keys.map((k) => [k.key, k]));

  // Secondary indexes for legacy keys.
  const byPrefix = new Map<string, KeyEntry[]>(); // item path -> entries
  for (const k of keys) {
    const m = k.key.match(/^(.*items\[\d+\])\.[^.]+$/);
    if (m && m[1]) {
      const arr = byPrefix.get(m[1]) ?? [];
      arr.push(k);
      byPrefix.set(m[1], arr);
    }
  }

  const resolve = (rawKey: string): KeyEntry | null => {
    const direct = byKey.get(rawKey);
    if (direct) return direct;

    // Legacy static-site format: the child array is named after the layout
    // (tabs[0], rules[3], poi[2], products[1]...) and a single-item category
    // hangs its fields directly on the category path.
    const normalized = rawKey.replace(
      /\.(tabs|rules|poi|products|routes|events|apartments)\[/g,
      ".items["
    );

    const m = normalized.match(/^(.*)\.([A-Za-z]+)((\[\d+\])?)$/);
    if (!m) return null;
    const [, rawPrefix, leaf, idx] = m as unknown as [
      string,
      string,
      string,
      string,
    ];

    // Candidate item prefixes: as-is, and (for category-level fields) the
    // category's single item.
    const prefixes = [rawPrefix];
    if (/^DATA\.[^.]+\.items\[\d+\]$/.test(rawPrefix)) {
      prefixes.push(`${rawPrefix}.items[0]`);
    }

    const leafCandidates: string[] = [`${leaf}${idx}`];
    const alias = ITEM_LEAF_ALIASES[leaf];
    if (alias) leafCandidates.push(`${alias}${idx}`);
    if (leaf === "incl") leafCandidates.push(`bullets${idx}`);
    if (leaf === "t") leafCandidates.push("title", "body");

    for (const p of prefixes) {
      for (const l of leafCandidates) {
        const hit = byKey.get(`${p}.${l}`);
        if (hit) return hit;
      }
    }

    // Value alignment: match the Slovene source value within the candidate
    // items — unique match wins, anything else is honestly "unknown".
    const src = file.source?.[rawKey];
    if (src) {
      const siblings = prefixes.flatMap((p) => byPrefix.get(p) ?? []);
      const hits = siblings.filter((k) => norm(k.source) === norm(src));
      if (hits.length === 1 && hits[0]) return hits[0];
    }
    return null;
  };

  const report: ImportReport = {
    set: 0,
    skippedUnknown: 0,
    unchanged: 0,
    kept: 0,
    unknownKeys: [],
  };

  // Existing rows for this tenant+lang, keyed by model/record/field.
  const recordIds = [...new Set(keys.map((k) => k.recordId))];
  recordIds.push(tenant.id);
  const existing = recordIds.length
    ? await db
        .select()
        .from(translationsTable)
        .where(
          and(
            inArray(translationsTable.recordId, recordIds),
            eq(translationsTable.lang, lang)
          )
        )
    : [];
  const exKey = (model: string, recordId: string, field: string) =>
    `${model}|${recordId}|${field}`;
  const existingMap = new Map(
    existing.map((e) => [exKey(e.model, e.recordId, e.field), e])
  );

  const upsert = async (
    model: string,
    recordId: string,
    field: string,
    value: string
  ) => {
    const prev = existingMap.get(exKey(model, recordId, field));
    if (prev) {
      if (prev.value === value) {
        report.unchanged++;
        return;
      }
      if (!opts.overwrite) {
        report.kept++;
        return;
      }
      await db
        .update(translationsTable)
        .set({ value, stale: false, updatedAt: new Date() })
        .where(eq(translationsTable.id, prev.id));
      prev.value = value;
      report.set++;
      return;
    }
    const [inserted] = await db
      .insert(translationsTable)
      .values({
        model,
        recordId,
        field,
        lang,
        value,
        stale: false,
      })
      .returning();
    // Track the new row so a second legacy key resolving to the same field
    // in the same run cannot collide on the unique index.
    if (inserted) existingMap.set(exKey(model, recordId, field), inserted);
    report.set++;
  };

  for (const [rawKey, value] of Object.entries(file.content ?? {})) {
    if (typeof value !== "string" || value.trim() === "") continue;
    const entry = resolve(rawKey);
    if (!entry) {
      report.skippedUnknown++;
      if (report.unknownKeys.length < 50) report.unknownKeys.push(rawKey);
      continue;
    }
    await upsert(entry.model, entry.recordId, entry.field, value);
  }

  // UI strings: stored as model="ui", recordId = tenant id, field = the key.
  // SECMETA.<sectionKey>.t/.s additionally feed the section's own
  // title/subtitle translations (the guest renders sections from content).
  const sectionByKey = new Map<string, string>(); // section.key -> recordId
  for (const k of keys) {
    if (k.model === "section") {
      const m = k.key.match(/^DATA\.([^.]+)\./);
      if (m && m[1]) sectionByKey.set(m[1], k.recordId);
    }
  }
  for (const [key, value] of Object.entries(file.ui ?? {})) {
    if (typeof value !== "string" || value.trim() === "") continue;
    await upsert("ui", tenant.id, key, value);
    const sm = key.match(/^SECMETA\.([^.]+)\.(t|s)$/);
    if (sm && sm[1]) {
      const sectionId = sectionByKey.get(sm[1]);
      if (sectionId) {
        await upsert(
          "section",
          sectionId,
          sm[2] === "t" ? "title" : "subtitle",
          value
        );
      }
    }
  }

  // Plural forms: replace this tenant+lang set for the imported keys.
  const plurals = file.plurals ?? {};
  for (const [key, forms] of Object.entries(plurals)) {
    for (const [form, value] of Object.entries(forms)) {
      if (typeof value !== "string" || value.trim() === "") continue;
      const prev = await db
        .select()
        .from(pluralFormsTable)
        .where(
          and(
            eq(pluralFormsTable.tenantId, tenant.id),
            eq(pluralFormsTable.lang, lang),
            eq(pluralFormsTable.key, key),
            eq(pluralFormsTable.form, form)
          )
        );
      const p = prev[0];
      if (p) {
        if (p.value === value) report.unchanged++;
        else {
          await db
            .update(pluralFormsTable)
            .set({ value })
            .where(eq(pluralFormsTable.id, p.id));
          report.set++;
        }
      } else {
        await db.insert(pluralFormsTable).values({
          tenantId: tenant.id,
          lang,
          key,
          form,
          value,
        });
        report.set++;
      }
    }
  }

  return report;
}

/**
 * Interface strings + plural forms for a guest response in one language.
 * Tenant-specific plural rows win over shared (tenant_id NULL) ones.
 */
export async function getUiAndPlurals(
  tenantId: string,
  lang: string
): Promise<{
  ui: Record<string, string>;
  plurals: Record<string, Record<string, string>>;
}> {
  const l = lang.toLowerCase();
  if (l === "sl") return { ui: {}, plurals: {} };
  const uiRows = await db
    .select()
    .from(translationsTable)
    .where(
      and(
        eq(translationsTable.model, "ui"),
        eq(translationsTable.recordId, tenantId),
        eq(translationsTable.lang, l)
      )
    );
  const ui: Record<string, string> = {};
  for (const r of uiRows) ui[r.field] = r.value;
  const pluralRows = await db
    .select()
    .from(pluralFormsTable)
    .where(eq(pluralFormsTable.lang, l));
  const plurals: Record<string, Record<string, string>> = {};
  // Shared rows first, tenant rows second so the tenant's own win.
  for (const p of [...pluralRows].sort((a, b) =>
    (a.tenantId ? 1 : 0) - (b.tenantId ? 1 : 0)
  )) {
    if (p.tenantId && p.tenantId !== tenantId) continue;
    plurals[p.key] = { ...(plurals[p.key] ?? {}), [p.form]: p.value };
  }
  return { ui, plurals };
}

/** Export one language in exactly the import format (canonical keys). */
export async function exportTranslations(
  tenant: Tenant,
  lang: string
): Promise<ImportFile> {
  const keys = await buildKeyList(tenant);
  const recordIds = [...new Set(keys.map((k) => k.recordId))];
  recordIds.push(tenant.id);
  const rows = await db
    .select()
    .from(translationsTable)
    .where(
      and(
        inArray(translationsTable.recordId, recordIds),
        eq(translationsTable.lang, lang.toLowerCase())
      )
    );
  const byRef = new Map(rows.map((r) => [`${r.model}|${r.recordId}|${r.field}`, r]));
  const content: Record<string, string> = {};
  for (const k of keys) {
    const row = byRef.get(`${k.model}|${k.recordId}|${k.field}`);
    if (row) content[k.key] = row.value;
  }
  const ui: Record<string, string> = {};
  for (const r of rows) {
    if (r.model === "ui" && r.recordId === tenant.id) ui[r.field] = r.value;
  }
  const pluralRows = await db
    .select()
    .from(pluralFormsTable)
    .where(
      and(
        eq(pluralFormsTable.tenantId, tenant.id),
        eq(pluralFormsTable.lang, lang.toLowerCase())
      )
    );
  const plurals: Record<string, Record<string, string>> = {};
  for (const p of pluralRows) {
    plurals[p.key] = { ...(plurals[p.key] ?? {}), [p.form]: p.value };
  }
  return { lang: lang.toLowerCase(), content, ui, plurals };
}
