import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  bigint,
  jsonb,
  boolean,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Single-operator admin account. Email is a label only (no mail is ever sent). */
export const adminUsersTable = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull().default("Upravitelj"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The single operator password credential. A boolean primary key makes a
 * second credential impossible while keeping the existing admin_users row
 * untouched.
 */
export const adminPasswordCredentialsTable = pgTable(
  "admin_password_credentials",
  {
    singleton: boolean("singleton").primaryKey().notNull().default(true),
    passwordHash: text("password_hash").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("admin_password_credentials_singleton", sql`${table.singleton} = true`)],
);

/** Cross-instance progressive-delay state for the single operator account. */
export const adminPasswordStateTable = pgTable(
  "admin_password_state",
  {
    singleton: boolean("singleton").primaryKey().notNull().default(true),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lastFailedAt: timestamp("last_failed_at", { withTimezone: true }),
  },
  (table) => [check("admin_password_state_singleton", sql`${table.singleton} = true`)],
);

/** WebAuthn passkey credentials. */
export const adminCredentialsTable = pgTable("admin_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  credentialId: text("credential_id").notNull().unique(), // base64url
  publicKey: text("public_key").notNull(), // base64url
  counter: integer("counter").notNull().default(0),
  transports: text("transports"), // JSON array string
  deviceName: text("device_name").notNull().default("Passkey"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

/** One-time recovery codes, argon2id-hashed. */
export const adminRecoveryCodesTable = pgTable("admin_recovery_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  codeHash: text("code_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

/** Server-side sessions; cookie carries the raw token, DB stores its SHA-256 hash. */
export const adminSessionsTable = pgTable("admin_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Single-use enrolment tokens (shell command or recovery code), 15 minutes. */
export const adminEnrollTokensTable = pgTable("admin_enroll_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  source: text("source").notNull().default("shell"), // shell | recovery
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

/** Short-lived WebAuthn challenges (registration and authentication). */
export const adminChallengesTable = pgTable("admin_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(), // registration | authentication
  challenge: text("challenge").notNull(),
  context: text("context"), // e.g. enroll token hash binding
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Audit log of sign-ins, enrolments and recovery-code use. */
export const adminAuthEventsTable = pgTable("admin_auth_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(), // login | enroll | recovery | logout | revoke_all | credential_deleted
  detail: text("detail"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One file moved to trash by a cleanup run. Paths are bucket object names. */
export type CleanupRunFile = {
  key: string; // "<slug>/<file>" — logical file
  bytes: number;
  paths: string[]; // original bucket object names (all width derivatives)
  restoredAt: string | null;
};

/**
 * Audit record of every storage-cleanup execution. Files are moved to
 * trash/<runId>/… in the bucket (never hard-deleted) and kept 30 days;
 * this row is the ledger that makes the trash restorable and the run
 * accountable (who, when, what, how much).
 */
export const cleanupRunsTable = pgTable("cleanup_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull().default("admin"),
  scope: text("scope").notNull(), // tenant | orphans
  tenantSlug: text("tenant_slug"),
  fileCount: integer("file_count").notNull().default(0),
  totalBytes: bigint("total_bytes", { mode: "number" }).notNull().default(0),
  files: jsonb("files").$type<CleanupRunFile[]>().notNull().default([]),
  purgedAt: timestamp("purged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CleanupRun = typeof cleanupRunsTable.$inferSelect;

export type AdminUser = typeof adminUsersTable.$inferSelect;
export type AdminCredential = typeof adminCredentialsTable.$inferSelect;
