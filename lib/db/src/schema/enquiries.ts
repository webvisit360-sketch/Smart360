import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const enquiriesTable = pgTable(
  "enquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    propertyName: text("property_name").notNull(),
    address: text("address").notNull(),
    propertyType: text("property_type").notNull(),
    message: text("message"),
    deliveryStatus: text("delivery_status").notNull().default("pending"),
    providerMessageId: text("provider_message_id"),
    providerEventName: text("provider_event_name"),
    providerEventAt: timestamp("provider_event_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    deliveryAttemptedAt: timestamp("delivery_attempted_at", { withTimezone: true }),
    deleteAfter: timestamp("delete_after", { withTimezone: true }).notNull(),
  },
  (table) => [
    check(
      "enquiries_delivery_status_enum",
      sql`${table.deliveryStatus} IN ('pending','accepted','failed','delivered','bounced','complained')`,
    ),
    index("enquiries_submitted_at_idx").on(table.submittedAt),
    index("enquiries_delete_after_idx").on(table.deleteAfter),
    uniqueIndex("enquiries_provider_message_id_unique")
      .on(table.providerMessageId)
      .where(sql`${table.providerMessageId} IS NOT NULL`),
  ],
);

export type EnquiryRow = typeof enquiriesTable.$inferSelect;