/**
 * Guest–host messaging tables (Architecture #29 Checkpoint 3).
 *
 * Design decisions:
 * - One durable thread per (tenantId, deviceTokenHash). Thread is upserted on
 *   first guest message; subsequent messages append to the existing thread.
 * - deviceTokenHash: SHA-256 of the raw device token (same convention as
 *   orders). Raw token is NEVER stored or logged.
 * - threadRef: public UUID exposed to both guest and admin. Safe to share.
 * - guestName / guestUnit: stored on the thread for host context only; never
 *   included in email notifications and never logged.
 * - Retention: deleteAfter = 90 days after the latest message timestamp. Each
 *   new message pushes the window forward via a trigger-less UPDATE on the
 *   thread.  A daily sweep removes threads whose deleteAfter is in the past;
 *   messages cascade via FK.
 * - Notification: messageNotifyEmail tenant flag controls whether Resend is
 *   called. Email is PII-safe: no body, name, unit, raw token, or IP.
 *   notificationKey = threadRef (Resend idempotency key) prevents duplicate
 *   emails for rapid bursts from the same thread. Thread-level, not per-message.
 *
 * Check constraints (applied by schema push only, not at runtime):
 *   message_threads_sender_enum  sender IN ('guest','host')
 *   messages_sender_enum         sender IN ('guest','host')
 */
import {
  pgTable,
  text,
  boolean,
  timestamp,
  uuid,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenantsTable } from "./tenants";

// ─── message_threads ──────────────────────────────────────────────────────────

export const messageThreadsTable = pgTable(
  "message_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Public reference shown to admin and used in notification idempotency.
     * Safe to share; carries no PII.
     */
    threadRef: uuid("thread_ref").notNull().defaultRandom(),
    /** Tenant that owns this thread. Cascade-delete when tenant is removed. */
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    /** SHA-256 of the raw device token. Raw token NEVER stored. */
    deviceTokenHash: text("device_token_hash").notNull(),
    /**
     * Optional guest-provided display name stored for host context.
     * Never sent in email; never logged. May be updated by successive guest sends.
     */
    guestName: text("guest_name"),
    /**
     * Optional guest-provided unit/room stored for host context.
     * Never sent in email; never logged. May be updated by successive guest sends.
     */
    guestUnit: text("guest_unit"),
    /**
     * Optional guest-provided phone stored once on the thread for host context.
     * Never sent in email; never logged. Nullable for pre-migration threads and
     * updated by the next authenticated guest send.
     */
    guestPhone: text("guest_phone"),
    /**
     * Whether the thread is still active. Admin may close it; closed threads
     * accept no new guest messages (returns 409).
     */
    isOpen: boolean("is_open").notNull().default(true),
    /**
     * 90-day retention deadline, extended by each new message.
     * A daily sweep deletes threads (and their cascaded messages) after this.
     */
    deleteAfter: timestamp("delete_after", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("message_threads_ref_idx").on(t.threadRef),
    /**
     * One durable thread per tenant + device. This unique index enforces the
     * "exactly one thread" invariant at the DB level.
     */
    uniqueIndex("message_threads_tenant_device_idx").on(
      t.tenantId,
      t.deviceTokenHash,
    ),
    index("message_threads_tenant_idx").on(t.tenantId),
    index("message_threads_delete_after_idx").on(t.deleteAfter),
  ],
);

// ─── messages ─────────────────────────────────────────────────────────────────

export const messagesTable = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Thread this message belongs to. Cascade-delete when thread is removed. */
    threadId: uuid("thread_id")
      .notNull()
      .references(() => messageThreadsTable.id, { onDelete: "cascade" }),
    /** Denormalised for simple queries without a join. */
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    /**
     * 'guest' | 'host'
     * Enforced by check constraint messages_sender_enum.
     */
    sender: text("sender").notNull(),
    /**
     * Plain-text message body. Max 2000 chars enforced at the route layer.
     * Never stored in email notifications.
     */
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("messages_thread_idx").on(t.threadId),
    index("messages_tenant_idx").on(t.tenantId),
    check("messages_sender_enum", sql`${t.sender} IN ('guest','host')`),
  ],
);

export type MessageThread = typeof messageThreadsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
