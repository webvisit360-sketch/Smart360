import { pgTable, uuid, text, jsonb, timestamp, check, index, uniqueIndex, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { tenantsTable } from "./tenants";
import { itemsTable } from "./content";

export const smartxstayImportRunsTable = pgTable("smartxstay_import_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  status: text("status").notNull().default("preparing"),
  report: jsonb("report").notNull().default({}),
  objectManifest: jsonb("object_manifest").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, t => [
  check("smartxstay_import_runs_status_check", sql`${t.status} IN ('preparing', 'importing', 'completed', 'failed')`),
  check("smartxstay_import_runs_report_check", sql`jsonb_typeof(${t.report}) = 'object'`),
  check("smartxstay_import_runs_manifest_check", sql`jsonb_typeof(${t.objectManifest}) = 'array'`),
  index("smartxstay_import_runs_tenant_created_idx").on(t.tenantId, t.createdAt),
  uniqueIndex("smartxstay_import_runs_one_active_idx").on(t.tenantId).where(sql`${t.status} IN ('preparing', 'importing')`),
]);

export const smartxstayImportSourcesTable = pgTable("smartxstay_import_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  runId: uuid("run_id").notNull().references(() => smartxstayImportRunsTable.id, { onDelete: "restrict" }),
  sourceGuideId: text("source_guide_id").notNull(),
  sourceItemId: text("source_item_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  itemId: uuid("item_id").references(() => itemsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  unique("smartxstay_import_sources_identity_unique").on(t.tenantId, t.sourceGuideId, t.sourceItemId),
  unique("smartxstay_import_sources_item_unique").on(t.itemId),
  check("smartxstay_import_sources_guide_nonempty", sql`length(btrim(${t.sourceGuideId})) > 0`),
  check("smartxstay_import_sources_item_nonempty", sql`length(btrim(${t.sourceItemId})) > 0`),
  index("smartxstay_import_sources_run_idx").on(t.runId),
]);

export const insertSmartxstayImportRunSchema = createInsertSchema(smartxstayImportRunsTable);
export const insertSmartxstayImportSourceSchema = createInsertSchema(smartxstayImportSourcesTable);
export type SmartxstayImportRun = typeof smartxstayImportRunsTable.$inferSelect;
export type SmartxstayImportSource = typeof smartxstayImportSourcesTable.$inferSelect;
