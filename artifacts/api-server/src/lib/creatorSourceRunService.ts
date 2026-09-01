import {
  categoriesTable,
  changelogTable,
  creatorPlaceProposalsTable,
  creatorSourceCandidateFactsTable,
  creatorSourceCandidatesTable,
  creatorSourceFactsTable,
  creatorSourceRunsTable,
  creatorSourceRunSnapshotsTable,
  creatorSourcesTable,
  db,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import pg from "pg";
import type { Client as PgClient } from "pg";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { logger } from "./logger";
import { createPacedNominatimFetch } from "./creatorNominatimRetry";
import {
  normalizeCreatorProposalName,
  runAndPersistCreatorSieve,
} from "./creatorProposalLedger";
import {
  buildCreatorSourceCompositeDocument,
  chunkCreatorSourceText,
  extractGroundedCreatorSourceFacts,
  routeGroundedCreatorSourceFactsToPages,
} from "./creatorSourceModelExtraction";
import { crawlApprovedCreatorSource } from "./creatorSourceReader";
import { computeRoadRoute } from "./distanceEngine";
import {
  CreatorSourceRegistryError,
  assertRunnableCreatorSourceStatuses,
  creatorSourceListFingerprint,
  normalizeCreatorMunicipality,
} from "./creatorSourceRegistry";

type SourceRunReport = {
  capturedSourceIds: string[];
  municipality: string;
  approvedSeedCount: number;
  pagesRead: number;
  facts: number;
  candidates: number;
  resolved: number;
  unresolved: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  error: string | null;
};

export type MunicipalityRunLease = {
  client: PgClient;
  lockKey: string;
  released: boolean;
};

export async function tryAcquireMunicipalityRunLease(
  municipality: string,
): Promise<MunicipalityRunLease | null> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const { Client } = pg;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const lockKey = `creator-municipality:${normalizeCreatorMunicipality(municipality)}`;
  try {
    await client.connect();
    const result = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
      [lockKey],
    );
    if (result.rows[0]?.acquired !== true) {
      await client.end();
      return null;
    }
    return { client, lockKey, released: false };
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
}

export async function releaseMunicipalityRunLease(
  lease: MunicipalityRunLease | undefined,
): Promise<void> {
  if (!lease || lease.released) return;
  lease.released = true;
  try {
    const result = await lease.client.query<{ released: boolean }>(
      "SELECT pg_advisory_unlock(hashtext($1)) AS released",
      [lease.lockKey],
    );
    if (result.rows[0]?.released !== true) {
      throw new Error("Municipality source-run advisory lease was not held.");
    }
    await lease.client.end();
  } catch (error) {
    await lease.client.end().catch(() => undefined);
    throw error;
  }
}
const RUN_LIMITS = {
  observedPages: 915, rawBytes: 64 * 1024 * 1024,
  extractedTextBytes: 48 * 1024 * 1024, modelChunks: 700,
  modelRequests: 700, inputTokens: 4_000_000, outputTokens: 250_000,
  acceptedFacts: 4_000, modelCostUsd: 10, elapsedMs: 60 * 60 * 1000,
} as const;
const SOURCE_RAW_BYTES_PER_SEED = 4 * 1024 * 1024;
const MODEL_PAGE_BATCH_SIZE = 9;
const MODEL_CHUNK_CHARACTERS = 80_000;
export const CREATOR_SOURCE_RUN_COMPOSITE_PAGE_SIZE = MODEL_PAGE_BATCH_SIZE;
export const CREATOR_SOURCE_RUN_COMPOSITE_CHARACTERS = MODEL_CHUNK_CHARACTERS;

export function buildCreatorSourceRunCompositeBatches(
  pageTexts: readonly string[],
) {
  const batches: Array<{
    offset: number;
    compositePages: Array<{ pageId: string; storedVisibleText: string }>;
    compositeText: string;
  }> = [];
  for (let offset = 0; offset < pageTexts.length; offset += MODEL_PAGE_BATCH_SIZE) {
    const compositePages = pageTexts
      .slice(offset, offset + MODEL_PAGE_BATCH_SIZE)
      .map((storedVisibleText, index) => ({ pageId: String(index), storedVisibleText }));
    batches.push({
      offset,
      compositePages,
      compositeText: buildCreatorSourceCompositeDocument(compositePages),
    });
  }
  return batches;
}

export function reserveCreatorSourceModelAttempt(
  committed: { modelRequests: number; inputTokens: number; outputTokens: number; modelCostUsd: number },
  inFlight: { requests: number; inputTokens: number; outputTokens: number; costUsd: number },
  upperBound: { inputTokens: number; outputTokens: number; costUsd: number },
) {
  if (
    committed.modelRequests + inFlight.requests + 1 > RUN_LIMITS.modelRequests
    || committed.inputTokens + inFlight.inputTokens + upperBound.inputTokens > RUN_LIMITS.inputTokens
    || committed.outputTokens + inFlight.outputTokens + upperBound.outputTokens > RUN_LIMITS.outputTokens
    || committed.modelCostUsd + inFlight.costUsd + upperBound.costUsd > RUN_LIMITS.modelCostUsd
  ) throw new Error("Run budget cannot reserve another model attempt.");
  inFlight.requests++;
  inFlight.inputTokens += upperBound.inputTokens;
  inFlight.outputTokens += upperBound.outputTokens;
  inFlight.costUsd += upperBound.costUsd;
  let released = false;
  return {
    upperBound,
    release(actual: { inputTokens: number; outputTokens: number; costUsd: number }) {
      if (released) throw new Error("Model reservation was already released.");
      released = true;
      inFlight.requests--;
      inFlight.inputTokens -= upperBound.inputTokens;
      inFlight.outputTokens -= upperBound.outputTokens;
      inFlight.costUsd -= upperBound.costUsd;
      if (inFlight.requests < 0 || inFlight.inputTokens < 0 || inFlight.outputTokens < 0 || inFlight.costUsd < -1e-9) {
        throw new Error("Model reservation underflow.");
      }
      if (Math.abs(inFlight.costUsd) < 1e-9) inFlight.costUsd = 0;
      committed.modelRequests++;
      committed.inputTokens += actual.inputTokens;
      committed.outputTokens += actual.outputTokens;
      committed.modelCostUsd += actual.costUsd;
    },
  };
}

export function serializeCreatorSourceRun(
  row: typeof creatorSourceRunsTable.$inferSelect,
) {
  let report: Record<string, unknown> | null = null;
  if (row.reportJson) {
    try {
      report = JSON.parse(row.reportJson) as Record<string, unknown>;
    } catch {
      report = null;
    }
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    status: row.status as "running" | "completed" | "failed",
    report,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    outcomes: [],
    unconfirmedByCategory: [],
  };
}

export async function latestCreatorSourceRun(tenantId: string) {
  const [row] = await db.select().from(creatorSourceRunsTable)
    .where(eq(creatorSourceRunsTable.tenantId, tenantId))
    .orderBy(desc(creatorSourceRunsTable.startedAt))
    .limit(1);
  return row ? serializeCreatorSourceRun(row) : null;
}

export async function startCreatorSourceRun(tenantId: string) {
  let lease: MunicipalityRunLease | undefined;
  let created;
  try {
    created = await db.transaction(async (tx) => {
    const globalLock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(
      hashtext(${"creator-source-runs:global-cap"})
    ) AS acquired`) as { rows?: Array<{ acquired: boolean }> };
    if (globalLock.rows?.[0]?.acquired !== true) {
      throw new CreatorSourceRegistryError(
        "Source-run capacity is currently being allocated; retry shortly.",
        "conflict",
      );
    }
    const [runningCount] = await tx.select({
      value: sql<number>`count(*)::int`,
    }).from(creatorSourceRunsTable)
      .where(eq(creatorSourceRunsTable.status, "running"));
    if ((runningCount?.value ?? 0) >= 3) {
      throw new CreatorSourceRegistryError(
        "At most three source-first runs may be active.",
        "conflict",
      );
    }
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`);
    const [tenant] = await tx.select({
      municipality: tenantsTable.municipality,
      latitude: tenantsTable.latitude,
      longitude: tenantsTable.longitude,
    }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
    if (!tenant || !tenant.municipality || tenant.latitude === null || tenant.longitude === null) {
      throw new CreatorSourceRegistryError("Tenant requires a confirmed origin and municipality before a run.", "not-found");
    }
    const municipality = normalizeCreatorMunicipality(tenant.municipality);
    lease = await tryAcquireMunicipalityRunLease(municipality) ?? undefined;
    if (!lease) throw new CreatorSourceRegistryError(
      "A source-first run is already active for this municipality.",
      "conflict",
    );
    const sources = await tx.select().from(creatorSourcesTable)
      .where(eq(creatorSourcesTable.municipality, municipality));
    assertRunnableCreatorSourceStatuses(sources.map((source) => source.status));
    const fingerprint = creatorSourceListFingerprint({ tenantId, municipality, sources });
    const [approval] = await tx.select({ id: changelogTable.id }).from(changelogTable)
      .where(and(
        eq(changelogTable.tenantId, tenantId),
        eq(changelogTable.operationKey, `creator-source-list:${tenantId}:${fingerprint}`),
      )).limit(1);
    if (!approval) throw new CreatorSourceRegistryError(
      "The current municipality source list requires explicit approval.", "approval-gate",
    );
    const sourceIds = sources
      .filter((source) => source.status === "approved")
      .map((source) => source.id)
      .sort();
    const [run] = await tx.insert(creatorSourceRunsTable).values({
      tenantId,
      reportJson: JSON.stringify({
        capturedSourceIds: sourceIds,
        municipality,
        captureFingerprint: fingerprint,
      }),
    }).returning();
    if (!run) throw new Error("Source-first run could not be created.");
    return {
      run,
      sourceIds,
      municipality,
      origin: { latitude: tenant.latitude, longitude: tenant.longitude },
    };
    });
  } catch (error: unknown) {
    await releaseMunicipalityRunLease(lease);
    if ((error as { code?: string }).code === "23505") {
      throw new CreatorSourceRegistryError("A source-first run is already in progress.", "conflict");
    }
    throw error;
  }
  const run = created.run;
  if (!run) throw new Error("Source-first run could not be created.");
  setImmediate(() => {
    executeCreatorSourceRun({
      runId: run!.id,
      tenantId,
      sourceIds: created.sourceIds,
      origin: created.origin,
      municipality: created.municipality,
      lease,
    }).catch((error) => {
      logger.error(
        { err: error, runId: run!.id, tenantId },
        "[creatorSourceRun] asynchronous run failed",
      );
    });
  });
  return serializeCreatorSourceRun(run);
}

export async function executeCreatorSourceRun(input: {
  runId: string;
  tenantId: string;
  sourceIds: string[];
  origin: { latitude: number; longitude: number };
  municipality?: string;
  lease?: MunicipalityRunLease;
}): Promise<void> {
  const report: SourceRunReport = {
    capturedSourceIds: [...input.sourceIds].sort(),
    municipality: input.municipality ?? "",
    approvedSeedCount: input.sourceIds.length,
    pagesRead: 0,
    facts: 0,
    candidates: 0,
    resolved: 0,
    unresolved: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    error: null,
  };
  const persist = () => db.update(creatorSourceRunsTable)
    .set({ reportJson: JSON.stringify(report) })
    .where(and(
      eq(creatorSourceRunsTable.id, input.runId),
      eq(creatorSourceRunsTable.status, "running"),
    ));
  const [run] = await db.select({ startedAt: creatorSourceRunsTable.startedAt })
    .from(creatorSourceRunsTable).where(eq(creatorSourceRunsTable.id, input.runId)).limit(1);
  const startedAt = run?.startedAt.getTime() ?? Date.now();
  const deadline = AbortSignal.timeout(Math.max(1, RUN_LIMITS.elapsedMs - (Date.now() - startedAt)));
  const usage = {
    observedPages: 0, rawBytes: 0, extractedTextBytes: 0, modelChunks: 0,
    modelRequests: 0, inputTokens: 0, outputTokens: 0, acceptedFacts: 0,
    modelCostUsd: 0,
  };
  const enforceBudget = (stage: string) => {
    const values = { ...usage, elapsedMs: Date.now() - startedAt };
    for (const key of Object.keys(RUN_LIMITS) as Array<keyof typeof RUN_LIMITS>) {
      if (values[key] > RUN_LIMITS[key]) {
        throw new Error(`Run budget exceeded at ${stage}: ${key} ${values[key]} > ${RUN_LIMITS[key]}`);
      }
    }
    deadline.throwIfAborted();
  };
  try {
    const factsByName = new Map<
      string,
      Array<typeof creatorSourceFactsTable.$inferSelect>
    >();
    for (const sourceId of input.sourceIds) {
      enforceBudget(`before crawl ${sourceId}`);
      const [source] = await db.select().from(creatorSourcesTable).where(and(
        eq(creatorSourcesTable.id, sourceId),
        eq(creatorSourcesTable.status, "approved"),
        ...(input.municipality
          ? [eq(creatorSourcesTable.municipality, input.municipality)]
          : []),
      )).limit(1);
      if (!source) continue;
      let sourceRawBytes = 0;
      const crawl = await crawlApprovedCreatorSource(source.id, {
        getRemainingContentBytes: () => Math.max(0, Math.min(
          RUN_LIMITS.rawBytes - usage.rawBytes,
          RUN_LIMITS.extractedTextBytes - usage.extractedTextBytes,
          SOURCE_RAW_BYTES_PER_SEED - sourceRawBytes,
        )),
        onContentRead: ({ rawBytes, extractedTextBytes }) => {
          sourceRawBytes += rawBytes;
          usage.observedPages++;
          usage.rawBytes += rawBytes;
          usage.extractedTextBytes += extractedTextBytes;
          enforceBudget(`content read ${source.id}`);
        },
      });
      const pages = crawl.pages.filter((page) =>
        page.status === "stored" && page.content && page.finalUrl && page.observedAt
      ).sort((left, right) => left.url.localeCompare(right.url) || left.depth - right.depth);
      for (const page of pages) {
        report.pagesRead++;
        await db.insert(creatorSourceRunSnapshotsTable).values({
          runId: input.runId,
          sourceContentId: page.content!.id,
        }).onConflictDoNothing();
      }
      const compositeBatches = buildCreatorSourceRunCompositeBatches(
        pages.map((page) => page.content!.extractedText),
      );
      for (const compositeBatch of compositeBatches) {
        const batch = pages.slice(
          compositeBatch.offset,
          compositeBatch.offset + MODEL_PAGE_BATCH_SIZE,
        );
        const { compositePages, compositeText } = compositeBatch;
        const reservedChunks = chunkCreatorSourceText(
          compositeText,
          MODEL_CHUNK_CHARACTERS,
        ).length;
        if (usage.modelChunks + reservedChunks > RUN_LIMITS.modelChunks) {
          throw new Error("Run budget cannot reserve another model batch.");
        }
        usage.modelChunks += reservedChunks;
        const inFlight = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
        let progressWriteQueue = Promise.resolve();
        let extraction: Awaited<ReturnType<typeof extractGroundedCreatorSourceFacts>>;
        try {
          extraction = await extractGroundedCreatorSourceFacts({
          storedVisibleText: compositeText,
          maxChunkCharacters: MODEL_CHUNK_CHARACTERS,
          signal: deadline,
          onModelAttemptStart: (upperBound) => {
            return reserveCreatorSourceModelAttempt(usage, inFlight, upperBound);
          },
          onModelAttemptFinish: ({ reservation, upperBound, usage: actual }) => {
            if (reservation.upperBound !== upperBound) throw new Error("Model reservation mismatch.");
            if (!("release" in reservation) || typeof reservation.release !== "function") {
              throw new Error("Model reservation release is unavailable.");
            }
            reservation.release(actual);
            enforceBudget(`after composite model attempt ${batch[0]!.url}`);
            progressWriteQueue = progressWriteQueue.then(async () => {
              await persist();
            });
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
        if (extraction.chunkCount !== reservedChunks) throw new Error("Model chunk reservation mismatch.");
        enforceBudget(`composite model extraction ${batch[0]!.url}`);
        report.inputTokens += extraction.inputTokens;
        report.outputTokens += extraction.outputTokens;
        report.costUsd += extraction.costUsd;
        const routed = routeGroundedCreatorSourceFactsToPages(
          compositePages,
          extraction.facts,
        );
        for (const [pageIndex, page] of batch.entries()) {
          // Routing re-runs strict grounding against only this original page.
          // Composite-only context can therefore never authorize persistence.
          const pageFacts = routed[pageIndex]!.facts;
          for (const fact of pageFacts) {
          const [stored] = await db.insert(creatorSourceFactsTable).values({
            runId: input.runId,
            sourceContentId: page.content!.id,
            placeName: fact.canonicalName,
            settlement: fact.settlement,
            categoryKey: fact.categoryKey,
            sourceUrl: page.finalUrl!,
            retrievedAt: page.observedAt!,
          }).onConflictDoNothing().returning();
          const row = stored ?? (await db.select().from(creatorSourceFactsTable)
            .where(and(
              eq(creatorSourceFactsTable.runId, input.runId),
              eq(creatorSourceFactsTable.sourceContentId, page.content!.id),
              eq(creatorSourceFactsTable.placeName, fact.canonicalName),
              eq(creatorSourceFactsTable.categoryKey, fact.categoryKey),
            )).limit(1))[0];
          if (!row) throw new Error("Grounded source fact was not persisted.");
          const key = normalizeCreatorProposalName(fact.canonicalName);
          factsByName.set(key, [...(factsByName.get(key) ?? []), row]);
          report.facts++;
          usage.acceptedFacts++;
          enforceBudget(`fact persistence ${page.url}`);
          }
        }
        await persist();
      }
    }

    const categoryRows = await db.select({
      id: categoriesTable.id,
      key: categoriesTable.key,
    }).from(categoriesTable)
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .where(eq(sectionsTable.tenantId, input.tenantId));
    const categoryByKey = new Map(categoryRows.flatMap((row) =>
      row.key ? [[row.key, row.id] as const] : []
    ));
    const nominatim = createPacedNominatimFetch();
    for (const [normalizedName, facts] of factsByName) {
      enforceBudget(`candidate ${normalizedName}`);
      const primary = facts[0]!;
      const [candidate] = await db.insert(creatorSourceCandidatesTable).values({
        runId: input.runId,
        normalizedName,
        officialName: primary.placeName,
        settlement: primary.settlement,
        categoryKey: primary.categoryKey,
      }).returning();
      if (!candidate) throw new Error("Source candidate was not persisted.");
      await db.insert(creatorSourceCandidateFactsTable).values(
        facts.map((fact) => ({ candidateId: candidate.id, factId: fact.id })),
      ).onConflictDoNothing();
      report.candidates++;
      const sieve = await runAndPersistCreatorSieve({
        tenantId: input.tenantId,
        runId: input.runId,
        proposedName: primary.placeName,
        lookupHint: primary.settlement
          ? `${primary.placeName}, ${primary.settlement}`
          : undefined,
        origin: input.origin,
        hardCeilingKm: 120,
        contentReady: false,
        fetchFn: nominatim.fetchFn,
      });
      const proposal = sieve.sourceProposal;
      let failure = sieve.result?.verdict === "resolved"
        ? null
        : sieve.result?.rule ?? "blocked-or-duplicate";
      let route: Awaited<ReturnType<typeof computeRoadRoute>> = null;
      if (proposal && !failure && proposal.latitude !== null && proposal.longitude !== null) {
        route = await computeRoadRoute(input.origin, {
          latitude: proposal.latitude,
          longitude: proposal.longitude,
        });
        if (!route) failure = "osrm-unavailable";
        else if (route.distanceMeters > 120_000) failure = "road-distance-ceiling";
        else if (Math.round(route.durationMinutes * 60) > 5_400) failure = "duration-ceiling";
      }
      if (proposal) {
        await db.update(creatorPlaceProposalsTable).set({
          categoryId: categoryByKey.get(primary.categoryKey) ?? null,
          roadDistanceM: route?.distanceMeters ?? null,
          travelDurationS: route ? Math.round(route.durationMinutes * 60) : null,
          range: route ? route.durationMinutes <= 20 ? "near" : "excursion" : null,
          ...(failure ? { status: "unresolved", refusalReason: failure } : {}),
          contentReady: false,
        }).where(and(
          eq(creatorPlaceProposalsTable.id, proposal.id),
          eq(creatorPlaceProposalsTable.runId, input.runId),
        ));
      }
      await db.update(creatorSourceCandidatesTable).set({
        proposalId: proposal?.runId === input.runId ? proposal.id : null,
        outcome: failure ? "unresolved" : "resolved",
        failureReason: failure,
      }).where(eq(creatorSourceCandidatesTable.id, candidate.id));
      if (failure) report.unresolved++;
      else report.resolved++;
      await persist();
    }

    await db.transaction(async (tx) => {
      const proposals = await tx.select({ id: creatorPlaceProposalsTable.id })
        .from(creatorPlaceProposalsTable)
        .where(and(
          eq(creatorPlaceProposalsTable.tenantId, input.tenantId),
          eq(creatorPlaceProposalsTable.runId, input.runId),
        ));
      const madeReady = await tx.update(creatorPlaceProposalsTable)
        .set({ contentReady: true })
        .where(and(
          eq(creatorPlaceProposalsTable.tenantId, input.tenantId),
          eq(creatorPlaceProposalsTable.runId, input.runId),
          eq(creatorPlaceProposalsTable.contentReady, false),
        )).returning({ id: creatorPlaceProposalsTable.id });
      if (madeReady.length !== proposals.length) {
        throw new Error("Final proposal visibility reconciliation failed.");
      }
      const completed = await tx.update(creatorSourceRunsTable).set({
        status: "completed",
        completedAt: new Date(),
        reportJson: JSON.stringify(report),
      }).where(and(
        eq(creatorSourceRunsTable.id, input.runId),
        eq(creatorSourceRunsTable.status, "running"),
      )).returning({ id: creatorSourceRunsTable.id });
      if (completed.length !== 1) {
        throw new Error("Source-first run completion reconciliation failed.");
      }
    });
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    await db.update(creatorSourceRunsTable).set({
      status: "failed",
      completedAt: new Date(),
      reportJson: JSON.stringify(report),
    }).where(and(
      eq(creatorSourceRunsTable.id, input.runId),
      eq(creatorSourceRunsTable.status, "running"),
    ));
    throw error;
  } finally {
    await releaseMunicipalityRunLease(input.lease);
  }
}

/**
 * A deployment can stop while a run is between durable checkpoints. On boot we
 * either restart that exact run from no run-owned evidence, or terminally mark
 * it once its original one-hour lease has elapsed. Source contents themselves
 * are immutable shared snapshots and are deliberately never removed.
 */
export async function recoverCreatorSourceRunsAtStartup(): Promise<void> {
  const running = await db.select().from(creatorSourceRunsTable)
    .where(eq(creatorSourceRunsTable.status, "running"));
  for (const run of running) {
    let capture: { capturedSourceIds?: unknown; municipality?: unknown };
    try {
      capture = JSON.parse(run.reportJson ?? "null") as typeof capture;
    } catch {
      capture = {};
    }
    const capturedSourceIds = Array.isArray(capture?.capturedSourceIds)
      && capture.capturedSourceIds.every((id): id is string => typeof id === "string")
      && new Set(capture.capturedSourceIds).size === capture.capturedSourceIds.length
      && capture.capturedSourceIds.length > 0
      && capture.capturedSourceIds.length <= 15
      ? [...capture.capturedSourceIds].sort()
      : null;
    const municipality = typeof capture?.municipality === "string"
      ? normalizeCreatorMunicipality(capture.municipality)
      : "";
    if (!municipality) {
      await db.update(creatorSourceRunsTable).set({
        status: "failed",
        completedAt: new Date(),
        reportJson: JSON.stringify({ error: "Captured municipality is absent." }),
      }).where(and(
        eq(creatorSourceRunsTable.id, run.id),
        eq(creatorSourceRunsTable.status, "running"),
      ));
      continue;
    }
    const lease = await tryAcquireMunicipalityRunLease(municipality);
    // Another live API instance still owns and executes this run.
    if (!lease) continue;
    try {
    if (Date.now() - run.startedAt.getTime() >= 60 * 60 * 1000) {
      await db.update(creatorSourceRunsTable).set({
        status: "failed",
        completedAt: new Date(),
        reportJson: JSON.stringify({ error: "Run deadline elapsed before restart recovery." }),
      }).where(and(
        eq(creatorSourceRunsTable.id, run.id),
        eq(creatorSourceRunsTable.status, "running"),
      ));
      await releaseMunicipalityRunLease(lease);
      continue;
    }
    const [tenant] = await db.select({
      municipality: tenantsTable.municipality,
      latitude: tenantsTable.latitude,
      longitude: tenantsTable.longitude,
    }).from(tenantsTable).where(eq(tenantsTable.id, run.tenantId)).limit(1);
    if (!tenant || tenant.latitude === null || tenant.longitude === null || !tenant.municipality) {
      await db.update(creatorSourceRunsTable).set({
        status: "failed",
        completedAt: new Date(),
        reportJson: JSON.stringify({ error: "Run cannot be recovered without its origin and municipality." }),
      }).where(eq(creatorSourceRunsTable.id, run.id));
      await releaseMunicipalityRunLease(lease);
      continue;
    }
    const currentMunicipality = normalizeCreatorMunicipality(tenant.municipality);
    const sources = capturedSourceIds
      ? await db.select({ id: creatorSourcesTable.id }).from(creatorSourcesTable)
        .where(and(
          eq(creatorSourcesTable.municipality, municipality),
          eq(creatorSourcesTable.status, "approved"),
          inArray(creatorSourcesTable.id, capturedSourceIds),
        ))
      : [];
    if (
      !capturedSourceIds
      || !municipality
      || municipality !== currentMunicipality
      || sources.length !== capturedSourceIds.length
    ) {
      await db.update(creatorSourceRunsTable).set({
        status: "failed", completedAt: new Date(),
        reportJson: JSON.stringify({ error: "Captured source set is absent or no longer approved." }),
      }).where(eq(creatorSourceRunsTable.id, run.id));
      await releaseMunicipalityRunLease(lease);
      continue;
    }
    await db.transaction(async (tx) => {
      await tx.delete(creatorSourceCandidatesTable).where(eq(creatorSourceCandidatesTable.runId, run.id));
      await tx.delete(creatorSourceFactsTable).where(eq(creatorSourceFactsTable.runId, run.id));
      await tx.delete(creatorSourceRunSnapshotsTable).where(eq(creatorSourceRunSnapshotsTable.runId, run.id));
      await tx.delete(creatorPlaceProposalsTable).where(and(
        eq(creatorPlaceProposalsTable.tenantId, run.tenantId),
        eq(creatorPlaceProposalsTable.runId, run.id),
        eq(creatorPlaceProposalsTable.contentReady, false),
      ));
    });
    setImmediate(() => {
      executeCreatorSourceRun({
        runId: run.id,
        tenantId: run.tenantId,
        sourceIds: capturedSourceIds,
        origin: { latitude: tenant.latitude!, longitude: tenant.longitude! },
        municipality,
        lease,
      }).catch((error) => logger.error({ err: error, runId: run.id }, "[creatorSourceRun] recovery failed"));
    });
    } catch (error) {
      await releaseMunicipalityRunLease(lease);
      throw error;
    }
  }
}