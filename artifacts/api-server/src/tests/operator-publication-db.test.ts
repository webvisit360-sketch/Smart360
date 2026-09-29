/**
 * Post-approval DB regression. Opt in only after the reviewed trigger function
 * has been approved/applied. No owner account or session is created: this
 * isolated router injects trusted test actors, never a production auth path.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import { eq, sql } from "drizzle-orm";
import {
  db, openHostDbContext, runWithHostDbContext, tenantsTable, sectionsTable, changelogTable, publishedSnapshotsTable,
  tenantSlugReservationsTable,
} from "@workspace/db";
import tenantRouter from "../routes/adminTenants";
import { actorStorage } from "../lib/actorContext";
import { ensureTenantPublication, readPublishedContent } from "../lib/publishedSnapshots";
import { ensureGuestDirtyTriggers } from "../lib/guestDirtyTriggers";
import { initializeOperatorDraftPending } from "../lib/operatorDraftBackfill";
import { currentHostOnboarding, submitHostOnboarding } from "../lib/hostOnboarding";
import { _setHostOnboardingDeliveryOverride } from "../lib/hostOnboardingEmail";
import {
  createCanonicalOnboardingFixture, cleanupCanonicalOnboardingFixture,
} from "./helpers/canonicalOnboardingFixture";

test("real locked publication: operator edits block host, owner clears, host-only edits publish", {
  skip: process.env.SMART360_OPERATOR_DRAFT_DB_TEST !== "1",
}, async (t) => {
  assert.notEqual(process.env.NODE_ENV, "production");
  // This changes a DB function. Never run this test until the owner has
  // approved the exact SQL in guestDirtyTriggers.ts.
  await ensureGuestDirtyTriggers();
  await initializeOperatorDraftPending();
  const tenantId = randomUUID();
  const [created] = await db.insert(tenantsTable).values({
    id: tenantId, slug: `publication-actor-${tenantId}`, name: "Initial",
    isPublished: true, firstPublishedAt: new Date(), lastPublishedAt: new Date(),
  }).returning();
  assert.ok(created);
  await ensureTenantPublication(tenantId);

  const isolated = express();
  isolated.use(express.json());
  isolated.use(async (req, res, next) => {
    if (req.get("x-test-actor") === "host") {
      const handle = await openHostDbContext(tenantId);
      res.once("finish", () => { void handle.release(); });
      handle.enter(() => actorStorage.run({
        kind: "host", hostUserId: randomUUID(), tenantId,
      }, () => {
        req.actor = actorStorage.getStore();
        next();
      }));
      return;
    }
    actorStorage.run({ kind: "owner" }, () => {
      req.actor = actorStorage.getStore();
      next();
    });
  });
  isolated.use(tenantRouter);
  const server = isolated.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/admin/tenants/${tenantId}`;
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(changelogTable).where(eq(changelogTable.tenantId, tenantId));
    await db.delete(publishedSnapshotsTable).where(eq(publishedSnapshotsTable.tenantId, tenantId));
    await db.delete(tenantSlugReservationsTable).where(eq(tenantSlugReservationsTable.tenantId, tenantId));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
  });
  const request = (actor: "host" | "owner", method: string, path = "", body?: unknown) =>
    fetch(url + path, {
      method, headers: { "content-type": "application/json", "x-test-actor": actor },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const token = async (actor: "host" | "owner"): Promise<string> => {
    const response = await request(actor, "GET", "/publish-preview");
    assert.equal(response.status, 200, await response.clone().text());
    return ((await response.json()) as { token: string }).token;
  };
  const row = async () => (await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)))[0]!;
  const initialSnapshot = await readPublishedContent(tenantId);

  assert.equal((await request("owner", "PATCH", "", { name: "Operator draft" })).status, 200);
  assert.equal((await row()).operatorDraftPending, true);
  assert.equal((await request("host", "PATCH", "", { name: "Host following edit" })).status, 200);
  const pendingAt = (await row()).lastPublishedAt;
  const denied = await request("host", "PATCH", "", {
    isPublished: true, publishNow: true, publishToken: await token("host"),
  });
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), {
    error: "Vodnik vsebuje spremembe upravljavca, ki še niso potrjene — objavo opravi Smart360.",
  });
  assert.deepEqual(await readPublishedContent(tenantId), initialSnapshot);
  assert.deepEqual((await row()).lastPublishedAt, pendingAt);
  assert.equal((await row()).operatorDraftPending, true);
  assert.equal((await request("host", "PATCH", "", { operatorDraftPending: false })).status, 400);

  const approved = await request("owner", "PATCH", "", {
    isPublished: true, publishNow: true, publishToken: await token("owner"),
  });
  assert.equal(approved.status, 200, await approved.clone().text());
  assert.equal((await row()).operatorDraftPending, false);
  assert.equal((await row()).hasUnpublishedChanges, false);
  await initializeOperatorDraftPending();
  assert.equal((await row()).operatorDraftPending, false, "initializer replay after owner publish");
  assert.equal((await request("host", "PATCH", "", { name: "Host-only draft" })).status, 200);
  assert.equal((await row()).operatorDraftPending, false);
  await initializeOperatorDraftPending();
  assert.equal((await row()).operatorDraftPending, false, "initializer replay must not reflag host edits");
  const published = await request("host", "PATCH", "", {
    isPublished: true, publishNow: true, publishToken: await token("host"),
  });
  assert.equal(published.status, 200, await published.clone().text());
  assert.equal((await readPublishedContent(tenantId)).languages.sl?.tree.name, "Host-only draft");

  const rollback = new Error("rollback-provenance-test");
  await assert.rejects(runWithHostDbContext(tenantId, () => db.transaction(async (tx) => {
    await tx.insert(sectionsTable).values({ tenantId, key: "test-host", title: "Host" });
    const [inside] = await tx.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    assert.equal(inside!.operatorDraftPending, false, "ordinary host DB content trigger");
    throw rollback;
  })), (error: unknown) => error === rollback);
  await assert.rejects(db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT set_config('smart360.draft_actor', 'host', true),
             set_config('smart360.draft_tenant', ${tenantId}, true)
    `);
    await tx.insert(sectionsTable).values({ tenantId, key: "test-host-escaped", title: "Host escaped" });
    const [inside] = await tx.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    assert.equal(inside!.operatorDraftPending, false, "verified host onboarding privileged transaction");
    throw rollback;
  }), (error: unknown) => error === rollback);
  await assert.rejects(db.transaction(async (tx) => {
    await tx.insert(sectionsTable).values({ tenantId, key: "test-system", title: "System" });
    const [inside] = await tx.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    assert.equal(inside!.operatorDraftPending, true, "unattributed jobs fail closed");
    throw rollback;
  }), (error: unknown) => error === rollback);

  // Whichever transaction wins the row lock, a racing owner edit cannot
  // sneak into a host-published snapshot. If the host publishes first, the
  // owner edit remains pending; if the edit wins, the host is denied.
  const raceToken = await token("host");
  const [edit, publish] = await Promise.all([
    request("owner", "PATCH", "", { name: "Concurrent operator draft" }),
    request("host", "PATCH", "", {
      isPublished: true, publishNow: true, publishToken: raceToken,
    }),
  ]);
  assert.equal(edit.status, 200);
  assert.ok([200, 403, 409].includes(publish.status));
  assert.equal((await row()).operatorDraftPending, true);
  assert.notEqual((await readPublishedContent(tenantId)).languages.sl?.tree.name, "Concurrent operator draft");
});

test("real host onboarding escaped Creator transaction retains host provenance", {
  skip: process.env.SMART360_OPERATOR_DRAFT_DB_TEST !== "1",
}, async (t) => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const fixture = await createCanonicalOnboardingFixture();
  _setHostOnboardingDeliveryOverride(async () => ({
    ok: true, providerMessageId: "operator-publication-db-test",
  }));
  t.after(async () => {
    _setHostOnboardingDeliveryOverride(null);
    await cleanupCanonicalOnboardingFixture(fixture);
  });
  // Fixture seeding is privileged operator content. Begin this provenance
  // check at an owner-approved baseline, without any operator session.
  await db.update(tenantsTable).set({
    operatorDraftPending: false, hasUnpublishedChanges: false,
  }).where(eq(tenantsTable.id, fixture.tenantId));
  const opened = await currentHostOnboarding(fixture.tenantId, fixture.hostUserId);
  assert.ok(opened);
  const submitted = await runWithHostDbContext(fixture.tenantId, () =>
    actorStorage.run({
      kind: "host", hostUserId: fixture.hostUserId, tenantId: fixture.tenantId,
    }, () => submitHostOnboarding(
      fixture.tenantId, fixture.hostUserId,
      opened.round.round, opened.round.revision, opened.round.draftData,
      opened.canonicalRevision,
    )),
  );
  assert.equal(submitted.ok, true);
  const [after] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, fixture.tenantId));
  assert.equal(after!.hasUnpublishedChanges, true);
  assert.equal(after!.operatorDraftPending, false);
});