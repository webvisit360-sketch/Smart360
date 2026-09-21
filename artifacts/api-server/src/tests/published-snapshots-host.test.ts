import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { eq, inArray, sql } from "drizzle-orm";
import {
  db, pool, runWithHostDbContext, tenantsTable, sectionsTable, categoriesTable,
  creatorPlaceProposalsTable, creatorProposalTranslationsTable,
  creatorPlaceMaterializationsTable, adminUsersTable, hostUsersTable,
  hostMembershipsTable, translationsTable, changelogTable, publishedSnapshotsTable,
} from "@workspace/db";
import app from "../app";
import { ensureRowLevelSecurity } from "../lib/rls";
import { hashPassword } from "../lib/hostAuth";
import { approveCreatorProposalIndividually, upsertPendingCreatorProposal } from "../lib/creatorProposalLedger";
import { ensurePublishedSnapshotSchema, ensureTenantPublication, readPublishedContent } from "../lib/publishedSnapshots";

test("RLS permits owner C4, isolates host reads, and host publication rejects stale endpoint tokens", async (t) => {
  assert.notEqual(process.env.NODE_ENV, "production", "disposable fixture is development-only");
  const role = await pool.query(`
    SELECT current_user, session_user, current_setting('app.role', true) AS app_role,
      rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `);
  assert.ok(role.rows[0].rolsuper || role.rows[0].rolbypassrls,
    "non-host pool must bypass RLS when app.role is unset");
  assert.notEqual(role.rows[0].app_role, "host");
  await ensurePublishedSnapshotSchema();
  // The exact production startup ensure path; no custom policy semantics.
  await ensureRowLevelSecurity();
  const policy = await pool.query(`
    SELECT relrowsecurity, relforcerowsecurity FROM pg_class
    WHERE oid = 'creator_place_materializations'::regclass
  `);
  assert.equal(policy.rows[0].relrowsecurity, true);
  assert.equal(policy.rows[0].relforcerowsecurity, true);
  const grants = await pool.query(`
    SELECT privilege_type FROM information_schema.role_table_grants
    WHERE grantee = 'smart360_host' AND table_name = 'creator_place_materializations'
  `);
  assert.deepEqual(grants.rows.map((row) => row.privilege_type), ["SELECT"]);

  const tenantIds: string[] = [], itemIds: string[] = [];
  const stamp = randomUUID();
  const [actor] = await db.insert(adminUsersTable).values({
    email: `snapshot-owner-${stamp}@example.test`,
  }).returning();
  const password = `snapshot-test-${stamp}`;
  const [host] = await db.insert(hostUsersTable).values({
    email: `snapshot-host-${stamp}@example.test`, passwordHash: await hashPassword(password),
  }).returning();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api`;
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (itemIds.length) await db.delete(translationsTable).where(inArray(translationsTable.recordId, itemIds));
    if (tenantIds.length) {
      await db.delete(changelogTable).where(inArray(changelogTable.tenantId, tenantIds));
      await db.delete(tenantsTable).where(inArray(tenantsTable.id, tenantIds));
    }
    await db.delete(hostUsersTable).where(eq(hostUsersTable.id, host!.id));
    await db.delete(adminUsersTable).where(eq(adminUsersTable.id, actor!.id));
  });
  const createFixture = async (suffix: string) => {
    const [tenant] = await db.insert(tenantsTable).values({
      slug: `snapshot-host-${suffix}-${stamp}`, name: `Snapshot ${suffix}`,
      isPublished: true, languages: ["sl", "en", "de", "it"],
    }).returning();
    tenantIds.push(tenant!.id);
    const [section] = await db.insert(sectionsTable).values({
      tenantId: tenant!.id, key: "explore", title: "Okolica",
    }).returning();
    const [category] = await db.insert(categoriesTable).values({
      sectionId: section!.id, key: "nature", label: "Narava", layout: "poi",
    }).returning();
    const name = `C4 fixture ${suffix} ${stamp}`;
    const { proposal } = await upsertPendingCreatorProposal({
      tenantId: tenant!.id, runId: randomUUID(), proposedName: name, originalQuery: name,
    });
    // Prepared test-only resolution evidence: no network calls or real content.
    await db.update(creatorPlaceProposalsTable).set({
      categoryId: category!.id, confirmationMethod: "exact", confirmedQuery: name,
      resolvedName: name, resolvedAddress: "Testna cesta 1", osmType: "node",
      osmId: suffix === "a" ? 9900000001 : 9900000002, osmCategory: "natural",
      osmFeatureType: "peak", osmAddressType: "natural", latitude: 46.3, longitude: 14.8,
      straightLineDistanceM: 1000, roadDistanceM: 1500, travelDurationS: 300,
      range: "near", contentReady: true,
    }).where(eq(creatorPlaceProposalsTable.id, proposal.id));
    await db.insert(creatorProposalTranslationsTable).values(
      ["sl", "en", "de", "it"].map((language) => ({
        proposalId: proposal.id, language, name: `${name} ${language}`, description: `Testni opis ${language}`,
      })),
    );
    // Real C4 approval/materialization runs as the non-host pool AFTER FORCE RLS.
    const approved = await approveCreatorProposalIndividually(tenant!.id, proposal.id, actor!.id);
    assert.equal(approved.status, "approved");
    const [materialized] = await db.select().from(creatorPlaceMaterializationsTable)
      .where(eq(creatorPlaceMaterializationsTable.proposalId, proposal.id));
    assert.ok(materialized, "non-host C4 must not silently lose its materialization");
    itemIds.push(materialized.itemId);
    assert.equal((await approveCreatorProposalIndividually(tenant!.id, proposal.id, actor!.id)).status, "approved");
    assert.equal((await db.select().from(creatorPlaceMaterializationsTable)
      .where(eq(creatorPlaceMaterializationsTable.proposalId, proposal.id))).length, 1);
    await ensureTenantPublication(tenant!.id);
    return { tenant: tenant!, materialized };
  };
  const A = await createFixture("a"), B = await createFixture("b");
  await db.insert(hostMembershipsTable).values({ hostUserId: host!.id, tenantId: A.tenant.id });
  await runWithHostDbContext(A.tenant.id, async () => {
    const role = await db.execute(sql`SELECT current_user, current_setting('app.role') AS app_role`);
    assert.equal(role.rows[0]!.current_user, "smart360_host");
    assert.equal(role.rows[0]!.app_role, "host");
    const rows = await db.select().from(creatorPlaceMaterializationsTable);
    assert.deepEqual(rows.map((row) => row.id), [A.materialized.id]);
    assert.deepEqual(await db.select().from(creatorPlaceMaterializationsTable)
      .where(eq(creatorPlaceMaterializationsTable.id, B.materialized.id)), []);
    await assert.rejects(db.update(creatorPlaceMaterializationsTable).set({ range: "excursion" })
      .where(eq(creatorPlaceMaterializationsTable.id, A.materialized.id)),
    (error: unknown) => (error as { cause?: { code?: string } }).cause?.code === "42501");
  });
  // Fail-closed even if the tenant GUC is absent/empty; no host read bypass.
  const client = await pool.connect();
  try {
    await client.query("SET ROLE smart360_host");
    await client.query("SELECT set_config('app.role','host',false), set_config('app.tenant_id','',false)");
    assert.deepEqual((await client.query("SELECT id FROM creator_place_materializations")).rows, []);
  } finally {
    await client.query("RESET ROLE");
    await client.query("RESET ALL");
    client.release();
  }
  const request = (method: string, path: string, cookie = "", body?: unknown) =>
    fetch(`${base}${path}`, { method, headers: { "content-type": "application/json", cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const login = await request("POST", "/admin/host/login", "", { email: host!.email, password });
  assert.equal(login.status, 200);
  const cookie = /__Host-s360_host=[^;]+/.exec(login.headers.get("set-cookie") ?? "")?.[0];
  assert.ok(cookie);
  const path = `/admin/tenants/${A.tenant.id}`;
  assert.equal((await request("GET", `${path}/publish-preview`)).status, 401);
  assert.equal((await request("GET", `/admin/tenants/${B.tenant.id}/publish-preview`, cookie)).status, 404);
  const preview = async () => {
    const result = await request("GET", `${path}/publish-preview`, cookie);
    assert.equal(result.status, 200, await result.clone().text());
    return result.json() as Promise<{ token: string; total: number }>;
  };
  assert.equal((await preview()).total, 0);
  const cleanPublish = await request("PATCH", path, cookie, { isPublished: true, publishNow: true });
  assert.equal(cleanPublish.status, 200, await cleanPublish.clone().text());
  const [cleanTenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, A.tenant.id));
  assert.equal((await request("PATCH", path, cookie, { name: "Prvi osnutek" })).status, 200);
  const stale = await preview();
  assert.ok(stale.total > 0);
  const publishedBefore = await readPublishedContent(A.tenant.id);
  const noToken = await request("PATCH", path, cookie, { isPublished: true, publishNow: true });
  assert.equal(noToken.status, 409, "a stale clean client cannot publish new changes without approval");
  assert.deepEqual(await readPublishedContent(A.tenant.id), publishedBefore);
  assert.equal((await request("PATCH", path, cookie, { name: "Drugi osnutek" })).status, 200);
  const rejected = await request("PATCH", path, cookie, {
    isPublished: true, publishNow: true, publishToken: stale.token,
  });
  assert.equal(rejected.status, 409, await rejected.clone().text());
  assert.deepEqual(await readPublishedContent(A.tenant.id), publishedBefore);
  const [afterRejected] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, A.tenant.id));
  assert.equal(afterRejected!.hasUnpublishedChanges, true);
  assert.deepEqual(afterRejected!.lastPublishedAt, cleanTenant!.lastPublishedAt);
  const current = await preview();
  assert.notEqual(current.token, stale.token);
  const published = await request("PATCH", path, cookie, {
    isPublished: true, publishNow: true, publishToken: current.token,
  });
  assert.equal(published.status, 200, await published.clone().text());
  assert.equal((await preview()).total, 0);
  const snapshot = await readPublishedContent(A.tenant.id);
  assert.equal(snapshot.languages.sl!.tree.name, "Drugi osnutek");
  for (const language of ["sl", "en", "de", "it"]) {
    const item = snapshot.languages[language]!.tree.sections[0]!.categories[0]!.items[0]!;
    assert.equal(item.id, A.materialized.itemId);
    assert.equal(item.range, "near");
    assert.equal(item.travelDurationSeconds, 300);
    assert.equal(item.body, `Testni opis ${language}`);
  }
  assert.equal((await db.select().from(publishedSnapshotsTable)
    .where(eq(publishedSnapshotsTable.tenantId, A.tenant.id))).length, 1);
  // Returning a host connection to the pool must preserve non-host C4 access.
  assert.equal((await db.select().from(creatorPlaceMaterializationsTable)
    .where(inArray(creatorPlaceMaterializationsTable.tenantId, tenantIds))).length, 2);
});