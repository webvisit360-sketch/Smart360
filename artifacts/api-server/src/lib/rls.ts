import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Ring 3 — fail-closed Postgres row-level security (Instruction #28, CP1/CP2).
 *
 * Host requests run on a connection with app.role='host' and
 * app.tenant_id=<tenant> (see openHostDbContext). These policies make the
 * DATABASE refuse cross-tenant rows for such connections, even if a handler
 * forgets a WHERE clause or an attacker supplies foreign ids in a body:
 *
 * - Non-host connections (guest/public/owner/background) are untouched: the
 *   first disjunct short-circuits to TRUE, so the planner sees a constant.
 * - Host connections are FAIL-CLOSED: if app.tenant_id is missing/empty the
 *   tenant comparison is NULL → row hidden, insert/update rejected.
 * - FORCE ROW LEVEL SECURITY is required because the app connects as the
 *   table owner, and owners otherwise bypass RLS entirely.
 *
 * Applied idempotently at startup (DROP POLICY IF EXISTS + CREATE), the same
 * way other self-applying startup migrations in this codebase work, so a
 * publish carries it to production without manual SQL.
 */

// Empty string handled too: RESET ALL leaves custom GUCs as '' on some paths.
const HOST = "current_setting('app.role', true) = 'host'";
const TID = "nullif(current_setting('app.tenant_id', true), '')::uuid";

/** tableName -> { using, withCheck? } (host-side predicate; non-host bypasses). */
const POLICIES: Record<string, { using: string; withCheck?: string }> = {
  tenants: { using: `id = ${TID}` },
  tenant_aliases: { using: `tenant_id = ${TID}` },
  sections: { using: `tenant_id = ${TID}` },
  categories: {
    using: `EXISTS (SELECT 1 FROM sections s WHERE s.id = categories.section_id AND s.tenant_id = ${TID})`,
  },
  items: {
    using: `EXISTS (SELECT 1 FROM categories c JOIN sections s ON s.id = c.section_id WHERE c.id = items.category_id AND s.tenant_id = ${TID})`,
  },
  media: {
    using: `((media.tenant_id IS NOT NULL AND media.tenant_id = ${TID}) OR (media.item_id IS NOT NULL AND EXISTS (SELECT 1 FROM items i JOIN categories c ON c.id = i.category_id JOIN sections s ON s.id = c.section_id WHERE i.id = media.item_id AND s.tenant_id = ${TID})))`,
  },
  translations: {
    using: `(
      (translations.model IN ('tenant','ui') AND translations.record_id = ${TID})
      OR (translations.model = 'section' AND EXISTS (SELECT 1 FROM sections s WHERE s.id = translations.record_id AND s.tenant_id = ${TID}))
      OR (translations.model = 'category' AND EXISTS (SELECT 1 FROM categories c JOIN sections s ON s.id = c.section_id WHERE c.id = translations.record_id AND s.tenant_id = ${TID}))
      OR (translations.model = 'item' AND EXISTS (SELECT 1 FROM items i JOIN categories c ON c.id = i.category_id JOIN sections s ON s.id = c.section_id WHERE i.id = translations.record_id AND s.tenant_id = ${TID}))
    )`,
  },
  plural_forms: {
    // Hosts may READ shared (tenantless) plural strings, but write only their own.
    using: `(tenant_id IS NULL OR tenant_id = ${TID})`,
    withCheck: `tenant_id = ${TID}`,
  },
  item_distance_proposals: { using: `tenant_id = ${TID}` },
  orders: { using: `tenant_id = ${TID}` },
  message_threads: { using: `tenant_id = ${TID}` },
  messages: {
    using: `EXISTS (SELECT 1 FROM message_threads t WHERE t.id = messages.thread_id AND t.tenant_id = ${TID})`,
  },
  // Host-context changelog writes must carry the host's tenant — attribution
  // cannot be forged or omitted from a host session.
  changelog: { using: `tenant_id = ${TID}`, withCheck: `tenant_id = ${TID}` },
  // Host-auth tables: a host connection sees only the account(s) belonging to
  // ITS tenant (password change runs under the host context). Cross-account
  // hashes, sessions and audit rows are invisible and unwritable.
  host_memberships: { using: `tenant_id = ${TID}` },
  host_users: {
    using: `EXISTS (SELECT 1 FROM host_memberships m WHERE m.host_user_id = host_users.id AND m.tenant_id = ${TID})`,
  },
  host_sessions: {
    using: `EXISTS (SELECT 1 FROM host_memberships m WHERE m.host_user_id = host_sessions.host_user_id AND m.tenant_id = ${TID})`,
  },
  host_auth_events: {
    using: `(host_auth_events.host_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM host_memberships m WHERE m.host_user_id = host_auth_events.host_user_id AND m.tenant_id = ${TID}))`,
  },
};

/**
 * The pool connects as the database owner, which on managed Postgres is a
 * superuser / BYPASSRLS role — policies would be silently skipped (verified:
 * current_user=postgres, rolbypassrls=t). Host-scoped connections therefore
 * SET ROLE to this dedicated NOLOGIN, NOBYPASSRLS role for the duration of
 * the request (see openHostDbContext), which makes the policies bite.
 */
export const HOST_DB_ROLE = "smart360_host";

/**
 * LEAST PRIVILEGE: the host role gets exactly the tables and operations the
 * host-allowed /admin handlers use — nothing else. Owner-secret tables
 * (admin_*, host_invites, host_password_resets) and owner bookkeeping (cleanup_runs,
 * tenant_renewals) have NO grants at all, and FUTURE tables are fail-closed:
 * a new table is invisible to hosts until it is deliberately added here.
 */
const HOST_ROLE_GRANTS: Record<string, string> = {
  // Content the host manages (incl. trash restore/purge and duplicates).
  sections: "SELECT, INSERT, UPDATE, DELETE",
  categories: "SELECT, INSERT, UPDATE, DELETE",
  items: "SELECT, INSERT, UPDATE, DELETE",
  media: "SELECT, INSERT, UPDATE, DELETE",
  translations: "SELECT, INSERT, UPDATE, DELETE",
  plural_forms: "SELECT, INSERT, UPDATE, DELETE",
  item_distance_proposals: "SELECT, INSERT, UPDATE, DELETE",
  message_threads: "SELECT, INSERT, UPDATE, DELETE",
  messages: "SELECT, INSERT, UPDATE, DELETE",
  // The host edits their tenant but never creates or deletes tenants.
  tenants: "SELECT, UPDATE",
  tenant_aliases: "SELECT",
  // Orders are created by guests; the host reads and processes them.
  orders: "SELECT, UPDATE, DELETE",
  // Attribution is append-only from a host's perspective.
  changelog: "SELECT, INSERT",
  // Distance review shares the geocode cache and the DB-wide throttle row.
  geocode_cache: "SELECT, INSERT, UPDATE",
  geocode_throttle: "SELECT, INSERT, UPDATE",
  // Self-service password change runs under the host context (RLS scopes
  // these to the tenant's own account — see POLICIES above).
  host_users: "SELECT, UPDATE",
  host_memberships: "SELECT",
  host_sessions: "SELECT, DELETE",
  host_auth_events: "SELECT, INSERT",
};

async function ensureHostRole(): Promise<void> {
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${HOST_DB_ROLE}') THEN
          CREATE ROLE ${HOST_DB_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        END IF;
      END $$;
    `),
  );
  await db.execute(sql.raw(`GRANT ${HOST_DB_ROLE} TO CURRENT_USER`));
  await db.execute(sql.raw(`GRANT USAGE ON SCHEMA public TO ${HOST_DB_ROLE}`));
  // Sweep first: removes any broader grants from earlier revisions and keeps
  // this function the single source of truth for what the role may touch.
  await db.execute(
    sql.raw(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${HOST_DB_ROLE}`),
  );
  await db.execute(
    sql.raw(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${HOST_DB_ROLE}`,
    ),
  );
  for (const [table, ops] of Object.entries(HOST_ROLE_GRANTS)) {
    await db.execute(sql.raw(`GRANT ${ops} ON ${table} TO ${HOST_DB_ROLE}`));
  }
  await db.execute(
    sql.raw(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${HOST_DB_ROLE}`),
  );
}

export async function ensureRowLevelSecurity(): Promise<void> {
  await ensureHostRole();
  for (const [table, p] of Object.entries(POLICIES)) {
    const using = `(NOT (${HOST})) OR (${p.using})`;
    const withCheck = `(NOT (${HOST})) OR (${p.withCheck ?? p.using})`;
    await db.execute(sql.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
    await db.execute(sql.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`));
    await db.execute(sql.raw(`DROP POLICY IF EXISTS host_scope ON ${table}`));
    await db.execute(
      sql.raw(
        `CREATE POLICY host_scope ON ${table} FOR ALL USING (${using}) WITH CHECK (${withCheck})`,
      ),
    );
  }
  logger.info(
    { tables: Object.keys(POLICIES).length },
    "[rls] row-level security policies ensured",
  );
}
