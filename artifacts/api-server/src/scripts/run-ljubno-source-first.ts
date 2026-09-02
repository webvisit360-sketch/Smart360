import {
  categoriesTable,
  creatorPlaceProposalsTable,
  creatorProposalTranslationsTable,
  creatorSourceCandidateFactsTable,
  creatorSourceContentsTable,
  creatorSourceCandidatesTable,
  creatorSourceFactsTable,
  creatorSourceRunSnapshotsTable,
  creatorSourceRunsTable,
  creatorSourcesTable,
  db,
  itemsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import {
  buildCreatorSourceCompositeDocument,
  chunkCreatorSourceText,
  extractGroundedCreatorSourceFacts,
  routeGroundedCreatorSourceFactsToPages,
} from "../lib/creatorSourceModelExtraction";
import { createPacedNominatimFetch } from "../lib/creatorNominatimRetry";
import { crawlApprovedCreatorSource } from "../lib/creatorSourceReader";
import {
  normalizeCreatorProposalName,
  runAndPersistCreatorSieve,
  upsertPendingCreatorProposal,
} from "../lib/creatorProposalLedger";
import { computeRoadRoute } from "../lib/distanceEngine";
import {
  assertCreatorDevelopmentRunEnvironment,
  assertCreatorLjubnoTargetTenantId,
  CREATOR_LJUBNO_LEGACY_DEVELOPMENT_TENANT_ID,
  CREATOR_LJUBNO_PROTECTED_TENANT_IDS,
} from "../lib/creatorDevelopmentRunGuard";

const NAME = "Piknik prostor in kamp Gril";
const ADDRESS = "Ter 35, 3333 Ljubno ob Savinji";
const MUNICIPALITY = "Ljubno ob Savinji";
const LATITUDE = 46.3536005;
const LONGITUDE = 14.8509723;
const BLOCKED_URLS = ["https://www.logarska-solcavsko.si/", "https://www.recica.si/"] as const;
const REVOKED_URL = "https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3";
const REFERENCE_PLACES = [
  "Skakalni center Savina",
  "Golte",
  "Mozirski gaj",
  "Logarska dolina",
  "slap Rinka",
  "Snežna jama",
  "Robanov kot",
  "Muzej gozdarstva in lesarstva",
] as const;
const GROUNDING_REJECTION_REASONS = [
  "invalid_shape", "invalid_category", "missing_evidence", "unsupported_name",
  "unsupported_settlement", "metadata_noise", "duplicate",
] as const;
const RUN_LIMITS = {
  observedPages: 915,
  rawBytes: 64 * 1024 * 1024,
  extractedTextBytes: 48 * 1024 * 1024,
  modelChunks: 700,
  modelRequests: 700,
  inputTokens: 4_000_000,
  outputTokens: 250_000,
  acceptedFacts: 4_000,
  modelCostUsd: 10,
  elapsedMs: 60 * 60 * 1000,
} as const;
const MODEL_PAGE_BATCH_SIZE = 9;
const MODEL_CHUNK_CHARACTERS = 80_000;
const SOURCE_RAW_BYTES_PER_SEED = 4 * 1024 * 1024;
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
  "https://mozirje.si/",
  "https://visitsavinjska.com/mozirje/",
] as const;

type Evidence = {
  requestedUrl: string;
  finalUrl: string;
  snapshotSha256: string;
  observedAt: string;
  snapshotRetrievedAt: string;
};
type Report = {
  tenantId: string;
  replacedRunId: string;
  runId: string;
  approvedSeedCount: number;
  sourceCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  proposed: number;
  duplicateFactsMerged: number;
  sourceSnapshots: number;
  resolved: number;
  unresolved: number;
  failures: Record<string, number>;
  groundingRejections: Record<string, number>;
  modelUsage: { requests: number; chunks: number; inputTokens: number; outputTokens: number; costUsd: number };
  budgets: {
    limits: typeof RUN_LIMITS;
    usage: { observedPages: number; rawBytes: number; extractedTextBytes: number; modelChunks: number; modelRequests: number; inputTokens: number; outputTokens: number; acceptedFacts: number; modelCostUsd: number; elapsedMs: number };
    failure: { stage: string; limit: keyof typeof RUN_LIMITS; actual: number; maximum: number } | null;
  };
  reconciliation: {
    sourceDetails: number; uniqueSnapshots: number; persistedFacts: number;
    candidates: number; candidateFactLinks: number; runProposals: number;
    resolvedOutcomes: number; unresolvedOutcomes: number; pagesRead: number;
  } | null;
  error: string | null;
  ranges: Record<string, number>;
  referencePlaces: Array<{
    requestedName: string;
    status: "resolved" | "unresolved" | "not-extracted";
    matchedCandidate: string | null;
    failureReason: string | null;
  }>;
  sourceDetails: Array<{
    label: string; sourceUrl: string; pagesRead: number; factsAccepted: number;
    skipped: Array<{ url: string; reason: string }>;
    counters: { discoveredSubpages: number; selectedSubpages: number; attemptedPages: number; storedPages: number; skippedPages: number; rawBytes: number; extractedTextBytes: number; skipReasons: Record<string, number> };
    groundingRejections: Record<string, number>;
    pages: Array<{ requestedUrl: string; finalUrl: string; depth: number; snapshotSha256: string; observedAt: string; snapshotRetrievedAt: string; rawBytes: number; extractedTextBytes: number; factsAccepted: number; groundingRejections: Record<string, number>; evidence: Array<{ canonicalName: string; evidence: string }> }>;
    modelUsage: { requests: number; chunks: number; inputTokens: number; outputTokens: number; costUsd: number };
  }>;
  resolvedList: Array<{ name: string; settlement: string | null; category: string; range: string; roadDistanceM: number; travelDurationS: number; sources: Evidence[] }>;
  unresolvedList: Array<{ name: string; settlement: string | null; category: string; reason: string; sources: Evidence[] }>;
  nominatimStoppedReason: string | null;
  nominatimAttempts: ReturnType<ReturnType<typeof createPacedNominatimFetch>["attempts"]>;
};

function count(rows: Record<string, number>, key: string, amount = 1) {
  rows[key] = (rows[key] ?? 0) + amount;
}

function emptyGroundingRejections(): Record<string, number> {
  return Object.fromEntries(GROUNDING_REJECTION_REASONS.map(reason => [reason, 0]));
}

async function main() {
  assertCreatorDevelopmentRunEnvironment(process.env);
  const replacedRunId = process.env.REPLACE_CREATOR_SOURCE_RUN_ID;
  if (!replacedRunId) throw new Error("REPLACE_CREATOR_SOURCE_RUN_ID is required.");
  if (APPROVED_URLS.length !== 15) throw new Error("Exactly 15 approved source seeds are required.");

  const [tenant] = await db.select().from(tenantsTable).where(and(
    eq(tenantsTable.name, NAME), eq(tenantsTable.address, ADDRESS),
    eq(tenantsTable.municipality, MUNICIPALITY), eq(tenantsTable.latitude, LATITUDE),
    eq(tenantsTable.longitude, LONGITUDE), eq(tenantsTable.creatorDraft, true),
    eq(tenantsTable.isPublished, false),
    notInArray(tenantsTable.id, [...CREATOR_LJUBNO_PROTECTED_TENANT_IDS]),
  )).limit(1);
  if (!tenant) throw new Error("Exact unpublished Gril development tenant was not found.");
  assertCreatorLjubnoTargetTenantId(tenant.id);

  const replaceableRuns = await db.select({
    id: creatorSourceRunsTable.id,
    status: creatorSourceRunsTable.status,
  }).from(creatorSourceRunsTable).where(eq(creatorSourceRunsTable.tenantId, tenant.id));
  if (
    replaceableRuns.length !== 1 ||
    replaceableRuns[0]?.id !== replacedRunId ||
    !["completed", "failed"].includes(replaceableRuns[0]?.status ?? "")
  ) {
    throw new Error("REPLACE_CREATOR_SOURCE_RUN_ID must be the sole completed or failed source run for Gril.");
  }

  const decisionUrls = [...APPROVED_URLS, ...BLOCKED_URLS, REVOKED_URL];
  const sourceRows = await db.select().from(creatorSourcesTable).where(and(
    eq(creatorSourcesTable.municipality, MUNICIPALITY), inArray(creatorSourcesTable.canonicalUrl, decisionUrls),
  ));
  const sources = new Map(sourceRows.map(source => [source.canonicalUrl, source]));
  if (sourceRows.length !== 18 || decisionUrls.some(url => !sources.has(url))) {
    throw new Error("The exact 15 approved, 2 rejected, 1 revoked source decision set is not present.");
  }
  if (
    APPROVED_URLS.some(url => sources.get(url)?.status !== "approved") ||
    BLOCKED_URLS.some(url => sources.get(url)?.status !== "rejected") ||
    !["approved", "revoked"].includes(sources.get(REVOKED_URL)?.status ?? "")
  ) throw new Error("Source decisions do not match the required approved/rejected/revocation boundary.");

  const protectedProposalCount = await db.select({ count: sql<number>`count(*)::int` })
    .from(creatorPlaceProposalsTable)
    .where(eq(creatorPlaceProposalsTable.tenantId, CREATOR_LJUBNO_LEGACY_DEVELOPMENT_TENANT_ID));
  if ((protectedProposalCount[0]?.count ?? 0) !== 60) {
    throw new Error("Protected legacy development tenant must still have exactly 60 proposals.");
  }
  await db.transaction(async tx => {
    const revoked = await tx.update(creatorSourcesTable).set({
      status: "revoked",
      approvedBy: null,
      approvedAt: null,
    }).where(and(
      eq(creatorSourcesTable.id, sources.get(REVOKED_URL)!.id),
      eq(creatorSourcesTable.municipality, MUNICIPALITY),
    )).returning({ id: creatorSourcesTable.id });
    if (revoked.length !== 1) throw new Error("Kamniško-Savinjske source was not revoked atomically.");
    await tx.delete(creatorPlaceProposalsTable).where(and(
      eq(creatorPlaceProposalsTable.tenantId, tenant.id),
      eq(creatorPlaceProposalsTable.runId, replacedRunId),
    ));
    const deleted = await tx.delete(creatorSourceRunsTable).where(and(
      eq(creatorSourceRunsTable.id, replacedRunId),
      eq(creatorSourceRunsTable.tenantId, tenant.id),
      inArray(creatorSourceRunsTable.status, ["completed", "failed"]),
    )).returning({ id: creatorSourceRunsTable.id });
    if (deleted.length !== 1) throw new Error("Replacement source run was not deleted atomically.");
  });
  const [run] = await db.insert(creatorSourceRunsTable).values({ tenantId: tenant.id }).returning();
  if (!run) throw new Error("Replacement source run could not be created.");

  const report: Report = {
    tenantId: tenant.id, replacedRunId, runId: run.id, approvedSeedCount: APPROVED_URLS.length,
    sourceCounts: {}, categoryCounts: {}, proposed: 0, duplicateFactsMerged: 0, sourceSnapshots: 0,
    resolved: 0, unresolved: 0, failures: {}, groundingRejections: emptyGroundingRejections(),
    modelUsage: { requests: 0, chunks: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    budgets: {
      limits: RUN_LIMITS,
      usage: {
        observedPages: 0, rawBytes: 0, extractedTextBytes: 0,
        modelChunks: 0, modelRequests: 0, inputTokens: 0, outputTokens: 0,
        acceptedFacts: 0, modelCostUsd: 0, elapsedMs: 0,
      },
      failure: null,
    },
    reconciliation: null,
    error: null,
    ranges: {}, referencePlaces: [], sourceDetails: [], resolvedList: [], unresolvedList: [],
    nominatimStoppedReason: null, nominatimAttempts: [],
  };
  const startedAt = Date.now();
  const runDeadlineSignal = AbortSignal.timeout(RUN_LIMITS.elapsedMs);
  const enforceBudget = (stage: string) => {
    report.budgets.usage.elapsedMs = Date.now() - startedAt;
    for (const key of Object.keys(RUN_LIMITS) as Array<keyof typeof RUN_LIMITS>) {
      const actual = report.budgets.usage[key];
      const maximum = RUN_LIMITS[key];
      if (actual > maximum) {
        report.budgets.failure = { stage, limit: key, actual, maximum };
        throw new Error(`Run budget exceeded at ${stage}: ${key} ${actual} > ${maximum}`);
      }
    }
  };
  const persistProgress = async () => {
    await db.update(creatorSourceRunsTable).set({
      reportJson: JSON.stringify(report),
    }).where(and(
      eq(creatorSourceRunsTable.id, run.id),
      eq(creatorSourceRunsTable.status, "running"),
    ));
  };
  try {
    const candidateFacts = new Map<string, Array<typeof creatorSourceFactsTable.$inferSelect>>();
    const evidenceByCandidate = new Map<string, Evidence[]>();
    const factByIdentity = new Map<string, typeof creatorSourceFactsTable.$inferSelect>();
    const inFlight = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    let progressWriteQueue = Promise.resolve();
    for (const url of APPROVED_URLS) {
      enforceBudget(`before crawl ${url}`);
      const source = sources.get(url)!;
      let sourceRawBytes = 0;
      let sourceBudgetHit = false;
      const crawl = await crawlApprovedCreatorSource(source.id, {
        getRemainingContentBytes: () => Math.max(0, Math.min(
          RUN_LIMITS.rawBytes - report.budgets.usage.rawBytes,
          RUN_LIMITS.extractedTextBytes - report.budgets.usage.extractedTextBytes,
          SOURCE_RAW_BYTES_PER_SEED - sourceRawBytes,
        )),
        onContentBudgetExceeded: ({ url: blockedUrl, remainingBytes }) => {
          const rawRemaining = RUN_LIMITS.rawBytes - report.budgets.usage.rawBytes;
          const textRemaining = RUN_LIMITS.extractedTextBytes - report.budgets.usage.extractedTextBytes;
          const sourceRemaining = SOURCE_RAW_BYTES_PER_SEED - sourceRawBytes;
          sourceBudgetHit = sourceRemaining <= Math.min(rawRemaining, textRemaining);
          if (sourceBudgetHit) return;
          const limit = rawRemaining <= textRemaining ? "rawBytes" : "extractedTextBytes";
          report.budgets.failure = {
            stage: `content stream ${blockedUrl}`,
            limit,
            actual: RUN_LIMITS[limit] - remainingBytes + 1,
            maximum: RUN_LIMITS[limit],
          };
        },
        shouldSkipRemainingOnContentBudgetExceeded: () => sourceBudgetHit,
        onContentRead: counters => {
          sourceRawBytes += counters.rawBytes;
          report.budgets.usage.observedPages += 1;
          report.budgets.usage.rawBytes += counters.rawBytes;
          report.budgets.usage.extractedTextBytes += counters.extractedTextBytes;
          enforceBudget(`content read ${url}`);
        },
      });
      const detail: Report["sourceDetails"][number] = {
        label: source.label, sourceUrl: url, pagesRead: crawl.counters.storedPages, factsAccepted: 0,
        skipped: crawl.pages.filter(page => page.status === "skipped").map(page => ({ url: page.url, reason: page.skipReason ?? "unknown" })),
        counters: crawl.counters, groundingRejections: emptyGroundingRejections(), pages: [],
        modelUsage: { requests: 0, chunks: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
      };
      report.sourceDetails.push(detail);
      await persistProgress();
      const storedPages = crawl.pages.filter(page =>
        page.status === "stored" && page.content && page.finalUrl && page.observedAt
      ).sort((a, b) => a.url.localeCompare(b.url) || a.depth - b.depth);
      for (let offset = 0; offset < storedPages.length; offset += MODEL_PAGE_BATCH_SIZE) {
        const batch = storedPages.slice(offset, offset + MODEL_PAGE_BATCH_SIZE);
        const compositePages = batch.map((page, index) => ({
          pageId: String(index),
          storedVisibleText: page.content!.extractedText,
        }));
        const compositeText = buildCreatorSourceCompositeDocument(compositePages);
        const expectedBatchChunks = chunkCreatorSourceText(compositeText, MODEL_CHUNK_CHARACTERS).length;
        if (report.budgets.usage.modelChunks + expectedBatchChunks > RUN_LIMITS.modelChunks) {
          const actual = report.budgets.usage.modelChunks + expectedBatchChunks;
          report.budgets.failure = { stage: `before model batch ${url}`, limit: "modelChunks", actual, maximum: RUN_LIMITS.modelChunks };
          throw new Error(`Run budget cannot reserve model batch chunks: ${actual} > ${RUN_LIMITS.modelChunks}`);
        }
        report.budgets.usage.modelChunks += expectedBatchChunks;
        enforceBudget(`before model batch ${url}`);
        const stageUrl = batch[0]!.url;
        let extraction: Awaited<ReturnType<typeof extractGroundedCreatorSourceFacts>>;
        try {
          extraction = await extractGroundedCreatorSourceFacts({
          storedVisibleText: compositeText,
          maxChunkCharacters: MODEL_CHUNK_CHARACTERS,
          signal: runDeadlineSignal,
          onModelAttemptStart: upperBound => {
            const checks = [
              ["modelRequests", report.budgets.usage.modelRequests + inFlight.requests + 1],
              ["inputTokens", report.budgets.usage.inputTokens + inFlight.inputTokens + upperBound.inputTokens],
              ["outputTokens", report.budgets.usage.outputTokens + inFlight.outputTokens + upperBound.outputTokens],
              ["modelCostUsd", report.budgets.usage.modelCostUsd + inFlight.costUsd + upperBound.costUsd],
            ] as const;
            for (const [limit, actual] of checks) {
              if (actual > RUN_LIMITS[limit]) {
                report.budgets.failure = { stage: `before composite model attempt ${stageUrl}`, limit, actual, maximum: RUN_LIMITS[limit] };
                throw new Error(`Run budget cannot reserve another model attempt: ${limit} ${actual} > ${RUN_LIMITS[limit]}`);
              }
            }
            inFlight.requests++;
            inFlight.inputTokens += upperBound.inputTokens;
            inFlight.outputTokens += upperBound.outputTokens;
            inFlight.costUsd += upperBound.costUsd;
            return { upperBound };
          },
          onModelAttemptFinish: ({ reservation, upperBound, usage }) => {
            if (reservation.upperBound !== upperBound) throw new Error("Model attempt reservation mismatch.");
            inFlight.requests--;
            inFlight.inputTokens -= upperBound.inputTokens;
            inFlight.outputTokens -= upperBound.outputTokens;
            inFlight.costUsd -= upperBound.costUsd;
            if (Math.abs(inFlight.costUsd) < 1e-12) inFlight.costUsd = 0;
            if (inFlight.requests < 0 || inFlight.inputTokens < 0 || inFlight.outputTokens < 0 || inFlight.costUsd < 0) {
              throw new Error("Model attempt reservation underflow.");
            }
            report.budgets.usage.modelRequests++;
            report.budgets.usage.inputTokens += usage.inputTokens;
            report.budgets.usage.outputTokens += usage.outputTokens;
            report.budgets.usage.modelCostUsd += usage.costUsd;
            report.modelUsage.requests++;
            report.modelUsage.inputTokens += usage.inputTokens;
            report.modelUsage.outputTokens += usage.outputTokens;
            report.modelUsage.costUsd += usage.costUsd;
            enforceBudget(`after composite model attempt ${stageUrl}`);
            progressWriteQueue = progressWriteQueue.then(persistProgress);
          },
          });
        } catch (error) {
          await progressWriteQueue;
          throw error;
        }
        await progressWriteQueue;
        if (inFlight.requests || inFlight.inputTokens || inFlight.outputTokens || inFlight.costUsd) {
          throw new Error("Model attempt reservations were not fully released.");
        }
        if (extraction.requestCount < extraction.chunkCount || extraction.inputTokens <= 0) {
          throw new Error(`Composite model usage telemetry is incomplete for ${stageUrl}`);
        }
        detail.modelUsage.requests += extraction.requestCount;
        detail.modelUsage.chunks += extraction.chunkCount;
        detail.modelUsage.inputTokens += extraction.inputTokens;
        detail.modelUsage.outputTokens += extraction.outputTokens;
        detail.modelUsage.costUsd += extraction.costUsd;
        report.modelUsage.chunks += extraction.chunkCount;
        for (const [reason, rejected] of Object.entries(extraction.rejectionCounts)) {
          count(report.groundingRejections, reason, rejected);
          count(detail.groundingRejections, reason, rejected);
        }
        const routed = routeGroundedCreatorSourceFactsToPages(compositePages, extraction.facts);
        for (const [index, page] of batch.entries()) {
        const pageFacts = routed[index]!.facts;
        if (!page.content || !page.finalUrl || !page.observedAt) continue;
        if (!page.content.rawContent) throw new Error(`Exact response body is unavailable for ${page.url}`);
        const attached = await db.insert(creatorSourceRunSnapshotsTable)
          .values({ runId: run.id, sourceContentId: page.content.id })
          .onConflictDoNothing()
          .returning({ runId: creatorSourceRunSnapshotsTable.runId });
        report.sourceSnapshots += attached.length;
        report.budgets.usage.acceptedFacts += pageFacts.length;
        enforceBudget(`after composite routing ${page.url}`);
        const evidence: Evidence = {
          requestedUrl: page.url, finalUrl: page.finalUrl,
          snapshotSha256: page.content.contentSha256,
          observedAt: page.observedAt.toISOString(),
          snapshotRetrievedAt: page.content.retrievedAt.toISOString(),
        };
        const pageRejections = emptyGroundingRejections();
        if (index === 0) {
          for (const [reason, rejected] of Object.entries(extraction.rejectionCounts)) {
            count(pageRejections, reason, rejected);
          }
        }
        detail.pages.push({
          requestedUrl: page.url, finalUrl: page.finalUrl, depth: page.depth,
          snapshotSha256: evidence.snapshotSha256, observedAt: evidence.observedAt,
          snapshotRetrievedAt: evidence.snapshotRetrievedAt,
          rawBytes: page.counters.rawBytes, extractedTextBytes: page.counters.extractedTextBytes,
          factsAccepted: pageFacts.length,
          groundingRejections: pageRejections,
          evidence: pageFacts.map(fact => ({ canonicalName: fact.canonicalName, evidence: fact.evidence })),
        });
        detail.factsAccepted += pageFacts.length;
        for (const fact of pageFacts) {
          const identity = [
            page.content.id,
            fact.canonicalName,
            fact.settlement ?? "",
            fact.categoryKey,
          ].join("\u0000");
          let stored = factByIdentity.get(identity);
          if (!stored) {
            [stored] = await db.insert(creatorSourceFactsTable).values({
              runId: run.id, sourceContentId: page.content.id, placeName: fact.canonicalName,
              settlement: fact.settlement, categoryKey: fact.categoryKey, sourceUrl: page.finalUrl,
              retrievedAt: page.observedAt,
            }).returning();
            if (!stored) throw new Error("Grounded source fact was not stored.");
            factByIdentity.set(identity, stored);
          }
          const normalized = normalizeCreatorProposalName(fact.canonicalName);
          evidenceByCandidate.set(normalized, [...(evidenceByCandidate.get(normalized) ?? []), evidence]);
          const existing = candidateFacts.get(normalized) ?? [];
          if (!existing.some(existingFact => existingFact.id === stored.id)) {
            candidateFacts.set(normalized, [...existing, stored]);
          }
          count(report.sourceCounts, source.label);
          count(report.categoryCounts, fact.categoryKey);
        }
        await persistProgress();
      }
    }
    }
    report.proposed = candidateFacts.size;
    report.duplicateFactsMerged = [...candidateFacts.values()].reduce((total, facts) => total + facts.length, 0) - candidateFacts.size;

    const categoryRows = await db.select({ id: categoriesTable.id, key: categoriesTable.key }).from(categoriesTable)
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .where(eq(sectionsTable.tenantId, tenant.id));
    const categoryByKey = new Map(categoryRows.flatMap(row => row.key ? [[row.key, row.id]] : []));
    const nominatim = createPacedNominatimFetch();
    for (const [normalizedName, facts] of candidateFacts) {
      enforceBudget(`before resolution ${normalizedName}`);
      const primary = facts[0]!;
      const factEvidence = evidenceByCandidate.get(normalizedName) ?? [];
      if (factEvidence.length === 0) throw new Error("Candidate page-level provenance is missing.");
      const [candidate] = await db.insert(creatorSourceCandidatesTable).values({
        runId: run.id, normalizedName, officialName: primary.placeName, settlement: primary.settlement, categoryKey: primary.categoryKey,
      }).returning();
      if (!candidate) throw new Error("Candidate was not stored.");
      await db.insert(creatorSourceCandidateFactsTable).values(facts.map(fact => ({ candidateId: candidate.id, factId: fact.id })));
      let proposal;
      let failure: string | null = null;
      if (nominatim.isStopped()) {
        proposal = (await upsertPendingCreatorProposal({ tenantId: tenant.id, runId: run.id, proposedName: primary.placeName, originalQuery: primary.placeName, contentReady: false })).proposal;
        failure = "nominatim-unavailable-not-attempted";
      } else {
        const result = await runAndPersistCreatorSieve({
          tenantId: tenant.id, runId: run.id, proposedName: primary.placeName, origin: { latitude: LATITUDE, longitude: LONGITUDE },
          hardCeilingKm: 120, contentReady: false, fetchFn: nominatim.fetchFn,
          lookupHint: primary.settlement ? `${primary.placeName}, ${primary.settlement}` : undefined,
        });
        proposal = result.sourceProposal;
        failure = result.result?.verdict === "resolved" ? null : result.result?.rule ?? "nominatim-unavailable";
        if (failure === "nominatim-unavailable") {
          nominatim.stop(nominatim.stopReason() ?? "Nominatim returned an unavailable result.");
          report.nominatimStoppedReason = nominatim.stopReason();
        }
      }
      const targetCategoryId = categoryByKey.get(primary.categoryKey);
      if (!targetCategoryId) throw new Error(`Creator category "${primary.categoryKey}" is missing from the tenant skeleton.`);
      if (!proposal) failure = "duplicate-ledger-conflict";
      if (!proposal || failure) {
        if (proposal) await db.update(creatorPlaceProposalsTable).set({
          categoryId: targetCategoryId, status: "unresolved", refusalReason: failure!, contentReady: false,
        }).where(and(eq(creatorPlaceProposalsTable.id, proposal.id), eq(creatorPlaceProposalsTable.tenantId, tenant.id), eq(creatorPlaceProposalsTable.runId, run.id)));
        await db.update(creatorSourceCandidatesTable).set({ proposalId: proposal?.id ?? null, outcome: "unresolved", failureReason: failure! })
          .where(and(eq(creatorSourceCandidatesTable.id, candidate.id), eq(creatorSourceCandidatesTable.runId, run.id)));
        report.unresolved++; count(report.failures, failure!);
        report.unresolvedList.push({ name: primary.placeName, settlement: primary.settlement, category: primary.categoryKey, reason: failure!, sources: factEvidence });
        report.nominatimAttempts = nominatim.attempts();
        await persistProgress();
        enforceBudget(`after resolution ${normalizedName}`);
        continue;
      }
      await db.update(creatorPlaceProposalsTable).set({
        categoryId: targetCategoryId,
        geocodingLookupHint: primary.settlement ? `${primary.placeName}, ${primary.settlement}` : null, inclusionReason: null,
      }).where(and(eq(creatorPlaceProposalsTable.id, proposal.id), eq(creatorPlaceProposalsTable.tenantId, tenant.id), eq(creatorPlaceProposalsTable.runId, run.id)));
      let route = await computeRoadRoute({ latitude: LATITUDE, longitude: LONGITUDE }, { latitude: proposal.latitude!, longitude: proposal.longitude! });
      failure = !route ? "osrm-unavailable" : route.distanceMeters > 120_000 ? "road-distance-ceiling" : Math.round(route.durationMinutes * 60) > 5_400 ? "duration-ceiling" : null;
      if (failure || !route) {
        await db.update(creatorPlaceProposalsTable).set({ status: "unresolved", refusalReason: failure ?? "osrm-unavailable", roadDistanceM: route?.distanceMeters ?? null, travelDurationS: route ? Math.round(route.durationMinutes * 60) : null, range: null, contentReady: false })
          .where(and(eq(creatorPlaceProposalsTable.id, proposal.id), eq(creatorPlaceProposalsTable.tenantId, tenant.id), eq(creatorPlaceProposalsTable.runId, run.id)));
        await db.update(creatorSourceCandidatesTable).set({ proposalId: proposal.id, outcome: "unresolved", failureReason: failure ?? "osrm-unavailable" }).where(eq(creatorSourceCandidatesTable.id, candidate.id));
        report.unresolved++; count(report.failures, failure ?? "osrm-unavailable");
        report.unresolvedList.push({ name: primary.placeName, settlement: primary.settlement, category: primary.categoryKey, reason: failure ?? "osrm-unavailable", sources: factEvidence });
        report.nominatimAttempts = nominatim.attempts();
        await persistProgress();
        enforceBudget(`after routing ${normalizedName}`);
        continue;
      }
      const range = route.durationMinutes <= 20 ? "near" : "excursion";
      await db.update(creatorPlaceProposalsTable).set({ roadDistanceM: route.distanceMeters, travelDurationS: Math.round(route.durationMinutes * 60), range, contentReady: false })
        .where(and(eq(creatorPlaceProposalsTable.id, proposal.id), eq(creatorPlaceProposalsTable.tenantId, tenant.id), eq(creatorPlaceProposalsTable.runId, run.id)));
      await db.update(creatorSourceCandidatesTable).set({ proposalId: proposal.id, outcome: "resolved", failureReason: null }).where(eq(creatorSourceCandidatesTable.id, candidate.id));
      report.resolved++; count(report.ranges, range);
      report.resolvedList.push({ name: primary.placeName, settlement: primary.settlement, category: primary.categoryKey, range, roadDistanceM: route.distanceMeters, travelDurationS: Math.round(route.durationMinutes * 60), sources: factEvidence });
      report.nominatimAttempts = nominatim.attempts();
      await persistProgress();
      enforceBudget(`after routing ${normalizedName}`);
    }
    const [translations, items, protectedAfter, disallowedSnapshots, disallowedFacts] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(creatorProposalTranslationsTable).innerJoin(creatorPlaceProposalsTable, eq(creatorProposalTranslationsTable.proposalId, creatorPlaceProposalsTable.id)).where(eq(creatorPlaceProposalsTable.tenantId, tenant.id)),
      db.select({ count: sql<number>`count(*)::int` }).from(itemsTable)
        .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
        .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
        .where(eq(sectionsTable.tenantId, tenant.id)),
      db.select({ count: sql<number>`count(*)::int` }).from(creatorPlaceProposalsTable)
        .where(eq(creatorPlaceProposalsTable.tenantId, CREATOR_LJUBNO_LEGACY_DEVELOPMENT_TENANT_ID)),
      db.select({ count: sql<number>`count(*)::int` }).from(creatorSourceRunSnapshotsTable)
        .innerJoin(creatorSourceContentsTable, eq(creatorSourceRunSnapshotsTable.sourceContentId, creatorSourceContentsTable.id))
        .innerJoin(creatorSourcesTable, eq(creatorSourceContentsTable.sourceId, creatorSourcesTable.id))
        .where(and(
          eq(creatorSourceRunSnapshotsTable.runId, run.id),
          inArray(creatorSourcesTable.canonicalUrl, [...BLOCKED_URLS, REVOKED_URL]),
        )),
      db.select({ count: sql<number>`count(*)::int` }).from(creatorSourceFactsTable)
        .innerJoin(creatorSourceContentsTable, eq(creatorSourceFactsTable.sourceContentId, creatorSourceContentsTable.id))
        .innerJoin(creatorSourcesTable, eq(creatorSourceContentsTable.sourceId, creatorSourcesTable.id))
        .where(and(
          eq(creatorSourceFactsTable.runId, run.id),
          inArray(creatorSourcesTable.canonicalUrl, [...BLOCKED_URLS, REVOKED_URL]),
        )),
    ]);
    if ((translations[0]?.count ?? 0) !== 0 || (items[0]?.count ?? 0) !== 0) throw new Error("Source-first run must not create translations or items.");
    if ((protectedAfter[0]?.count ?? 0) !== 60) throw new Error("Protected legacy development tenant proposal count changed.");
    if ((disallowedSnapshots[0]?.count ?? 0) !== 0 || (disallowedFacts[0]?.count ?? 0) !== 0) {
      throw new Error("A rejected or revoked source leaked into the replacement run.");
    }
    const [currentTenant, currentSource] = await Promise.all([
      db.select({ isPublished: tenantsTable.isPublished }).from(tenantsTable).where(eq(tenantsTable.id, tenant.id)).limit(1),
      db.select({ status: creatorSourcesTable.status }).from(creatorSourcesTable).where(eq(creatorSourcesTable.id, sources.get(REVOKED_URL)!.id)).limit(1),
    ]);
    if (currentTenant[0]?.isPublished !== false) throw new Error("Gril must remain unpublished.");
    if (currentSource[0]?.status !== "revoked") throw new Error("Kamniško-Savinjske source is not revoked.");
    const candidateByName = new Map<string, {
      name: string;
      status: "resolved" | "unresolved";
      failureReason: string | null;
    }>();
    for (const row of report.resolvedList) {
      candidateByName.set(normalizeCreatorProposalName(row.name), {
        name: row.name,
        status: "resolved",
        failureReason: null,
      });
    }
    for (const row of report.unresolvedList) {
      candidateByName.set(normalizeCreatorProposalName(row.name), {
        name: row.name,
        status: "unresolved",
        failureReason: row.reason,
      });
    }
    report.referencePlaces = REFERENCE_PLACES.map(requestedName => {
      const match = candidateByName.get(normalizeCreatorProposalName(requestedName));
      return {
        requestedName,
        status: match?.status ?? "not-extracted",
        matchedCandidate: match?.name ?? null,
        failureReason: match?.failureReason ?? null,
      };
    });
    report.sourceDetails.sort((a, b) => a.label.localeCompare(b.label, "sl"));
    report.resolvedList.sort((a, b) => a.name.localeCompare(b.name, "sl"));
    report.unresolvedList.sort((a, b) => a.name.localeCompare(b.name, "sl"));
    report.nominatimAttempts = nominatim.attempts();
    const [
      snapshotCount, factCount, candidateCount, candidateFactCount,
      proposalCount, resolvedCount, unresolvedCount, visibleProposalCount,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(creatorSourceRunSnapshotsTable)
        .where(eq(creatorSourceRunSnapshotsTable.runId, run.id)),
      db.select({ count: sql<number>`count(*)::int` }).from(creatorSourceFactsTable)
        .where(eq(creatorSourceFactsTable.runId, run.id)),
      db.select({ count: sql<number>`count(*)::int` }).from(creatorSourceCandidatesTable)
        .where(eq(creatorSourceCandidatesTable.runId, run.id)),
      db.select({ count: sql<number>`count(*)::int` }).from(creatorSourceCandidateFactsTable)
        .innerJoin(creatorSourceCandidatesTable, eq(creatorSourceCandidateFactsTable.candidateId, creatorSourceCandidatesTable.id))
        .where(eq(creatorSourceCandidatesTable.runId, run.id)),
      db.select({ count: sql<number>`count(*)::int` }).from(creatorPlaceProposalsTable)
        .where(and(eq(creatorPlaceProposalsTable.tenantId, tenant.id), eq(creatorPlaceProposalsTable.runId, run.id))),
      db.select({ count: sql<number>`count(*)::int` }).from(creatorSourceCandidatesTable)
        .where(and(eq(creatorSourceCandidatesTable.runId, run.id), eq(creatorSourceCandidatesTable.outcome, "resolved"))),
      db.select({ count: sql<number>`count(*)::int` }).from(creatorSourceCandidatesTable)
        .where(and(eq(creatorSourceCandidatesTable.runId, run.id), eq(creatorSourceCandidatesTable.outcome, "unresolved"))),
      db.select({ count: sql<number>`count(*)::int` }).from(creatorPlaceProposalsTable)
        .where(and(
          eq(creatorPlaceProposalsTable.tenantId, tenant.id),
          eq(creatorPlaceProposalsTable.runId, run.id),
          eq(creatorPlaceProposalsTable.contentReady, true),
        )),
    ]);
    report.reconciliation = {
      sourceDetails: report.sourceDetails.length,
      uniqueSnapshots: snapshotCount[0]?.count ?? 0,
      persistedFacts: factCount[0]?.count ?? 0,
      candidates: candidateCount[0]?.count ?? 0,
      candidateFactLinks: candidateFactCount[0]?.count ?? 0,
      runProposals: proposalCount[0]?.count ?? 0,
      resolvedOutcomes: resolvedCount[0]?.count ?? 0,
      unresolvedOutcomes: unresolvedCount[0]?.count ?? 0,
      pagesRead: report.sourceDetails.reduce((sum, source) => sum + source.pagesRead, 0),
    };
    const reconciliation = report.reconciliation;
    if (reconciliation.sourceDetails !== 15) throw new Error("Final reconciliation requires exactly 15 source details.");
    if (reconciliation.uniqueSnapshots !== report.sourceSnapshots) throw new Error("Final unique snapshot reconciliation failed.");
    if (reconciliation.persistedFacts !== factByIdentity.size) throw new Error("Final persisted fact reconciliation failed.");
    if (reconciliation.candidates !== report.proposed) throw new Error("Final candidate reconciliation failed.");
    if (reconciliation.candidateFactLinks !== [...candidateFacts.values()].reduce((sum, facts) => sum + facts.length, 0)) {
      throw new Error("Final candidate-fact link reconciliation failed.");
    }
    if (reconciliation.runProposals !== reconciliation.candidates) throw new Error("Final run proposal reconciliation failed.");
    if (reconciliation.candidateFactLinks !== reconciliation.persistedFacts) {
      throw new Error("Every persisted fact must have exactly one candidate link.");
    }
    if (reconciliation.resolvedOutcomes !== report.resolved || reconciliation.unresolvedOutcomes !== report.unresolved) {
      throw new Error("Final outcome reconciliation failed.");
    }
    if (reconciliation.resolvedOutcomes + reconciliation.unresolvedOutcomes !== reconciliation.candidates) {
      throw new Error("Resolved and unresolved outcomes must equal candidates.");
    }
    if (reconciliation.pagesRead !== report.budgets.usage.observedPages) throw new Error("Final page-read reconciliation failed.");
    if (report.sourceDetails.reduce((sum, source) => sum + source.factsAccepted, 0) !== report.budgets.usage.acceptedFacts) {
      throw new Error("Final accepted-fact budget reconciliation failed.");
    }
    if (
      report.modelUsage.chunks !== report.budgets.usage.modelChunks ||
      report.modelUsage.requests !== report.budgets.usage.modelRequests ||
      report.modelUsage.inputTokens !== report.budgets.usage.inputTokens ||
      report.modelUsage.outputTokens !== report.budgets.usage.outputTokens ||
      report.modelUsage.costUsd !== report.budgets.usage.modelCostUsd
    ) throw new Error("Final model-usage budget reconciliation failed.");
    if ((visibleProposalCount[0]?.count ?? 0) !== 0) throw new Error("Run proposals became visible before completion.");
    enforceBudget("before completion");
    await db.transaction(async tx => {
      const madeReady = await tx.update(creatorPlaceProposalsTable).set({ contentReady: true }).where(and(
        eq(creatorPlaceProposalsTable.tenantId, tenant.id),
        eq(creatorPlaceProposalsTable.runId, run.id),
        eq(creatorPlaceProposalsTable.contentReady, false),
      )).returning({ id: creatorPlaceProposalsTable.id });
      if (madeReady.length !== reconciliation.runProposals) {
        throw new Error("Final proposal visibility reconciliation failed.");
      }
      const completed = await tx.update(creatorSourceRunsTable).set({
        status: "completed", completedAt: new Date(), reportJson: JSON.stringify(report),
      }).where(and(
        eq(creatorSourceRunsTable.id, run.id),
        eq(creatorSourceRunsTable.status, "running"),
      )).returning({ id: creatorSourceRunsTable.id });
      if (completed.length !== 1) throw new Error("Source run completion reconciliation failed.");
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    report.budgets.usage.elapsedMs = Date.now() - startedAt;
    report.error = error instanceof Error ? error.message : String(error);
    await db.update(creatorSourceRunsTable).set({
      status: "failed", completedAt: new Date(), reportJson: JSON.stringify(report),
    }).where(eq(creatorSourceRunsTable.id, run.id));
    throw error;
  }
}

await main();