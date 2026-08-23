import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

/**
 * Host accounts (Instruction #28, CHECKPOINT 2).
 *
 * The ACCOUNT (who can log in) is deliberately separate from the MEMBERSHIP
 * (which tenant the account manages). Today the product rule is one account
 * per tenant AND one tenant per account — both enforced as unique indexes on
 * host_memberships, i.e. as database guarantees. The approved growth path
 * ("one person, two properties") is: drop host_memberships_user_unique and
 * add a role column. No table rename, no data rewrite, no session or
 * changelog migration — a second property becomes one added membership row.
 *
 * passwordHash is Argon2id (m=64 MiB, t=3, p=1) or NULL for an account whose
 * password has not been set yet (owner created it; host sets the password
 * through the e-mail reset flow — nobody, including the owner, ever knows it).
 */
export const hostUsersTable = pgTable("host_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(), // stored lowercased
  passwordHash: text("password_hash"),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  // Capped exponential backoff (NOT a hard lockout — a stranger who knows the
  // e-mail must not be able to lock the host out; see CHECKPOINT 1 follow-up).
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lastFailedAt: timestamp("last_failed_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const hostMembershipsTable = pgTable(
  "host_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => hostUsersTable.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // ONE account per tenant (permanent product rule).
    uniqueIndex("host_memberships_tenant_unique").on(t.tenantId),
    // ONE tenant per account (today's rule; DROP this index to allow a host
    // to manage a second property — the only schema change multi-property needs).
    uniqueIndex("host_memberships_user_unique").on(t.hostUserId),
  ],
);

/** Server-side host sessions; cookie carries the raw token, DB stores SHA-256. */
export const hostSessionsTable = pgTable(
  "host_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => hostUsersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("host_sessions_user_idx").on(t.hostUserId)],
);

/** Single-use password-reset tokens, 60 minutes, SHA-256 hash only. */
export const hostPasswordResetsTable = pgTable(
  "host_password_resets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => hostUsersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [index("host_password_resets_user_idx").on(t.hostUserId)],
);

/** Audit log of host sign-ins, failures, resets. Passwords are never stored. */
export const hostAuthEventsTable = pgTable("host_auth_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  hostUserId: uuid("host_user_id"),
  // login | login_failed | login_backoff | logout | password_changed |
  // reset_requested | reset_completed | account_created | email_changed
  type: text("type").notNull(),
  detail: text("detail"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type HostUser = typeof hostUsersTable.$inferSelect;
export type HostMembership = typeof hostMembershipsTable.$inferSelect;
export type HostSession = typeof hostSessionsTable.$inferSelect;
export type HostPasswordReset = typeof hostPasswordResetsTable.$inferSelect;
