import crypto from "node:crypto";
import {
  adminUsersTable,
  categoriesTable,
  creatorPlaceProposalsTable,
  creatorProposalTranslationsTable,
  creatorSourceCandidateFactsTable,
  creatorSourceCandidatesTable,
  creatorSourceFactsTable,
  creatorSourceRunSnapshotsTable,
  creatorSourceRunsTable,
  creatorSourcesTable,
  db,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { extractCreatorSourceFacts } from "../lib/creatorSourceExtraction";
import { createPacedNominatimFetch } from "../lib/creatorNominatimRetry";
import { readApprovedCreatorSource } from "../lib/creatorSourceReader";
import {
  normalizeCreatorProposalName,
  runAndPersistCreatorSieve,
  upsertPendingCreatorProposal,
} from "../lib/creatorProposalLedger";
import { computeRoadRoute } from "../lib/distanceEngine";
import { seedTenantContent } from "../lib/tenantSeeds";
import {
  assertCreatorDevelopmentRunEnvironment,
  assertCreatorLjubnoTargetTenantId,
  CREATOR_LJUBNO_PROTECTED_TENANT_IDS,
} from "../lib/creatorDevelopmentRunGuard";

const NAME = "Piknik prostor in kamp Gril";
const ADDRESS = "Ter 35, 3333 Ljubno ob Savinji";
const MUNICIPALITY = "Ljubno ob Savinji";
const LATITUDE = 46.3536005;
const LONGITUDE = 14.8509723;
const BLOCKED_URLS = new Set([
  "https://www.logarska-solcavsko.si/",
  "https://www.recica.si/",
]);
const APPROVED_URLS = [
  "https://www.ljubno.si/",
  "https://visitsavinjska.com/ljubno-ob-savinji/",
  "https://visitsavinjska.com/savinjska-in-saleska-dolina/",
  "https://visitluce.si/",
  "https://www.luce.si/",
  "https://visitsavinjska.com/solcava/",
  "https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/",
  "https://www.solcava.si/",
  "https://www.gornji-grad.si/",
  "https://nazarje.si/",
  "https://visitsavinjska.com/recica-ob-savinji/",
  "https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315",
  "https://www.hribi.net/gora/smrekovec/3/485",
  "https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3",
  "https://mozirje.si/",
  "https://visitsavinjska.com/mozirje/",
] as const;

type Report = {
  tenantId: string;
  runId: string;
  sourceCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  proposed: number;
  duplicateFactsMerged: number;
  sourceSnapshots: number;
  resolved: number;
  unresolved: number;
  failures: Record<string, number>;
  ranges: Record<string, number>;
  resolvedList: Array<{
    name: string; settlement: string | null; category: string;
    range: string; roadDistanceM: number; travelDurationS: number;
    sources: Array<{ url: string; snapshotSha256: string; retrievedAt: string }>;
  }>;
  unresolvedList: Array<{
    name: string; settlement: string | null; category: string; reason: string;
    sources: Array<{ url: string; snapshotSha256: string; retrievedAt: string }>;
  }>;
  nominatimStoppedReason: string | null;
};

async function findOrCreateDraft(): Promise<string> {
  const [existing] = await db.select().from(tenantsTable).where(and(
    notInArray(tenantsTable.id, [...CREATOR_LJUBNO_PROTECTED_TENANT_IDS]),
    eq(tenantsTable.name, NAME),
    eq(tenantsTable.address, ADDRESS),
    eq(tenantsTable.municipality, MUNICIPALITY),
    eq(tenantsTable.latitude, LATITUDE),
    eq(tenantsTable.longitude, LONGITUDE),
    eq(tenantsTable.creatorDraft, true),
    eq(tenantsTable.isPublished, false),
  )).limit(1);
  if (existing) {
    return existing.id;
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('creator-source-first-ljubno-gril'))`);
    const slug = `piknik-prostor-in-kamp-gril-${crypto.randomUUID().slice(0, 8)}`;
    const [tenant] = await tx.insert(tenantsTable).values({
      slug, name: NAME, address: ADDRESS, latitude: LATITUDE, longitude: LONGITUDE,
      municipality: MUNICIPALITY, tenantType: "kamp", guestUiMode: "living-guide",
      creatorDraft: true, creatorOriginRegion: "Ljubno ob Savinji, Savinjska, Slovenija",
      isPublished: false, firstPublishedAt: null,
    }).returning({ id: tenantsTable.id });
    if (!tenant) throw new Error("Draft creation failed.");
    assertCreatorLjubnoTargetTenantId(tenant.id);
    await seedTenantContent(tenant.id, "kamp", tx);
    return tenant.id;
  });
}

async function main() {
  assertCreatorDevelopmentRunEnvironment(process.env);
  const [owner] = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
  if (!owner) throw new Error("Owner actor is missing.");
  const sources = await db.select().from(creatorSourcesTable).where(and(
    eq(creatorSourcesTable.municipality, MUNICIPALITY),
    inArray(creatorSourcesTable.canonicalUrl, [...APPROVED_URLS, ...BLOCKED_URLS]),
  ));
  const byUrl = new Map(sources.map((source) => [source.canonicalUrl, source]));
  const exactDecisionUrls = new Set([...APPROVED_URLS, ...BLOCKED_URLS]);
  if (
    sources.length !== exactDecisionUrls.size ||
    [...exactDecisionUrls].some((url) => !byUrl.has(url)) ||
    [...byUrl.keys()].some((url) => !exactDecisionUrls.has(url))
  ) {
    throw new Error("The exact 18-row owner source decision set is not present.");
  }
  const tenantId = await findOrCreateDraft();
  const [existingRun] = await db.select().from(creatorSourceRunsTable)
    .where(eq(creatorSourceRunsTable.tenantId, tenantId)).limit(1);
  if (existingRun) throw new Error("The isolated source-first draft has already been run.");

  const approvedAt = new Date();
  await db.transaction(async (tx) => {
    await tx.update(creatorSourcesTable).set({
      status: "approved", approvedBy: owner.id, approvedAt,
    }).where(and(
      eq(creatorSourcesTable.municipality, MUNICIPALITY),
      inArray(creatorSourcesTable.canonicalUrl, [...APPROVED_URLS]),
    ));
    await tx.update(creatorSourcesTable).set({
      status: "rejected", approvedBy: null, approvedAt: null,
    }).where(and(
      eq(creatorSourcesTable.municipality, MUNICIPALITY),
      inArray(creatorSourcesTable.canonicalUrl, [...BLOCKED_URLS]),
    ));
  });

  const [run] = await db.insert(creatorSourceRunsTable).values({ tenantId }).returning();
  if (!run) throw new Error("Source run could not be created.");

  const report: Report = {
    tenantId, runId: run.id, sourceCounts: {}, categoryCounts: {},
    proposed: 0, duplicateFactsMerged: 0, sourceSnapshots: 0,
    resolved: 0, unresolved: 0, failures: {}, ranges: {}, resolvedList: [],
    unresolvedList: [], nominatimStoppedReason: null,
  };
  try {
    const candidateFacts = new Map<string, Array<typeof creatorSourceFactsTable.$inferSelect>>();
    const snapshotEvidence = new Map<string, { url: string; sha256: string; retrievedAt: Date }>();
    for (const url of APPROVED_URLS) {
      const source = byUrl.get(url)!;
      const snapshot = await readApprovedCreatorSource(source.id);
      if (!snapshot.rawContent) throw new Error(`Exact response body is unavailable for ${url}`);
      snapshotEvidence.set(snapshot.id, {
        url: snapshot.finalUrl,
        sha256: snapshot.contentSha256,
        retrievedAt: snapshot.retrievedAt,
      });
      await db.insert(creatorSourceRunSnapshotsTable).values({
        runId: run.id,
        sourceContentId: snapshot.id,
      }).onConflictDoNothing();
      report.sourceSnapshots++;
      const facts = extractCreatorSourceFacts({
        sourceLabel: source.label, sourceKind: source.sourceKind,
        sourceUrl: source.canonicalUrl, rawContent: snapshot.rawContent,
      });
      report.sourceCounts[source.label] = facts.length;
      for (const fact of facts) {
        const [stored] = await db.insert(creatorSourceFactsTable).values({
          runId: run.id, sourceContentId: snapshot.id, ...fact,
          sourceUrl: snapshot.finalUrl, retrievedAt: snapshot.retrievedAt,
        }).returning();
        if (!stored) throw new Error("Source fact was not stored.");
        const normalized = normalizeCreatorProposalName(fact.placeName);
        candidateFacts.set(normalized, [...(candidateFacts.get(normalized) ?? []), stored]);
        report.categoryCounts[fact.categoryKey] = (report.categoryCounts[fact.categoryKey] ?? 0) + 1;
      }
    }
    report.proposed = candidateFacts.size;
    report.duplicateFactsMerged =
      [...candidateFacts.values()].reduce((sum, facts) => sum + facts.length, 0) -
      candidateFacts.size;

    const categoryRows = await db.select({
      id: categoriesTable.id, key: categoriesTable.key,
    }).from(categoriesTable).innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .where(eq(sectionsTable.tenantId, tenantId));
    const categoryByKey = new Map(categoryRows.flatMap((row) => row.key ? [[row.key, row.id]] : []));
    const nominatim = createPacedNominatimFetch();
    for (const [normalizedName, facts] of candidateFacts) {
      const primary = facts[0]!;
      const sources = facts.map((fact) => {
        const evidence = snapshotEvidence.get(fact.sourceContentId);
        if (!evidence) throw new Error("Candidate provenance snapshot is missing.");
        return {
          url: evidence.url,
          snapshotSha256: evidence.sha256,
          retrievedAt: evidence.retrievedAt.toISOString(),
        };
      });
      const [candidate] = await db.insert(creatorSourceCandidatesTable).values({
        runId: run.id, normalizedName, officialName: primary.placeName,
        settlement: primary.settlement, categoryKey: primary.categoryKey,
      }).returning();
      if (!candidate) throw new Error("Candidate was not stored.");
      await db.insert(creatorSourceCandidateFactsTable).values(
        facts.map((fact) => ({ candidateId: candidate.id, factId: fact.id })),
      );
      if (nominatim.isStopped()) {
        const pending = await upsertPendingCreatorProposal({
          tenantId,
          runId: run.id,
          proposedName: primary.placeName,
          originalQuery: primary.placeName,
          contentReady: true,
        });
        await db.update(creatorPlaceProposalsTable).set({
          categoryId: categoryByKey.get(primary.categoryKey) ?? null,
          geocodingLookupHint: primary.settlement ? `${primary.placeName}, ${primary.settlement}` : null,
          status: "unresolved",
          refusalReason: "nominatim-unavailable-not-attempted",
          contentReady: true,
        }).where(and(
          eq(creatorPlaceProposalsTable.id, pending.proposal.id),
          eq(creatorPlaceProposalsTable.tenantId, tenantId),
        ));
        await db.update(creatorSourceCandidatesTable).set({
          proposalId: pending.proposal.id,
          outcome: "unresolved",
          failureReason: "nominatim-unavailable-not-attempted",
        }).where(eq(creatorSourceCandidatesTable.id, candidate.id));
        report.unresolved++;
        report.failures["nominatim-unavailable-not-attempted"] =
          (report.failures["nominatim-unavailable-not-attempted"] ?? 0) + 1;
        report.unresolvedList.push({
          name: primary.placeName,
          settlement: primary.settlement,
          category: primary.categoryKey,
          reason: "nominatim-unavailable-not-attempted",
          sources,
        });
        continue;
      }
      const output = await runAndPersistCreatorSieve({
        tenantId, runId: run.id, proposedName: primary.placeName,
        origin: { latitude: LATITUDE, longitude: LONGITUDE },
        hardCeilingKm: 120, contentReady: true,
        fetchFn: nominatim.fetchFn,
        lookupHint: primary.settlement ? `${primary.placeName}, ${primary.settlement}` : undefined,
      });
      const proposal = output.sourceProposal;
      if (!proposal) {
        await db.update(creatorSourceCandidatesTable).set({
          outcome: "unresolved", failureReason: "duplicate-ledger-conflict",
        }).where(eq(creatorSourceCandidatesTable.id, candidate.id));
        report.unresolved++;
        report.failures["duplicate-ledger-conflict"] = (report.failures["duplicate-ledger-conflict"] ?? 0) + 1;
        report.unresolvedList.push({
          name: primary.placeName, settlement: primary.settlement,
          category: primary.categoryKey, reason: "duplicate-ledger-conflict", sources,
        });
        continue;
      }
      await db.update(creatorPlaceProposalsTable).set({
        categoryId: categoryByKey.get(primary.categoryKey) ?? null,
        geocodingLookupHint: primary.settlement ? `${primary.placeName}, ${primary.settlement}` : null,
        inclusionReason: null,
      }).where(and(eq(creatorPlaceProposalsTable.id, proposal.id), eq(creatorPlaceProposalsTable.tenantId, tenantId)));

      let failure = output.result?.verdict === "resolved" ? null : output.result?.rule ?? "nominatim-unavailable";
      if (failure === "nominatim-unavailable") {
        nominatim.stop(nominatim.stopReason() ?? "Nominatim returned an unavailable result.");
        report.nominatimStoppedReason = nominatim.stopReason();
      }
      let route: Awaited<ReturnType<typeof computeRoadRoute>> = null;
      if (!failure && output.result?.verdict === "resolved") {
        route = await computeRoadRoute(
          { latitude: LATITUDE, longitude: LONGITUDE },
          { latitude: output.result.candidate.latitude, longitude: output.result.candidate.longitude },
        );
        if (!route) failure = "osrm-unavailable";
        else if (route.distanceMeters > 120_000) failure = "road-distance-ceiling";
        else if (Math.round(route.durationMinutes * 60) > 5_400) failure = "duration-ceiling";
      }
      if (failure || !route) {
        const failureReason = failure ?? "osrm-unavailable";
        await db.update(creatorPlaceProposalsTable).set({
          status: "unresolved", refusalReason: failureReason,
          roadDistanceM: route?.distanceMeters ?? null,
          travelDurationS: route ? Math.round(route.durationMinutes * 60) : null,
          range: null, contentReady: true,
        }).where(and(eq(creatorPlaceProposalsTable.id, proposal.id), eq(creatorPlaceProposalsTable.tenantId, tenantId)));
        await db.update(creatorSourceCandidatesTable).set({
          proposalId: proposal.id, outcome: "unresolved", failureReason,
        }).where(eq(creatorSourceCandidatesTable.id, candidate.id));
        report.unresolved++;
        report.failures[failureReason] = (report.failures[failureReason] ?? 0) + 1;
        report.unresolvedList.push({
          name: primary.placeName, settlement: primary.settlement,
          category: primary.categoryKey, reason: failureReason, sources,
        });
        continue;
      }
      const range = route.durationMinutes <= 20 ? "near" : "excursion";
      await db.update(creatorPlaceProposalsTable).set({
        roadDistanceM: route.distanceMeters,
        travelDurationS: Math.round(route.durationMinutes * 60),
        range, contentReady: true,
      }).where(and(eq(creatorPlaceProposalsTable.id, proposal.id), eq(creatorPlaceProposalsTable.tenantId, tenantId)));
      await db.update(creatorSourceCandidatesTable).set({
        proposalId: proposal.id, outcome: "resolved", failureReason: null,
      }).where(eq(creatorSourceCandidatesTable.id, candidate.id));
      report.resolved++;
      report.ranges[range] = (report.ranges[range] ?? 0) + 1;
      report.resolvedList.push({
        name: primary.placeName, settlement: primary.settlement, category: primary.categoryKey,
        range, roadDistanceM: route.distanceMeters,
        travelDurationS: Math.round(route.durationMinutes * 60),
        sources,
      });
    }
    const translationCount = await db.select({ count: sql<number>`count(*)::int` })
      .from(creatorProposalTranslationsTable)
      .innerJoin(creatorPlaceProposalsTable, eq(creatorProposalTranslationsTable.proposalId, creatorPlaceProposalsTable.id))
      .where(eq(creatorPlaceProposalsTable.tenantId, tenantId));
    if ((translationCount[0]?.count ?? 0) !== 0) throw new Error("Source-first queue unexpectedly contains translations.");
    const [published] = await db.select({ isPublished: tenantsTable.isPublished }).from(tenantsTable)
      .where(and(
        eq(tenantsTable.id, tenantId),
        notInArray(tenantsTable.id, [...CREATOR_LJUBNO_PROTECTED_TENANT_IDS]),
      )).limit(1);
    if (!published || published.isPublished) throw new Error("Source-first draft publication guard failed.");
    report.resolvedList.sort((a, b) => a.name.localeCompare(b.name, "sl"));
    report.unresolvedList.sort((a, b) => a.name.localeCompare(b.name, "sl"));
    await db.update(creatorSourceRunsTable).set({
      status: "completed", completedAt: new Date(), reportJson: JSON.stringify(report),
    }).where(eq(creatorSourceRunsTable.id, run.id));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    await db.update(creatorSourceRunsTable).set({
      status: "failed", completedAt: new Date(),
      reportJson: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
    }).where(eq(creatorSourceRunsTable.id, run.id));
    throw error;
  }
}

await main();