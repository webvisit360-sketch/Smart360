import { pgTable, uuid, text, jsonb, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenantsTable } from "./tenants";

export type CopyObject = { bucket: string; name: string };
export const tenantCopyJobsTable = pgTable("tenant_copy_jobs", {
  tenantId: uuid("tenant_id").primaryKey().references(() => tenantsTable.id, { onDelete: "restrict" }),
  environment: text("environment").notNull(),
  objectManifest: jsonb("object_manifest").$type<CopyObject[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  check("tenant_copy_jobs_environment_check", sql`${t.environment} IN ('development', 'production')`),
  check("tenant_copy_jobs_object_manifest_check", sql`jsonb_typeof(${t.objectManifest}) = 'array'`),
]);