import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    deliveryAttemptedAt: timestamp("delivery_attempted_at", { withTimezone: true }),
    deleteAfter: timestamp("delete_after", { withTimezone: true }).notNull(),
  },
  (table) => [
    check(
      "enquiries_delivery_status_enum",
      sql`${table.deliveryStatus} IN ('pending','accepted','failed')`,
    ),
    index("enquiries_submitted_at_idx").on(table.submittedAt),
    index("enquiries_delete_after_idx").on(table.deleteAfter),
  ],
);

export type EnquiryRow = typeof enquiriesTable.$inferSelect;