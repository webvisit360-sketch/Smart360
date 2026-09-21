import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

/** One replaceable publication per tenant; deliberately not a revision history. */
export const publishedSnapshotsTable = pgTable("published_snapshots", {
  tenantId: uuid("tenant_id").primaryKey().references(() => tenantsTable.id, { onDelete: "cascade" }),
  content: jsonb("content").notNull().$type<Record<string, unknown>>(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});