/**
 * Explicitly invoked DEV-only host fixture. Never installs auth bypasses, sends
 * mail, creates operator credentials, or runs automatically with the server.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import {
  db, pool, runWithDatabase, tenantsTable, hostUsersTable, hostMembershipsTable,
  sectionsTable, categoriesTable, itemsTable, publishedSnapshotsTable,
  tenantSlugReservationsTable, type PoolClient,
} from "@workspace/db";
import { seedTenantContent } from "../src/lib/tenantSeeds";
import { buildDraftPublication } from "../src/lib/publishedSnapshots";

const REPORT = resolve(import.meta.dirname, "../../../reports/management-mode-e2e");
const PRIVATE = "/tmp/management-mode-e2e-credentials.json";
const LEDGER = "/tmp/management-mode-e2e-baseline.json";
const MANIFEST = `${REPORT}/fixture-manifest.json`;
const PREFIX = "mme2e-";
type Mode = "self_service" | "concierge";
type Identity = {
  label: "A" | "B"; tenantId: string; slug: string; email: string;
  hostUserId: string; membershipId: string; initialMode: Mode;
  sections: Record<string, string>; categories: Record<string, string>;
  items: Record<string, string>;
};
type Manifest = {
  version: 1; marker: string; createdAt: string; databaseFingerprint: string;
  identities: Identity[]; operatorCreated: false; credentialPath: string;
};
type Table = { name: string; pk: string[]; columns: string[] };
type FK = { child: string; parent: string; childColumn: string; parentColumn: string };
type Row = Record<string, string | null>;
type Baseline = { tables: Table[]; keys: Record<string, string[]> };
let stage = "preflight";

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function q(value: string): string {
  assert(/^[a-z_][a-z0-9_]*$/.test(value), "Unsafe SQL identifier");
  return `"${value}"`;
}
function key(table: Table, row: Row): string {
  return JSON.stringify(table.pk.map((column) => row[column]));
}
function fields(table: Table): string[] {
  return [...new Set([...table.pk, ...table.columns.filter((c) =>
    c === "id" || c.endsWith("_id"))])];
}
function projection(table: Table): string {
  return fields(table).map((c) => `${q(c)}::text AS ${q(c)}`).join(", ");
}
async function json(path: string, value: unknown, exclusive = false) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    flag: exclusive ? "wx" : "w", mode: 0o600,
  });
  await chmod(path, 0o600);
}
async function fingerprint(): Promise<string> {
  return createHash("sha256").update(process.env.DATABASE_URL!).digest("hex");
}
async function tables(client: PoolClient): Promise<Table[]> {
  const result = await client.query(`
    SELECT c.relname AS name,
      array_agg(a.attname::text ORDER BY a.attnum) AS columns,
      ARRAY(SELECT pa.attname::text FROM pg_index i
        CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum, ord)
        JOIN pg_attribute pa ON pa.attrelid=c.oid AND pa.attnum=k.attnum
        WHERE i.indrelid=c.oid AND i.indexrelid=(
          SELECT candidate.indexrelid FROM pg_index candidate
          WHERE candidate.indrelid=c.oid AND candidate.indisunique
            AND candidate.indpred IS NULL AND candidate.indexprs IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM unnest(candidate.indkey) ck(attnum)
              JOIN pg_attribute col ON col.attrelid=c.oid AND col.attnum=ck.attnum
              WHERE NOT col.attnotnull)
          ORDER BY candidate.indisprimary DESC, candidate.indexrelid LIMIT 1)
        ORDER BY k.ord) AS pk
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    WHERE n.nspname='public' AND c.relkind='r'
    GROUP BY c.oid,c.relname ORDER BY c.relname`);
  return result.rows;
}
async function baseline(): Promise<Baseline> {
  const client = await pool.connect();
  try {
    const all = await tables(client);
    const keys: Baseline["keys"] = {};
    for (const table of all) {
      assert(table.pk.length > 0, `Table ${table.name} has no primary key`);
      const rows = await client.query(`SELECT ${table.pk.map((c) =>
        `${q(c)}::text AS ${q(c)}`).join(", ")} FROM public.${q(table.name)}`);
      keys[table.name] = rows.rows.map((row) => key(table, row));
    }
    return { tables: all, keys };
  } finally { client.release(); }
}
async function readManifest(): Promise<Manifest> {
  const m = JSON.parse(await readFile(MANIFEST, "utf8")) as Manifest;
  assert(m.version === 1 && /^mme2e-[a-f0-9]{12}$/.test(m.marker), "Invalid marker");
  assert(m.operatorCreated === false && m.identities.length === 2, "Invalid fixture scope");
  assert(m.databaseFingerprint === await fingerprint(), "Database connection changed");
  for (const i of m.identities) {
    assert(i.slug === `${m.marker}-${i.label.toLowerCase()}`, "Unexpected slug");
    assert(i.email === `${i.slug}@example.invalid`, "Unexpected host email");
    for (const id of [i.tenantId, i.hostUserId, i.membershipId]) {
      assert(/^[0-9a-f-]{36}$/.test(id), "Invalid fixture ID");
    }
  }
  return m;
}
async function verify(client: PoolClient, m: Manifest) {
  for (const i of m.identities) {
    const rows = await client.query(`
      SELECT t.id FROM tenants t JOIN host_memberships hm ON hm.tenant_id=t.id
      JOIN host_users h ON h.id=hm.host_user_id
      WHERE t.id=$1 AND t.slug=$2 AND t.subtitle=$3
      AND h.id=$4 AND h.email=$5 AND hm.id=$6 FOR UPDATE OF t,h,hm`,
    [i.tenantId, i.slug, m.marker, i.hostUserId, i.email, i.membershipId]);
    assert(rows.rowCount === 1, "Fixture identity/marker/membership mismatch");
  }
}
async function setup() {
  stage = "setup.files";
  for (const path of [PRIVATE, LEDGER, MANIFEST]) {
    const exists = await stat(path).then(() => true, (e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return false;
      throw e;
    });
    assert(!exists, "Fixture already exists; refusing replacement");
  }
  const marker = `${PREFIX}${randomBytes(6).toString("hex")}`;
  const m: Manifest = {
    version: 1, marker, createdAt: new Date().toISOString(),
    databaseFingerprint: await fingerprint(), identities: [], operatorCreated: false,
    credentialPath: PRIVATE,
  };
  const credentials: Array<Identity & { password: string }> = [];
  for (const [label, initialMode] of [["A", "self_service"], ["B", "concierge"]] as const) {
    const slug = `${marker}-${label.toLowerCase()}`;
    const identity: Identity = {
      label, initialMode, slug, tenantId: randomUUID(), hostUserId: randomUUID(),
      membershipId: randomUUID(), email: `${slug}@example.invalid`,
      sections: {}, categories: {}, items: {},
    };
    m.identities.push(identity);
    credentials.push({ ...identity, password: randomBytes(30).toString("base64url") });
  }
  await mkdir(REPORT, { recursive: true });
  stage = "setup.baseline";
  await json(LEDGER, await baseline(), true);
  // Write recovery identities and private credentials before any DB commit.
  await json(PRIVATE, { version: 1, loginPath: "/admin", identities: credentials }, true);
  await json(MANIFEST, m, true);
  stage = "setup.transaction";
  await db.transaction(async (tx) => runWithDatabase(tx, async () => {
    for (const i of m.identities) {
      const password = credentials.find((c) => c.label === i.label)!.password;
      const passwordHash = await hash(password, {
        algorithm: 2, memoryCost: 65536, timeCost: 3, parallelism: 1,
      });
      const now = new Date();
      const [tenant] = await tx.insert(tenantsTable).values({
        id: i.tenantId, slug: i.slug, subtitle: marker,
        name: `DEV ONLY · Management E2E ${i.label}`,
        tenantType: "apartmaji", managementMode: i.initialMode,
        latitude: i.label === "A" ? 0.12345 : 0.23456, longitude: -140.12345,
        address: "SYNTHETIC TEST LOCATION — not a real property",
        guestUiMode: "living-guide", languages: ["sl", "en"], theme: "noc",
        livingGuideNav: ["home", "stay", "offer", "explore", "program"],
        email: null, orderNotifyEmail: false, messageNotifyEmail: false,
        isPublished: true, firstPublishedAt: now, lastPublishedAt: now,
      }).returning();
      await tx.insert(tenantSlugReservationsTable).values({ slug: i.slug, tenantId: i.tenantId });
      await tx.insert(hostUsersTable).values({
        id: i.hostUserId, email: i.email, passwordHash, passwordChangedAt: now,
      });
      await tx.insert(hostMembershipsTable).values({
        id: i.membershipId, hostUserId: i.hostUserId, tenantId: i.tenantId,
      });
      // Static normal skeleton, never reads or copies another tenant's data.
      await seedTenantContent(i.tenantId, "apartmaji", tx);
      const sections = await tx.select().from(sectionsTable)
        .where(eq(sectionsTable.tenantId, i.tenantId));
      for (const section of sections) {
        i.sections[section.key] = section.id;
        const categories = await tx.select().from(categoriesTable)
          .where(eq(categoriesTable.sectionId, section.id));
        for (const category of categories) i.categories[`${section.key}/${category.key}`] = category.id;
      }
      for (const [name, category, extra] of [
        ["welcome", "stay/welcome", {}],
        ["offer", "offer/sup", { price: "5", priceUnit: "test", orderEnabled: false }],
        ["explore", "explore/nature", { distanceMeters: 1000 }],
        ["weekly", "explore/events", {
          eventSchedule: {
            type: "weekly" as const, days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as
              Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">,
            timeFrom: "17:00", timeTo: "18:00", inCamp: true,
            locationText: "Synthetic test meeting point",
          },
        }],
      ] as const) {
        const [item] = await tx.insert(itemsTable).values({
          categoryId: i.categories[category],
          title: `DEV TEST ${i.label} · ${name}`,
          body: "Synthetic disposable E2E content. Not a real offer, event or location.",
          ...extra,
        }).returning({ id: itemsTable.id });
        i.items[name] = item.id;
      }
      const content = await buildDraftPublication(tenant);
      await tx.insert(publishedSnapshotsTable).values({
        tenantId: i.tenantId, content: content as unknown as Record<string, unknown>,
      });
      // Only our just-inserted tenant: establish a clean initial guest snapshot.
      await tx.update(tenantsTable).set({
        hasUnpublishedChanges: false, operatorDraftPending: false,
      }).where(eq(tenantsTable.id, i.tenantId));
    }
  }));
  await json(MANIFEST, m);
  await inspect(m);
  console.log(JSON.stringify({ manifestPath: MANIFEST, credentialPath: PRIVATE, baselinePath: LEDGER }));
}

async function inspect(m: Manifest) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await verify(client, m);
    const counts = [];
    for (const i of m.identities) {
      const result = await client.query(`
        SELECT t.id AS tenant_id, t.slug, t.management_mode, t.is_published,
          t.has_unpublished_changes, t.operator_draft_pending,
          (SELECT count(*)::int FROM host_users WHERE id=$2) AS hosts,
          (SELECT count(*)::int FROM host_memberships WHERE id=$3 AND tenant_id=$1 AND host_user_id=$2) AS memberships,
          (SELECT count(*)::int FROM host_sessions WHERE host_user_id=$2) AS sessions,
          (SELECT count(*)::int FROM host_auth_events WHERE host_user_id=$2) AS auth_events,
          (SELECT count(*)::int FROM host_password_resets WHERE host_user_id=$2) AS password_resets,
          (SELECT count(*)::int FROM host_invites WHERE host_user_id=$2) AS invites,
          (SELECT count(*)::int FROM published_snapshots WHERE tenant_id=$1) AS snapshots,
          (SELECT count(*)::int FROM sections WHERE tenant_id=$1) AS sections,
          (SELECT count(*)::int FROM categories c JOIN sections s ON c.section_id=s.id WHERE s.tenant_id=$1) AS categories,
          (SELECT count(*)::int FROM items it JOIN categories c ON it.category_id=c.id
             JOIN sections s ON c.section_id=s.id WHERE s.tenant_id=$1) AS items
        FROM tenants t WHERE t.id=$1`, [i.tenantId, i.hostUserId, i.membershipId]);
      assert(result.rowCount === 1, "Missing fixture tenant");
      const row = result.rows[0];
      assert(row.hosts === 1 && row.memberships === 1 && row.snapshots === 1, "Incomplete fixture");
      counts.push(row);
    }
    await client.query("COMMIT");
    const permissions = (await stat(PRIVATE)).mode & 0o777;
    assert(permissions === 0o600, "Credential file must be private");
    await json(`${REPORT}/setup-verification.json`, {
      verifiedAt: new Date().toISOString(), method: "Actual exact-ID SQL counts",
      counts, credentialFileMode: "0600", operatorIdentitiesCreatedByScript: 0,
      sessionsPrecreatedByScript: 0, emailsSentByScript: 0,
      initialPublication: "Synthetic baseline only; browser must test subsequent publish",
    });
    console.log(JSON.stringify({ verificationPath: `${REPORT}/setup-verification.json`, counts }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function switchMode(m: Manifest) {
  const label = process.argv[3];
  const mode = process.argv[4];
  assert(label === "A" || label === "B", "Expected A or B");
  assert(mode === "self_service" || mode === "concierge", "Expected self_service or concierge");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await verify(client, m);
    const i = m.identities.find((identity) => identity.label === label)!;
    await client.query("UPDATE tenants SET management_mode=$1 WHERE id=$2", [mode, i.tenantId]);
    await client.query("COMMIT");
    await json(`${REPORT}/last-fixture-mode-switch.json`, {
      tenantId: i.tenantId, mode, method: "DEV fixture SQL, not an operator UI action",
      switchedAt: new Date().toISOString(), sessionsModifiedByScript: 0,
    });
    console.log(JSON.stringify({ tenantId: i.tenantId, mode, sessionsModifiedByScript: 0 }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function cleanup(m: Manifest, dryRun = false) {
  assert(dryRun || process.argv[3] === "--confirm-disposable-hosts", "Explicit cleanup confirmation required");
  const base = JSON.parse(await readFile(LEDGER, "utf8")) as Baseline;
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await verify(client, m);
    const all = await tables(client);
    assert(JSON.stringify(all) === JSON.stringify(base.tables), "Schema changed; review cleanup first");
    // Only fingerprints/counts leave PostgreSQL; never fetch protected row
    // contents, credentials, or real tenant PII into a report.
    const protectedState = async () => {
      const state: Record<string, { recorded: number; present: number; digest: string | null }> = {};
      for (const table of all) {
        const keys = base.keys[table.name].map((value) => JSON.parse(value) as string[]);
        const parameters = table.pk.map((_, n) => keys.map((parts) => parts[n]));
        const where = `(${table.pk.map((c) => `t.${q(c)}::text`).join(",")}) IN
          (SELECT * FROM unnest(${parameters.map((_, n) => `$${n + 1}::text[]`).join(",")}))`;
        const result = await client.query(`
          SELECT count(*)::int AS present,
            md5(string_agg(md5(to_jsonb(t)::text), '' ORDER BY ${table.pk.map((c) => `t.${q(c)}`).join(",")})) AS digest
          FROM public.${q(table.name)} t WHERE ${where}`, parameters);
        state[table.name] = { recorded: keys.length, ...result.rows[0] };
      }
      return state;
    };
    const protectedBefore = dryRun ? null : await protectedState();
    // No operator/global-auth table may ever become a deletion target.
    const forbidden = (name: string) => name.startsWith("admin_");
    const selected = new Map<string, Map<string, Row>>();
    const tenants = m.identities.map((i) => i.tenantId);
    const hosts = m.identities.map((i) => i.hostUserId);
    const baselineKeys = new Map(all.map((t) => [t.name, new Set(base.keys[t.name])]));
    const add = (table: Table, rows: Row[]) => {
      let added = false;
      const map = selected.get(table.name) ?? new Map<string, Row>();
      for (const row of rows) {
        assert(!forbidden(table.name), "Refusing operator table");
        assert(!baselineKeys.get(table.name)!.has(key(table, row)), "Refusing preexisting row");
        if (row.tenant_id) assert(tenants.includes(row.tenant_id), "Foreign tenant dependency");
        if (row.host_user_id) assert(hosts.includes(row.host_user_id), "Foreign host dependency");
        if (!map.has(key(table, row))) { map.set(key(table, row), row); added = true; }
      }
      selected.set(table.name, map);
      return added;
    };
    for (const table of all) {
      if (forbidden(table.name)) continue;
      const predicates: string[] = [];
      const values: string[][] = [];
      const predicate = (column: string, ids: string[]) => {
        values.push(ids);
        predicates.push(`${q(column)}::text=ANY($${values.length}::text[])`);
      };
      if (table.name === "tenants") predicate("id", tenants);
      if (table.name === "host_users") predicate("id", hosts);
      if (table.columns.includes("tenant_id")) predicate("tenant_id", tenants);
      if (table.columns.includes("host_user_id")) predicate("host_user_id", hosts);
      if (table.name === "cleanup_runs") predicate("tenant_slug", m.identities.map((i) => i.slug));
      if (!predicates.length) continue;
      const result = await client.query(
        `SELECT ${projection(table)} FROM public.${q(table.name)} WHERE ${predicates.join(" OR ")} FOR UPDATE`,
        values,
      );
      add(table, result.rows);
    }
    const fks = await client.query<FK>(`
      SELECT child.relname AS child, parent.relname AS parent,
        ca.attname AS "childColumn", pa.attname AS "parentColumn"
      FROM pg_constraint fk
      JOIN pg_class child ON child.oid=fk.conrelid
      JOIN pg_namespace ns ON ns.oid=child.relnamespace
      JOIN pg_class parent ON parent.oid=fk.confrelid
      JOIN pg_attribute ca ON ca.attrelid=child.oid AND ca.attnum=fk.conkey[1]
      JOIN pg_attribute pa ON pa.attrelid=parent.oid AND pa.attnum=fk.confkey[1]
      WHERE fk.contype='f' AND ns.nspname='public'
        AND array_length(fk.conkey,1)=1`);
    let changed = true;
    while (changed) {
      changed = false;
      for (const fk of fks.rows) {
        const parents = selected.get(fk.parent);
        if (!parents?.size) continue;
        const ids = [...parents.values()].map((r) => r[fk.parentColumn]).filter(Boolean);
        const table = all.find((t) => t.name === fk.child)!;
        assert(table && !forbidden(table.name), "Unexpected auth dependency");
        const result = await client.query(
          `SELECT ${projection(table)} FROM public.${q(table.name)}
           WHERE ${q(fk.childColumn)}::text=ANY($1::text[]) FOR UPDATE`, [ids]);
        changed = add(table, result.rows) || changed;
      }
    }
    // Translations use polymorphic references, intentionally without FKs.
    const recordIds = ["tenants", "sections", "categories", "items"]
      .flatMap((name) => [...(selected.get(name)?.values() ?? [])].map((r) => r.id!));
    const translationTable = all.find((t) => t.name === "translations")!;
    add(translationTable, (await client.query(
      `SELECT ${projection(translationTable)} FROM translations WHERE record_id=ANY($1::uuid[]) FOR UPDATE`,
      [recordIds])).rows);
    // Uploads are outside this fixture's scope: refuse rather than orphan bytes.
    assert(!selected.get("media")?.size && !selected.get("host_onboarding_photos")?.size,
      "Fixture acquired uploaded media; review storage cleanup first");
    // Persist exact PKs before any deletion; no password, token or hash columns.
    const inventory = Object.fromEntries([...selected].filter(([, rows]) => rows.size)
      .map(([name, rows]) => [name, [...rows.values()].map((row) =>
        Object.fromEntries(all.find((t) => t.name === name)!.pk.map((c) => [c, row[c]])))]));
    await json(`${REPORT}/${dryRun ? "cleanup-plan-exact-ids" : "cleanup-exact-ids"}.json`, inventory);
    const pending = new Set(Object.keys(inventory));
    const ordered: string[] = [];
    while (pending.size) {
      const leaves = [...pending].filter((parent) => !fks.rows.some((fk) =>
        fk.parent === parent && fk.child !== parent && pending.has(fk.child)));
      assert(leaves.length > 0, "Cyclic dependencies require manual reviewed cleanup");
      for (const name of leaves) { ordered.push(name); pending.delete(name); }
    }
    if (dryRun) {
      await client.query("ROLLBACK");
      await json(`${REPORT}/cleanup-plan.json`, {
        plannedAt: new Date().toISOString(), dryRun: true, deletionsExecuted: 0,
        orderedTables: ordered,
        counts: Object.fromEntries(ordered.map((name) => [name, selected.get(name)!.size])),
        preexistingRowsSelected: 0, operatorTablesSelected: 0,
      });
      console.log(JSON.stringify({ cleanupPlanPath: `${REPORT}/cleanup-plan.json`, deletionsExecuted: 0 }));
      return;
    }
    const checks: { table: string; sql: string; parameters: string[][]; remaining: number }[] = [];
    const deletedCounts: Record<string, number> = {};
    for (const name of ordered) {
      const table = all.find((t) => t.name === name)!;
      const rows = [...selected.get(name)!.values()];
      const parameters = table.pk.map((c) => rows.map((r) => r[c]!));
      // Paired primary-key tuples, not a Cartesian-product IN deletion.
      const where = `(${table.pk.map((c) => `${q(c)}::text`).join(",")}) IN
        (SELECT * FROM unnest(${parameters.map((_, n) => `$${n + 1}::text[]`).join(",")}))`;
      const deletion = await client.query(`DELETE FROM public.${q(name)} WHERE ${where}`, parameters);
      deletedCounts[name] = deletion.rowCount ?? 0;
      checks.push({
        table: name, sql: `SELECT count(*)::int AS remaining FROM public.${q(name)} WHERE ${where}`,
        parameters, remaining: -1,
      });
    }
    // Count all scoped auth traces too, even tables with zero rows before cleanup.
    for (const table of all.filter((t) => !forbidden(t.name))) {
      for (const column of ["tenant_id", "host_user_id"]) {
        if (!table.columns.includes(column)) continue;
        checks.push({
          table: table.name,
          sql: `SELECT count(*)::int AS remaining FROM public.${q(table.name)} WHERE ${q(column)}::text=ANY($1::text[])`,
          parameters: [column === "tenant_id" ? tenants : hosts], remaining: -1,
        });
      }
    }
    checks.push(
      {
        table: "host_users",
        sql: "SELECT count(*)::int AS remaining FROM host_users WHERE email=ANY($1::text[])",
        parameters: [m.identities.map((i) => i.email)], remaining: -1,
      },
      {
        table: "tenants",
        sql: "SELECT count(*)::int AS remaining FROM tenants WHERE slug LIKE ANY($1::text[]) OR subtitle=ANY($2::text[])",
        parameters: [`${m.marker}%`].map((p) => [p]).concat([[m.marker]]), remaining: -1,
      },
      {
        table: "host_auth_events",
        sql: "SELECT count(*)::int AS remaining FROM host_auth_events WHERE detail LIKE ANY($1::text[])",
        parameters: [[`%${m.marker}%`]], remaining: -1,
      },
      {
        table: "changelog",
        sql: "SELECT count(*)::int AS remaining FROM changelog WHERE actor_email=ANY($1::text[]) OR detail LIKE ANY($2::text[])",
        parameters: [m.identities.map((i) => i.email), [`%${m.marker}%`]], remaining: -1,
      },
    );
    for (const check of checks) {
      check.remaining = (await client.query(check.sql, check.parameters)).rows[0].remaining;
      assert(check.remaining === 0, "Cleanup left fixture rows; rolling back");
    }
    const protectedInTransaction = await protectedState();
    assert(JSON.stringify(protectedBefore) === JSON.stringify(protectedInTransaction),
      "Protected baseline row changed during cleanup; rolling back");
    await client.query("COMMIT");
    // Evidence is measured again after COMMIT, not inferred from affected rows.
    for (const check of checks) {
      check.remaining = (await client.query(check.sql, check.parameters)).rows[0].remaining;
      assert(check.remaining === 0, "Post-commit verification found fixture rows");
    }
    const protectedAfter = await protectedState();
    const protectedBaseline = all.map((table) => ({
      table: table.name,
      baselineRecordedIdentities: protectedBefore![table.name].recorded,
      presentBeforeCleanup: protectedBefore![table.name].present,
      presentAfterCleanup: protectedAfter[table.name].present,
      identitiesAndContentsUnchanged:
        JSON.stringify(protectedBefore![table.name]) === JSON.stringify(protectedAfter[table.name]),
    }));
    assert(protectedBaseline.every((entry) => entry.identitiesAndContentsUnchanged),
      "Post-commit protected baseline verification changed");
    // Re-runnable exact-ID summary; all interpolated literals are verified
    // synthetic UUIDs/emails/marker, never user data or private credentials.
    const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
    const summarySql = `WITH fixture AS (
  SELECT ARRAY[${tenants.map(literal).join(",")}]::uuid[] AS tenants,
         ARRAY[${hosts.map(literal).join(",")}]::uuid[] AS hosts,
         ARRAY[${m.identities.map((i) => literal(i.email)).join(",")}]::text[] AS emails,
         ${literal(m.marker)}::text AS marker
)
SELECT 'tenants_ids_or_marker' AS scope, count(*)::int AS remaining FROM tenants, fixture
 WHERE id=ANY(fixture.tenants) OR slug LIKE fixture.marker || '%' OR subtitle=fixture.marker
UNION ALL SELECT 'host_users_ids_or_emails', count(*)::int FROM host_users, fixture
 WHERE id=ANY(fixture.hosts) OR email=ANY(fixture.emails)
UNION ALL SELECT 'host_memberships', count(*)::int FROM host_memberships, fixture
 WHERE tenant_id=ANY(fixture.tenants) OR host_user_id=ANY(fixture.hosts)
UNION ALL SELECT 'host_sessions', count(*)::int FROM host_sessions, fixture WHERE host_user_id=ANY(fixture.hosts)
UNION ALL SELECT 'host_auth_events_ids_or_marker', count(*)::int FROM host_auth_events, fixture
 WHERE host_user_id=ANY(fixture.hosts) OR detail LIKE '%' || fixture.marker || '%'
UNION ALL SELECT 'host_password_resets', count(*)::int FROM host_password_resets, fixture WHERE host_user_id=ANY(fixture.hosts)
UNION ALL SELECT 'host_invites', count(*)::int FROM host_invites, fixture WHERE host_user_id=ANY(fixture.hosts)
UNION ALL SELECT 'tenant_aliases', count(*)::int FROM tenant_aliases, fixture
 WHERE tenant_id=ANY(fixture.tenants) OR slug LIKE fixture.marker || '%'
UNION ALL SELECT 'tenant_slug_reservations', count(*)::int FROM tenant_slug_reservations, fixture
 WHERE tenant_id=ANY(fixture.tenants) OR slug LIKE fixture.marker || '%'
UNION ALL SELECT 'changelog_ids_emails_or_marker', count(*)::int FROM changelog, fixture
 WHERE tenant_id=ANY(fixture.tenants) OR actor_id=ANY(fixture.hosts)
 OR actor_email=ANY(fixture.emails) OR detail LIKE '%' || fixture.marker || '%'
ORDER BY scope;\n`;
    const summaryResults = (await client.query(summarySql)).rows;
    assert(summaryResults.every((row) => row.remaining === 0), "Summary found remaining fixture data");
    await writeFile(`${REPORT}/cleanup-verification.sql`, summarySql, { mode: 0o600 });
    await rm(PRIVATE);
    await rm(LEDGER);
    const absent = async (path: string) => stat(path).then(() => false, (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return true;
      throw error;
    });
    await json(`${REPORT}/cleanup-zero-verification.json`, {
      verifiedAt: new Date().toISOString(), committed: true, checks,
      deletedCounts, protectedBaseline, summarySql, summaryResults,
      allRemainingZero: checks.every((check) => check.remaining === 0),
      preexistingRowsSelectedForDeletion: 0, operatorTablesTouched: 0,
      privateFilesDeleted: {
        credentials: await absent(PRIVATE), baseline: await absent(LEDGER),
      },
    });
    console.log(JSON.stringify({ reportPath: `${REPORT}/cleanup-zero-verification.json`, remaining: 0 }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function main() {
  assert(process.env.NODE_ENV === "development", "NODE_ENV must be development");
  assert(!process.env.REPLIT_DEPLOYMENT && !process.env.REPLIT_DEPLOYMENT_ID,
    "Deployment execution prohibited");
  assert(process.env.REPLIT_DEV_DOMAIN, "Development workspace required");
  const result = await pool.query("SELECT current_database() AS name");
  assert(!/(^|[^a-z])(prod|production)([^a-z]|$)/i.test(result.rows[0].name),
    "Production database prohibited");
  const command = process.argv[2];
  if (command === "setup") return setup();
  assert(["mode", "cleanup", "inspect", "cleanup-plan"].includes(command),
    "Use setup, inspect, cleanup-plan, mode A|B self_service|concierge, or cleanup --confirm-disposable-hosts");
  stage = command;
  const m = await readManifest();
  if (command === "mode") await switchMode(m);
  else if (command === "inspect") await inspect(m);
  else await cleanup(m, command === "cleanup-plan");
}
main().catch((error: unknown) => {
  // Do not stringify DB/ORM errors: they can contain bound password hashes.
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) : "GUARD_OR_OPERATION_FAILED";
  console.error(JSON.stringify({ stage, code, error: "Fixture operation refused or failed; no private values printed." }));
  process.exitCode = 1;
}).finally(() => pool.end());