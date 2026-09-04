import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import {
  adminUsersTable,
  categoriesTable,
  creatorPlaceMaterializationsTable,
  creatorPlaceProposalsTable,
  creatorProposalProcessingFailuresTable,
  creatorProposalTranslationsTable,
  itemCategoryAttachmentsTable,
  creatorVerificationAttemptsTable,
  creatorVerificationCandidatesTable,
  db,
  itemsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import {
  approveCreatorProposalIndividually,
  approveCreatorProposalsBulk,
  confirmCreatorProposalCoordinates,
  CreatorBulkApprovalError,
  CreatorProposalValidationError,
  listCreatorProposalQueue,
  rejectCreatorProposalIndividually,
  recordCreatorVerification,
  runAndPersistCreatorSieve,
  upsertPendingCreatorProposal,
  unapproveCreatorProposal,
  undoCreatorProposalRejection,
} from "../lib/creatorProposalLedger";
import { reevaluateCreatorQueue } from "../lib/creatorQueueReevaluation";

const runIds = [crypto.randomUUID(), crypto.randomUUID()];
let tenantId = "";
let actorId = "";
let categoryId = "";
let secondCategoryId = "";
const proposalIds: string[] = [];

before(async () => {
  const [tenant] = await db.select({ id: tenantsTable.id })
    .from(tenantsTable)
    .innerJoin(sectionsTable, eq(sectionsTable.tenantId, tenantsTable.id))
    .innerJoin(categoriesTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .limit(1);
  const [actor] = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
  assert.ok(tenant, "development database needs one tenant");
  assert.ok(actor, "development database needs one admin user");
  tenantId = tenant.id;
  actorId = actor.id;
  const [category] = await db.select({ id: categoriesTable.id, sectionId: categoriesTable.sectionId })
    .from(categoriesTable)
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(eq(sectionsTable.tenantId, tenantId))
    .limit(1);
  assert.ok(category, "development tenant needs one category");
  categoryId = category.id;
  const [secondCategory] = await db.insert(categoriesTable).values({
    sectionId: category.sectionId,
    key: `creator-test-${crypto.randomUUID()}`,
    label: "Creator lifecycle test",
  }).returning({ id: categoriesTable.id });
  secondCategoryId = secondCategory.id;
});

async function makeMaterializable(proposalId: string) {
  await db.update(creatorPlaceProposalsTable).set({
    categoryId,
    range: "near",
  }).where(eq(creatorPlaceProposalsTable.id, proposalId));
  await db.insert(creatorProposalTranslationsTable).values(
    ["sl", "en", "de", "it"].map((language) => ({
      proposalId,
      language,
      name: `Materialized ${language}`,
      description: `Description ${language}`,
    })),
  ).onConflictDoNothing();
}

after(async () => {
  if (proposalIds.length > 0) {
    await db.delete(creatorProposalProcessingFailuresTable)
      .where(inArray(creatorProposalProcessingFailuresTable.proposalId, proposalIds));
  }
  await db.delete(creatorPlaceProposalsTable).where(and(
    inArray(creatorPlaceProposalsTable.runId, runIds),
    eq(creatorPlaceProposalsTable.status, "superseded"),
  ));
  await db.delete(creatorPlaceProposalsTable)
    .where(inArray(creatorPlaceProposalsTable.runId, runIds));
  if (proposalIds.length > 0) {
    await db.delete(creatorPlaceProposalsTable)
      .where(inArray(creatorPlaceProposalsTable.id, proposalIds));
  }
  if (secondCategoryId) {
    await db.delete(categoriesTable).where(eq(categoriesTable.id, secondCategoryId));
  }
});

test("pending-name upsert suppresses duplicates and shortened rows require individual approval", async () => {
  const unique = crypto.randomUUID().slice(0, 8);
  const originalQuery = `Snežna jama na Raduhi ${unique}`;
  const first = await upsertPendingCreatorProposal({
    tenantId,
    runId: runIds[0]!,
    proposedName: originalQuery,
    originalQuery,
  });
  proposalIds.push(first.proposal.id);
  assert.equal(first.inserted, true);

  const duplicate = await upsertPendingCreatorProposal({
    tenantId,
    runId: runIds[0]!,
    proposedName: originalQuery,
    originalQuery,
  });
  assert.equal(duplicate.inserted, false);
  assert.equal(duplicate.proposal.id, first.proposal.id);

  await recordCreatorVerification(tenantId, first.proposal.id, {
    originalQuery,
    confirmedQuery: `Snežna jama ${unique}`,
    confirmationMethod: "shortened_query",
    status: "pending",
    refusalReason: null,
    resolvedName: "Snežna jama",
    resolvedAddress: "Raduha, Slovenija",
    osmType: "node",
    osmId: 2_311_232_018,
    osmCategory: "natural",
    osmFeatureType: "cave_entrance",
    osmAddressType: "natural",
    latitude: 46.397811,
    longitude: 14.7416985,
    straightLineDistanceM: 16_051.9,
    attempts: [
      {
        attemptNumber: 1,
        query: originalQuery,
        verdict: "refused",
        refusalRule: "no-results",
        candidates: [],
      },
      {
        attemptNumber: 2,
        query: `Snežna jama ${unique}`,
        verdict: "resolved",
        refusalRule: null,
        candidates: [{
          osmType: "node",
          osmId: 2_311_232_018,
          osmCategory: "natural",
          osmFeatureType: "cave_entrance",
          osmAddressType: "natural",
          resolvedName: "Snežna jama",
          latitude: 46.397811,
          longitude: 14.7416985,
          straightLineDistanceM: 16_051.9,
          selected: true,
        }],
      },
    ],
  });

  const [stored] = await db.select().from(creatorPlaceProposalsTable)
    .where(eq(creatorPlaceProposalsTable.id, first.proposal.id));
  assert.equal(stored?.originalQuery, originalQuery);
  assert.equal(stored?.confirmedQuery, `Snežna jama ${unique}`);
  assert.equal(stored?.requiresIndividualReview, true);

  const attempts = await db.select().from(creatorVerificationAttemptsTable)
    .where(eq(creatorVerificationAttemptsTable.proposalId, first.proposal.id));
  assert.equal(attempts.length, 2);
  const attemptIds = attempts.map((row) => row.id);
  const candidates = await db.select().from(creatorVerificationCandidatesTable)
    .where(inArray(creatorVerificationCandidatesTable.attemptId, attemptIds));
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.selected, true);
  assert.equal(candidates[0]?.osmCategory, "natural");

  await assert.rejects(
    db.insert(creatorVerificationAttemptsTable).values({
      proposalId: first.proposal.id,
      attemptNumber: 3,
      query: "third-attempt-is-forbidden",
      verdict: "refused",
      refusalRule: "no-results",
    }),
  );
  const selectedAttempt = attempts.find((row) => row.attemptNumber === 2);
  assert.ok(selectedAttempt);
  await assert.rejects(
    db.insert(creatorVerificationCandidatesTable).values({
      attemptId: selectedAttempt.id,
      candidatePosition: 1,
      osmType: "node",
      osmId: 2_311_232_019,
      selected: true,
    }),
  );

  await assert.rejects(
    approveCreatorProposalsBulk(tenantId, [first.proposal.id], actorId),
    CreatorBulkApprovalError,
  );

  await db.update(creatorPlaceProposalsTable)
    .set({ contentReady: true, roadDistanceM: 12_000, travelDurationS: 1_200, range: "near" })
    .where(eq(creatorPlaceProposalsTable.id, first.proposal.id));
  await makeMaterializable(first.proposal.id);
  const approved = await approveCreatorProposalIndividually(
    tenantId,
    first.proposal.id,
    actorId,
  );
  assert.equal(approved.status, "approved");
  assert.equal(approved.reviewedBy, actorId);
  const [materialized] = await db.select().from(creatorPlaceMaterializationsTable)
    .where(eq(creatorPlaceMaterializationsTable.proposalId, first.proposal.id));
  assert.ok(materialized);
  const originalProvenance = materialized.provenanceJson;
  const originalEditorial = materialized.editorialJson;
  await db.update(creatorPlaceProposalsTable).set({
    resolvedAddress: "Spremenjen naslov za projekcijo",
  }).where(eq(creatorPlaceProposalsTable.id, first.proposal.id));
  const reapproved = await approveCreatorProposalIndividually(tenantId, first.proposal.id, actorId);
  assert.equal(reapproved.status, "approved");
  const materializedAgain = await db.select().from(creatorPlaceMaterializationsTable)
    .where(eq(creatorPlaceMaterializationsTable.proposalId, first.proposal.id));
  assert.equal(materializedAgain.length, 1);
  assert.equal(materializedAgain[0]?.provenanceJson, originalProvenance);
  assert.equal(materializedAgain[0]?.editorialJson, originalEditorial);

  const secondRunId = crypto.randomUUID();
  runIds.push(secondRunId);
  const [secondProposal] = await db.insert(creatorPlaceProposalsTable).values({
    tenantId,
    runId: secondRunId,
    proposedName: `Second category ${crypto.randomUUID()}`,
    normalizedName: `second-category-${crypto.randomUUID()}`,
    originalQuery: "Second category",
    confirmedQuery: reapproved.confirmedQuery,
    confirmationMethod: reapproved.confirmationMethod,
    status: "pending",
    resolvedName: reapproved.resolvedName,
    resolvedAddress: reapproved.resolvedAddress,
    osmType: reapproved.osmType,
    osmId: reapproved.osmId,
    osmCategory: reapproved.osmCategory,
    osmFeatureType: reapproved.osmFeatureType,
    osmAddressType: reapproved.osmAddressType,
    latitude: reapproved.latitude,
    longitude: reapproved.longitude,
    straightLineDistanceM: reapproved.straightLineDistanceM,
    roadDistanceM: reapproved.roadDistanceM,
    travelDurationS: reapproved.travelDurationS,
    categoryId: secondCategoryId,
    range: "near",
    contentReady: true,
  }).returning();
  proposalIds.push(secondProposal.id);
  await db.insert(creatorProposalTranslationsTable).values(
    ["sl", "en", "de", "it"].map((language) => ({
      proposalId: secondProposal.id,
      language,
      name: `Second ${language}`,
      description: `Second description ${language}`,
    })),
  );
  await approveCreatorProposalIndividually(tenantId, secondProposal.id, actorId);
  const twoMaterializations = await db.select().from(creatorPlaceMaterializationsTable)
    .where(inArray(creatorPlaceMaterializationsTable.proposalId, [first.proposal.id, secondProposal.id]));
  assert.equal(twoMaterializations.length, 2);
  assert.equal(new Set(twoMaterializations.map((row) => row.itemId)).size, 1);
  let attachments = await db.select().from(itemCategoryAttachmentsTable)
    .where(eq(itemCategoryAttachmentsTable.itemId, materialized.itemId));
  assert.deepEqual(new Set(attachments.map((row) => row.categoryId)), new Set([categoryId, secondCategoryId]));

  await rejectCreatorProposalIndividually(tenantId, first.proposal.id, actorId);
  attachments = await db.select().from(itemCategoryAttachmentsTable)
    .where(eq(itemCategoryAttachmentsTable.itemId, materialized.itemId));
  assert.deepEqual(attachments.map((row) => row.categoryId), [secondCategoryId]);
  const [survivingItem] = await db.select().from(itemsTable).where(eq(itemsTable.id, materialized.itemId));
  assert.equal(survivingItem?.isVisible, true);
  assert.equal(survivingItem?.categoryId, secondCategoryId);

  await undoCreatorProposalRejection(tenantId, first.proposal.id, actorId);
  attachments = await db.select().from(itemCategoryAttachmentsTable)
    .where(eq(itemCategoryAttachmentsTable.itemId, materialized.itemId));
  assert.deepEqual(new Set(attachments.map((row) => row.categoryId)), new Set([categoryId, secondCategoryId]));

  await unapproveCreatorProposal(tenantId, first.proposal.id, actorId);
  attachments = await db.select().from(itemCategoryAttachmentsTable)
    .where(eq(itemCategoryAttachmentsTable.itemId, materialized.itemId));
  assert.deepEqual(attachments.map((row) => row.categoryId), [secondCategoryId]);
  const [stillVisible] = await db.select({ isVisible: itemsTable.isVisible }).from(itemsTable)
    .where(eq(itemsTable.id, materialized.itemId));
  assert.equal(stillVisible?.isVisible, true);
  await unapproveCreatorProposal(tenantId, secondProposal.id, actorId);
  const [hidden] = await db.select({ isVisible: itemsTable.isVisible }).from(itemsTable)
    .where(eq(itemsTable.id, materialized.itemId));
  assert.equal(hidden?.isVisible, false);
});

test("database constraints reject invalid workflow values", async () => {
  const invalidRows = [
    { status: "aproved" },
    { confirmationMethod: "model_guess", confirmedQuery: "x" },
    { status: "approved" },
    { status: "unresolved" },
    { confirmationMethod: "shortened_query", confirmedQuery: "same", originalQuery: "same" },
    { osmType: "node", osmId: null },
  ];
  for (const invalid of invalidRows) {
    const name = `constraint-${crypto.randomUUID().slice(0, 8)}`;
    await assert.rejects(db.insert(creatorPlaceProposalsTable).values({
      tenantId,
      runId: runIds[0]!,
      proposedName: name,
      normalizedName: name,
      originalQuery: name,
      ...invalid,
    }));
    const rows = await db.select({ id: creatorPlaceProposalsTable.id })
      .from(creatorPlaceProposalsTable)
      .where(and(
        eq(creatorPlaceProposalsTable.tenantId, tenantId),
        eq(creatorPlaceProposalsTable.normalizedName, name),
      ));
    assert.equal(rows.length, 0);
  }
});

test("an unresolved rejection without an entity does not suppress a later same-name candidate", async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const proposedName = `Zavrnjeni kraj ${suffix}`;
  const first = await upsertPendingCreatorProposal({
    tenantId,
    runId: runIds[0]!,
    proposedName,
    originalQuery: proposedName,
  });
  proposalIds.push(first.proposal.id);
  await recordCreatorVerification(tenantId, first.proposal.id, {
    originalQuery: proposedName,
    confirmedQuery: null,
    confirmationMethod: null,
    status: "unresolved",
    refusalReason: "blocked-class-or-addresstype",
    resolvedName: null,
    resolvedAddress: null,
    osmType: null,
    osmId: null,
    osmCategory: null,
    osmFeatureType: null,
    osmAddressType: null,
    latitude: null,
    longitude: null,
    straightLineDistanceM: null,
    attempts: [{
      attemptNumber: 1,
      query: proposedName,
      verdict: "refused",
      refusalRule: "blocked-class-or-addresstype",
      candidates: [],
    }],
  });
  await db.update(creatorPlaceProposalsTable).set({
    status: "rejected",
    reviewedBy: actorId,
    reviewedAt: new Date(),
  }).where(eq(creatorPlaceProposalsTable.id, first.proposal.id));

  const rerun = await runAndPersistCreatorSieve({
    tenantId,
    runId: runIds[1]!,
    proposedName,
    origin: { latitude: 46.36, longitude: 14.73 },
    fetchFn: async () => new Response("[]", {
      status: 200, headers: { "content-type": "application/json" },
    }),
  });
  proposalIds.push(rerun.proposal.id);
  assert.equal(rerun.inserted, true);
  assert.notEqual(rerun.proposal.id, first.proposal.id);
  assert.equal(rerun.proposal.status, "unresolved");
});

test("the real sieve path persists shortened-query provenance and both attempts", async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const proposedName = `Snežna jama na Raduhi ${suffix}`;
  let calls = 0;
  const osmId = 3_000_000_000 + Math.floor(Math.random() * 100_000_000);
  const output = await runAndPersistCreatorSieve({
    tenantId,
    runId: runIds[1]!,
    proposedName,
    origin: { latitude: 46.36, longitude: 14.73 },
    fetchFn: async () => {
      calls += 1;
      return new Response(JSON.stringify(calls === 1 ? [] : [{
        osm_type: "node",
        osm_id: osmId,
        category: "natural",
        type: "cave_entrance",
        addresstype: "natural",
        name: "Snežna jama",
        display_name: "Snežna jama, Raduha, Slovenija",
        lat: "46.397811",
        lon: "14.7416985",
        namedetails: { name: "Snežna jama" },
        address: { municipality: "Luče" },
        importance: 0.5,
      }]), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  proposalIds.push(output.proposal.id);
  assert.equal(calls, 2);
  assert.equal(output.result?.verdict, "resolved");
  assert.equal(output.proposal.originalQuery, proposedName);
  assert.equal(output.proposal.confirmedQuery, "Snežna jama");
  assert.equal(output.proposal.confirmationMethod, "shortened_query");
  assert.equal(output.proposal.requiresIndividualReview, true);
  const attempts = await db.select().from(creatorVerificationAttemptsTable)
    .where(eq(creatorVerificationAttemptsTable.proposalId, output.proposal.id));
  assert.equal(attempts.length, 2);
});

test("a strict global confirmation always wins over a prepared near-ring candidate", async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const proposedName = `Mozirski gaj ${suffix}`;
  const globalOsmId = 3_100_000_000 + Math.floor(Math.random() * 100_000_000);
  let nearFallbackCalls = 0;
  const output = await runAndPersistCreatorSieve({
    tenantId,
    runId: runIds[1]!,
    proposedName,
    origin: { latitude: 46.31, longitude: 14.91 },
    nearFallback: async () => {
      nearFallbackCalls++;
      return {
        candidate: {
          osmType: "node",
          osmId: globalOsmId + 1,
          className: "tourism",
          type: "attraction",
          addresstype: "tourism",
          returnedName: proposedName,
          displayName: `${proposedName}, near catalogue`,
          latitude: 46.32,
          longitude: 14.92,
          distanceKm: 2,
        },
        route: { distanceMeters: 2_000, durationMinutes: 5 },
      };
    },
    fetchFn: async () => new Response(JSON.stringify([{
      osm_type: "way",
      osm_id: globalOsmId,
      category: "leisure",
      type: "park",
      addresstype: "leisure",
      name: proposedName,
      display_name: `${proposedName}, global sieve`,
      lat: "46.339",
      lon: "14.958",
      namedetails: { name: proposedName },
      address: { municipality: "Mozirje" },
      importance: 0.5,
    }]), { status: 200, headers: { "content-type": "application/json" } }),
  });
  proposalIds.push(output.proposal.id);
  assert.equal(output.result?.verdict, "resolved");
  if (output.result?.verdict === "resolved") {
    assert.equal(output.result.candidate.osmId, globalOsmId);
    assert.equal(output.result.confirmationMethod, "exact");
  }
  assert.equal(output.nearRingResolvedAfterGlobalSieveFailed, false);
  assert.equal(nearFallbackCalls, 0);
  assert.equal(output.nearRingRoute, null);
  assert.equal(output.proposal.osmId, globalOsmId);
  assert.equal(output.proposal.confirmationMethod, "exact");
});

test("near-ring resolution is used and marked only after the strict global sieve refuses", async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const proposedName = `Local catalogue place ${suffix}`;
  const nearOsmId = 3_200_000_000 + Math.floor(Math.random() * 100_000_000);
  const output = await runAndPersistCreatorSieve({
    tenantId,
    runId: runIds[1]!,
    proposedName,
    origin: { latitude: 46.31, longitude: 14.91 },
    nearFallback: async () => ({
      candidate: {
        osmType: "node",
        osmId: nearOsmId,
        className: "tourism",
        type: "attraction",
        addresstype: "tourism",
        returnedName: proposedName,
        displayName: `${proposedName}, local catalogue`,
        latitude: 46.32,
        longitude: 14.92,
        distanceKm: 2,
      },
      route: { distanceMeters: 2_000, durationMinutes: 5 },
    }),
    fetchFn: async () =>
      new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } }),
  });
  proposalIds.push(output.proposal.id);
  assert.equal(output.result?.verdict, "resolved");
  if (output.result?.verdict === "resolved") {
    assert.equal(output.result.candidate.osmId, nearOsmId);
    assert.equal(output.result.confirmationMethod, "overpass_near");
    assert.equal(output.result.attempts[0]?.verdict, "refused");
  }
  assert.equal(output.nearRingResolvedAfterGlobalSieveFailed, true);
  assert.deepEqual(output.nearRingRoute, { distanceMeters: 2_000, durationMinutes: 5 });
  assert.equal(output.proposal.osmId, nearOsmId);
  assert.equal(output.proposal.confirmationMethod, "overpass_near");
  const attempts = await db.select().from(creatorVerificationAttemptsTable)
    .where(eq(creatorVerificationAttemptsTable.proposalId, output.proposal.id));
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0]?.verdict, "refused");
});

test("operator coordinates require individual approval and cannot be overwritten", async () => {
  const [originalTenant] = await db.select({
    latitude: tenantsTable.latitude,
    longitude: tenantsTable.longitude,
  }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  await db.update(tenantsTable).set({
    latitude: 46.31,
    longitude: 14.91,
  }).where(eq(tenantsTable.id, tenantId));
  const proposedName = `Ročno potrjen kraj ${crypto.randomUUID().slice(0, 8)}`;
  const pending = await upsertPendingCreatorProposal({
    tenantId,
    runId: runIds[1]!,
    proposedName,
    originalQuery: proposedName,
    contentReady: true,
  });
  proposalIds.push(pending.proposal.id);
  assert.equal(pending.proposal.contentReady, false);
  await db.update(creatorPlaceProposalsTable).set({
    status: "unresolved",
    refusalReason: "no-results",
    contentReady: true,
    resolvedName: "Napačno ime iz Nominatima",
    resolvedAddress: "Napačen naslov iz Nominatima",
  }).where(eq(creatorPlaceProposalsTable.id, pending.proposal.id));
  await db.update(tenantsTable).set({
    latitude: null,
    longitude: null,
  }).where(eq(tenantsTable.id, tenantId));
  await assert.rejects(confirmCreatorProposalCoordinates({
    tenantId,
    proposalId: pending.proposal.id,
    actorId,
    latitude: 46.32,
    longitude: 14.92,
    operatorAddress: "Ljubenski most, pri reki Savinji",
  }), /Izhodišče nima koordinat/);
  const [unchangedAfterFailure] = await db.select().from(creatorPlaceProposalsTable)
    .where(eq(creatorPlaceProposalsTable.id, pending.proposal.id)).limit(1);
  assert.equal(unchangedAfterFailure?.confirmationMethod, null);
  assert.equal(unchangedAfterFailure?.operatorAddress, null);
  assert.equal(unchangedAfterFailure?.coordinateConfirmedAt, null);
  await db.update(tenantsTable).set({
    latitude: 46.31,
    longitude: 14.91,
  }).where(eq(tenantsTable.id, tenantId));
  await assert.rejects(confirmCreatorProposalCoordinates({
    tenantId,
    proposalId: pending.proposal.id,
    actorId,
    latitude: 46.32,
    longitude: 14.92,
    operatorAddress: "   ",
  }), /potrebuje naslov/);
  const positioned = await confirmCreatorProposalCoordinates({
    tenantId,
    proposalId: pending.proposal.id,
    actorId,
    latitude: 46.32,
    longitude: 14.92,
    operatorAddress: "Logarska dolina 9, Solčava",
    fetchFn: async () => new Response(JSON.stringify({
      routes: [{ distance: 120_000, duration: 6_000 }],
    }), { status: 200 }),
  });
  assert.equal(positioned?.confirmationMethod, "operator_coordinates");
  assert.equal(positioned?.osmId, null);
  assert.equal(positioned?.requiresIndividualReview, true);
  assert.equal(positioned?.status, "unresolved");
  assert.equal(positioned?.resolvedName, null);
  assert.equal(positioned?.resolvedAddress, null);
  assert.equal(positioned?.operatorAddress, "Logarska dolina 9, Solčava");
  await assert.rejects(confirmCreatorProposalCoordinates({
    tenantId,
    proposalId: pending.proposal.id,
    actorId,
    latitude: 46.33,
    longitude: 14.93,
    operatorAddress: "Logarska dolina 10, Solčava",
    fetchFn: async () => new Response(JSON.stringify({
      routes: [{ distance: 12_000, duration: 1_200 }],
    }), { status: 200 }),
  }), /Prvotno ročno določene točke ni mogoče prepisati/);
  const rerouted = await confirmCreatorProposalCoordinates({
    tenantId,
    proposalId: pending.proposal.id,
    actorId,
    latitude: 46.32,
    longitude: 14.92,
    operatorAddress: "Logarska dolina 9, Solčava",
    fetchFn: async () => new Response(JSON.stringify({
      routes: [{ distance: 12_000, duration: 1_200 }],
    }), { status: 200 }),
  });
  assert.equal(rerouted?.status, "pending");
  assert.equal(rerouted?.contentReady, false);
  await db.update(creatorPlaceProposalsTable).set({ categoryId })
    .where(eq(creatorPlaceProposalsTable.id, pending.proposal.id));
  const exactMissingLanguagesReason =
    "Predloga ni mogoče potrditi: manjkajo jeziki sl, en, de, it.";
  await assert.rejects(
    approveCreatorProposalIndividually(tenantId, pending.proposal.id, actorId),
    (error: unknown) => {
      assert.ok(error instanceof CreatorProposalValidationError);
      assert.equal(error.message, exactMissingLanguagesReason);
      return true;
    },
  );
  const [stillPending] = await db.select().from(creatorPlaceProposalsTable)
    .where(eq(creatorPlaceProposalsTable.id, pending.proposal.id)).limit(1);
  assert.equal(stillPending?.status, "pending");
  assert.equal(stillPending?.contentReady, false);
  const failedMaterializations = await db.select().from(creatorPlaceMaterializationsTable)
    .where(eq(creatorPlaceMaterializationsTable.proposalId, pending.proposal.id));
  assert.equal(failedMaterializations.length, 0);
  const approvalFailures = await db.select().from(creatorProposalProcessingFailuresTable)
    .where(and(
      eq(creatorProposalProcessingFailuresTable.proposalId, pending.proposal.id),
      eq(creatorProposalProcessingFailuresTable.operation, "approval"),
      eq(creatorProposalProcessingFailuresTable.stage, "validation"),
    ));
  assert.ok(approvalFailures.some((failure) => failure.reason === exactMissingLanguagesReason));
  assert.ok(approvalFailures.every((failure) => failure.actorId === actorId));
  assert.ok(approvalFailures.every((failure) => failure.actorType === "owner"));
  assert.ok(approvalFailures.every((failure) => failure.createdAt instanceof Date));
  const reevaluated = await reevaluateCreatorQueue(tenantId);
  assert.deepEqual(
    reevaluated.outcomes.find((outcome) => outcome.proposalId === pending.proposal.id),
    {
      proposalId: pending.proposal.id,
      proposedName,
      outcome: "failed",
      reason: exactMissingLanguagesReason,
    },
  );
  await assert.rejects(
    approveCreatorProposalsBulk(tenantId, [pending.proposal.id], actorId),
    CreatorBulkApprovalError,
  );
  await makeMaterializable(pending.proposal.id);
  await db.update(creatorPlaceProposalsTable).set({ operatorAddress: null })
    .where(eq(creatorPlaceProposalsTable.id, pending.proposal.id));
  await assert.rejects(
    approveCreatorProposalIndividually(tenantId, pending.proposal.id, actorId),
    /Manjka naslov, ki ga je operater potrdil ob ročni določitvi koordinat\./,
  );
  await db.update(creatorPlaceProposalsTable).set({
    operatorAddress: "Logarska dolina 9, Solčava",
  }).where(eq(creatorPlaceProposalsTable.id, pending.proposal.id));
  const approved = await approveCreatorProposalIndividually(
    tenantId,
    pending.proposal.id,
    actorId,
  );
  assert.equal(approved.status, "approved");
  assert.equal(approved.contentReady, true);
  const [materialized] = await db.select().from(creatorPlaceMaterializationsTable)
    .where(eq(creatorPlaceMaterializationsTable.proposalId, pending.proposal.id));
  assert.ok(materialized);
  await db.update(tenantsTable).set({
    latitude: originalTenant?.latitude ?? null,
    longitude: originalTenant?.longitude ?? null,
  }).where(eq(tenantsTable.id, tenantId));
});

test("two proposals may retain one OSM entity for later canonical materialization", async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const identity = 3_500_000_000 + Math.floor(Math.random() * 100_000_000);
  const firstRunId = crypto.randomUUID();
  const secondRunId = crypto.randomUUID();
  runIds.push(firstRunId, secondRunId);
  const firstName = `Motovun ${suffix}`;
  const secondName = `Motovun Old Town ${suffix}`;
  const fetchFn = async () => new Response(JSON.stringify([{
    osm_type: "relation",
    osm_id: identity,
    category: "tourism",
    type: "attraction",
    addresstype: "attraction",
    name: firstName,
    display_name: "Motovun, Istarska županija, Hrvatska",
    lat: "45.3366",
    lon: "13.8284",
    namedetails: { name: firstName, "name:en": secondName },
    address: { municipality: "Motovun" },
    importance: 0.5,
  }]), { status: 200, headers: { "content-type": "application/json" } });

  const first = await runAndPersistCreatorSieve({
    tenantId,
    runId: firstRunId,
    proposedName: firstName,
    origin: { latitude: 45.32, longitude: 13.84 },
    fetchFn,
  });
  await db.update(creatorPlaceProposalsTable).set({
    status: "rejected",
    reviewedBy: actorId,
    reviewedAt: new Date(),
    inclusionReason: "canonical-content-must-survive",
  }).where(eq(creatorPlaceProposalsTable.id, first.proposal.id));
  await db.insert(creatorProposalTranslationsTable).values(
    ["sl", "en", "de", "it"].map((language) => ({
      proposalId: first.proposal.id,
      language,
      name: `canonical-${language}`,
      description: `canonical-description-${language}`,
    })),
  );
  await db.update(creatorPlaceProposalsTable).set({ contentReady: true })
    .where(eq(creatorPlaceProposalsTable.id, first.proposal.id));
  const second = await runAndPersistCreatorSieve({
    tenantId,
    runId: secondRunId,
    proposedName: secondName,
    origin: { latitude: 45.32, longitude: 13.84 },
    fetchFn,
  });
  proposalIds.push(second.proposal.id);
  assert.notEqual(second.proposal.id, first.proposal.id);
  assert.equal(second.duplicate, false);

  const stored = await db.select().from(creatorPlaceProposalsTable)
    .where(inArray(creatorPlaceProposalsTable.runId, [firstRunId, secondRunId]));
  assert.equal(stored.length, 2);
  const canonical = stored.find((row) => row.runId === firstRunId)!;
  const duplicate = stored.find((row) => row.runId === secondRunId)!;
  assert.equal(canonical.osmId, identity);
  assert.equal(duplicate.osmId, identity);
  assert.equal(duplicate.status, "pending");
  await db.insert(creatorProposalTranslationsTable).values(
    ["sl", "en", "de", "it"].map((language) => ({
      proposalId: duplicate.id,
      language,
      name: `duplicate-${language}`,
      description: `duplicate-description-${language}`,
    })),
  );
  await db.update(creatorPlaceProposalsTable).set({ contentReady: true })
    .where(eq(creatorPlaceProposalsTable.id, duplicate.id));
  const [canonicalAfter] = await db.select().from(creatorPlaceProposalsTable)
    .where(eq(creatorPlaceProposalsTable.id, first.proposal.id));
  assert.equal(canonicalAfter?.status, "rejected");
  assert.equal(canonicalAfter?.inclusionReason, "canonical-content-must-survive");
  const canonicalTranslations = await db.select().from(creatorProposalTranslationsTable)
    .where(eq(creatorProposalTranslationsTable.proposalId, first.proposal.id));
  assert.deepEqual(
    canonicalTranslations.map((row) => row.description).sort(),
    ["de", "en", "it", "sl"].map((language) => `canonical-description-${language}`).sort(),
  );

  const rerun = await upsertPendingCreatorProposal({
    tenantId,
    runId: crypto.randomUUID(),
    proposedName: secondName,
    originalQuery: secondName,
  });
  proposalIds.push(rerun.proposal.id);
  assert.equal(rerun.inserted, true);
  assert.notEqual(rerun.proposal.id, canonical.id);

  const queue = await listCreatorProposalQueue(tenantId);
  const fixtureQueueRows = queue.filter((row) =>
    row.runId === firstRunId || row.runId === secondRunId);
  assert.deepEqual(fixtureQueueRows.map((row) => row.id).sort(), [canonical.id, duplicate.id].sort());
});