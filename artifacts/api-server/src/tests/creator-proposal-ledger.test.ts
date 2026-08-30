import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import {
  adminUsersTable,
  creatorPlaceProposalsTable,
  creatorProposalTranslationsTable,
  creatorVerificationAttemptsTable,
  creatorVerificationCandidatesTable,
  db,
  tenantsTable,
} from "@workspace/db";
import {
  approveCreatorProposalIndividually,
  approveCreatorProposalsBulk,
  confirmCreatorProposalCoordinates,
  CreatorBulkApprovalError,
  listCreatorProposalQueue,
  recordCreatorVerification,
  runAndPersistCreatorSieve,
  upsertPendingCreatorProposal,
} from "../lib/creatorProposalLedger";

const runIds = [crypto.randomUUID(), crypto.randomUUID()];
let tenantId = "";
let actorId = "";
const proposalIds: string[] = [];

before(async () => {
  const [tenant] = await db.select({ id: tenantsTable.id }).from(tenantsTable).limit(1);
  const [actor] = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
  assert.ok(tenant, "development database needs one tenant");
  assert.ok(actor, "development database needs one admin user");
  tenantId = tenant.id;
  actorId = actor.id;
});

after(async () => {
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
    .set({ contentReady: true, roadDistanceM: 12_000, travelDurationS: 1_200 })
    .where(eq(creatorPlaceProposalsTable.id, first.proposal.id));
  const approved = await approveCreatorProposalIndividually(
    tenantId,
    first.proposal.id,
    actorId,
  );
  assert.equal(approved.status, "approved");
  assert.equal(approved.reviewedBy, actorId);
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

test("a rejected unresolved name stays rejected on a later run", async () => {
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
    fetchFn: async () => {
      throw new Error("the sieve must not rerun a rejected name");
    },
  });
  assert.equal(rerun.inserted, false);
  assert.equal(rerun.result, null);
  assert.equal(rerun.proposal.id, first.proposal.id);
  assert.equal(rerun.proposal.status, "rejected");
  assert.equal(rerun.proposal.refusalReason, "blocked-class-or-addresstype");
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
  await db.update(creatorPlaceProposalsTable).set({
    status: "unresolved",
    refusalReason: "no-results",
    contentReady: true,
  }).where(eq(creatorPlaceProposalsTable.id, pending.proposal.id));
  const positioned = await confirmCreatorProposalCoordinates({
    tenantId,
    proposalId: pending.proposal.id,
    actorId,
    latitude: 46.32,
    longitude: 14.92,
    fetchFn: async () => new Response(JSON.stringify({
      routes: [{ distance: 120_000, duration: 6_000 }],
    }), { status: 200 }),
  });
  assert.equal(positioned?.confirmationMethod, "operator_coordinates");
  assert.equal(positioned?.osmId, null);
  assert.equal(positioned?.requiresIndividualReview, true);
  assert.equal(positioned?.status, "unresolved");
  await assert.rejects(confirmCreatorProposalCoordinates({
    tenantId,
    proposalId: pending.proposal.id,
    actorId,
    latitude: 46.33,
    longitude: 14.93,
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
    fetchFn: async () => new Response(JSON.stringify({
      routes: [{ distance: 12_000, duration: 1_200 }],
    }), { status: 200 }),
  });
  assert.equal(rerouted?.status, "pending");
  await assert.rejects(
    approveCreatorProposalsBulk(tenantId, [pending.proposal.id], actorId),
    CreatorBulkApprovalError,
  );
  const approved = await approveCreatorProposalIndividually(
    tenantId,
    pending.proposal.id,
    actorId,
  );
  assert.equal(approved.status, "approved");
  await db.update(tenantsTable).set({
    latitude: originalTenant?.latitude ?? null,
    longitude: originalTenant?.longitude ?? null,
  }).where(eq(tenantsTable.id, tenantId));
});

test("two names resolving to one OSM identity produce one queue row", async () => {
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
  const second = await runAndPersistCreatorSieve({
    tenantId,
    runId: secondRunId,
    proposedName: secondName,
    origin: { latitude: 45.32, longitude: 13.84 },
    fetchFn,
  });
  assert.equal(second.proposal.id, first.proposal.id);
  assert.equal(second.duplicate, true);
  assert.notEqual(second.sourceProposal?.id, first.proposal.id);

  const stored = await db.select().from(creatorPlaceProposalsTable)
    .where(inArray(creatorPlaceProposalsTable.runId, [firstRunId, secondRunId]));
  assert.equal(stored.length, 2);
  const canonical = stored.find((row) => row.runId === firstRunId);
  const duplicate = stored.find((row) => row.runId === secondRunId);
  assert.ok(canonical);
  assert.ok(duplicate);
  assert.equal(canonical.osmId, identity);
  assert.equal(duplicate.status, "superseded");
  assert.equal(duplicate.supersededBy, canonical.id);
  assert.equal(duplicate.proposedName, secondName);
  assert.equal(duplicate.osmId, null);
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
  assert.deepEqual(fixtureQueueRows.map((row) => row.id), [canonical.id]);
});