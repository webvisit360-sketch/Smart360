import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, index, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { tenantsTable } from "./tenants";

/** Runtime data: deliberately outside guide snapshots, translations and dirty triggers. */
export const tenantAnnouncementsTable = pgTable("tenant_announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
  titleSl: text("title_sl"),
  titleEn: text("title_en"),
  titleDe: text("title_de"),
  titleIt: text("title_it"),
  bodySl: text("body_sl"),
  bodyEn: text("body_en"),
  bodyDe: text("body_de"),
  bodyIt: text("body_it"),
  titleFr: text("title_fr"),
  bodyFr: text("body_fr"),
  titleNl: text("title_nl"),
  bodyNl: text("body_nl"),
  titleHr: text("title_hr"),
  bodyHr: text("body_hr"),
  imageUrl: text("image_url"),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("tenant_announcements_tenant_created_idx").on(t.tenantId, t.createdAt.desc()),
  check("tenant_announcements_validity_chk", sql`${t.validTo} IS NULL OR ${t.validTo} >= ${t.validFrom}`),
]);

export const insertAnnouncementSchema = createInsertSchema(tenantAnnouncementsTable)
  .omit({ id: true, createdAt: true, updatedAt: true });
export type TenantAnnouncement = typeof tenantAnnouncementsTable.$inferSelect;