import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

/**
 * Append-only evidence for every actual host-notification delivery attempt.
 * notificationId intentionally has no source FK: evidence survives source
 * notification retention/deletion. Tenant deletion may remove its evidence.
 */
export const notificationDeliveryAttemptsTable = pgTable(
  "notification_delivery_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    notificationKind: text("notification_kind").notNull(),
    notificationId: text("notification_id").notNull(),
    channel: text("channel").notNull(),
    recipient: text("recipient").notNull(),
    outcome: text("outcome").notNull(),
    providerMessageId: text("provider_message_id"),
    providerError: text("provider_error"),
    fallbackFrom: text("fallback_from"),
    fallbackTriggerError: text("fallback_trigger_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notification_attempts_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("notification_attempts_notification_idx").on(
      t.tenantId,
      t.notificationKind,
      t.notificationId,
    ),
    check(
      "notification_attempts_kind_enum_v1",
      sql`${t.notificationKind} IN ('order','message')`,
    ),
    check(
      "notification_attempts_channel_enum_v1",
      sql`${t.channel} IN ('email','whatsapp')`,
    ),
    check(
      "notification_attempts_outcome_enum_v1",
      sql`${t.outcome} IN ('sent','failed')`,
    ),
    check(
      "notification_attempts_fallback_enum_v1",
      sql`${t.fallbackFrom} IS NULL OR ${t.fallbackFrom} IN ('email','whatsapp')`,
    ),
  ],
);

export type NotificationDeliveryAttempt =
  typeof notificationDeliveryAttemptsTable.$inferSelect;