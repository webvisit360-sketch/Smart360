import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  adminUsersTable,
  categoriesTable,
  creatorCanonicalPlacesTable,
  creatorPlaceProposalsTable,
  creatorPlaceMaterializationsTable,
  creatorProposalTranslationsTable,
  creatorProposalProcessingFailuresTable,
  creatorSourceCandidatesTable,
  creatorSourceCandidateFactsTable,
  creatorSourceFactsTable,
  creatorVerificationAttemptsTable,
  creatorVerificationCandidatesTable,
  db,
  itemCategoryAttachmentsTable,
  itemDistanceProposalsTable,
  itemsTable,
  sectionsTable,
  tenantsTable,
  translationsTable,
} from "@workspace/db";
import { runCreatorSieve } from "./creatorSieve";
import { createPacedNominatimFetch } from "./creatorNominatimRetry";
import type { CreatorDependencyRecorder } from "./creatorDependencyTelemetry";
import { computeRoadRoute, type FetchFn } from "./distanceEngine";
import { logger } from "./logger";

export const CREATOR_MAX_QUEUE_DURATION_S = 5400;

export type CreatorProposalProcessingFailure = {
  proposalId: string;
  proposedName: string;
  reason: string;
};

export const CREATOR_EDITORIAL_LANGUAGES = ["sl", "en", "de", "it"] as const;

/** A reviewer-facing precondition failure.  Routes deliberately map this to
 * 409 rather than treating an incomplete draft as a missing proposal. */
export class CreatorProposalValidationError extends Error {
  constructor(
    message: string,
    public readonly proposalId?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

export function missingCreatorEditorialLanguages(
  rows: Array<{ language: string }>,
): string[] {
  const present = new Set(rows.map((row) => row.language));
  return CREATOR_EDITORIAL_LANGUAGES.filter((language) => !present.has(language));
}

export function missingCreatorEditorialLanguagesReason(
  rows: Array<{ language: string }>,
): string | null {
  const missing = missingCreatorEditorialLanguages(rows);
  return missing.length
    ? `Predloga ni mogoče potrditi: manjkajo jeziki ${missing.join(", ")}.`
    : null;
}

/** Bounded, idempotent repair for unsafe content_ready drift. It only demotes
 * rows that claim readiness while one of the four editorial languages is
 * absent; promotion remains owned by the workflow that verifies all other
 * queue prerequisites. */
export async function syncCreatorProposalContentReadyFlags(limit = 500): Promise<number> {
  const result = await db.execute(sql`
    WITH drifted AS (
      SELECT p.id
      FROM creator_place_proposals p
      LEFT JOIN creator_proposal_translations t ON t.proposal_id = p.id
      WHERE p.content_ready = true
      GROUP BY p.id, p.content_ready
      HAVING COUNT(t.id) FILTER (
        WHERE t.language IN ('sl', 'en', 'de', 'it')
      ) < 4
      ORDER BY p.id
      LIMIT ${Math.max(1, Math.min(limit, 5_000))}
    )
    UPDATE creator_place_proposals p
    SET content_ready = false, updated_at = now()
    FROM drifted
    WHERE p.id = drifted.id
    RETURNING p.id
  `) as unknown as { rows?: unknown[]; rowCount?: number } | unknown[];
  if (Array.isArray(result)) return result.length;
  return result.rows?.length ?? result.rowCount ?? 0;
}

export async function runCreatorProposalContentReadySyncAtStartup(): Promise<void> {
  const batchSize = 500;
  const maxBatches = 20;
  let updated = 0;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const batchUpdated = await syncCreatorProposalContentReadyFlags(batchSize);
    updated += batchUpdated;
    if (batchUpdated < batchSize) break;
  }
  logger.info({ updated }, "Creator proposal content readiness synchronized");
}

export type CreatorApprovedBackfillResult = {
  backfilled: number;
  backfilledProposalIds: string[];
  backfilledProposalNames: Record<string, string>;
  failures: CreatorProposalProcessingFailure[];
};

export function creatorProposalProcessingReason(error: unknown): string {
  if (error instanceof CreatorBulkApprovalError) return error.message;
  const databaseError = error as { code?: string; constraint?: string; message?: string };
  if (databaseError.code === "23503") {
    return "Predlog se sklicuje na kategorijo ali drug podatek, ki ne obstaja več.";
  }
  if (databaseError.code === "23505") {
    return "Predlog je v sporu z že obstoječim enoličnim zapisom.";
  }
  if (databaseError.code === "23514") {
    return `Predlog krši podatkovno pravilo${databaseError.constraint ? ` ${databaseError.constraint}` : ""}.`;
  }
  if (error instanceof Error && error.message.trim()) {
    return `Tehnična napaka pri obdelavi predloga: ${error.message}`;
  }
  return "Pri obdelavi predloga je nastala neznana napaka.";
}

export function normalizeCreatorProposalName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("sl")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function fuzzyCreatorProposalKey(value: string): string {
  return normalizeCreatorProposalName(value).replace(/\s+/g, "");
}

/** Stable tenant-local canonical place identity. OSM wins; manual pins are
 * deliberately rounded so the same operator point cannot create two places. */
export function creatorPlaceEntityKey(row: Pick<typeof creatorPlaceProposalsTable.$inferSelect,
  "osmType" | "osmId" | "latitude" | "longitude">): string {
  if (row.osmType && row.osmId !== null) return `osm:${row.osmType}:${row.osmId}`;
  if (row.latitude === null || row.longitude === null) {
    throw new CreatorBulkApprovalError("Predlog nima identitete kraja.");
  }
  return `coordinates:${row.latitude.toFixed(5)}:${row.longitude.toFixed(5)}`;
}

/** All writers of a canonical place take these two locks in this order. */
export async function lockCreatorPlaceIdentity(
  tx: any,
  tenantId: string,
  entityKey: string,
  normalizedName: string,
) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(
    hashtextextended(${`${tenantId}:creator-place-entity:${entityKey}`}, 0)
  )`);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(
    hashtextextended(${`${tenantId}:creator-place-name:${normalizedName}`}, 0)
  )`);
}

/** Must run after lockCreatorPlaceIdentity.  The canonical entity may be
 * replayed idempotently, but a different live place may never claim its name. */
export async function assertNoLiveCreatorPlaceDuplicate(
  tx: any,
  input: {
    tenantId: string;
    entityKey: string;
    normalizedName: string;
    currentProposalId: string;
    currentCreatedAt: Date;
  },
) {
  const [sameEntity] = await tx.select({ itemId: creatorCanonicalPlacesTable.itemId })
    .from(creatorCanonicalPlacesTable)
    .where(and(
      eq(creatorCanonicalPlacesTable.tenantId, input.tenantId),
      eq(creatorCanonicalPlacesTable.entityKey, input.entityKey),
    ))
    .limit(1);
  const reusableItemId = sameEntity?.itemId ?? null;
  const proposals = await tx.select().from(creatorPlaceProposalsTable)
    .where(and(
      eq(creatorPlaceProposalsTable.tenantId, input.tenantId),
      eq(creatorPlaceProposalsTable.normalizedName, input.normalizedName),
      ne(creatorPlaceProposalsTable.id, input.currentProposalId),
      ne(creatorPlaceProposalsTable.status, "rejected"),
    ));
  const conflictingProposal = proposals.some((row: typeof creatorPlaceProposalsTable.$inferSelect) => {
    const key = row.osmType && row.osmId !== null
      ? `osm:${row.osmType}:${row.osmId}`
      : row.latitude !== null && row.longitude !== null
        ? `coordinates:${row.latitude.toFixed(5)}:${row.longitude.toFixed(5)}`
        : null;
    // Pending Creator rows can exist before either reviewer approves them.
    // Give that race one stable winner; once it is approved/materialized the
    // other row deterministically loses under the same name lock.
    const earlierOrLive = row.status !== "pending" ||
      row.createdAt < input.currentCreatedAt ||
      (row.createdAt.getTime() === input.currentCreatedAt.getTime() && row.id < input.currentProposalId);
    return key !== input.entityKey && earlierOrLive;
  });
  const itemRows = await tx.select({ id: itemsTable.id, title: itemsTable.title })
    .from(itemsTable)
    .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(and(
      eq(sectionsTable.tenantId, input.tenantId),
      isNull(itemsTable.deletedAt),
    ));
  const conflictingItem = itemRows.some((item: { id: string; title: string | null }) =>
    item.id !== reusableItemId &&
    item.title !== null &&
    normalizeCreatorProposalName(item.title) === input.normalizedName);
  if (conflictingProposal || conflictingItem) {
    throw new CreatorBulkApprovalError("Ta kraj je že v vodniku.");
  }
  return { reusableItemId };
}

export async function upsertPendingCreatorProposal(input: {
  tenantId: string;
  runId: string;
  proposedName: string;
  originalQuery: string;
  geocodingLookupHint?: string;
  contentReady?: boolean;
}) {
  const normalizedName = normalizeCreatorProposalName(input.proposedName);
  const fuzzyKey = fuzzyCreatorProposalKey(input.proposedName);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(
      hashtextextended(${`${input.tenantId}:creator-name:${fuzzyKey}`}, 0)
    )`);
    const sameRun = await tx
      .select()
      .from(creatorPlaceProposalsTable)
      .where(and(
        eq(creatorPlaceProposalsTable.runId, input.runId),
        isNull(creatorPlaceProposalsTable.osmId),
      ));
    const fuzzyDuplicate = sameRun.find((row) =>
      fuzzyCreatorProposalKey(row.proposedName) === fuzzyKey);
    if (fuzzyDuplicate) return { proposal: fuzzyDuplicate, inserted: false };

    const [inserted] = await tx
      .insert(creatorPlaceProposalsTable)
      .values({ ...input, normalizedName, contentReady: false })
      .onConflictDoNothing()
      .returning();
    if (inserted) return { proposal: inserted, inserted: true };

    const [existing] = await tx
      .select()
      .from(creatorPlaceProposalsTable)
      .where(and(
        eq(creatorPlaceProposalsTable.runId, input.runId),
        eq(creatorPlaceProposalsTable.normalizedName, normalizedName),
        isNull(creatorPlaceProposalsTable.osmId),
      ))
      .limit(1);
    if (!existing) throw new Error("Predloga po konfliktu ni bilo mogoče ponovno prebrati.");
    if (existing.status === "superseded") {
      if (!existing.supersededBy) {
        throw new Error("Združeni predlog nima povezave na kanonični predlog.");
      }
      const [canonical] = await tx
        .select()
        .from(creatorPlaceProposalsTable)
        .where(and(
          eq(creatorPlaceProposalsTable.id, existing.supersededBy),
          eq(creatorPlaceProposalsTable.tenantId, input.tenantId),
        ))
        .limit(1);
      if (!canonical) {
        throw new Error("Kanoničnega predloga po združitvi ni bilo mogoče najti.");
      }
      return { proposal: canonical, inserted: false };
    }
    return { proposal: existing, inserted: false };
  });
}

export type CreatorVerificationRecord = {
  originalQuery: string;
  confirmedQuery: string | null;
  confirmationMethod: "exact" | "generic_type" | "address_token" | "shortened_query" | "overpass_near" | "operator_coordinates" | null;
  status: "pending" | "unresolved";
  refusalReason: string | null;
  resolvedName: string | null;
  resolvedAddress: string | null;
  osmType: string | null;
  osmId: number | null;
  osmCategory: string | null;
  osmFeatureType: string | null;
  osmAddressType: string | null;
  latitude: number | null;
  longitude: number | null;
  straightLineDistanceM: number | null;
  attempts: Array<{
    attemptNumber: 1 | 2;
    query: string;
    verdict: "resolved" | "refused";
    refusalRule: string | null;
    candidates: Array<{
      osmType: string | null;
      osmId: number | null;
      osmCategory: string | null;
      osmFeatureType: string | null;
      osmAddressType: string | null;
      resolvedName: string | null;
      latitude: number | null;
      longitude: number | null;
      straightLineDistanceM: number | null;
      selected: boolean;
    }>;
  }>;
};

export async function recordCreatorVerification(
  tenantId: string,
  proposalId: string,
  record: CreatorVerificationRecord,
) {
  if (record.status === "unresolved" && !record.refusalReason) {
    throw new Error("Nerazrešen predlog potrebuje razlog zavrnitve sita.");
  }
  if (record.status === "pending" && (
    !record.confirmedQuery ||
    !record.confirmationMethod ||
    !record.resolvedName ||
    !record.osmType ||
    record.osmId === null ||
    !record.osmCategory ||
    !record.osmFeatureType ||
    !record.osmAddressType ||
    record.latitude === null ||
    record.longitude === null ||
    record.straightLineDistanceM === null
  )) {
    throw new Error("Potrjen rezultat sita nima vseh obveznih strojnih dokazov.");
  }
  return db.transaction(async (tx) => {
    const [sourceProposal] = await tx.select().from(creatorPlaceProposalsTable)
      .where(and(
        eq(creatorPlaceProposalsTable.id, proposalId),
        eq(creatorPlaceProposalsTable.tenantId, tenantId),
      )).limit(1);
    if (!sourceProposal) throw new Error("Predlog ni najden.");

    if (record.osmType && record.osmId !== null) {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            ${`${sourceProposal.tenantId}:${record.osmType}:${record.osmId}`},
            0
          )
        )
      `);
    }

    const [latestAttempt] = await tx.select({
      generation: sql<number>`COALESCE(MAX(${creatorVerificationAttemptsTable.generation}), -1)::int`,
    }).from(creatorVerificationAttemptsTable)
      .where(eq(creatorVerificationAttemptsTable.proposalId, proposalId));
    const generation = (latestAttempt?.generation ?? -1) + 1;
    for (const attempt of record.attempts) {
      const [attemptRow] = await tx.insert(creatorVerificationAttemptsTable).values({
        proposalId,
        generation,
        attemptNumber: attempt.attemptNumber,
        query: attempt.query,
        verdict: attempt.verdict,
        refusalRule: attempt.refusalRule,
      }).returning({ id: creatorVerificationAttemptsTable.id });
      if (attempt.candidates.length > 0) {
        await tx.insert(creatorVerificationCandidatesTable).values(
          attempt.candidates.map((candidate, index) => ({
            attemptId: attemptRow!.id,
            candidatePosition: index,
            ...candidate,
          })),
        );
      }
    }
    const [updated] = await tx.update(creatorPlaceProposalsTable).set({
      originalQuery: record.originalQuery,
      confirmedQuery: record.confirmedQuery,
      confirmationMethod: record.confirmationMethod,
      status: record.status,
      supersededBy: null,
      refusalReason: record.refusalReason,
      resolvedName: record.resolvedName,
      resolvedAddress: record.resolvedAddress,
      osmType: record.osmType,
      osmId: record.osmId,
      osmCategory: record.osmCategory,
      osmFeatureType: record.osmFeatureType,
      osmAddressType: record.osmAddressType,
      latitude: record.latitude,
      longitude: record.longitude,
      straightLineDistanceM: record.straightLineDistanceM,
      updatedAt: new Date(),
    }).where(and(
      eq(creatorPlaceProposalsTable.id, proposalId),
      eq(creatorPlaceProposalsTable.tenantId, tenantId),
    )).returning();
    if (!updated) throw new Error("Predlog ni najden.");
    return {
      sourceProposal: updated,
      canonicalProposal: updated,
      duplicate: false as const,
    };
  });
}

export async function runAndPersistCreatorSieve(input: {
  tenantId: string;
  runId: string;
  proposedName: string;
  lookupHint?: string;
  origin: { latitude: number; longitude: number };
  hardCeilingKm?: number;
  fetchFn?: FetchFn;
  onNominatimWait?: (milliseconds: number) => void;
  onDependencyAttempt?: CreatorDependencyRecorder;
  contentReady?: boolean;
  nearFallback?: () => Promise<{
    candidate: {
      osmType: string; osmId: number; className: string; type: string;
      addresstype: string; returnedName: string; displayName: string;
      latitude: number; longitude: number; distanceKm: number;
    };
    route: { distanceMeters: number; durationMinutes: number };
  } | null>;
}) {
  const pending = await upsertPendingCreatorProposal({
    tenantId: input.tenantId,
    runId: input.runId,
    proposedName: input.proposedName,
    originalQuery: input.proposedName,
    geocodingLookupHint: input.lookupHint,
    contentReady: input.contentReady,
  });
  if (!pending.inserted) {
    return {
      proposal: pending.proposal,
      sourceProposal: null,
      canonicalProposal: pending.proposal,
      inserted: false,
      duplicate: true,
      result: null,
      nearRingResolvedAfterGlobalSieveFailed: false,
      nearRingRoute: null,
    };
  }
  // The strict global sieve is authoritative. The bounded near-ring catalogue
  // is additive fallback evidence only and can never replace or downgrade a
  // globally resolved identity.
  const globalResult = await runCreatorSieve(input.proposedName, input.origin, {
    fallbackQuery: input.lookupHint,
    hardCeilingKm: input.hardCeilingKm,
    fetchFn: input.fetchFn,
    onNominatimWait: input.onNominatimWait,
    onDependencyAttempt: input.onDependencyAttempt,
  });
  const nearFallback = globalResult.verdict !== "resolved"
    ? await input.nearFallback?.() ?? null
    : null;
  const nearRingResolvedAfterGlobalSieveFailed = nearFallback !== null;
  const result = nearRingResolvedAfterGlobalSieveFailed ? {
    verdict: "resolved" as const,
    candidate: nearFallback.candidate,
    originalQuery: input.proposedName,
    confirmedQuery: input.proposedName,
    confirmationMethod: "overpass_near" as const,
    // Retain the strict global refusal attempts as the evidence that made the
    // additive fallback eligible. The selected near-ring identity is stored on
    // the proposal row through recordCreatorVerification below.
    attempts: globalResult.attempts,
  } : globalResult;
  const attempts: CreatorVerificationRecord["attempts"] = result.attempts.map((attempt) => ({
    ...attempt,
    candidates: attempt.candidates,
  }));
  const verification = result.verdict === "resolved"
    ? await recordCreatorVerification(input.tenantId, pending.proposal.id, {
      originalQuery: result.originalQuery,
      confirmedQuery: result.confirmedQuery,
      confirmationMethod: result.confirmationMethod,
      status: "pending",
      refusalReason: null,
      resolvedName: result.candidate.returnedName,
      resolvedAddress: result.candidate.displayName || null,
      osmType: result.candidate.osmType,
      osmId: result.candidate.osmId,
      osmCategory: result.candidate.className,
      osmFeatureType: result.candidate.type,
      osmAddressType: result.candidate.addresstype,
      latitude: result.candidate.latitude,
      longitude: result.candidate.longitude,
      straightLineDistanceM: result.candidate.distanceKm * 1000,
      attempts,
    })
    : await recordCreatorVerification(input.tenantId, pending.proposal.id, {
      originalQuery: result.originalQuery,
      confirmedQuery: null,
      confirmationMethod: null,
      status: "unresolved",
      refusalReason: result.rule,
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
      attempts,
    });
  let sourceProposal = verification.sourceProposal;
  let canonicalProposal = verification.canonicalProposal;
  // Step B becomes queue-ready when its verification evidence is complete.
  // C1 explicitly passes false and exposes the whole run only after all four
  // translations, routing evidence, and the completed run report are durable.
  if (!verification.duplicate) {
    const editorial = await db.select({ language: creatorProposalTranslationsTable.language })
      .from(creatorProposalTranslationsTable)
      .where(eq(creatorProposalTranslationsTable.proposalId, verification.sourceProposal.id));
    const contentReady = input.contentReady !== false
      && missingCreatorEditorialLanguages(editorial).length === 0;
    const [ready] = await db.update(creatorPlaceProposalsTable)
      .set({ contentReady, updatedAt: new Date() })
      .where(and(
        eq(creatorPlaceProposalsTable.id, verification.sourceProposal.id),
        eq(creatorPlaceProposalsTable.tenantId, input.tenantId),
      ))
      .returning();
    if (!ready) throw new Error("Preverjenega predloga ni bilo mogoče označiti kot pripravljenega.");
    sourceProposal = ready;
    canonicalProposal = ready;
  }
  return {
    proposal: canonicalProposal,
    sourceProposal,
    canonicalProposal,
    inserted: true,
    duplicate: verification.duplicate,
    result,
    nearRingResolvedAfterGlobalSieveFailed,
    nearRingRoute: nearFallback?.route ?? null,
  };
}

export async function listCreatorProposalQueue(tenantId: string) {
  const rows = await db.select({
    proposal: creatorPlaceProposalsTable,
    categoryLabel: categoriesTable.label,
  }).from(creatorPlaceProposalsTable)
    .leftJoin(categoriesTable, eq(creatorPlaceProposalsTable.categoryId, categoriesTable.id))
    .where(and(
      eq(creatorPlaceProposalsTable.tenantId, tenantId),
      ne(creatorPlaceProposalsTable.status, "superseded"),
      or(
        eq(creatorPlaceProposalsTable.contentReady, true),
        eq(creatorPlaceProposalsTable.confirmationMethod, "operator_coordinates"),
      ),
    ))
    .orderBy(asc(creatorPlaceProposalsTable.createdAt));
  if (rows.length === 0) return [];
  const runIds = [...new Set(rows.map(({ proposal }) => proposal.runId))];
  const evidenceRows = await db.select({
    proposal: creatorPlaceProposalsTable,
    categoryLabel: categoriesTable.label,
  }).from(creatorPlaceProposalsTable)
    .leftJoin(categoriesTable, eq(creatorPlaceProposalsTable.categoryId, categoriesTable.id))
    .where(and(
      eq(creatorPlaceProposalsTable.tenantId, tenantId),
      inArray(creatorPlaceProposalsTable.runId, runIds),
      ne(creatorPlaceProposalsTable.status, "superseded"),
    ));
  const translations = await db.select().from(creatorProposalTranslationsTable)
    .where(inArray(creatorProposalTranslationsTable.proposalId, rows.map(({ proposal }) => proposal.id)))
    .orderBy(asc(creatorProposalTranslationsTable.language));
  const coordinateActors = [...new Set(rows
    .flatMap(({ proposal }) => proposal.coordinateConfirmedBy ? [proposal.coordinateConfirmedBy] : []))];
  const actorNames = coordinateActors.length === 0 ? [] : await db.select({
    id: adminUsersTable.id,
    displayName: adminUsersTable.displayName,
  }).from(adminUsersTable).where(inArray(adminUsersTable.id, coordinateActors));
  const actorNameById = new Map(actorNames.map((actor) => [actor.id, actor.displayName]));
  const byProposal = new Map<string, Array<{ language: string; name: string; description: string }>>();
  for (const translation of translations) {
    const list = byProposal.get(translation.proposalId) ?? [];
    list.push({
      language: translation.language,
      name: translation.name,
      description: translation.description,
    });
    byProposal.set(translation.proposalId, list);
  }
  return rows.map(({ proposal, categoryLabel }) => ({
    ...proposal,
    categoryLabel,
    translations: byProposal.get(proposal.id) ?? [],
    coordinateConfirmedByLabel: proposal.coordinateConfirmedBy
      ? actorNameById.get(proposal.coordinateConfirmedBy) ?? null
      : null,
    lostSameCategoryCount: evidenceRows.filter(({ proposal: alternative }) =>
      alternative.id !== proposal.id &&
      alternative.runId === proposal.runId &&
      alternative.categoryId === proposal.categoryId &&
      alternative.status === "unresolved").length,
    nearestAlternatives: proposal.travelDurationS !== null && proposal.travelDurationS > 20 * 60
      ? evidenceRows
        .filter(({ proposal: alternative }) =>
          alternative.id !== proposal.id &&
          alternative.runId === proposal.runId &&
          alternative.categoryId === proposal.categoryId &&
          (
            alternative.status === "unresolved" ||
            (
              alternative.travelDurationS !== null &&
              alternative.travelDurationS < proposal.travelDurationS!
            )
          ))
        .map(({ proposal: alternative, categoryLabel: alternativeCategoryLabel }) => ({
          proposedName: alternative.proposedName,
          categoryLabel: alternativeCategoryLabel,
          outcome: alternative.status === "unresolved"
            ? "unconfirmed" as const
            : alternative.travelDurationS === null
              ? "route_failed" as const
              : "confirmed" as const,
          refusalRule: alternative.refusalReason,
          roadDistanceM: alternative.roadDistanceM,
          travelDurationS: alternative.travelDurationS,
          proximityKnown: alternative.travelDurationS !== null,
        }))
        .sort((a, b) => {
          if (a.proximityKnown !== b.proximityKnown) return a.proximityKnown ? -1 : 1;
          return (a.travelDurationS ?? Infinity) - (b.travelDurationS ?? Infinity);
        })
      : [],
  }));
}

export async function syncApprovedCreatorPlace(
  tx: any,
  proposal: typeof creatorPlaceProposalsTable.$inferSelect,
  options: { validateOnly?: boolean } = {},
) {
  if (!proposal.categoryId) {
    throw new CreatorBulkApprovalError("Predlog mora biti pred potrditvijo pripet kategoriji.");
  }
  const [category] = await tx.select({ id: categoriesTable.id })
    .from(categoriesTable)
    .innerJoin(sectionsTable, eq(sectionsTable.id, categoriesTable.sectionId))
    .where(and(
      eq(categoriesTable.id, proposal.categoryId),
      eq(sectionsTable.tenantId, proposal.tenantId),
    ))
    .limit(1);
  if (!category) {
    throw new CreatorBulkApprovalError("Kategorija predloga ne obstaja v tej namestitvi.");
  }
  const authoritativeAddress = (
    proposal.confirmationMethod === "operator_coordinates"
      ? proposal.operatorAddress
      : proposal.resolvedAddress
  )?.trim();
  if (!proposal.confirmationMethod) {
    throw new CreatorBulkApprovalError("Predlog nima načina potrditve lokacije.");
  }
  if (!authoritativeAddress) {
    throw new CreatorBulkApprovalError(
      proposal.confirmationMethod === "operator_coordinates"
        ? "Manjka naslov, ki ga je operater potrdil ob ročni določitvi koordinat."
        : "Predlog nima potrjenega naslova kraja.",
    );
  }
  const missingLocationFields = [
    proposal.latitude === null ? "zemljepisna širina" : null,
    proposal.longitude === null ? "zemljepisna dolžina" : null,
    proposal.roadDistanceM === null ? "cestna razdalja" : null,
    proposal.travelDurationS === null ? "čas poti" : null,
    !proposal.range ? "obseg poti" : null,
  ].filter((value): value is string => value !== null);
  if (missingLocationFields.length > 0) {
    throw new CreatorBulkApprovalError(
      `Predlogu manjkajo podatki za vsebino gosta: ${missingLocationFields.join(", ")}.`,
    );
  }
  const travelDurationS = proposal.travelDurationS!;
  const editorial = await tx.select().from(creatorProposalTranslationsTable)
    .where(eq(creatorProposalTranslationsTable.proposalId, proposal.id));
  const editorialReason = missingCreatorEditorialLanguagesReason(editorial);
  if (editorialReason) throw new CreatorProposalValidationError(editorialReason);
  const entityKey = creatorPlaceEntityKey(proposal);
  // Hold this identity lock through validation, status transition and
  // materialization so a competing approval cannot invalidate preconditions.
  await lockCreatorPlaceIdentity(
    tx,
    proposal.tenantId,
    entityKey,
    proposal.normalizedName,
  );
  await assertNoLiveCreatorPlaceDuplicate(tx, {
    tenantId: proposal.tenantId,
    entityKey,
    normalizedName: proposal.normalizedName,
    currentProposalId: proposal.id,
    currentCreatedAt: proposal.createdAt,
  });
  if (options.validateOnly) return;
  const sl = editorial.find((row: any) => row.language === "sl")!;
  const sourceRows = await tx.select({
    id: creatorSourceFactsTable.id,
    sourceUrl: creatorSourceFactsTable.sourceUrl,
  })
    .from(creatorSourceCandidatesTable)
    .innerJoin(
      creatorSourceCandidateFactsTable,
      eq(creatorSourceCandidateFactsTable.candidateId, creatorSourceCandidatesTable.id),
    )
    .innerJoin(
      creatorSourceFactsTable,
      eq(creatorSourceFactsTable.id, creatorSourceCandidateFactsTable.factId),
    )
    .where(eq(creatorSourceCandidatesTable.proposalId, proposal.id));
  const provenanceJson = JSON.stringify({
    provenance: proposal.inclusionReason,
    proposalId: proposal.id,
    runId: proposal.runId,
    confirmationMethod: proposal.confirmationMethod,
    sourceFacts: sourceRows.map((row: any) => ({ id: row.id, url: row.sourceUrl })),
    osmIdentity: proposal.osmType && proposal.osmId !== null
      ? { type: proposal.osmType, id: proposal.osmId }
      : null,
    coordinateConfirmation: proposal.confirmationMethod === "operator_coordinates"
      ? { actorId: proposal.coordinateConfirmedBy, at: proposal.coordinateConfirmedAt }
      : null,
  });
  const [ownMaterialization] = await tx.select().from(creatorPlaceMaterializationsTable)
    .where(eq(creatorPlaceMaterializationsTable.proposalId, proposal.id)).limit(1);
  const [canonical] = await tx.select().from(creatorCanonicalPlacesTable)
    .where(ownMaterialization
      ? eq(creatorCanonicalPlacesTable.id, ownMaterialization.canonicalPlaceId)
      : and(
          eq(creatorCanonicalPlacesTable.tenantId, proposal.tenantId),
          eq(creatorCanonicalPlacesTable.entityKey, entityKey),
        ))
    .limit(1);
  let itemId = canonical?.itemId as string | undefined;
  let canonicalPlaceId = canonical?.id as string | undefined;
  const itemValues = {
    categoryId: proposal.categoryId,
    title: sl.name,
    body: sl.description,
    mapQuery: authoritativeAddress,
    distanceMeters: proposal.roadDistanceM,
    duration: `${Math.round(travelDurationS / 60)} min`,
    isVisible: true,
    deletedAt: null,
  };
  if (itemId) {
    await tx.update(itemsTable).set(itemValues).where(eq(itemsTable.id, itemId));
  } else {
    const [item] = await tx.insert(itemsTable).values(itemValues).returning({ id: itemsTable.id });
    const createdItemId = item.id;
    itemId = createdItemId;
    const [createdCanonical] = await tx.insert(creatorCanonicalPlacesTable).values({
      tenantId: proposal.tenantId,
      entityKey,
      itemId,
    }).onConflictDoNothing().returning({ id: creatorCanonicalPlacesTable.id });
    if (!createdCanonical) {
      // Defensive conflict handling in addition to the advisory lock. The DB
      // uniqueness constraint is the final authority across all writers.
      const [winner] = await tx.select().from(creatorCanonicalPlacesTable).where(and(
        eq(creatorCanonicalPlacesTable.tenantId, proposal.tenantId),
        eq(creatorCanonicalPlacesTable.entityKey, entityKey),
      )).limit(1);
      if (!winner) throw new Error("Kanoničnega kraja ni bilo mogoče ustvariti.");
      await tx.delete(itemsTable).where(eq(itemsTable.id, createdItemId));
      itemId = winner.itemId;
      canonicalPlaceId = winner.id;
      await tx.update(itemsTable).set(itemValues).where(eq(itemsTable.id, winner.itemId));
    } else {
      canonicalPlaceId = createdCanonical.id;
    }
  }
  const canonicalItemId = itemId!;

  await tx.delete(translationsTable).where(and(
    eq(translationsTable.model, "item"),
    eq(translationsTable.recordId, canonicalItemId),
    inArray(translationsTable.field, ["title", "body"]),
  ));
  const overlays = editorial
    .filter((row: any) => row.language !== "sl")
    .flatMap((row: any) => [
      { model: "item", recordId: canonicalItemId, field: "title", lang: row.language, value: row.name },
      { model: "item", recordId: canonicalItemId, field: "body", lang: row.language, value: row.description },
    ]);
  if (overlays.length) await tx.insert(translationsTable).values(overlays);

  await tx.insert(itemDistanceProposalsTable).values({
    itemId: canonicalItemId,
    tenantId: proposal.tenantId,
    status: "approved",
    source: "creator-approved-proposal",
    confidence: "operator-approved",
    latitude: proposal.latitude,
    longitude: proposal.longitude,
    distanceMeters: proposal.roadDistanceM,
    durationMinutes: travelDurationS / 60,
    resolvedAddress: authoritativeAddress,
    geocodeQuery: proposal.confirmedQuery,
    inputFingerprint: `creator:${proposal.id}`,
  }).onConflictDoUpdate({
    target: itemDistanceProposalsTable.itemId,
    set: {
      status: "approved",
      latitude: proposal.latitude,
      longitude: proposal.longitude,
      distanceMeters: proposal.roadDistanceM,
      durationMinutes: travelDurationS / 60,
      resolvedAddress: authoritativeAddress,
      geocodeQuery: proposal.confirmedQuery,
      inputFingerprint: `creator:${proposal.id}`,
      updatedAt: new Date(),
    },
  });
  await tx.delete(itemCategoryAttachmentsTable)
    .where(eq(itemCategoryAttachmentsTable.sourceProposalId, proposal.id));
  await tx.insert(itemCategoryAttachmentsTable).values({
    itemId: canonicalItemId,
    categoryId: proposal.categoryId,
    sourceProposalId: proposal.id,
  }).onConflictDoNothing();
  await tx.insert(creatorPlaceMaterializationsTable).values({
    tenantId: proposal.tenantId,
    entityKey,
    canonicalPlaceId: canonicalPlaceId!,
    proposalId: proposal.id,
    itemId: canonicalItemId,
    runId: proposal.runId,
    confirmationMethod: proposal.confirmationMethod,
    authoritativeAddress,
    latitude: proposal.latitude,
    longitude: proposal.longitude,
    roadDistanceM: proposal.roadDistanceM,
    travelDurationS: proposal.travelDurationS,
    range: proposal.range,
    editorialJson: JSON.stringify(editorial.map((row: any) => ({
      language: row.language, name: row.name, description: row.description,
    }))),
    provenanceJson,
    isActive: true,
  }).onConflictDoUpdate({
    target: creatorPlaceMaterializationsTable.proposalId,
    set: {
      // Snapshot provenance is immutable. Only lifecycle state changes here;
      // current guest fields are the canonical item/distance projection above.
      isActive: true,
      updatedAt: new Date(),
    },
  });
}

export async function backfillApprovedCreatorProposalMaterializations(
  tenantId: string,
  options: { dryRun?: boolean } = {},
): Promise<CreatorApprovedBackfillResult> {
  const candidates = await db.select({
    proposalId: creatorPlaceProposalsTable.id,
    proposedName: creatorPlaceProposalsTable.proposedName,
  })
    .from(creatorPlaceProposalsTable)
    .leftJoin(
      creatorPlaceMaterializationsTable,
      eq(creatorPlaceMaterializationsTable.proposalId, creatorPlaceProposalsTable.id),
    )
    .where(and(
      eq(creatorPlaceProposalsTable.tenantId, tenantId),
      eq(creatorPlaceProposalsTable.status, "approved"),
      isNull(creatorPlaceMaterializationsTable.id),
    ))
    .orderBy(asc(creatorPlaceProposalsTable.createdAt), asc(creatorPlaceProposalsTable.id));
  if (options.dryRun) return {
    backfilled: candidates.length, backfilledProposalIds: candidates.map((candidate) => candidate.proposalId),
    backfilledProposalNames: Object.fromEntries(candidates.map((candidate) => [candidate.proposalId, candidate.proposedName])), failures: [],
  };

  let backfilled = 0;
  const backfilledProposalIds: string[] = [];
  const backfilledProposalNames: Record<string, string> = {};
  const failures: CreatorProposalProcessingFailure[] = [];
  for (const candidate of candidates) {
    try {
      const inserted = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(
          hashtextextended(${`${tenantId}:creator-approved-backfill`}, 0)
        )`);
        const [proposal] = await tx.select().from(creatorPlaceProposalsTable).where(and(
          eq(creatorPlaceProposalsTable.id, candidate.proposalId),
          eq(creatorPlaceProposalsTable.tenantId, tenantId),
          eq(creatorPlaceProposalsTable.status, "approved"),
        )).for("update").limit(1);
        if (!proposal) return false;
        const [existing] = await tx.select({ id: creatorPlaceMaterializationsTable.id })
          .from(creatorPlaceMaterializationsTable)
          .where(eq(creatorPlaceMaterializationsTable.proposalId, proposal.id))
          .limit(1);
        if (existing) return false;
        await syncApprovedCreatorPlace(tx, proposal);
        return true;
      });
      if (inserted) {
        backfilled += 1;
        backfilledProposalIds.push(candidate.proposalId);
        backfilledProposalNames[candidate.proposalId] = candidate.proposedName;
      }
    } catch (error) {
      failures.push({
        proposalId: candidate.proposalId,
        proposedName: candidate.proposedName,
        reason: creatorProposalProcessingReason(error),
      });
    }
  }
  return { backfilled, backfilledProposalIds, backfilledProposalNames, failures };
}

async function deactivateCreatorPlace(tx: any, proposalId: string) {
  const [materialized] = await tx.select().from(creatorPlaceMaterializationsTable)
    .where(eq(creatorPlaceMaterializationsTable.proposalId, proposalId)).limit(1);
  if (!materialized) return;
  await tx.update(creatorPlaceMaterializationsTable).set({ isActive: false, updatedAt: new Date() })
    .where(eq(creatorPlaceMaterializationsTable.id, materialized.id));
  const materializations = await tx.select({
    proposalId: creatorPlaceMaterializationsTable.proposalId,
    isActive: creatorPlaceMaterializationsTable.isActive,
    categoryId: creatorPlaceProposalsTable.categoryId,
  }).from(creatorPlaceMaterializationsTable)
    .innerJoin(
      creatorPlaceProposalsTable,
      eq(creatorPlaceProposalsTable.id, creatorPlaceMaterializationsTable.proposalId),
    ).where(
      eq(creatorPlaceMaterializationsTable.itemId, materialized.itemId),
    );
  const inactiveProposalIds = materializations
    .filter((row: any) => !row.isActive)
    .map((row: any) => row.proposalId);
  if (inactiveProposalIds.length) {
    await tx.delete(itemCategoryAttachmentsTable).where(and(
      eq(itemCategoryAttachmentsTable.itemId, materialized.itemId),
      inArray(itemCategoryAttachmentsTable.sourceProposalId, inactiveProposalIds),
    ));
  }
  // Rebuild any surviving managed membership. This also transfers ownership
  // when two proposals intentionally share the same item/category and the
  // departing proposal previously owned the deduplicated attachment row.
  for (const row of materializations.filter((candidate: any) => candidate.isActive && candidate.categoryId)) {
    await tx.insert(itemCategoryAttachmentsTable).values({
      itemId: materialized.itemId,
      categoryId: row.categoryId,
      sourceProposalId: row.proposalId,
    }).onConflictDoNothing();
  }
  const survivor = materializations.find((row: any) => row.isActive && row.categoryId);
  if (survivor) {
    await tx.update(itemsTable).set({
      categoryId: survivor.categoryId,
      isVisible: true,
    }).where(eq(itemsTable.id, materialized.itemId));
  } else {
    await tx.update(itemsTable).set({ isVisible: false })
      .where(eq(itemsTable.id, materialized.itemId));
  }
}

export async function editCreatorProposalEditorial(input: {
  tenantId: string;
  proposalId: string;
  actorId: string;
  categoryId: string | null;
  operatorAddress: string | null;
  translations: Array<{ language: string; name: string; description: string }>;
}) {
  await requireActor(input.actorId);
  const languageSet = new Set(input.translations.map((row) => row.language));
  if (
    input.translations.length !== 4 ||
    languageSet.size !== 4 ||
    !["sl", "en", "de", "it"].every((language) => languageSet.has(language)) ||
    input.translations.some((row) => !row.name.trim())
  ) {
    throw new CreatorBulkApprovalError("Predlog potrebuje ime in vse štiri jezike.");
  }
  let category: { id: string; key: string | null; label: string } | null = null;
  if (input.categoryId) {
    [category] = await db.select({
      id: categoriesTable.id,
      key: categoriesTable.key,
      label: categoriesTable.label,
    }).from(categoriesTable)
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .where(and(
        eq(categoriesTable.id, input.categoryId),
        eq(sectionsTable.tenantId, input.tenantId),
        isNull(categoriesTable.deletedAt),
      ))
      .limit(1);
    if (!category) throw new Error("Kategorija ni najdena.");
  }
  await db.transaction(async (tx) => {
    const [proposal] = await tx.select({
      id: creatorPlaceProposalsTable.id,
      confirmationMethod: creatorPlaceProposalsTable.confirmationMethod,
      status: creatorPlaceProposalsTable.status,
    })
      .from(creatorPlaceProposalsTable)
      .where(and(
        eq(creatorPlaceProposalsTable.id, input.proposalId),
        eq(creatorPlaceProposalsTable.tenantId, input.tenantId),
        or(
          eq(creatorPlaceProposalsTable.status, "pending"),
          eq(creatorPlaceProposalsTable.status, "approved"),
          and(
            eq(creatorPlaceProposalsTable.status, "unresolved"),
            eq(creatorPlaceProposalsTable.confirmationMethod, "operator_coordinates"),
          ),
        ),
      ))
      .limit(1);
    if (!proposal) throw new Error("Predlog ni najden ali ga ni mogoče urediti.");
    const operatorAddress = input.operatorAddress?.trim() || null;
    if (proposal.confirmationMethod === "operator_coordinates" && !operatorAddress) {
      throw new CreatorBulkApprovalError("Ročno postavljen predlog potrebuje naslov, ki ga vnese operater.");
    }
    await tx.update(creatorPlaceProposalsTable)
      .set({
        categoryId: category?.id ?? null,
        operatorAddress: proposal.confirmationMethod === "operator_coordinates"
          ? operatorAddress
          : null,
        updatedAt: new Date(),
      })
      .where(eq(creatorPlaceProposalsTable.id, proposal.id));
    await tx.delete(creatorProposalTranslationsTable)
      .where(eq(creatorProposalTranslationsTable.proposalId, proposal.id));
    await tx.insert(creatorProposalTranslationsTable).values(input.translations.map((row) => ({
      proposalId: proposal.id,
      language: row.language,
      name: row.name.trim(),
      description: row.description.trim(),
    })));
    await tx.update(creatorPlaceProposalsTable).set({
      contentReady: missingCreatorEditorialLanguages(input.translations).length === 0,
      updatedAt: new Date(),
    }).where(eq(creatorPlaceProposalsTable.id, proposal.id));
    if (proposal.status === "approved") {
      const [fresh] = await tx.select().from(creatorPlaceProposalsTable)
        .where(eq(creatorPlaceProposalsTable.id, proposal.id)).limit(1);
      await syncApprovedCreatorPlace(tx, fresh);
    }
  });
  return (await listCreatorProposalQueue(input.tenantId))
    .find((row) => row.id === input.proposalId);
}

export async function rejectCreatorProposalIndividually(
  tenantId: string,
  proposalId: string,
  actorId: string,
) {
  await requireActor(actorId);
  const updated = await db.transaction(async (tx) => {
    const [proposal] = await tx.select().from(creatorPlaceProposalsTable).where(and(
      eq(creatorPlaceProposalsTable.id, proposalId),
      eq(creatorPlaceProposalsTable.tenantId, tenantId),
    )).limit(1);
    if (!proposal) return null;
    const rejectionIdentity = proposal.osmType && proposal.osmId !== null
      ? `osm:${proposal.osmType}:${proposal.osmId}`
      : proposal.latitude !== null && proposal.longitude !== null
        ? `coordinates:${proposal.latitude.toFixed(5)}:${proposal.longitude.toFixed(5)}`
        : null;
    const [row] = await tx.update(creatorPlaceProposalsTable).set({
      status: "rejected",
      refusalReason: "human-rejected",
      rejectionIdentity,
      rejectedFromStatus: proposal.status,
      rejectedFromReason: proposal.refusalReason,
      reviewedBy: actorId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(creatorPlaceProposalsTable.id, proposalId),
      eq(creatorPlaceProposalsTable.tenantId, tenantId),
      inArray(creatorPlaceProposalsTable.status, ["pending", "unresolved", "approved"]),
      eq(creatorPlaceProposalsTable.contentReady, true),
    )).returning({ id: creatorPlaceProposalsTable.id });
    if (row) await deactivateCreatorPlace(tx, proposal.id);
    return row ?? null;
  });
  if (!updated) throw new Error("Predlog ni najden ali ga ni mogoče zavrniti.");
  return (await listCreatorProposalQueue(tenantId)).find((row) => row.id === proposalId);
}

export async function undoCreatorProposalRejection(
  tenantId: string,
  proposalId: string,
  actorId: string,
) {
  await requireActor(actorId);
  await db.transaction(async (tx) => {
    const [proposal] = await tx.select().from(creatorPlaceProposalsTable).where(and(
      eq(creatorPlaceProposalsTable.id, proposalId),
      eq(creatorPlaceProposalsTable.tenantId, tenantId),
      eq(creatorPlaceProposalsTable.status, "rejected"),
      eq(creatorPlaceProposalsTable.contentReady, true),
    )).limit(1).for("update");
    if (!proposal) throw new Error("Zavrnjen predlog ni najden.");
    const restoredStatus = proposal.rejectedFromStatus === "approved"
      ? "approved"
      : proposal.rejectedFromStatus === "pending" ? "pending" : "unresolved";
    const [updated] = await tx.update(creatorPlaceProposalsTable).set({
      status: restoredStatus,
      refusalReason: restoredStatus === "pending"
        ? null
        : proposal.rejectedFromReason ?? "operator-review-required",
      rejectionIdentity: null,
      rejectedFromStatus: null,
      rejectedFromReason: null,
      reviewedBy: restoredStatus === "approved" ? proposal.reviewedBy : null,
      reviewedAt: restoredStatus === "approved" ? proposal.reviewedAt : null,
      updatedAt: new Date(),
    }).where(eq(creatorPlaceProposalsTable.id, proposalId)).returning();
    if (!updated) throw new Error("Zavrnitve ni bilo mogoče razveljaviti.");
    if (restoredStatus === "approved") await syncApprovedCreatorPlace(tx, updated);
  });
  return (await listCreatorProposalQueue(tenantId)).find((row) => row.id === proposalId);
}

export async function rejectCreatorProposalsBulk(
  tenantId: string,
  proposalIds: string[],
  actorId: string,
) {
  await requireActor(actorId);
  if (proposalIds.length === 0) return [];
  for (const proposalId of [...new Set(proposalIds)]) {
    await rejectCreatorProposalIndividually(tenantId, proposalId, actorId);
  }
  return listCreatorProposalQueue(tenantId);
}

export async function retryInfrastructureFailedCreatorProposals(
  tenantId: string,
  actorId: string,
  options: { fetchFn?: FetchFn; sleepFn?: (milliseconds: number) => Promise<void> } = {},
) {
  await requireActor(actorId);
  const [tenant] = await db.select({
    latitude: tenantsTable.latitude,
    longitude: tenantsTable.longitude,
  }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenant || tenant.latitude === null || tenant.longitude === null) {
    throw new Error("Izhodišče nima koordinat.");
  }
  const rows = await db.select().from(creatorPlaceProposalsTable).where(and(
    eq(creatorPlaceProposalsTable.tenantId, tenantId),
    eq(creatorPlaceProposalsTable.status, "unresolved"),
    eq(creatorPlaceProposalsTable.refusalReason, "nominatim-unavailable"),
    eq(creatorPlaceProposalsTable.contentReady, true),
  )).orderBy(asc(creatorPlaceProposalsTable.createdAt));
  const paced = createPacedNominatimFetch({
    fetchFn: options.fetchFn,
    sleepFn: options.sleepFn,
    minimumIntervalMs: 1_000,
  });
  let retried = 0;
  let resolved = 0;
  for (const row of rows) {
    const result = await runCreatorSieve(row.proposedName, {
      latitude: tenant.latitude,
      longitude: tenant.longitude,
    }, {
      fallbackQuery: row.geocodingLookupHint ?? undefined,
      fetchFn: paced.fetchFn,
    });
    const attempts: CreatorVerificationRecord["attempts"] = result.attempts;
    await recordCreatorVerification(tenantId, row.id, result.verdict === "resolved" ? {
      originalQuery: result.originalQuery,
      confirmedQuery: result.confirmedQuery,
      confirmationMethod: result.confirmationMethod,
      status: "pending",
      refusalReason: null,
      resolvedName: result.candidate.returnedName,
      resolvedAddress: result.candidate.displayName || null,
      osmType: result.candidate.osmType,
      osmId: result.candidate.osmId,
      osmCategory: result.candidate.className,
      osmFeatureType: result.candidate.type,
      osmAddressType: result.candidate.addresstype,
      latitude: result.candidate.latitude,
      longitude: result.candidate.longitude,
      straightLineDistanceM: result.candidate.distanceKm * 1000,
      attempts,
    } : {
      originalQuery: result.originalQuery,
      confirmedQuery: null, confirmationMethod: null, status: "unresolved",
      refusalReason: result.rule, resolvedName: null, resolvedAddress: null,
      osmType: null, osmId: null, osmCategory: null, osmFeatureType: null,
      osmAddressType: null, latitude: null, longitude: null,
      straightLineDistanceM: null, attempts,
    });
    if (result.verdict === "resolved") {
      const route = await computeRoadRoute(
        { latitude: tenant.latitude, longitude: tenant.longitude },
        { latitude: result.candidate.latitude, longitude: result.candidate.longitude },
      );
      const durationS = route ? Math.round(route.durationMinutes * 60) : null;
      await db.update(creatorPlaceProposalsTable).set({
        roadDistanceM: route?.distanceMeters ?? null,
        travelDurationS: durationS,
        range: route ? route.durationMinutes <= 20 ? "near" : "excursion" : null,
        status: !route || durationS! > CREATOR_MAX_QUEUE_DURATION_S ? "unresolved" : "pending",
        refusalReason: !route
          ? "osrm-unavailable"
          : durationS! > CREATOR_MAX_QUEUE_DURATION_S ? "duration-ceiling" : null,
        updatedAt: new Date(),
      }).where(and(
        eq(creatorPlaceProposalsTable.id, row.id),
        eq(creatorPlaceProposalsTable.tenantId, tenantId),
      ));
    }
    retried++;
    if (result.verdict === "resolved") resolved++;
    if (paced.isStopped()) break;
  }
  return { eligible: rows.length, retried, resolved, unresolved: retried - resolved };
}

export async function confirmCreatorProposalCoordinates(input: {
  tenantId: string;
  proposalId: string;
  actorId: string;
  latitude: number;
  longitude: number;
  operatorAddress: string;
  fetchFn?: FetchFn;
}) {
  await requireActor(input.actorId);
  const operatorAddress = input.operatorAddress.trim();
  if (!operatorAddress) {
    throw new CreatorBulkApprovalError("Ročna potrditev potrebuje naslov, ki ga vnese operater.");
  }
  const [proposal] = await db.select().from(creatorPlaceProposalsTable).where(and(
    eq(creatorPlaceProposalsTable.id, input.proposalId),
    eq(creatorPlaceProposalsTable.tenantId, input.tenantId),
    eq(creatorPlaceProposalsTable.status, "unresolved"),
  )).limit(1);
  if (!proposal) throw new Error("Nerazrešen predlog ni najden.");
  const editorial = await db.select({ language: creatorProposalTranslationsTable.language })
    .from(creatorProposalTranslationsTable)
    .where(eq(creatorProposalTranslationsTable.proposalId, proposal.id));
  const contentReady = missingCreatorEditorialLanguages(editorial).length === 0;
  const alreadyPositioned = proposal.confirmationMethod === "operator_coordinates";
  if (
    alreadyPositioned &&
    (proposal.latitude !== input.latitude || proposal.longitude !== input.longitude)
  ) {
    throw new Error("Prvotno ročno določene točke ni mogoče prepisati.");
  }
  const [tenant] = await db.select({
    latitude: tenantsTable.latitude,
    longitude: tenantsTable.longitude,
  }).from(tenantsTable)
    .where(eq(tenantsTable.id, input.tenantId)).limit(1);
  if (!tenant || tenant.latitude === null || tenant.longitude === null) {
    throw new CreatorBulkApprovalError("Izhodišče nima koordinat.");
  }
  const route = await computeRoadRoute(
    { latitude: tenant.latitude, longitude: tenant.longitude },
    { latitude: input.latitude, longitude: input.longitude },
    input.fetchFn,
  );
  const now = new Date();
  const routable = route && Math.round(route.durationMinutes * 60) <= CREATOR_MAX_QUEUE_DURATION_S;
  const [updated] = await db.update(creatorPlaceProposalsTable).set({
    ...(alreadyPositioned ? {} : {
      confirmationMethod: "operator_coordinates",
      confirmedQuery: "operator-map-pin",
      coordinateConfirmedBy: input.actorId,
      coordinateConfirmedAt: now,
      latitude: input.latitude,
      longitude: input.longitude,
    }),
    straightLineDistanceM: null,
    roadDistanceM: route?.distanceMeters ?? null,
    travelDurationS: route ? Math.round(route.durationMinutes * 60) : null,
    range: route
      ? route.durationMinutes <= 20 ? "near" : "excursion"
      : null,
    // Charman's Bridge: a map pin confirms only coordinates. Any stale
    // Nominatim identity/address must stop being presented as authoritative.
    resolvedName: null,
    resolvedAddress: null,
    operatorAddress,
    contentReady,
    status: routable ? "pending" : "unresolved",
    refusalReason: !route ? "osrm-unavailable" : routable ? null : "duration-ceiling",
    updatedAt: now,
  }).where(and(
    eq(creatorPlaceProposalsTable.id, input.proposalId),
    eq(creatorPlaceProposalsTable.status, "unresolved"),
    ...(alreadyPositioned ? [] : [isNull(creatorPlaceProposalsTable.coordinateConfirmedAt)]),
  )).returning();
  if (!updated) throw new Error("Koordinat ni bilo mogoče shraniti.");
  return (await listCreatorProposalQueue(input.tenantId)).find((row) => row.id === input.proposalId);
}

export class CreatorBulkApprovalError extends Error {
  constructor(
    message: string,
    public readonly proposalId?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

class CreatorProposalMaterializationError extends Error {
  constructor(
    message: string,
    public readonly proposalId: string,
    options: { cause: unknown },
  ) {
    super(message, options);
  }
}

export class CreatorApprovalResponseHydrationError extends Error {}

function targetCreatorApprovalError(error: unknown, proposalId: string): Error {
  if (error instanceof CreatorProposalValidationError) {
    return new CreatorProposalValidationError(error.message, proposalId, { cause: error });
  }
  if (error instanceof CreatorBulkApprovalError) {
    return new CreatorBulkApprovalError(error.message, proposalId, { cause: error });
  }
  return new CreatorProposalMaterializationError(
    error instanceof Error ? error.message : "Predloga ni mogoče materializirati.",
    proposalId,
    { cause: error },
  );
}

export class CreatorApprovalFailurePersistenceError extends Error {
  constructor(
    public readonly approvalReason: string,
    options: { cause: unknown },
  ) {
    super(
      `Potrditev ni uspela (${approvalReason}), zapisa o napaki pa ni bilo mogoče trajno shraniti.`,
      options,
    );
  }
}

async function persistCreatorApprovalFailure(
  tenantId: string,
  proposalId: string,
  actorId: string,
  error: unknown,
): Promise<void> {
  const reason = error instanceof Error ? error.message : "Predloga ni mogoče potrditi.";
  const stage =
    error instanceof CreatorProposalValidationError || error instanceof CreatorBulkApprovalError
      ? "validation"
      : "materialization";
  try {
    await db.insert(creatorProposalProcessingFailuresTable).values({
      tenantId,
      proposalId,
      operation: "approval",
      stage,
      reason,
      actorType: "owner",
      actorId,
    });
  } catch (persistenceError) {
    logger.error(
      { error: persistenceError, tenantId, proposalId, stage, approvalReason: reason },
      "Creator approval failure could not be recorded durably",
    );
    throw new CreatorApprovalFailurePersistenceError(reason, { cause: persistenceError });
  }
}

function hasResolutionEvidence(row: typeof creatorPlaceProposalsTable.$inferSelect): boolean {
  if (row.confirmationMethod === "operator_coordinates") {
    return Boolean(
      row.coordinateConfirmedBy &&
      row.coordinateConfirmedAt &&
      row.latitude !== null &&
      row.longitude !== null &&
      Boolean(row.operatorAddress?.trim()) &&
      row.roadDistanceM !== null &&
      row.travelDurationS !== null,
    );
  }
  return Boolean(
    row.confirmedQuery &&
    row.confirmationMethod &&
    row.resolvedName &&
    row.osmType &&
    row.osmId !== null &&
    row.osmCategory &&
    row.osmFeatureType &&
    row.osmAddressType &&
    row.latitude !== null &&
    row.longitude !== null &&
    row.straightLineDistanceM !== null,
  );
}

async function requireActor(actorId: string) {
  const [actor] = await db.select({ id: adminUsersTable.id })
    .from(adminUsersTable).where(eq(adminUsersTable.id, actorId)).limit(1);
  if (!actor) throw new Error("Operater ni najden.");
}

export async function approveCreatorProposalIndividually(
  tenantId: string,
  proposalId: string,
  actorId: string,
) {
  await requireActor(actorId);
  let updated: typeof creatorPlaceProposalsTable.$inferSelect;
  try {
    updated = await db.transaction(async (tx) => {
      const [proposal] = await tx.select().from(creatorPlaceProposalsTable).where(and(
        eq(creatorPlaceProposalsTable.id, proposalId),
        eq(creatorPlaceProposalsTable.tenantId, tenantId),
        inArray(creatorPlaceProposalsTable.status, ["pending", "approved"]),
      )).limit(1).for("update");
      if (!proposal) throw new Error("Predlog ni najden ali ne čaka več na pregled.");
      // Validate the complete materialization contract before changing status.
      await syncApprovedCreatorPlace(tx, proposal, { validateOnly: true });
      if (!hasResolutionEvidence(proposal)) {
        throw new CreatorProposalValidationError("Predloga brez popolnih strojnih dokazov ni mogoče potrditi.");
      }
      if (proposal.travelDurationS === null || proposal.travelDurationS > CREATOR_MAX_QUEUE_DURATION_S) {
        throw new CreatorProposalValidationError("Predloga nad 90 minutami ali brez poti ni mogoče potrditi.");
      }
      let approved = proposal;
      if (proposal.status === "pending") {
        const [changed] = await tx.update(creatorPlaceProposalsTable).set({
          status: "approved",
          contentReady: true,
          reviewedBy: actorId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(creatorPlaceProposalsTable.id, proposalId)).returning();
        if (!changed) throw new Error("Predloga ni bilo mogoče potrditi.");
        approved = changed;
      } else if (!proposal.contentReady) {
        const [ready] = await tx.update(creatorPlaceProposalsTable).set({
          contentReady: true,
          updatedAt: new Date(),
        }).where(eq(creatorPlaceProposalsTable.id, proposalId)).returning();
        if (!ready) throw new Error("Pripravljenosti predloga ni bilo mogoče uskladiti.");
        approved = ready;
      }
      await syncApprovedCreatorPlace(tx, approved);
      return approved;
    });
  } catch (error) {
    await persistCreatorApprovalFailure(tenantId, proposalId, actorId, error);
    throw error;
  }
  if (!updated) throw new Error("Predlog ni najden ali ne čaka več na pregled.");
  const hydrated = (await listCreatorProposalQueue(tenantId))
    .find((row) => row.id === updated.id);
  if (!hydrated) {
    throw new CreatorApprovalResponseHydrationError(
      "Potrditev je uspela, vendar odgovora ni bilo mogoče ponovno prebrati.",
    );
  }
  return hydrated;
}

export async function unapproveCreatorProposal(
  tenantId: string,
  proposalId: string,
  actorId: string,
) {
  await requireActor(actorId);
  await db.transaction(async (tx) => {
    const [proposal] = await tx.update(creatorPlaceProposalsTable).set({
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(creatorPlaceProposalsTable.id, proposalId),
      eq(creatorPlaceProposalsTable.tenantId, tenantId),
      eq(creatorPlaceProposalsTable.status, "approved"),
    )).returning();
    if (!proposal) throw new Error("Potrjen predlog ni najden.");
    await deactivateCreatorPlace(tx, proposal.id);
  });
  return (await listCreatorProposalQueue(tenantId)).find((row) => row.id === proposalId);
}

export async function approveCreatorProposalsBulk(
  tenantId: string,
  proposalIds: string[],
  actorId: string,
) {
  await requireActor(actorId);
  const uniqueProposalIds = [...new Set(proposalIds)];
  if (uniqueProposalIds.length === 0) return [];
  try {
    return await db.transaction(async (tx) => {
      const rows = await tx.select({
        proposal: creatorPlaceProposalsTable,
      }).from(creatorPlaceProposalsTable).where(and(
        eq(creatorPlaceProposalsTable.tenantId, tenantId),
        inArray(creatorPlaceProposalsTable.id, uniqueProposalIds),
      )).for("update");
      if (rows.length !== uniqueProposalIds.length) {
        const found = new Set(rows.map(({ proposal }) => proposal.id));
        const missingProposalId = uniqueProposalIds.find((proposalId) => !found.has(proposalId));
        throw new CreatorBulkApprovalError(
          "Eden ali več predlogov ni bilo mogoče najti.",
          missingProposalId,
        );
      }
      const individualOnly = rows.find(({ proposal }) => proposal.requiresIndividualReview);
      if (individualOnly) {
        throw new CreatorBulkApprovalError(
          "Predloga, potrjenega s skrajšano poizvedbo, ni mogoče množično potrditi.",
          individualOnly.proposal.id,
        );
      }
      const unavailable = rows.find(({ proposal }) => proposal.status !== "pending");
      if (unavailable) {
        throw new CreatorBulkApprovalError(
          "Potrditi je mogoče samo pripravljene predloge, ki čakajo na pregled.",
          unavailable.proposal.id,
        );
      }
      for (const { proposal } of rows) {
        try {
          await syncApprovedCreatorPlace(tx, proposal, { validateOnly: true });
          if (!hasResolutionEvidence(proposal)) {
            throw new CreatorProposalValidationError(
              "Predloga brez popolnih strojnih dokazov ni mogoče potrditi.",
            );
          }
          if (proposal.travelDurationS === null || proposal.travelDurationS > CREATOR_MAX_QUEUE_DURATION_S) {
            throw new CreatorProposalValidationError(
              "Predloga nad 90 minutami ali brez poti ni mogoče potrditi.",
            );
          }
        } catch (error) {
          throw targetCreatorApprovalError(error, proposal.id);
        }
      }
      const approved = await tx.update(creatorPlaceProposalsTable).set({
        status: "approved",
        contentReady: true,
        reviewedBy: actorId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(
        eq(creatorPlaceProposalsTable.tenantId, tenantId),
        eq(creatorPlaceProposalsTable.status, "pending"),
        inArray(creatorPlaceProposalsTable.id, uniqueProposalIds),
        eq(creatorPlaceProposalsTable.requiresIndividualReview, false),
      )).returning();
      for (const proposal of approved) {
        try {
          await syncApprovedCreatorPlace(tx, proposal);
        } catch (error) {
          throw targetCreatorApprovalError(error, proposal.id);
        }
      }
      return approved;
    });
  } catch (error) {
    const targetedProposalId =
      error instanceof CreatorProposalValidationError ||
      error instanceof CreatorBulkApprovalError ||
      error instanceof CreatorProposalMaterializationError
        ? error.proposalId
        : undefined;
    const failedProposalIds = targetedProposalId ? [targetedProposalId] : uniqueProposalIds;
    await Promise.all(failedProposalIds.map((proposalId) =>
      persistCreatorApprovalFailure(tenantId, proposalId, actorId, error)));
    throw error;
  }
}