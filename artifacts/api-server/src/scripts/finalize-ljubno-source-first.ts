import {
  creatorPlaceProposalsTable,
  creatorProposalTranslationsTable,
  creatorSourceCandidateFactsTable,
  creatorSourceCandidatesTable,
  creatorSourceContentsTable,
  creatorSourceFactsTable,
  creatorSourceRunSnapshotsTable,
  creatorSourceRunsTable,
  creatorSourcesTable,
  db,
  tenantsTable,
} from "@workspace/db";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { computeRoadRoute } from "../lib/distanceEngine";
import {
  assertCreatorDevelopmentRunEnvironment,
  assertCreatorLjubnoTargetTenantId,
  CREATOR_LJUBNO_PROTECTED_TENANT_IDS,
} from "../lib/creatorDevelopmentRunGuard";

const NAME = "Piknik prostor in kamp Gril";
const LATITUDE = 46.3536005;
const LONGITUDE = 14.8509723;

assertCreatorDevelopmentRunEnvironment(process.env);
const targetTenantId = process.env.TARGET_TENANT_ID;
const targetRunId = process.env.TARGET_SOURCE_RUN_ID;
if (!targetTenantId || !targetRunId) {
  throw new Error("TARGET_TENANT_ID and TARGET_SOURCE_RUN_ID are required.");
}
assertCreatorLjubnoTargetTenantId(targetTenantId);
const [tenant] = await db.select().from(tenantsTable).where(and(
  eq(tenantsTable.id, targetTenantId),
  notInArray(tenantsTable.id, [...CREATOR_LJUBNO_PROTECTED_TENANT_IDS]),
  eq(tenantsTable.name, NAME),
  eq(tenantsTable.creatorDraft, true),
  eq(tenantsTable.isPublished, false),
)).limit(1);
if (!tenant || tenant.latitude !== LATITUDE || tenant.longitude !== LONGITUDE) {
  throw new Error("Exact isolated Ljubno draft was not found.");
}
const [run] = await db.select().from(creatorSourceRunsTable).where(and(
  eq(creatorSourceRunsTable.tenantId, tenant.id),
  eq(creatorSourceRunsTable.id, targetRunId),
  inArray(creatorSourceRunsTable.status, ["running", "completed"]),
)).limit(1);
if (!run) throw new Error("No interrupted source-first run is available to finalize.");

const pending = await db.select().from(creatorSourceCandidatesTable).where(and(
  eq(creatorSourceCandidatesTable.runId, run.id),
  eq(creatorSourceCandidatesTable.outcome, "pending"),
));
for (const candidate of pending) {
  const [proposal] = await db.select().from(creatorPlaceProposalsTable).where(and(
    eq(creatorPlaceProposalsTable.tenantId, tenant.id),
    eq(creatorPlaceProposalsTable.runId, run.id),
    eq(creatorPlaceProposalsTable.normalizedName, candidate.normalizedName),
  )).limit(1);
  if (!proposal) throw new Error(`Pending candidate has no proposal: ${candidate.officialName}`);
  let failure = proposal.status === "unresolved"
    ? proposal.refusalReason ?? "unconfirmed"
    : null;
  let route: Awaited<ReturnType<typeof computeRoadRoute>> = null;
  if (!failure && proposal.latitude !== null && proposal.longitude !== null) {
    route = await computeRoadRoute(
      { latitude: LATITUDE, longitude: LONGITUDE },
      { latitude: proposal.latitude, longitude: proposal.longitude },
    );
    if (!route) failure = "osrm-unavailable";
    else if (route.distanceMeters > 120_000) failure = "road-distance-ceiling";
    else if (Math.round(route.durationMinutes * 60) > 5_400) failure = "duration-ceiling";
  } else if (!failure) {
    failure = "missing-resolution-evidence";
  }
  if (failure || !route) {
    const reason = failure ?? "osrm-unavailable";
    await db.update(creatorPlaceProposalsTable).set({
      status: "unresolved", refusalReason: reason,
      roadDistanceM: route?.distanceMeters ?? proposal.roadDistanceM,
      travelDurationS: route ? Math.round(route.durationMinutes * 60) : proposal.travelDurationS,
      range: null, contentReady: true,
    }).where(and(
      eq(creatorPlaceProposalsTable.id, proposal.id),
      eq(creatorPlaceProposalsTable.tenantId, tenant.id),
    ));
    await db.update(creatorSourceCandidatesTable).set({
      proposalId: proposal.id, outcome: "unresolved", failureReason: reason,
    }).where(and(
      eq(creatorSourceCandidatesTable.id, candidate.id),
      eq(creatorSourceCandidatesTable.runId, run.id),
    ));
  } else {
    const range = route.durationMinutes <= 20 ? "near" : "excursion";
    await db.update(creatorPlaceProposalsTable).set({
      roadDistanceM: route.distanceMeters,
      travelDurationS: Math.round(route.durationMinutes * 60),
      range, contentReady: true,
    }).where(and(
      eq(creatorPlaceProposalsTable.id, proposal.id),
      eq(creatorPlaceProposalsTable.tenantId, tenant.id),
    ));
    await db.update(creatorSourceCandidatesTable).set({
      proposalId: proposal.id, outcome: "resolved", failureReason: null,
    }).where(and(
      eq(creatorSourceCandidatesTable.id, candidate.id),
      eq(creatorSourceCandidatesTable.runId, run.id),
    ));
  }
}

const facts = await db.select({
  id: creatorSourceFactsTable.id,
  candidateId: creatorSourceCandidateFactsTable.candidateId,
  sourceLabel: creatorSourcesTable.label,
  categoryKey: creatorSourceFactsTable.categoryKey,
  sourceUrl: creatorSourceFactsTable.sourceUrl,
  snapshotSha256: creatorSourceContentsTable.contentSha256,
  retrievedAt: creatorSourceFactsTable.retrievedAt,
}).from(creatorSourceFactsTable)
  .innerJoin(creatorSourceCandidateFactsTable, eq(creatorSourceCandidateFactsTable.factId, creatorSourceFactsTable.id))
  .innerJoin(creatorSourceContentsTable, eq(creatorSourceFactsTable.sourceContentId, creatorSourceContentsTable.id))
  .innerJoin(creatorSourcesTable, eq(creatorSourceContentsTable.sourceId, creatorSourcesTable.id))
  .where(eq(creatorSourceFactsTable.runId, run.id));
const candidateRows = await db.select({
  candidate: creatorSourceCandidatesTable,
  proposal: creatorPlaceProposalsTable,
}).from(creatorSourceCandidatesTable)
  .leftJoin(creatorPlaceProposalsTable, eq(creatorSourceCandidatesTable.proposalId, creatorPlaceProposalsTable.id))
  .where(eq(creatorSourceCandidatesTable.runId, run.id));

const sourceCounts: Record<string, number> = {};
const categoryCounts: Record<string, number> = {};
const runSources = await db.select({ label: creatorSourcesTable.label })
  .from(creatorSourceRunSnapshotsTable)
  .innerJoin(creatorSourceContentsTable, eq(creatorSourceRunSnapshotsTable.sourceContentId, creatorSourceContentsTable.id))
  .innerJoin(creatorSourcesTable, eq(creatorSourceContentsTable.sourceId, creatorSourcesTable.id))
  .where(eq(creatorSourceRunSnapshotsTable.runId, run.id));
for (const source of runSources) sourceCounts[source.label] = 0;
for (const fact of facts) {
  sourceCounts[fact.sourceLabel] = (sourceCounts[fact.sourceLabel] ?? 0) + 1;
  categoryCounts[fact.categoryKey] = (categoryCounts[fact.categoryKey] ?? 0) + 1;
}
const failures: Record<string, number> = {};
const ranges: Record<string, number> = {};
for (const { candidate, proposal } of candidateRows) {
  if (candidate.outcome === "unresolved") {
    const reason = candidate.failureReason ?? "unknown";
    failures[reason] = (failures[reason] ?? 0) + 1;
  }
  if (proposal?.range) ranges[proposal.range] = (ranges[proposal.range] ?? 0) + 1;
}
const resolvedList = candidateRows
  .filter((row) => row.candidate.outcome === "resolved" && row.proposal)
  .map(({ candidate, proposal }) => ({
    name: candidate.officialName,
    settlement: candidate.settlement,
    category: candidate.categoryKey,
    range: proposal!.range!,
    roadDistanceM: proposal!.roadDistanceM!,
    travelDurationS: proposal!.travelDurationS!,
    sources: facts.filter((fact) => fact.candidateId === candidate.id).map((fact) => ({
      url: fact.sourceUrl,
      snapshotSha256: fact.snapshotSha256,
      retrievedAt: fact.retrievedAt.toISOString(),
    })),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "sl"));

const proposalIds = candidateRows.flatMap(({ proposal }) => proposal ? [proposal.id] : []);
const translations = proposalIds.length === 0 ? [] : await db.select({
  id: creatorProposalTranslationsTable.id,
}).from(creatorProposalTranslationsTable)
  .where(inArray(creatorProposalTranslationsTable.proposalId, proposalIds));
if (translations.length !== 0) throw new Error("Source-first queue contains translation rows.");
const report = {
  tenantId: tenant.id,
  runId: run.id,
  sourceCounts,
  categoryCounts,
  proposed: candidateRows.length,
  duplicateFactsMerged: facts.length - candidateRows.length,
  sourceSnapshots: runSources.length,
  resolved: candidateRows.filter(({ candidate }) => candidate.outcome === "resolved").length,
  unresolved: candidateRows.filter(({ candidate }) => candidate.outcome === "unresolved").length,
  failures,
  ranges,
  resolvedList,
};
await db.update(creatorSourceRunsTable).set({
  status: "completed", completedAt: new Date(), reportJson: JSON.stringify(report),
}).where(eq(creatorSourceRunsTable.id, run.id));
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);