import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  ne,
  sql,
} from "drizzle-orm";
import {
  adminUsersTable,
  creatorPlaceProposalsTable,
  creatorVerificationAttemptsTable,
  creatorVerificationCandidatesTable,
  db,
} from "@workspace/db";
import { runCreatorSieve } from "./creatorSieve";
import type { FetchFn } from "./distanceEngine";

export function normalizeCreatorProposalName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("sl")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export async function upsertPendingCreatorProposal(input: {
  tenantId: string;
  runId: string;
  proposedName: string;
  originalQuery: string;
}) {
  const normalizedName = normalizeCreatorProposalName(input.proposedName);
  const [inserted] = await db
    .insert(creatorPlaceProposalsTable)
    .values({ ...input, normalizedName })
    // Intentionally suppresses both partial unique-index conflicts. A rerun
    // never errors merely because the same unresolved name is already in flight.
    .onConflictDoNothing()
    .returning();
  if (inserted) return { proposal: inserted, inserted: true };
  const [existing] = await db
    .select()
    .from(creatorPlaceProposalsTable)
    .where(and(
      eq(creatorPlaceProposalsTable.tenantId, input.tenantId),
      eq(creatorPlaceProposalsTable.normalizedName, normalizedName),
      isNull(creatorPlaceProposalsTable.osmId),
    ))
    .limit(1);
  if (!existing) throw new Error("Predloga po konfliktu ni bilo mogoče ponovno prebrati.");
  return { proposal: existing, inserted: false };
}

export type CreatorVerificationRecord = {
  originalQuery: string;
  confirmedQuery: string | null;
  confirmationMethod: "exact" | "generic_type" | "address_token" | "shortened_query" | null;
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
      .where(eq(creatorPlaceProposalsTable.id, proposalId)).limit(1);
    if (!sourceProposal) throw new Error("Predlog ni najden.");

    let canonicalProposal: typeof creatorPlaceProposalsTable.$inferSelect | undefined;
    if (record.osmType && record.osmId !== null) {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            ${`${sourceProposal.tenantId}:${record.osmType}:${record.osmId}`},
            0
          )
        )
      `);
      [canonicalProposal] = await tx.select().from(creatorPlaceProposalsTable)
        .where(and(
          eq(creatorPlaceProposalsTable.tenantId, sourceProposal.tenantId),
          eq(creatorPlaceProposalsTable.osmType, record.osmType),
          eq(creatorPlaceProposalsTable.osmId, record.osmId),
          ne(creatorPlaceProposalsTable.id, proposalId),
        ))
        .limit(1);
    }

    for (const attempt of record.attempts) {
      const [attemptRow] = await tx.insert(creatorVerificationAttemptsTable).values({
        proposalId,
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
    if (canonicalProposal) {
      const [superseded] = await tx.update(creatorPlaceProposalsTable).set({
        originalQuery: record.originalQuery,
        confirmedQuery: record.confirmedQuery,
        confirmationMethod: record.confirmationMethod,
        status: "superseded",
        supersededBy: canonicalProposal.id,
        refusalReason: null,
        resolvedName: record.resolvedName,
        resolvedAddress: record.resolvedAddress,
        osmType: null,
        osmId: null,
        osmCategory: record.osmCategory,
        osmFeatureType: record.osmFeatureType,
        osmAddressType: record.osmAddressType,
        latitude: record.latitude,
        longitude: record.longitude,
        straightLineDistanceM: record.straightLineDistanceM,
        updatedAt: new Date(),
      }).where(eq(creatorPlaceProposalsTable.id, proposalId)).returning();
      if (!superseded) throw new Error("Predloga ni bilo mogoče označiti kot združenega.");
      return canonicalProposal;
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
    }).where(eq(creatorPlaceProposalsTable.id, proposalId)).returning();
    if (!updated) throw new Error("Predlog ni najden.");
    return updated;
  });
}

export async function runAndPersistCreatorSieve(input: {
  tenantId: string;
  runId: string;
  proposedName: string;
  origin: { latitude: number; longitude: number };
  hardCeilingKm?: number;
  fetchFn?: FetchFn;
}) {
  const pending = await upsertPendingCreatorProposal({
    tenantId: input.tenantId,
    runId: input.runId,
    proposedName: input.proposedName,
    originalQuery: input.proposedName,
  });
  if (!pending.inserted) {
    return { proposal: pending.proposal, inserted: false, result: null };
  }
  const result = await runCreatorSieve(input.proposedName, input.origin, {
    hardCeilingKm: input.hardCeilingKm,
    fetchFn: input.fetchFn,
  });
  const attempts: CreatorVerificationRecord["attempts"] = result.attempts.map((attempt) => ({
    ...attempt,
    candidates: attempt.candidates,
  }));
  const proposal = result.verdict === "resolved"
    ? await recordCreatorVerification(pending.proposal.id, {
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
    : await recordCreatorVerification(pending.proposal.id, {
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
  return { proposal, inserted: true, result };
}

export async function listCreatorProposalQueue(tenantId: string) {
  return db.select().from(creatorPlaceProposalsTable)
    .where(and(
      eq(creatorPlaceProposalsTable.tenantId, tenantId),
      ne(creatorPlaceProposalsTable.status, "superseded"),
    ))
    .orderBy(asc(creatorPlaceProposalsTable.createdAt));
}

export class CreatorBulkApprovalError extends Error {}

function hasResolutionEvidence(row: typeof creatorPlaceProposalsTable.$inferSelect): boolean {
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
  const [proposal] = await db.select().from(creatorPlaceProposalsTable).where(and(
    eq(creatorPlaceProposalsTable.id, proposalId),
    eq(creatorPlaceProposalsTable.tenantId, tenantId),
    eq(creatorPlaceProposalsTable.status, "pending"),
  )).limit(1);
  if (!proposal) throw new Error("Predlog ni najden ali ne čaka več na pregled.");
  if (!hasResolutionEvidence(proposal)) {
    throw new Error("Predloga brez popolnih strojnih dokazov ni mogoče potrditi.");
  }
  const [updated] = await db.update(creatorPlaceProposalsTable).set({
    status: "approved",
    reviewedBy: actorId,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(
    eq(creatorPlaceProposalsTable.id, proposalId),
    eq(creatorPlaceProposalsTable.tenantId, tenantId),
    eq(creatorPlaceProposalsTable.status, "pending"),
  )).returning();
  if (!updated) throw new Error("Predlog ni najden ali ne čaka več na pregled.");
  return updated;
}

export async function approveCreatorProposalsBulk(
  tenantId: string,
  proposalIds: string[],
  actorId: string,
) {
  await requireActor(actorId);
  if (proposalIds.length === 0) return [];
  return db.transaction(async (tx) => {
    const rows = await tx.select({
      proposal: creatorPlaceProposalsTable,
    }).from(creatorPlaceProposalsTable).where(and(
      eq(creatorPlaceProposalsTable.tenantId, tenantId),
      inArray(creatorPlaceProposalsTable.id, proposalIds),
    ));
    if (rows.length !== new Set(proposalIds).size) {
      throw new CreatorBulkApprovalError("Eden ali več predlogov ni bilo mogoče najti.");
    }
    if (rows.some(({ proposal }) => proposal.requiresIndividualReview)) {
      throw new CreatorBulkApprovalError(
        "Predloga, potrjenega s skrajšano poizvedbo, ni mogoče množično potrditi.",
      );
    }
    if (rows.some(({ proposal }) => !hasResolutionEvidence(proposal))) {
      throw new CreatorBulkApprovalError(
        "Predloga brez popolnih strojnih dokazov ni mogoče potrditi.",
      );
    }
    return tx.update(creatorPlaceProposalsTable).set({
      status: "approved",
      reviewedBy: actorId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(creatorPlaceProposalsTable.tenantId, tenantId),
      eq(creatorPlaceProposalsTable.status, "pending"),
      inArray(creatorPlaceProposalsTable.id, proposalIds),
      eq(creatorPlaceProposalsTable.requiresIndividualReview, false),
    )).returning();
  });
}