/**
 * Disposable development fixture for the host-onboarding browser check.
 *
 * This is deliberately an operator-invoked script, not an application seed.
 * It never runs the publish workflow and never sends an invitation.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmod, readFile, rename, rm, writeFile } from "node:fs/promises";
import type { Request } from "express";
import { pool, tenantsTable } from "@workspace/db";
import { seedTenantContent } from "../lib/tenantSeeds";
import { buildDraftPublication } from "../lib/publishedSnapshots";
import { issueHostInviteForTenant, upsertHostAccountForTenant } from "../lib/hostAuth";
import { ObjectStorageService } from "../lib/objectStorage";
import { hostOnboardingObjectCounterpart } from "../lib/hostOnboardingPhotoPaths";

const STATE_PATH = "/tmp/host-onboarding-fixture.json";
const MARKER_PREFIX = "host-onboarding-fixture-";
const SLUG_PREFIX = "hofx-";
const LEGACY_SLUG_PREFIX = MARKER_PREFIX;
const CLIENT_SLUG_SHAPE = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;
const MODES = new Set(["setup", "inspect", "cleanup"]);
let currentStage = "startup";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

type FixtureState = {
  version: 1;
  marker: string;
  tenantId: string;
  tenantSlug: string;
  hostUserId: string;
  hostEmail: string;
  inviteId: string;
  inviteToken: string;
  testPassword: string;
  ownerSessionId: string;
  ownerSessionCookie: string;
  publishedDigest: string;
  publishedFields: {
    name: string | null;
    address: string | null;
    website: string | null;
    phone: string | null;
    email: string | null;
  };
  createdAt: string;
};

type QueryResult = { rows: Array<Record<string, unknown>>; rowCount: number | null };

function refuseUnsafeEnvironment(): void {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Refusing: NODE_ENV must be exactly development.");
  }
  if (process.env.REPLIT_DEPLOYMENT || process.env.REPLIT_DEPLOYMENT_ID) {
    throw new Error("Refusing: deployment environment detected.");
  }
  if (!process.env.REPLIT_DEV_DOMAIN) {
    throw new Error("Refusing: this command requires the Replit development workspace.");
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function quoted(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) throw new Error("Unsafe database identifier.");
  return `"${identifier}"`;
}

async function query(text: string, values: unknown[] = []): Promise<QueryResult> {
  return pool.query(text, values) as Promise<QueryResult>;
}

async function readState(): Promise<FixtureState> {
  const raw = await readFile(STATE_PATH, "utf8");
  const state = JSON.parse(raw) as Partial<FixtureState>;
  if (
    state.version !== 1 ||
    typeof state.marker !== "string" ||
    !state.marker.startsWith(MARKER_PREFIX) ||
    typeof state.tenantId !== "string" ||
    typeof state.tenantSlug !== "string" ||
    (!state.tenantSlug.startsWith(SLUG_PREFIX) &&
      !state.tenantSlug.startsWith(LEGACY_SLUG_PREFIX)) ||
    typeof state.hostUserId !== "string" ||
    typeof state.inviteToken !== "string" ||
    typeof state.ownerSessionId !== "string" ||
    typeof state.ownerSessionCookie !== "string"
  ) {
    throw new Error("Refusing: fixture state is missing or invalid.");
  }
  return state as FixtureState;
}

async function writeState(state: FixtureState): Promise<void> {
  const temporary = `${STATE_PATH}.${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  await chmod(temporary, 0o600);
  await rename(temporary, STATE_PATH);
  await chmod(STATE_PATH, 0o600);
}

function snapshotFields(content: unknown): FixtureState["publishedFields"] {
  const root = content as {
    languages?: { sl?: { tree?: Record<string, unknown> } };
  };
  const tree = root.languages?.sl?.tree ?? {};
  const text = (key: string): string | null =>
    typeof tree[key] === "string" ? tree[key] as string : null;
  return {
    name: text("name"),
    address: text("address"),
    website: text("website"),
    phone: text("phone"),
    email: text("email"),
  };
}

async function assertDevelopmentDatabase(): Promise<void> {
  const result = await query(
    `select current_database() as database_name,
            coalesce(current_setting('application_name', true), '') as application_name`,
  );
  const row = result.rows[0] ?? {};
  const joined = `${String(row.database_name ?? "")} ${String(row.application_name ?? "")}`.toLowerCase();
  if (/(^|[^a-z])(prod|production)([^a-z]|$)/.test(joined)) {
    throw new Error("Refusing: database identifies itself as production.");
  }
}

async function setup(): Promise<Record<string, number>> {
  currentStage = "setup.preflight";
  try {
    await readFile(STATE_PATH, "utf8");
    throw new Error(`Refusing: ${STATE_PATH} already exists; inspect or cleanup first.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const stamp = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const marker = `${MARKER_PREFIX}${stamp}`;
  const tenantSlug = `${SLUG_PREFIX}${stamp}`;
  if (tenantSlug.length > 40 || !CLIENT_SLUG_SHAPE.test(tenantSlug)) {
    throw new Error("Generated fixture slug violates the guest-client route contract.");
  }
  const hostEmail = `${marker}@example.invalid`;
  const testPassword = `Dev-only-${randomBytes(18).toString("base64url")}`;
  let tenantId: string | null = null;
  let hostUserId: string | null = null;
  let ownerSessionId: string | null = null;

  try {
    currentStage = "setup.tenant";
    const inserted = await query(
      `insert into tenants
        (slug, name, tenant_type, guest_ui_mode, phone, address,
         email, is_published, has_unpublished_changes)
       values ($1, $2, 'apartmaji', 'living-guide', $3, null, null, true, false)
       returning id`,
      [tenantSlug, "OPERATERJEVO IME – NE PREPIŠI", "+386 40 700 701"],
    );
    tenantId = String(inserted.rows[0]?.id);

    currentStage = "setup.skeleton";
    await seedTenantContent(tenantId, "apartmaji");

    currentStage = "setup.snapshot";
    const [tenant] = await (await import("@workspace/db")).db
      .select()
      .from(tenantsTable)
      .where((await import("drizzle-orm")).eq(tenantsTable.id, tenantId))
      .limit(1);
    if (!tenant) throw new Error("Fixture tenant could not be re-read.");
    const publication = await buildDraftPublication(tenant);
    await query(
      `insert into published_snapshots (tenant_id, content, published_at)
       values ($1, $2::jsonb, now())`,
      [tenantId, JSON.stringify(publication)],
    );

    currentStage = "setup.host";
    const account = await upsertHostAccountForTenant(tenantId, hostEmail, null);
    if (!account.ok || !account.created) throw new Error("Temporary host account was not created.");
    const user = await query(
      "select id from host_users where email = $1 and password_hash is null",
      [hostEmail],
    );
    hostUserId = String(user.rows[0]?.id);
    if (!hostUserId) throw new Error("Temporary host account could not be re-read.");

    const request = {
      actor: { kind: "owner" },
      ip: "127.0.0.1",
      get: () => "host-onboarding-development-fixture",
    } as unknown as Request;
    currentStage = "setup.invite";
    const invite = await issueHostInviteForTenant(tenantId, "welcome", request);
    if (!invite.ok) throw new Error("Temporary welcome invite was not created.");

    // A session only (never an account or credential) permits the requested
    // read-only/reopen operator checks without touching the real operator's
    // password, passkey, recovery codes, or existing sessions.
    currentStage = "setup.owner-session";
    const ownerSessionToken = randomBytes(32).toString("base64url");
    const ownerSession = await query(
      `insert into admin_sessions (token_hash, ip, user_agent, expires_at)
       values ($1, '127.0.0.1', $2, now() + interval '8 hours')
       returning id`,
      [createHash("sha256").update(ownerSessionToken).digest("hex"), marker],
    );
    ownerSessionId = String(ownerSession.rows[0]?.id);
    if (!ownerSessionId) throw new Error("Temporary owner session was not created.");

    const state: FixtureState = {
      version: 1,
      marker,
      tenantId,
      tenantSlug,
      hostUserId,
      hostEmail,
      inviteId: invite.inviteId,
      inviteToken: invite.token,
      testPassword,
      ownerSessionId,
      ownerSessionCookie: `__Host-s360_admin=${ownerSessionToken}`,
      publishedDigest: digest(publication),
      publishedFields: snapshotFields(publication),
      createdAt: new Date().toISOString(),
    };
    currentStage = "setup.state";
    await writeState(state);
    currentStage = "setup.complete";
    return { tenants: 1, hostAccounts: 1, invites: 1, ownerSessions: 1, publishedSnapshots: 1 };
  } catch (error) {
    if (ownerSessionId) {
      await query("delete from admin_sessions where id = $1", [ownerSessionId]).catch(() => undefined);
    }
    if (hostUserId) {
      await query("delete from host_auth_events where host_user_id = $1", [hostUserId]).catch(() => undefined);
      await query("delete from host_users where id = $1", [hostUserId]).catch(() => undefined);
    }
    if (tenantId) {
      await query("delete from changelog where tenant_id = $1", [tenantId]).catch(() => undefined);
      await query("delete from tenants where id = $1", [tenantId]).catch(() => undefined);
    }
    throw error;
  }
}

async function fixtureTables(): Promise<Array<{ tableName: string; hasTenantId: boolean; hasHostUserId: boolean }>> {
  const result = await query(
    `select table_name,
            bool_or(column_name = 'tenant_id') as has_tenant_id,
            bool_or(column_name = 'host_user_id') as has_host_user_id
       from information_schema.columns
      where table_schema = 'public'
        and (column_name in ('tenant_id', 'host_user_id')
             or table_name like 'host_onboarding%')
      group by table_name
      order by table_name`,
  );
  return result.rows.map((row) => ({
    tableName: String(row.table_name),
    hasTenantId: row.has_tenant_id === true,
    hasHostUserId: row.has_host_user_id === true,
  }));
}

async function countScopedRows(state: FixtureState): Promise<Record<string, number>> {
  const tables = await fixtureTables();
  let tenantRows = 0;
  let hostRows = 0;
  let onboardingRows = 0;
  for (const table of tables) {
    if (table.hasTenantId) {
      const result = await query(
        `select count(*)::int as count from ${quoted(table.tableName)} where tenant_id = $1`,
        [state.tenantId],
      );
      const count = Number(result.rows[0]?.count ?? 0);
      tenantRows += count;
      if (table.tableName.startsWith("host_onboarding")) onboardingRows += count;
    }
    if (table.hasHostUserId && !table.hasTenantId) {
      const result = await query(
        `select count(*)::int as count from ${quoted(table.tableName)} where host_user_id = $1`,
        [state.hostUserId],
      );
      hostRows += Number(result.rows[0]?.count ?? 0);
    }
  }
  return { tenantRows, hostRows, onboardingRows };
}

async function inspect(): Promise<Record<string, number>> {
  currentStage = "inspect";
  const state = await readState();
  const identity = await query(
    `select count(*)::int as count
       from tenants
      where id = $1 and slug = $2`,
    [state.tenantId, state.tenantSlug],
  );
  if (Number(identity.rows[0]?.count ?? 0) !== 1) {
    throw new Error("Refusing: fixture tenant identity no longer matches private state.");
  }
  const snapshot = await query(
    "select content from published_snapshots where tenant_id = $1",
    [state.tenantId],
  );
  if (snapshot.rows.length !== 1) throw new Error("Fixture published snapshot is missing.");
  const content = snapshot.rows[0]?.content;
  if (digest(content) !== state.publishedDigest) {
    throw new Error("Published snapshot changed during onboarding verification.");
  }
  const fields = snapshotFields(content);
  for (const key of ["name", "address", "website", "phone", "email"] as const) {
    if (fields[key] !== state.publishedFields[key]) {
      throw new Error(`Published ${key} changed during onboarding verification.`);
    }
  }
  const rows = await countScopedRows(state);
  return { ...rows, publishedSnapshotsUnchanged: 1, publishedFieldsUnchanged: 5 };
}

function collectObjectPaths(value: unknown, output: Set<string>): void {
  if (typeof value === "string" && value.startsWith("/objects/")) output.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectObjectPaths(item, output));
  else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => collectObjectPaths(item, output));
  }
}

async function ownStagedObjectPaths(state: FixtureState): Promise<Set<string>> {
  const paths = new Set<string>();
  const tables = (await fixtureTables()).filter((table) => table.tableName.startsWith("host_onboarding"));
  const ownedIds = new Map<string, Set<string>>();
  const rowsByTable = new Map<string, Array<Record<string, unknown>>>();
  for (const table of tables) {
    if (!table.hasTenantId && !table.hasHostUserId) continue;
    const clauses: string[] = [];
    const values: string[] = [];
    if (table.hasTenantId) {
      values.push(state.tenantId);
      clauses.push(`tenant_id = $${values.length}`);
    }
    if (table.hasHostUserId) {
      values.push(state.hostUserId);
      clauses.push(`host_user_id = $${values.length}`);
    }
    const result = await query(
      `select * from ${quoted(table.tableName)} where ${clauses.join(" or ")}`,
      values,
    );
    rowsByTable.set(table.tableName, result.rows);
    ownedIds.set(
      table.tableName,
      new Set(result.rows.map((row) => row.id).filter((id): id is string => typeof id === "string")),
    );
  }

  // Photo/review child tables may be scoped only by a round/draft FK. Follow
  // declared onboarding-table FKs from the already-owned parent IDs.
  const foreignKeys = await query(
    `select child.relname as child_table, child_col.attname as child_column,
            parent.relname as parent_table
       from pg_constraint constraint_row
       join pg_class child on child.oid = constraint_row.conrelid
       join pg_namespace child_ns on child_ns.oid = child.relnamespace
       join pg_class parent on parent.oid = constraint_row.confrelid
       join pg_attribute child_col
         on child_col.attrelid = child.oid and child_col.attnum = constraint_row.conkey[1]
      where constraint_row.contype = 'f'
        and child_ns.nspname = 'public'
        and child.relname like 'host_onboarding%'
        and parent.relname like 'host_onboarding%'`,
  );
  for (let pass = 0; pass < tables.length; pass += 1) {
    let found = false;
    for (const fk of foreignKeys.rows) {
      const child = String(fk.child_table);
      const parentIds = ownedIds.get(String(fk.parent_table));
      if (!parentIds?.size || rowsByTable.has(child)) continue;
      const result = await query(
        `select * from ${quoted(child)} where ${quoted(String(fk.child_column))} = any($1::uuid[])`,
        [[...parentIds]],
      );
      rowsByTable.set(child, result.rows);
      ownedIds.set(
        child,
        new Set(result.rows.map((row) => row.id).filter((id): id is string => typeof id === "string")),
      );
      found = true;
    }
    if (!found) break;
  }
  for (const rows of rowsByTable.values()) {
    for (const row of rows) collectObjectPaths(row, paths);
  }
  for (const path of [...paths]) {
    const counterpart = hostOnboardingObjectCounterpart(path);
    if (counterpart) paths.add(counterpart);
  }
  return paths;
}

async function deleteStagedObjects(paths: Set<string>): Promise<number> {
  if (paths.size === 0) return 0;
  const storage = new ObjectStorageService();
  let removed = 0;
  for (const path of paths) {
    try {
      const file = await storage.getObjectEntityFile(path);
      await file.delete({ ignoreNotFound: true });
      removed += 1;
    } catch (error) {
      if ((error as Error).name !== "ObjectNotFoundError") throw error;
    }
  }
  return removed;
}

async function cleanup(): Promise<Record<string, number>> {
  currentStage = "cleanup";
  const state = await readState();
  const identity = await query(
    "select count(*)::int as count from tenants where id = $1 and slug = $2",
    [state.tenantId, state.tenantSlug],
  );
  if (Number(identity.rows[0]?.count ?? 0) !== 1) {
    throw new Error("Refusing cleanup: fixture tenant identity does not match.");
  }

  const stagedObjects = await deleteStagedObjects(await ownStagedObjectPaths(state));
  await query("delete from admin_sessions where id = $1", [state.ownerSessionId]);
  await query("delete from changelog where tenant_id = $1", [state.tenantId]);
  await query("delete from host_auth_events where host_user_id = $1", [state.hostUserId]);
  await query("delete from host_users where id = $1", [state.hostUserId]);
  await query("delete from tenants where id = $1", [state.tenantId]);

  // Remove only exact fixture-ID rows from non-FK ledgers, if future onboarding
  // schema additions deliberately retain them after tenant deletion.
  for (const table of await fixtureTables()) {
    if (table.tableName === "tenants") continue;
    if (table.hasTenantId) {
      await query(`delete from ${quoted(table.tableName)} where tenant_id = $1`, [state.tenantId]);
    }
    if (table.hasHostUserId) {
      await query(`delete from ${quoted(table.tableName)} where host_user_id = $1`, [state.hostUserId]);
    }
  }

  const tenant = await query("select count(*)::int as count from tenants where id = $1", [state.tenantId]);
  const host = await query("select count(*)::int as count from host_users where id = $1", [state.hostUserId]);
  const ownerSession = await query(
    "select count(*)::int as count from admin_sessions where id = $1",
    [state.ownerSessionId],
  );
  const remaining = await countScopedRows(state);
  const remainingCount =
    Number(tenant.rows[0]?.count ?? 0) +
    Number(host.rows[0]?.count ?? 0) +
    Number(ownerSession.rows[0]?.count ?? 0) +
    remaining.tenantRows +
    remaining.hostRows;
  if (remainingCount !== 0) throw new Error("Cleanup verification found fixture rows.");
  await rm(STATE_PATH);
  return {
    tenantsDeleted: 1,
    hostAccountsDeleted: 1,
    ownerSessionsDeleted: 1,
    stagedObjectsDeleted: stagedObjects,
    remainingRows: 0,
  };
}

async function main(): Promise<void> {
  currentStage = "guard.environment";
  refuseUnsafeEnvironment();
  currentStage = "guard.database";
  await assertDevelopmentDatabase();
  currentStage = "arguments";
  const mode = process.argv[2] ?? "";
  if (!MODES.has(mode)) throw new Error("Usage: verify-host-onboarding-fixture.ts setup|inspect|cleanup");
  const counts = mode === "setup" ? await setup() : mode === "inspect" ? await inspect() : await cleanup();
  console.log(JSON.stringify({ command: mode, counts }));
}

main()
  .catch((error: unknown) => {
    const code =
      error && typeof error === "object" && "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code.replace(/[^A-Z0-9_]/gi, "").slice(0, 24)
        : "FIXTURE_ERROR";
    const safeMessages: Record<string, string> = {
      "42P01": "required table is missing",
      "42703": "referenced column is missing",
      "23503": "foreign-key constraint rejected the operation",
      "23505": "unique constraint rejected the operation",
      "23514": "check constraint rejected the operation",
      EACCES: "private state file permission was denied",
      EEXIST: "private state file already exists",
      ENOENT: "required private state file is missing",
    };
    console.error(JSON.stringify({
      command: "failed",
      stage: currentStage,
      code,
      message: safeMessages[code] ?? "fixture operation failed; no private values were printed",
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });