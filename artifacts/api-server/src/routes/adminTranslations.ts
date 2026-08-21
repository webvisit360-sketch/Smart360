import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, tenantsTable, translationsTable } from "@workspace/db";
import {
  ListTenantTranslationsResponse,
  GetTranslationOverviewResponse,
  ImportTranslationsBody,
  ImportTranslationsResponse,
  ExportTranslationsResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/adminAuth";
import { logChange } from "../lib/changelog";
import {
  CONTENT_LANGS,
  buildKeyList,
  importTranslations,
  exportTranslations,
} from "../lib/translationKeys";
import { invalidateTenantCache } from "./publicTenants";

const router: IRouter = Router();
router.use("/admin", requireAdmin);

function firstParam(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

async function loadTenant(id: string) {
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, id));
  return tenant;
}

// Every translatable field with path key, Slovene source and translation.
router.get(
  "/admin/tenants/:id/translations",
  async (req, res): Promise<void> => {
    const tenant = await loadTenant(firstParam(req.params["id"]));
    if (!tenant) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const lang = String(req.query["lang"] ?? "").toLowerCase();
    if (!lang) {
      res.status(400).json({ error: "lang is required" });
      return;
    }
    const keys = await buildKeyList(tenant);
    const recordIds = [...new Set(keys.map((k) => k.recordId))];
    const rows = recordIds.length
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
    const byRef = new Map(
      rows.map((r) => [`${r.model}|${r.recordId}|${r.field}`, r])
    );
    const entries = keys.map((k) => {
      const row = byRef.get(`${k.model}|${k.recordId}|${k.field}`);
      return {
        key: k.key,
        model: k.model,
        recordId: k.recordId,
        field: k.field,
        source: k.source,
        rich: k.rich,
        value: row?.value ?? null,
        stale: row?.stale ?? false,
      };
    });
    res.json(ListTenantTranslationsResponse.parse(entries));
  }
);

// Coverage per language: "142 / 272" + stale count for the tab badges.
router.get(
  "/admin/tenants/:id/translations/overview",
  async (req, res): Promise<void> => {
    const tenant = await loadTenant(firstParam(req.params["id"]));
    if (!tenant) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const keys = await buildKeyList(tenant);
    const recordIds = [...new Set(keys.map((k) => k.recordId))];
    const rows = recordIds.length
      ? await db
          .select()
          .from(translationsTable)
          .where(inArray(translationsTable.recordId, recordIds))
      : [];
    const refSet = new Set(keys.map((k) => `${k.model}|${k.recordId}|${k.field}`));
    const out = CONTENT_LANGS.map((lang) => {
      const forLang = rows.filter(
        (r) =>
          r.lang.toLowerCase() === lang &&
          refSet.has(`${r.model}|${r.recordId}|${r.field}`)
      );
      return {
        lang,
        translated: forLang.length,
        total: keys.length,
        stale: forLang.filter((r) => r.stale).length,
      };
    });
    res.json(GetTranslationOverviewResponse.parse(out));
  }
);

// Import a language file (exact attached format). Reports set / skipped as
// unknown / unchanged / kept (existing edits are never overwritten unless
// overwrite=true — "never overwrite an edited translation without asking").
router.post(
  "/admin/tenants/:id/translations/import",
  async (req, res): Promise<void> => {
    const tenant = await loadTenant(firstParam(req.params["id"]));
    if (!tenant) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = ImportTranslationsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const lang = parsed.data.lang.toLowerCase();
    if (!(CONTENT_LANGS as readonly string[]).includes(lang)) {
      res.status(400).json({ error: `Neznan jezik: ${lang}` });
      return;
    }
    const report = await importTranslations(
      tenant,
      { ...parsed.data, lang },
      { overwrite: parsed.data.overwrite ?? false }
    );
    invalidateTenantCache();
    await logChange({
      tenantId: tenant.id,
      tenantName: tenant.name,
      action: "update",
      entity: "translations",
      detail: `uvoz ${lang}: ${report.set} zapisanih, ${report.skippedUnknown} neznanih, ${report.unchanged} nespremenjenih`,
    });
    res.json(ImportTranslationsResponse.parse(report));
  }
);

// Export one language in exactly the import format (round-trips to zero
// changes on re-import).
router.get(
  "/admin/tenants/:id/translations/export",
  async (req, res): Promise<void> => {
    const tenant = await loadTenant(firstParam(req.params["id"]));
    if (!tenant) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const lang = String(req.query["lang"] ?? "").toLowerCase();
    if (!lang) {
      res.status(400).json({ error: "lang is required" });
      return;
    }
    const file = await exportTranslations(tenant, lang);
    res.json(ExportTranslationsResponse.parse(file));
  }
);

export default router;
