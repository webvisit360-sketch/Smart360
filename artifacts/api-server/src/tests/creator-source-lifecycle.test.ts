import test from "node:test";
import assert from "node:assert/strict";
import {
  adminUsersTable,
  creatorRobotsEvidenceTable,
  creatorSourceContentsTable,
  creatorSourceRunsTable,
  creatorSourceRunSnapshotsTable,
  creatorSourcesTable,
  db,
  tenantsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  archiveCreatorSource,
  CreatorSourceRegistryError,
  decideCreatorSource,
  deleteCreatorSource,
  editCreatorSource,
  listCreatorSourcesForTenant,
} from "../lib/creatorSourceRegistry";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 as const }];

test("source deletion hides non-provenance rows without deleting evidence", async () => {
  const suffix = crypto.randomUUID();
  const municipality = `Lifecycle ${suffix}`;
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `source-lifecycle-${suffix}`,
    name: `Source lifecycle ${suffix}`,
    municipality,
  }).returning({ id: tenantsTable.id });
  const [source] = await db.insert(creatorSourcesTable).values({
    municipality,
    label: "Typo",
    sourceKind: "other",
    url: "https://example.com/typo",
    canonicalUrl: "https://example.com/typo",
  }).returning();
  assert.ok(tenant && source);

  try {
    await deleteCreatorSource({ tenantId: tenant.id, sourceId: source.id });
    assert.equal((await listCreatorSourcesForTenant(tenant.id)).length, 0);
    const [tombstone] = await db.select().from(creatorSourcesTable)
      .where(eq(creatorSourcesTable.id, source.id));
    assert.ok(tombstone?.deletedAt);
  } finally {
    await db.delete(creatorSourcesTable).where(eq(creatorSourcesTable.id, source.id));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
  }
});

test("completed-run source provenance cannot be deleted and can be archived", async () => {
  const suffix = crypto.randomUUID();
  const municipality = `Provenance ${suffix}`;
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `source-provenance-${suffix}`,
    name: `Source provenance ${suffix}`,
    municipality,
  }).returning({ id: tenantsTable.id });
  const [source] = await db.insert(creatorSourcesTable).values({
    municipality,
    label: "Historical source",
    sourceKind: "municipality",
    url: "https://example.com/history",
    canonicalUrl: "https://example.com/history",
    status: "revoked",
  }).returning();
  assert.ok(tenant && source);
  const [robots] = await db.insert(creatorRobotsEvidenceTable).values({
    sourceId: source.id,
    requestedRobotsUrl: "https://example.com/robots.txt",
    finalRobotsUrl: "https://example.com/robots.txt",
    userAgent: "Smart360Creator",
    decision: "allowed",
    allowed: true,
    httpStatus: 200,
    expiresAt: new Date(Date.now() + 60_000),
  }).returning();
  const [content] = await db.insert(creatorSourceContentsTable).values({
    sourceId: source.id,
    robotsEvidenceId: robots!.id,
    sourceUrl: source.url,
    finalUrl: source.url,
    httpStatus: 200,
    contentType: "text/html",
    rawContent: "<html>evidence</html>",
    extractedText: "evidence",
    contentSha256: crypto.randomUUID().replaceAll("-", ""),
  }).returning();
  const [run] = await db.insert(creatorSourceRunsTable).values({
    tenantId: tenant.id,
    status: "completed",
    completedAt: new Date(),
  }).returning();
  await db.insert(creatorSourceRunSnapshotsTable).values({
    runId: run!.id,
    sourceContentId: content!.id,
  });

  try {
    await assert.rejects(
      deleteCreatorSource({ tenantId: tenant.id, sourceId: source.id }),
      (error) => error instanceof CreatorSourceRegistryError && /provenance/i.test(error.message),
    );
    await assert.rejects(
      editCreatorSource({
        tenantId: tenant.id,
        sourceId: source.id,
        label: "Changed history",
        sourceKind: "other",
        url: "https://example.com/changed-history",
      }),
      (error) => error instanceof CreatorSourceRegistryError && /provenance/i.test(error.message),
    );
    const archived = await archiveCreatorSource({ tenantId: tenant.id, sourceId: source.id });
    assert.ok(archived?.archivedAt);
    assert.equal(archived?.hasCompletedProvenance, true);
  } finally {
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
    await db.delete(creatorSourceContentsTable).where(eq(creatorSourceContentsTable.sourceId, source.id));
    await db.delete(creatorSourcesTable).where(eq(creatorSourcesTable.id, source.id));
  }
});

test("editing a revoked source cleans tracking parameters and requires re-approval", async () => {
  const suffix = crypto.randomUUID();
  const municipality = `Edit ${suffix}`;
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `source-edit-${suffix}`,
    name: `Source edit ${suffix}`,
    municipality,
  }).returning({ id: tenantsTable.id });
  const [source] = await db.insert(creatorSourcesTable).values({
    municipality,
    label: "Old",
    sourceKind: "other",
    url: "https://example.com/old",
    canonicalUrl: "https://example.com/old",
    status: "revoked",
  }).returning();
  assert.ok(tenant && source);
  try {
    const edited = await editCreatorSource({
      tenantId: tenant.id,
      sourceId: source.id,
      label: "New label",
      sourceKind: "municipality",
      url: "https://example.com/new?utm_source=operator&fbclid=abc&lang=sl",
    }, {
      lookupFn: publicLookup,
      fetchFn: async () => new Response("", { status: 404 }),
    });
    assert.equal(edited?.status, "proposed");
    assert.equal(edited?.url, "https://example.com/new?lang=sl");
    assert.equal(edited?.canonicalUrl, "https://example.com/new?lang=sl");
    assert.equal(edited?.approvedAt, null);
  } finally {
    await db.delete(creatorSourcesTable).where(eq(creatorSourcesTable.id, source.id));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
  }
});

test("a duplicated revoke is idempotent and genuine transition errors explain the transition in Slovenian", async () => {
  const suffix = crypto.randomUUID();
  const municipality = `Transition ${suffix}`;
  const [actor] = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
  assert.ok(actor);
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `source-transition-${suffix}`,
    name: `Source transition ${suffix}`,
    municipality,
  }).returning({ id: tenantsTable.id });
  const [source] = await db.insert(creatorSourcesTable).values({
    municipality,
    label: "Transition source",
    sourceKind: "other",
    url: "https://example.com/transition",
    canonicalUrl: "https://example.com/transition",
    status: "approved",
    approvedBy: actor!.id,
    approvedAt: new Date(),
  }).returning();
  assert.ok(tenant && source);

  try {
    const revoked = await decideCreatorSource({
      tenantId: tenant.id,
      sourceId: source.id,
      decision: "revoke",
      actorId: actor.id,
    });
    assert.equal(revoked.status, "revoked");
    const duplicate = await decideCreatorSource({
      tenantId: tenant.id,
      sourceId: source.id,
      decision: "revoke",
      actorId: actor.id,
    });
    assert.equal(duplicate.status, "revoked");
    await assert.rejects(
      decideCreatorSource({
        tenantId: tenant.id,
        sourceId: source.id,
        decision: "approve",
        actorId: actor.id,
      }),
      (error) => error instanceof CreatorSourceRegistryError
        && error.message.includes("iz stanja »preklican« v stanje »odobren«")
        && error.message.includes("odobriti je mogoče samo predlagan vir"),
    );
  } finally {
    await db.delete(creatorSourcesTable).where(eq(creatorSourcesTable.id, source.id));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
  }
});