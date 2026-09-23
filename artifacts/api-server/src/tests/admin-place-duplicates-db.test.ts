import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  adminUsersTable, categoriesTable,
  creatorPlaceMaterializationsTable, creatorPlaceProposalsTable,
  creatorProposalTranslationsTable, creatorRunsTable, db, itemsTable, sectionsTable, tenantsTable,
} from "@workspace/db";
import { AdminPlaceConflictError, adminPlaceConflictResponse, adminPlaceDuplicateKeys, createAdminPlace } from "../lib/adminPlaceCreation";
import {
  approveCreatorProposalIndividually,
  lockCreatorPlaceIdentity, normalizeCreatorProposalName,
} from "../lib/creatorProposalLedger";

let tenantId = "";
let actorId = "";
let categoryId = "";
const raceProposalIds: string[] = [];
const unique = `Rejected place ${crypto.randomUUID().slice(0, 8)}`;

before(async () => {
  // Entire test tree is disposable. Never attach proposals or items to a real tenant.
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `place-duplicate-test-${crypto.randomUUID()}`,
    name: "Disposable canonical place regression",
    isPublished: false,
    latitude: 46.31,
    longitude: 14.91,
  }).returning({ id: tenantsTable.id });
  tenantId = tenant.id;
  const [section] = await db.insert(sectionsTable).values({
    tenantId, key: "explore", title: "Okolica",
  }).returning({ id: sectionsTable.id });
  const [category] = await db.insert(categoriesTable).values({
    sectionId: section.id, label: "Naravna dediščina",
  }).returning({ id: categoriesTable.id });
  categoryId = category.id;
  const [actor] = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
  assert.ok(actor, "development database needs one admin user");
  actorId = actor.id;
  await db.insert(creatorPlaceProposalsTable).values({
    tenantId,
    runId: crypto.randomUUID(),
    proposedName: unique,
    normalizedName: normalizeCreatorProposalName(unique),
    originalQuery: unique,
    status: "rejected",
    refusalReason: "human-rejected",
    rejectionIdentity: `osm:node:${Date.now()}`,
    contentReady: true,
    osmType: "node",
    osmId: Date.now(),
    reviewedBy: actorId,
    reviewedAt: new Date(),
  });
});

after(async () => {
  if (tenantId) await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
});

test("rejected Creator proposals are not live place duplicates", async () => {
  const keys = await adminPlaceDuplicateKeys(tenantId);
  assert.equal(keys.names.has(normalizeCreatorProposalName(unique)), false);
});

test("shared creator identity locks serialize competing writers", async () => {
  const key = `coordinates:46.12345:14.12345:${crypto.randomUUID()}`;
  const name = normalizeCreatorProposalName(`lock ${crypto.randomUUID()}`);
  let firstLocked = false;
  let secondEntered = false;
  const first = db.transaction(async (tx) => {
    await lockCreatorPlaceIdentity(tx, tenantId, key, name);
    firstLocked = true;
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  while (!firstLocked) await new Promise((resolve) => setTimeout(resolve, 2));
  const second = db.transaction(async (tx) => {
    await lockCreatorPlaceIdentity(tx, tenantId, key, name);
    secondEntered = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(secondEntered, false);
  await Promise.all([first, second]);
  assert.equal(secondEntered, true);
});

test("Dodaj kraj silently resolves a matching pending Gril-style proposal atomically", async () => {
  // Real Gril naming, but exclusively on this disposable tenant.
  const name = "Logarska dolina";
  const [pending] = await db.insert(creatorPlaceProposalsTable).values({
    tenantId, categoryId, runId: crypto.randomUUID(), proposedName: name,
    normalizedName: normalizeCreatorProposalName(name),
    originalQuery: name, status: "pending", contentReady: true,
    latitude: 46.39555, longitude: 14.62222,
  }).returning({ id: creatorPlaceProposalsTable.id });
  const created = await createAdminPlace({
    categoryId, actorId,
    selection: {
      mode: "manual", name, locationText: "Lega pri kraju",
      latitude: 46.39555, longitude: 14.62222,
    },
  }, { route: async () => ({ distanceMeters: 3200, durationMinutes: 9 }) });
  const [resolved] = await db.select().from(creatorPlaceProposalsTable)
    .where(eq(creatorPlaceProposalsTable.id, pending.id));
  assert.equal(resolved?.status, "superseded");
  assert.equal(resolved?.supersededBy, created.id);
  const proposals = await db.select({ id: creatorPlaceProposalsTable.id })
    .from(creatorPlaceProposalsTable).where(eq(creatorPlaceProposalsTable.tenantId, tenantId));
  assert.equal(proposals.filter(row => row.id === pending.id).length, 1);
  assert.equal(proposals.length, 3, "one ordinary materialized place and one resolved hint");
});

test("concurrent different identities with one normalized name remain two distinct places", async () => {
  const uniqueName = `Race place ${crypto.randomUUID().slice(0, 8)}`;
  const normalizedName = normalizeCreatorProposalName(uniqueName);
  const rows = await db.insert(creatorPlaceProposalsTable).values([0, 1].map((index) => ({
    tenantId,
    runId: crypto.randomUUID(),
    categoryId,
    proposedName: uniqueName,
    normalizedName,
    originalQuery: uniqueName,
    confirmedQuery: uniqueName,
    confirmationMethod: "exact",
    contentReady: true,
    status: "pending",
    resolvedName: uniqueName,
    resolvedAddress: `${uniqueName}, Slovenija`,
    osmType: "node",
    osmId: Number(`${Date.now()}${index}`),
    osmCategory: "tourism",
    osmFeatureType: "attraction",
    osmAddressType: "tourism",
    latitude: 46.2 + index / 1000,
    longitude: 14.8 + index / 1000,
    straightLineDistanceM: 1000,
    roadDistanceM: 1200,
    travelDurationS: 600,
    range: "near",
  }))).returning();
  raceProposalIds.push(...rows.map((row) => row.id));
  await db.insert(creatorProposalTranslationsTable).values(rows.flatMap((row) =>
    ["sl", "en", "de", "it"].map((language) => ({
      proposalId: row.id, language, name: uniqueName, description: "",
    })),
  ));
  const outcomes = await Promise.allSettled(rows.map((row) =>
    approveCreatorProposalIndividually(tenantId, row.id, actorId),
  ));
  assert.equal(outcomes.filter((row) => row.status === "fulfilled").length, 2);
  const materialized = await db.select({
    id: creatorPlaceMaterializationsTable.id,
    itemId: creatorPlaceMaterializationsTable.itemId,
    proposalId: creatorPlaceMaterializationsTable.proposalId,
  })
    .from(creatorPlaceMaterializationsTable)
    .where(inArray(creatorPlaceMaterializationsTable.proposalId, raceProposalIds));
  assert.equal(materialized.length, 2);
  const original = rows[0]!;
  const itemId = materialized.find(row => row.proposalId === original.id)!.itemId;
  const selection = {
    mode: "manual" as const, name: uniqueName, locationText: "Obstoječi kraj",
    latitude: original.latitude!, longitude: original.longitude!,
  };
  await assert.rejects(createAdminPlace({ categoryId, actorId, selection }), (error: unknown) =>
    error instanceof AdminPlaceConflictError &&
    error.match.kind === "item" &&
    error.match.id === itemId &&
    error.match.categoryId === categoryId &&
    error.match.category === "Naravna dediščina" &&
    error.match.name === uniqueName &&
    error.match.hidden === false);
  await db.update(itemsTable).set({ deletedAt: new Date() }).where(eq(itemsTable.id, itemId));
  await assert.rejects(createAdminPlace({ categoryId, actorId, selection }), (error: unknown) =>
    error instanceof AdminPlaceConflictError &&
    error.match.kind === "archived" &&
    error.match.id === itemId &&
    error.match.category === "Naravna dediščina",
  );
  const [archived] = await db.select({ deletedAt: itemsTable.deletedAt })
    .from(itemsTable).where(eq(itemsTable.id, itemId));
  assert.ok(archived?.deletedAt, "duplicate creation must not resurrect an archived canonical item");
});