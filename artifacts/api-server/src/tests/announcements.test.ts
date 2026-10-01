import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import pg from "pg";
import { eq, inArray } from "drizzle-orm";
import { db, pool, tenantsTable, tenantAnnouncementsTable, runWithHostDbContext } from "@workspace/db";
import { CreateTenantAnnouncementResponse, GetGuestAnnouncementsResponse } from "@workspace/api-zod";
import { announcementActiveAt, announcementContentError, announcementText, parseAnnouncementWrite } from "../lib/announcementHelpers";
import { createAdminGateForTests } from "../lib/actorGate";
import { POLICIES, HOST_ROLE_GRANTS } from "../lib/rls";
import { makeAdminMutationInvalidator } from "../routes";
import announcementsRouter from "../routes/announcements";
import type { Actor } from "../lib/actorContext";

test("announcement validity is inclusive; no end date and soft delete", () => {
  const validFrom = new Date("2026-01-15T10:00:00Z"), validTo = new Date("2026-01-15T12:00:00Z");
  const row = { validFrom, validTo, deletedAt: null };
  assert.equal(announcementActiveAt(row, new Date(validFrom.getTime() - 1)), false);
  assert.equal(announcementActiveAt(row, validFrom), true);
  assert.equal(announcementActiveAt(row, validTo), true);
  assert.equal(announcementActiveAt(row, new Date(validTo.getTime() + 1)), false);
  assert.equal(announcementActiveAt({ ...row, validTo: null }, new Date("2030-01-01")), true);
  assert.equal(announcementActiveAt({ ...row, deletedAt: validFrom }, validFrom), false);
});

test("language fallback is first filled SL/EN/DE/IT, selected language wins", () => {
  const row = { titleSl: " ", titleEn: "English", titleDe: "Deutsch", bodyIt: "Italiano" };
  assert.equal(announcementText(row, "title", "sl"), "English");
  assert.equal(announcementText(row, "title", "de"), "Deutsch");
  assert.equal(announcementText(row, "body", "en"), "Italiano");
});

test("write boundary rejects unknown/owned fields, unzoned/null start, insecure images, empty content and backwards validity", () => {
  for (const raw of [{ tenantId: randomUUID() }, { id: randomUUID() }, { deletedAt: null },
    { validFrom: null }, { validFrom: "2026-01-15T12:00" }, { validFrom: 123 },
    { imageUrl: "javascript:alert(1)" }, { imageUrl: "data:image/png;base64,x" }]) {
    assert.equal(parseAnnouncementWrite(raw).ok, false, JSON.stringify(raw));
  }
  const parsed = parseAnnouncementWrite({ titleDe: " Titel ", bodyDe: " Text ", validFrom: "2026-01-15T12:00:00+01:00" });
  assert.ok(parsed.ok);
  assert.equal(parsed.data.titleDe, "Titel");
  const validFrom = new Date("2026-01-15T12:00Z");
  assert.ok(announcementContentError({ validFrom, validTo: null }));
  assert.ok(announcementContentError({ titleSl: "Title", bodyEn: "Body", validFrom, validTo: new Date(validFrom.getTime() - 1) }));
});

test("null-safe registry override is announcements-only; old policies/grants remain untouched", () => {
  assert.equal(POLICIES.tenant_announcements!.nonHostPredicate,
    "current_setting('app.role', true) IS DISTINCT FROM 'host'");
  assert.equal(POLICIES.orders!.nonHostPredicate, undefined);
  assert.equal(POLICIES.message_threads!.nonHostPredicate, undefined);
  assert.equal(HOST_ROLE_GRANTS.tenant_announcements, "SELECT, INSERT, UPDATE");
});

/** In-process route harness like existing phase2 tests: no app/workflow restart or credentials. */
async function harness(actor: Actor, onInvalidation: () => void) {
  const app = express();
  app.use(express.json());
  app.use(makeAdminMutationInvalidator(onInvalidation));
  app.use(createAdminGateForTests(actor));
  app.use(announcementsRouter);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err instanceof Error ? err.message : "Test error" });
  });
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    request: (method: string, path: string, body?: unknown) => fetch(`http://127.0.0.1:${address.port}${path}`, {
      method, headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("real DB RLS/FORCE, own/foreign host CRUD, operator CRUD, live guest visibility without snapshot/cache invalidation", async (t) => {
  const suffix = randomUUID();
  const [tenantA, tenantB, legacy] = await db.insert(tenantsTable).values([
    { slug: `ann-a-${suffix}`, name: "Announcements test A", isPublished: true },
    { slug: `ann-b-${suffix}`, name: "Announcements test B", isPublished: true },
    { slug: `ann-legacy-${suffix}`, name: "Announcements legacy test", guestUiMode: "legacy", isPublished: true },
  ]).returning();
  assert.ok(tenantA && tenantB && legacy);
  const ids = [tenantA.id, tenantB.id, legacy.id];
  let invalidations = 0;
  const owner = await harness({ kind: "owner" }, () => invalidations++);
  const host = await harness({ kind: "host", hostUserId: randomUUID(), tenantId: tenantA.id }, () => invalidations++);
  t.after(async () => {
    await owner.close();
    await host.close();
    await db.delete(tenantsTable).where(inArray(tenantsTable.id, ids));
  });
  const base = `/admin/tenants/${tenantA.id}/announcements`;
  const created = await host.request("POST", base, { titleSl: "Takrat", bodySl: "Prva vsebina" });
  assert.equal(created.status, 201, await created.clone().text());
  assert.equal(created.headers.get("cache-control"), "no-store");
  const { announcement } = CreateTenantAnnouncementResponse.parse(await created.json());
  assert.equal(announcement.tenantId, tenantA.id);
  const ownerCreated = await owner.request("POST", `/admin/tenants/${tenantB.id}/announcements`, {
    titleEn: "Other tenant", bodyEn: "Other body",
  });
  assert.equal(ownerCreated.status, 201);
  const { announcement: other } = CreateTenantAnnouncementResponse.parse(await ownerCreated.json());

  await t.test("host cannot reach tenant B or foreign row through tenant A", async () => {
    assert.equal((await host.request("GET", `/admin/tenants/${tenantB.id}/announcements`)).status, 404);
    assert.equal((await host.request("POST", `/admin/tenants/${tenantB.id}/announcements`, { titleSl: "No", bodySl: "No" })).status, 404);
    assert.equal((await host.request("PATCH", `${base}/${other.id}`, { titleSl: "No" })).status, 404);
    assert.equal((await host.request("DELETE", `${base}/${other.id}`)).status, 404);
    const rows = await runWithHostDbContext(tenantA.id, () =>
      db.select().from(tenantAnnouncementsTable).where(inArray(tenantAnnouncementsTable.tenantId, ids)));
    assert.deepEqual(rows.map((r) => r.id), [announcement.id]);
    await assert.rejects(runWithHostDbContext(tenantA.id, () => db.insert(tenantAnnouncementsTable)
      .values({ tenantId: tenantB.id, titleSl: "Bad", bodySl: "Bad" })),
    (error: unknown) => error instanceof Error && error.cause instanceof Error && /row-level security/i.test(error.cause.message));
  });

  await t.test("both RLS flags enabled and actual non-bypass role without marker reads rows; marked host without tenant sees none", async () => {
    // Fresh connection is essential: RESET ALL can leave a custom GUC as ''.
    // Prove the original NULL case, not just the empty-string case.
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const flags = await client.query("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid='public.tenant_announcements'::regclass");
      assert.deepEqual(flags.rows[0], { relrowsecurity: true, relforcerowsecurity: true });
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE smart360_host");
      const role = await client.query("SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname=current_user");
      assert.deepEqual(role.rows[0], { rolbypassrls: false, rolsuper: false });
      const marker = await client.query("SELECT current_setting('app.role', true) AS marker");
      assert.equal(marker.rows[0].marker, null);
      const unset = await client.query("SELECT id FROM public.tenant_announcements WHERE tenant_id=ANY($1::uuid[])", [ids]);
      assert.equal(unset.rows.length, 2);
      const inserted = await client.query(
        "INSERT INTO public.tenant_announcements(tenant_id,title_sl,body_sl) VALUES($1,$2,$3) RETURNING id",
        [tenantA.id, "Rollback-only unmarked connection", "WITH CHECK proof"],
      );
      assert.equal(inserted.rowCount, 1, "NULL host marker must also pass WITH CHECK");
      await client.query("SELECT set_config('app.role', 'host', true), set_config('app.tenant_id', '', true)");
      const denied = await client.query("SELECT id FROM public.tenant_announcements WHERE tenant_id=ANY($1::uuid[])", [ids]);
      assert.equal(denied.rows.length, 0);
      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK");
      await client.query("RESET ROLE");
      await client.query("RESET ALL");
      await client.end();
    }
  });

  await t.test("guest reads live edits without publish; scheduled, expired, deleted and legacy hidden", async () => {
    const path = `/guest/${tenantA.slug}/announcements`;
    const response = await owner.request("GET", path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(GetGuestAnnouncementsResponse.parse(await response.json()).announcements[0]!.id, announcement.id);
    const patch = await host.request("PATCH", `${base}/${announcement.id}`, { titleSl: "Spremenjeno takoj", bodySl: "Druga vsebina" });
    assert.equal(patch.status, 200);
    const live = await owner.request("GET", path);
    assert.equal(GetGuestAnnouncementsResponse.parse(await live.json()).announcements[0]!.titleSl, "Spremenjeno takoj");
    const now = Date.now();
    await db.insert(tenantAnnouncementsTable).values([
      { tenantId: tenantA.id, titleSl: "Scheduled", bodySl: "Body", validFrom: new Date(now + 60_000) },
      { tenantId: tenantA.id, titleSl: "Expired", bodySl: "Body", validFrom: new Date(now - 60_000), validTo: new Date(now - 1) },
      { tenantId: tenantA.id, titleSl: "Deleted", bodySl: "Body", deletedAt: new Date(now) },
      { tenantId: tenantA.id, titleSl: "Newest", bodySl: "Body", validFrom: new Date(now - 60_000), createdAt: new Date(now + 1) },
    ]);
    const visible = GetGuestAnnouncementsResponse.parse(await (await owner.request("GET", path)).json()).announcements;
    assert.deepEqual(visible.map((r) => r.titleSl), ["Newest", "Spremenjeno takoj"]);
    assert.equal((await owner.request("GET", `/guest/${legacy.slug}/announcements`)).status, 404);
    assert.equal((await owner.request("DELETE", `${base}/${announcement.id}`)).status, 204);
    const afterDelete = GetGuestAnnouncementsResponse.parse(await (await owner.request("GET", path)).json());
    assert.equal(afterDelete.announcements.some((row) => row.id === announcement.id), false);
    const [deleted] = await db.select().from(tenantAnnouncementsTable).where(eq(tenantAnnouncementsTable.id, announcement.id));
    assert.ok(deleted?.deletedAt);
    assert.equal(invalidations, 0, "runtime writes must not invalidate guide snapshot caches");
  });

  await t.test("database validity CHECK and unknown write fields are enforced", async () => {
    assert.equal((await host.request("POST", base, { titleSl: "T", bodySl: "B", tenantId: tenantB.id })).status, 400);
    await assert.rejects(db.insert(tenantAnnouncementsTable).values({
      tenantId: tenantA.id, validFrom: new Date("2026-01-16"), validTo: new Date("2026-01-15"),
    }), (error: unknown) => error instanceof Error && error.cause instanceof Error && /tenant_announcements_validity_chk/.test(error.cause.message));
  });
});

test.after(async () => { await pool.end(); });