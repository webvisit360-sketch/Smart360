/**
 * CHECKPOINT 2 negative-access suite (Instruction #28).
 *
 * Proves the three concentric rings around host accounts:
 *  - Ring 1/2 (gate + fence): host A gets 404 on tenant B's URLs and
 *    entities, 404 on owner-only endpoints, 401 anonymously.
 *  - Ring 3 (RLS): body/query-based endpoints and direct DB access under the
 *    host context cannot see or touch foreign rows even when the handler
 *    itself has no tenant filter.
 *  - Positive controls: the same host does the same operations on their OWN
 *    tenant successfully (the fence does not break legitimate work).
 *
 * Uses the real Express app on an ephemeral port and the real dev database
 * with two throwaway tenants, cleaned up afterwards.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  runWithHostDbContext,
  tenantsTable,
  sectionsTable,
  categoriesTable,
  itemsTable,
  mediaTable,
  translationsTable,
  changelogTable,
  hostUsersTable,
  hostMembershipsTable,
} from "@workspace/db";
import app from "../app";
import { hashPassword, _clearHostRateLimiters } from "../lib/hostAuth";
import { ensureRowLevelSecurity } from "../lib/rls";

const PASSWORD_A = "geslo-za-testA-123";

type Fixture = {
  base: string;
  tenantA: string;
  tenantB: string;
  sectionA: string;
  sectionB: string;
  categoryA: string;
  categoryB: string;
  itemA: string;
  itemB: string;
  mediaB: string;
  hostAEmail: string;
  cookie: string;
};

async function jreq(
  base: string,
  method: string,
  path: string,
  cookie: string | null,
  body?: unknown,
): Promise<Response> {
  return fetch(`${base}/api${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("CP2 host access model: fence + RLS + positive controls", async (t) => {
  _clearHostRateLimiters();
  await ensureRowLevelSecurity();
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  const stamp = Date.now().toString(36);
  const hostAEmail = `cp2-host-a-${stamp}@example.com`;

  // ---------- Fixture: two tenants with parallel content ----------
  const mkTenant = async (suffix: string) => {
    const [row] = await db
      .insert(tenantsTable)
      .values({ slug: `cp2-${suffix}-${stamp}`, name: `CP2 ${suffix}` })
      .returning({ id: tenantsTable.id });
    return row!.id;
  };
  const tenantA = await mkTenant("a");
  const tenantB = await mkTenant("b");

  const mkContent = async (tenantId: string, tag: string) => {
    const [s] = await db
      .insert(sectionsTable)
      .values({ tenantId, key: `info-${tag}`, title: `Sekcija ${tag}` })
      .returning({ id: sectionsTable.id });
    const [c] = await db
      .insert(categoriesTable)
      .values({ sectionId: s!.id, label: `Kategorija ${tag}` })
      .returning({ id: categoriesTable.id });
    const [i] = await db
      .insert(itemsTable)
      .values({ categoryId: c!.id, title: `Item ${tag}` })
      .returning({ id: itemsTable.id });
    return { section: s!.id, category: c!.id, item: i!.id };
  };
  const A = await mkContent(tenantA, "A");
  const B = await mkContent(tenantB, "B");

  const [mB] = await db
    .insert(mediaTable)
    .values({ itemId: B.item, url: "https://example.com/b.jpg" })
    .returning({ id: mediaTable.id });
  const mediaB = mB!.id;

  await db.insert(translationsTable).values([
    { model: "item", recordId: A.item, field: "title", lang: "en", value: "A-title-EN" },
    { model: "item", recordId: B.item, field: "title", lang: "en", value: "B-title-EN" },
  ]);

  const [hostA] = await db
    .insert(hostUsersTable)
    .values({ email: hostAEmail, passwordHash: await hashPassword(PASSWORD_A) })
    .returning({ id: hostUsersTable.id });
  await db.insert(hostMembershipsTable).values({ hostUserId: hostA!.id, tenantId: tenantA });

  const createdSectionIds: string[] = [A.section, B.section];

  t.after(async () => {
    await db.delete(translationsTable).where(
      inArray(translationsTable.recordId, [
        A.item, B.item, A.category, B.category, ...createdSectionIds, tenantA, tenantB,
      ]),
    );
    await db.delete(changelogTable).where(inArray(changelogTable.tenantId, [tenantA, tenantB]));
    await db.delete(hostUsersTable).where(eq(hostUsersTable.id, hostA!.id));
    await db.delete(tenantsTable).where(inArray(tenantsTable.id, [tenantA, tenantB]));
    await new Promise<void>((r) => server.close(() => r()));
  });

  // ---------- Login ----------
  const loginRes = await jreq(base, "POST", "/admin/host/login", null, {
    email: hostAEmail,
    password: PASSWORD_A,
  });
  assert.equal(loginRes.status, 200);
  const setCookie = loginRes.headers.get("set-cookie") ?? "";
  const m = /__Host-s360_host=([^;]+)/.exec(setCookie);
  assert.ok(m, "login must set the host session cookie");
  const cookie = `__Host-s360_host=${m![1]}`;

  const fx: Fixture = {
    base, tenantA, tenantB,
    sectionA: A.section, sectionB: B.section,
    categoryA: A.category, categoryB: B.category,
    itemA: A.item, itemB: B.item,
    mediaB, hostAEmail, cookie,
  };

  let denied = 0;
  const expectDenied = async (method: string, path: string, body?: unknown) => {
    const res = await jreq(base, method, path, cookie, body);
    assert.equal(res.status, 404, `${method} ${path} must be 404 for host A, got ${res.status}`);
    const parsed = (await res.json()) as { error?: string };
    assert.equal(parsed.error, "Not found", `${method} ${path} must not leak details`);
    denied += 1;
  };

  // ---------- Ring 2a: tenant-URL routes of tenant B ----------
  await t.test("tenant-URL routes of the foreign tenant are 404", async () => {
    await expectDenied("GET", `/admin/tenants/${fx.tenantB}`);
    await expectDenied("PATCH", `/admin/tenants/${fx.tenantB}`, { name: "hacked" });
    await expectDenied("GET", `/admin/tenants/${fx.tenantB}/orders`);
    await expectDenied("GET", `/admin/tenants/${fx.tenantB}/trash`);
    await expectDenied("GET", `/admin/tenants/${fx.tenantB}/translations`);
    await expectDenied("GET", `/admin/tenants/${fx.tenantB}/translations/overview`);
    await expectDenied("GET", `/admin/tenants/${fx.tenantB}/site-plan-images`);
    await expectDenied("GET", `/admin/tenants/${fx.tenantB}/distance-review`);
    await expectDenied("GET", `/admin/tenants/${fx.tenantB}/changelog`);
    await expectDenied("GET", `/admin/tenants/${fx.tenantB}/messages`);
    await expectDenied("GET", `/admin/tenants/${fx.tenantB}/qr.png`);
    await expectDenied("POST", `/admin/tenants/${fx.tenantB}/sections`, { key: "x", title: "X" });
    await expectDenied("POST", `/admin/tenants/${fx.tenantB}/hero/upload`, {});
    const [bTenant] = await db.select({ name: tenantsTable.name })
      .from(tenantsTable).where(eq(tenantsTable.id, fx.tenantB));
    assert.equal(bTenant!.name, "CP2 b", "tenant B must be untouched");
  });

  await t.test("every Creator route rejects a real host session", async () => {
    const proposalId = "00000000-0000-4000-8000-000000000001";
    await expectDenied("POST", "/admin/creator/origin-preview", {
      mapUrl: "https://www.google.com/maps?q=46.05,14.51",
    });
    await expectDenied("GET", `/admin/tenants/${fx.tenantA}/creator/proposals`);
    await expectDenied(
      "POST",
      `/admin/tenants/${fx.tenantA}/creator/proposals/${proposalId}/approve`,
    );
    await expectDenied(
      "POST",
      `/admin/tenants/${fx.tenantA}/creator/proposals/approve-bulk`,
      { proposalIds: [proposalId] },
    );
  });

  // ---------- Ring 2b: entity-id routes of tenant B ----------
  await t.test("entity routes resolving to the foreign tenant are 404", async () => {
    await expectDenied("PATCH", `/admin/sections/${fx.sectionB}`, { title: "hacked" });
    await expectDenied("DELETE", `/admin/sections/${fx.sectionB}`);
    await expectDenied("POST", `/admin/sections/${fx.sectionB}/categories`, { label: "hacked" });
    await expectDenied("PATCH", `/admin/categories/${fx.categoryB}`, { label: "hacked" });
    await expectDenied("DELETE", `/admin/categories/${fx.categoryB}`);
    await expectDenied("POST", `/admin/categories/${fx.categoryB}/items`, { title: "hacked" });
    await expectDenied("PATCH", `/admin/items/${fx.itemB}`, { title: "hacked" });
    await expectDenied("DELETE", `/admin/items/${fx.itemB}`);
    await expectDenied("POST", `/admin/items/${fx.itemB}/duplicate`);
    await expectDenied("POST", `/admin/items/${fx.itemB}/media`, { url: "https://x/y.jpg" });
    await expectDenied("PATCH", `/admin/media/${fx.mediaB}`, { alt: "hacked" });
    await expectDenied("DELETE", `/admin/media/${fx.mediaB}`);
    await expectDenied("PATCH", `/admin/site-plan-images/${fx.mediaB}`, { alt: "hacked" });
    // Non-existent entity → same 404 (no existence oracle either way)
    await expectDenied("PATCH", `/admin/orders/00000000-0000-4000-8000-000000000000/status`, { status: "done" });
    // Non-UUID id → same 404
    await expectDenied("PATCH", `/admin/sections/not-a-uuid`, { title: "x" });

    const [sB] = await db.select({ title: sectionsTable.title })
      .from(sectionsTable).where(eq(sectionsTable.id, fx.sectionB));
    const [iB] = await db.select({ title: itemsTable.title })
      .from(itemsTable).where(eq(itemsTable.id, fx.itemB));
    assert.equal(sB!.title, "Sekcija B");
    assert.equal(iB!.title, "Item B");
  });

  // ---------- Ring 2c: owner-only endpoints are invisible to hosts ----------
  await t.test("owner-only endpoints are 404 for a host (even on their own tenant)", async () => {
    await expectDenied("GET", `/admin/tenants`);
    await expectDenied("POST", `/admin/tenants`, { slug: "x", name: "X" });
    await expectDenied("GET", `/admin/overview`);
    await expectDenied("GET", `/admin/slug-check?slug=x`);
    await expectDenied("GET", `/admin/storage/usage`);
    await expectDenied("POST", `/admin/storage/cleanup`, {});
    await expectDenied("GET", `/admin/auth-events`);
    await expectDenied("GET", `/admin/credentials`);
    await expectDenied("GET", `/admin/recovery-codes`);
    await expectDenied("POST", `/admin/maintenance/normalize-content`, {});
    await expectDenied("GET", `/admin/cutovers/part-5-meli-pu`);
    await expectDenied("DELETE", `/admin/tenants/${fx.tenantA}`);
    await expectDenied("POST", `/admin/tenants/${fx.tenantA}/renew`, {});
    await expectDenied("GET", `/admin/tenants/${fx.tenantA}/renewals`);
    await expectDenied("POST", `/admin/tenants/${fx.tenantA}/duplicate`, {});
    await expectDenied("GET", `/admin/tenants/${fx.tenantA}/media-check`);
    await expectDenied("POST", `/admin/tenants/${fx.tenantA}/operator-entry`, {});
    await expectDenied("DELETE", `/admin/categories/${fx.categoryA}/purge`);
    await expectDenied("DELETE", `/admin/items/${fx.itemA}/purge`);
    await expectDenied("POST", `/admin/tenants/${fx.tenantA}/translations/import`, {});
    await expectDenied("GET", `/admin/tenants/${fx.tenantA}/translations/export`);
    await expectDenied("GET", `/admin/tenants/${fx.tenantA}/host`);
    await expectDenied("PUT", `/admin/tenants/${fx.tenantA}/host`, { email: "x@y.si" });
    await expectDenied("POST", `/admin/tenants/${fx.tenantA}/host/send-invite`, {
      template: "welcome",
    });
    await expectDenied("POST", `/admin/tenants/${fx.tenantA}/host/send-reset`);
    await expectDenied("GET", `/admin/does-not-exist`);
  });

  // ---------- Ring 3: body/query-based endpoints under RLS ----------
  await t.test("body/query ids of the foreign tenant are invisible (RLS)", async () => {
    const readRes = await jreq(base, "GET",
      `/admin/translations?model=item&recordId=${fx.itemB}`, cookie);
    assert.equal(readRes.status, 200);
    assert.deepEqual(await readRes.json(), [], "foreign translations must read as empty");
    denied += 1;

    const writeRes = await jreq(base, "PUT", `/admin/translations`, cookie, {
      model: "item", recordId: fx.itemB, field: "title", lang: "en", value: "HACKED",
    });
    assert.notEqual(writeRes.status, 200, "foreign translation write must not succeed");
    const [tB] = await db.select({ value: translationsTable.value })
      .from(translationsTable)
      .where(and(eq(translationsTable.recordId, fx.itemB), eq(translationsTable.lang, "en")));
    assert.equal(tB!.value, "B-title-EN", "B's translation must be unchanged");
    denied += 1;

    const reorderRes = await jreq(base, "POST", `/admin/items/reorder`, cookie, {
      ids: [fx.itemB],
    });
    assert.notEqual(reorderRes.status, 200, "foreign reorder must not succeed");
    denied += 1;
  });

  // ---------- Field denylist on the host's own tenant ----------
  await t.test("identity fields of the own tenant are owner-only", async () => {
    for (const body of [{ slug: "prevzet-slug" }, { customDomain: "evil.example.com" }]) {
      const res = await jreq(base, "PATCH", `/admin/tenants/${fx.tenantA}`, cookie, body);
      assert.equal(res.status, 400, `PATCH with ${Object.keys(body)[0]} must be 400`);
      denied += 1;
    }
    const [aTenant] = await db.select({ slug: tenantsTable.slug })
      .from(tenantsTable).where(eq(tenantsTable.id, fx.tenantA));
    assert.equal(aTenant!.slug, `cp2-a-${stamp}`);
  });

  // ---------- Anonymous and garbage sessions ----------
  await t.test("no session or a forged session gets 401", async () => {
    for (const c of [null, "__Host-s360_host=forged-token-value"]) {
      const res = await jreq(base, "GET", `/admin/tenants/${fx.tenantA}`, c);
      assert.equal(res.status, 401);
      denied += 1;
    }
  });

  // ---------- Positive controls on the OWN tenant ----------
  await t.test("the same host does the same work on their own tenant", async () => {
    const get = await jreq(base, "GET", `/admin/tenants/${fx.tenantA}`, cookie);
    assert.equal(get.status, 200);

    const patch = await jreq(base, "PATCH", `/admin/tenants/${fx.tenantA}`, cookie, { name: "CP2 A (urejeno)" });
    assert.equal(patch.status, 200);

    const mkSection = await jreq(base, "POST", `/admin/tenants/${fx.tenantA}/sections`, cookie, { key: "cp2-nova", title: "Nova sekcija", icon: "sparkle" });
    assert.ok(mkSection.status === 200 || mkSection.status === 201, `create section got ${mkSection.status}`);
    const created = (await mkSection.json()) as { id?: string };
    if (created.id) createdSectionIds.push(created.id);

    const patchSection = await jreq(base, "PATCH", `/admin/sections/${fx.sectionA}`, cookie, { title: "Sekcija A (urejeno)" });
    assert.equal(patchSection.status, 200);

    const patchItem = await jreq(base, "PATCH", `/admin/items/${fx.itemA}`, cookie, { title: "Item A (urejeno)" });
    assert.equal(patchItem.status, 200);

    const orders = await jreq(base, "GET", `/admin/tenants/${fx.tenantA}/orders`, cookie);
    assert.equal(orders.status, 200);

    const ownTranslations = await jreq(base, "GET",
      `/admin/translations?model=item&recordId=${fx.itemA}`, cookie);
    assert.equal(ownTranslations.status, 200);
    const list = (await ownTranslations.json()) as Array<{ value: string }>;
    assert.ok(list.some((r) => r.value === "A-title-EN"), "own translations must be readable");

    const session = await jreq(base, "GET", `/admin/host/session`, cookie);
    const sBody = (await session.json()) as { authenticated: boolean; tenantId?: string };
    assert.equal(sBody.authenticated, true);
    assert.equal(sBody.tenantId, fx.tenantA);

    const history = await jreq(base, "GET", `/admin/tenants/${fx.tenantA}/changelog`, cookie);
    assert.equal(history.status, 200);
    const historyRows = (await history.json()) as Array<{ actorLabel: string; summary: string; requestIp: string | null; actorEmail?: unknown }>;
    assert.ok(historyRows.length > 0);
    assert.ok(historyRows.every((r) => r.actorLabel === "Stranka" && typeof r.summary === "string"));
    assert.ok(historyRows.some((r) => r.actorLabel === "Stranka" && typeof r.requestIp === "string"), "host audit IP is visible");
    assert.ok(historyRows.every((r) => r.actorLabel === "Stranka" ? typeof r.requestIp === "string" : r.requestIp === null));
    assert.ok(historyRows.every((r) => r.actorEmail === undefined));
  });

  // ---------- Changelog attribution ----------
  await t.test("host changes are recorded as the host in the changelog", async () => {
    const rows = await db
      .select({ actorType: changelogTable.actorType, actorEmail: changelogTable.actorEmail, actorLabel: changelogTable.actorLabel })
      .from(changelogTable)
      .where(eq(changelogTable.tenantId, fx.tenantA));
    assert.ok(rows.length > 0, "host edits must produce changelog rows");
    assert.ok(
      rows.every((r) => r.actorType === "host" && r.actorEmail === null && r.actorLabel === "Stranka"),
      "host attribution must not store the host e-mail",
    );
  });

  // ---------- Ring 3 direct: RLS at the connection level ----------
  await t.test("RLS: host-scoped connection cannot see or write foreign rows", async () => {
    const visible = await runWithHostDbContext(fx.tenantA, async () =>
      db.select({ id: sectionsTable.id, tenantId: sectionsTable.tenantId }).from(sectionsTable),
    );
    assert.ok(visible.length > 0);
    assert.ok(visible.every((s) => s.tenantId === fx.tenantA), "only own sections visible");

    const foreign = await runWithHostDbContext(fx.tenantA, async () =>
      db.select().from(translationsTable).where(eq(translationsTable.recordId, fx.itemB)),
    );
    assert.deepEqual(foreign, [], "foreign translations invisible under RLS");

    await assert.rejects(
      runWithHostDbContext(fx.tenantA, async () => {
        await db.insert(sectionsTable).values({ tenantId: fx.tenantB, key: "evil", title: "Evil" });
      }),
      (err: unknown) => {
        // drizzle wraps the pg error; the policy violation sits in the chain
        let messages = "";
        for (let e = err; e instanceof Error; e = e.cause as Error) {
          messages += e.message + "\n";
        }
        assert.match(messages, /row-level security/i,
          "insert into the foreign tenant must be rejected by the RLS policy");
        return true;
      },
    );

    // Fail-closed: host connection WITHOUT a tenant setting sees nothing.
    const client = await pool.connect();
    try {
      await client.query("SET ROLE smart360_host");
      await client.query("SELECT set_config('app.role','host',false)");
      const res = await client.query("SELECT count(*)::int AS n FROM sections");
      assert.equal(res.rows[0].n, 0, "host role without tenant id must see zero rows");
    } finally {
      await client.query("RESET ROLE");
      await client.query("RESET ALL");
      client.release();
    }

    // Non-host paths are untouched.
    const publicView = await db.select({ id: sectionsTable.id })
      .from(sectionsTable).where(eq(sectionsTable.tenantId, fx.tenantB));
    assert.equal(publicView.length, 1, "guest/owner paths still see everything");
  });

  // ---------- Fail-closed: no privileged fallback after release ----------
  await t.test("work outliving a host context is rejected, never run privileged", async () => {
    let leaked: Promise<unknown> | undefined;
    await runWithHostDbContext(fx.tenantA, async () => {
      // Fire-and-forget work that inherits the context but finishes AFTER
      // the context is released (the exact leak mode the review flagged).
      leaked = (async () => {
        await new Promise((r) => setTimeout(r, 30));
        return db.select({ id: sectionsTable.id }).from(sectionsTable);
      })();
    });
    await assert.rejects(
      leaked!,
      /released/i,
      "post-release query must throw instead of falling back to the pool",
    );
  });

  // ---------- Least privilege: owner-secret tables and auth-table scoping ----------
  await t.test("host role cannot touch owner-secret tables; auth tables are self-scoped", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET ROLE smart360_host");
      await client.query(
        "SELECT set_config('app.role','host',false), set_config('app.tenant_id',$1,false)",
        [fx.tenantA],
      );
      for (const tbl of [
        "admin_sessions",
        "admin_credentials",
        "admin_users",
        "admin_recovery_codes",
        "admin_password_credentials",
        "admin_password_state",
        "host_invites",
        "host_password_resets",
        "tenant_renewals",
        "cleanup_runs",
      ]) {
        await assert.rejects(
          client.query(`SELECT count(*) FROM ${tbl}`),
          /permission denied/i,
          `host role must have zero privileges on ${tbl}`,
        );
        denied += 1;
      }
      const users = await client.query("SELECT email FROM host_users");
      assert.ok(users.rows.length >= 1, "own account must be visible");
      assert.ok(
        users.rows.every((r: { email: string }) => r.email === fx.hostAEmail),
        "host connection sees ONLY its own tenant's account",
      );
    } finally {
      await client.query("RESET ROLE").catch(() => {});
      await client.query("RESET ALL").catch(() => {});
      client.release();
    }
  });

  console.log(`[CP2] negative-access checks passed: ${denied} denied requests verified`);
});
