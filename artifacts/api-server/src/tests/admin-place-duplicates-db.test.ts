import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  adminUsersTable, categoriesTable, creatorCanonicalPlacesTable,
  creatorPlaceMaterializationsTable, creatorPlaceProposalsTable,
  creatorProposalTranslationsTable, db, itemsTable, sectionsTable, tenantsTable,
} from "@workspace/db";
import { adminPlaceDuplicateKeys } from "../lib/adminPlaceCreation";
import {
  approveCreatorProposalIndividually, CreatorBulkApprovalError,
  lockCreatorPlaceIdentity, normalizeCreatorProposalName,
} from "../lib/creatorProposalLedger";

let tenantId = "";
let proposalId = "";
let actorId = "";
let categoryId = "";
const raceProposalIds: string[] = [];
const raceItemIds: string[] = [];
const unique = `Rejected place ${crypto.randomUUID().slice(0, 8)}`;

before(async () => {
  const [tenant] = await db.select({ id: tenantsTable.id }).from(tenantsTable)
    .innerJoin(sectionsTable, eq(sectionsTable.tenantId, tenantsTable.id))
    .innerJoin(categoriesTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .limit(1);
  assert.ok(tenant, "development database needs one tenant");
  tenantId = tenant.id;
  const [category] = await db.select({ id: categoriesTable.id }).from(categoriesTable)
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(eq(sectionsTable.tenantId, tenantId)).limit(1);
  assert.ok(category, "development database needs one category");
  categoryId = category.id;
  const [actor] = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
  assert.ok(actor, "development database needs one admin user");
  actorId = actor.id;
  const [proposal] = await db.insert(creatorPlaceProposalsTable).values({
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
  }).returning({ id: creatorPlaceProposalsTable.id });
  proposalId = proposal.id;
});

after(async () => {
  if (proposalId) await db.delete(creatorPlaceProposalsTable)
    .where(eq(creatorPlaceProposalsTable.id, proposalId));
  if (raceProposalIds.length) {
    const materializations = await db.select({ itemId: creatorPlaceMaterializationsTable.itemId })
      .from(creatorPlaceMaterializationsTable)
      .where(inArray(creatorPlaceMaterializationsTable.proposalId, raceProposalIds));
    raceItemIds.push(...materializations.map((row) => row.itemId));
    await db.delete(creatorPlaceProposalsTable)
      .where(inArray(creatorPlaceProposalsTable.id, raceProposalIds));
    if (raceItemIds.length) {
      await db.delete(creatorCanonicalPlacesTable).where(inArray(creatorCanonicalPlacesTable.itemId, raceItemIds));
      await db.delete(itemsTable).where(inArray(itemsTable.id, raceItemIds));
    }
  }
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

test("concurrent different identities with one normalized name materialize exactly once", async () => {
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
  assert.equal(outcomes.filter((row) => row.status === "fulfilled").length, 1);
  const loser = outcomes.find((row) => row.status === "rejected");
  assert.equal(loser?.status, "rejected");
  if (loser?.status === "rejected") assert.ok(loser.reason instanceof CreatorBulkApprovalError);
  const materialized = await db.select({ id: creatorPlaceMaterializationsTable.id })
    .from(creatorPlaceMaterializationsTable)
    .where(inArray(creatorPlaceMaterializationsTable.proposalId, raceProposalIds));
  assert.equal(materialized.length, 1);
});