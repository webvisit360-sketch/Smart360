import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
} from "drizzle-orm/pg-core";

/** Single-operator admin account. Email is a label only (no mail is ever sent). */
export const adminUsersTable = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull().default("Upravitelj"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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

export type AdminUser = typeof adminUsersTable.$inferSelect;
export type AdminCredential = typeof adminCredentialsTable.$inferSelect;
