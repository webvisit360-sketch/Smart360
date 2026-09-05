import {
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenantsTable } from "./tenants";

/**
 * Guest orders placed through the Living Guide ordering feature.
 *
 * Security notes:
 * - orderRef: public unguessable reference (UUID v4, shown to guest and admin)
 * - deviceTokenHash: SHA-256 of the raw device token; raw token NEVER stored
 * - idempotencyKey (required, not null): SHA-256 of (tenantId + deviceTokenHash + clientKey)
 *   prevents duplicate rows on client retry via the unique constraint.
 * - Phone and name are stored for fulfilment only; never logged
 * - notificationStatus: pending → sent | failed, or skipped when tenant email
 *   notifications are disabled. Sent/skipped orders are visible in public/admin
 *   lists; pending/failed rows are eligible for retry and 90-day purge.
 * - Auto-expiry: deleteAfter is 90 days from creation; a daily sweep removes expired rows.
 *
 * DB-level check constraints (no DDL at runtime — applied by schema push only):
 *   orders_qty_range         qty BETWEEN 1 AND 999
 *   orders_status_enum       status IN ('novo','potrjeno','prevzeto','zavrnjeno')
 *   orders_notif_status_enum notificationStatus IN ('pending','sending','sent','failed','skipped')
 */
export const ordersTable = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Public-facing order reference (safe to share with guest and operator). */
    orderRef: uuid("order_ref").notNull().defaultRandom(),
    /** Tenant that received the order (for isolation). */
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    /** SHA-256 of the raw device token supplied in the request header. */
    deviceTokenHash: text("device_token_hash").notNull(),
    /**
     * Idempotency key = SHA-256(tenantId + ":" + deviceTokenHash + ":" + clientKey).
     * NOT NULL — x-idempotency-key header is required (16-128 chars).
     * Unique constraint + INSERT … ON CONFLICT DO NOTHING makes inserts atomic.
     */
    idempotencyKey: text("idempotency_key").notNull(),

    // ── Item snapshot ─────────────────────────────────────────────────────────
    itemId: uuid("item_id").notNull(),
    snapshotTitle: text("snapshot_title"),
    snapshotPrice: text("snapshot_price"),
    snapshotPriceUnit: text("snapshot_price_unit"),
    /**
     * Fulfilment sentence extracted at order time from item body/noteText/bullets.
     * Defaults to 'Prevzem pri gostitelju.' when no delivery keyword found.
     * producerNote is never used as fulfilment.
     */
    snapshotFulfillment: text("snapshot_fulfillment"),
    snapshotProducerName: text("snapshot_producer_name"),

    // ── Tenant snapshot ───────────────────────────────────────────────────────
    snapshotTenantName: text("snapshot_tenant_name"),
    /** Tenant's notification email captured at order time. */
    snapshotTenantEmail: text("snapshot_tenant_email"),
    /** Immutable selected transport and both possible recipients. */
    snapshotNotificationChannel: text("snapshot_notification_channel"),
    snapshotTenantWhatsappPhone: text("snapshot_tenant_whatsapp_phone"),

    // ── Order details ─────────────────────────────────────────────────────────
    /** Positive integer 1-999. Enforced by check constraint orders_qty_range. */
    qty: integer("qty").notNull().default(1),
    guestName: text("guest_name").notNull(),
    guestPhone: text("guest_phone").notNull(),
    guestUnit: text("guest_unit").notNull(),
    guestNote: text("guest_note"),

    // ── Order status lifecycle ────────────────────────────────────────────────
    /**
     * novo → potrjeno | zavrnjeno
     * potrjeno → prevzeto | zavrnjeno
     * prevzeto, zavrnjeno → terminal
     * Enforced by check constraint orders_status_enum.
     */
    status: text("status").notNull().default("novo"),
    /**
     * Optional plain-text note attached by the host to the CURRENT status.
     * Every legal transition replaces/clears this value; there is no chat thread.
     */
    statusNote: text("status_note"),

    // ── Notification status ───────────────────────────────────────────────────
    /**
     * Lifecycle: pending → sending → sent | failed  (failed → sending on retry)
     *            skipped (terminal, no email attempt because tenant disabled it)
     *
     *   pending  — row exists, no attempt has claimed it yet (transient; the
     *              inserting request immediately claims it into 'sending')
     *   sending  — an ACTIVE send attempt owns this row; identified by
     *              notificationClaimToken. Only the attempt whose token matches
     *              may complete it (→ sent | failed). A fresh 'sending' claim
     *              yields 425 to any other caller.
     *   sent     — email delivered; row is visible in lists (token cleared)
     *   failed   — last attempt failed; eligible for atomic reclaim (token cleared)
     *
     * Exact claim identity (fixes the stale-A / new-B completion race):
     *   Every send attempt writes a fresh cryptographically random
     *   notificationClaimToken atomically when it transitions the row into
     *   'sending'.  Success/failure updates MUST match
     *     orderRef AND notificationClaimToken=<this attempt token>
     *              AND notificationStatus='sending'
     *   so an older attempt (A) can never overwrite a newer claim (B): once B
     *   reclaims the row it rotates the token, and A's completion UPDATE matches
     *   zero rows.
     *
     * Recovery: an expired active claim ('sending' with notificationClaimedAt
     *   older than STALE_PENDING_MS) or a 'failed' row may be atomically
     *   reclaimed by rotating the token and refreshing notificationClaimedAt.
     *
     * Only rows with notificationStatus IN ('sent','skipped') appear in list responses.
     * Enforced by check constraint orders_notif_status_enum.
     */
    notificationStatus: text("notification_status").notNull().default("pending"),
    notificationSentAt: timestamp("notification_sent_at", { withTimezone: true }),
    /**
     * Cryptographically random token identifying the CURRENT active send attempt.
     * Set atomically when a row enters 'sending'; cleared (null) on sent/failed.
     * Completion updates gate on this value so a stale attempt cannot mutate a
     * newer claim.
     */
    notificationClaimToken: text("notification_claim_token"),
    /**
     * When the current active claim was taken.  Used to detect an expired claim
     * (crashed sender) that recovery may reclaim after STALE_PENDING_MS.
     */
    notificationClaimedAt: timestamp("notification_claimed_at", { withTimezone: true }),

    // ── Timestamps ────────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    /** 90-day retention deadline. Rows are swept daily after this timestamp. */
    deleteAfter: timestamp("delete_after", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("orders_order_ref_idx").on(t.orderRef),
    uniqueIndex("orders_idempotency_idx").on(t.idempotencyKey),
    index("orders_tenant_device_idx").on(t.tenantId, t.deviceTokenHash),
    index("orders_tenant_status_idx").on(t.tenantId, t.status),
    index("orders_tenant_notification_idx").on(t.tenantId, t.notificationStatus),
    index("orders_delete_after_idx").on(t.deleteAfter),
    // DB-level constraints — applied by schema push, never at runtime
    check("orders_qty_range", sql`${t.qty} BETWEEN 1 AND 999`),
    check(
      "orders_status_enum",
      sql`${t.status} IN ('novo','potrjeno','prevzeto','zavrnjeno')`,
    ),
    check(
      "orders_notif_status_enum_v2",
      sql`${t.notificationStatus} IN ('pending','sending','sent','failed','skipped')`,
    ),
    check(
      "orders_snapshot_notification_channel_enum_v1",
      sql`${t.snapshotNotificationChannel} IS NULL OR ${t.snapshotNotificationChannel} IN ('email','whatsapp')`,
    ),
  ],
);

export type Order = typeof ordersTable.$inferSelect;
