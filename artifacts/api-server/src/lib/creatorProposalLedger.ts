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
  categoriesTable,
  creatorPlaceProposalsTable,
  creatorProposalTranslationsTable,
  creatorVerificationAttemptsTable,
  creatorVerificationCandidatesTable,
  db,
  sectionsTable,
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
  contentReady?: boolean;
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
  if (existing.status === "superseded") {
    if (!existing.supersededBy) {
      throw new Error("Združeni predlog nima povezave na kanonični predlog.");
    }
    const [canonical] = await db
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
      }).where(and(
        eq(creatorPlaceProposalsTable.id, proposalId),
        eq(creatorPlaceProposalsTable.tenantId, tenantId),
      )).returning();
      if (!superseded) throw new Error("Predloga ni bilo mogoče označiti kot združenega.");
      return {
        sourceProposal: superseded,
        canonicalProposal,
        duplicate: true as const,
      };
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
  contentReady?: boolean;
}) {
  const pending = await upsertPendingCreatorProposal({
    tenantId: input.tenantId,
    runId: input.runId,
    proposedName: input.proposedName,
    originalQuery: input.proposedName,
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
    };
  }
  const result = await runCreatorSieve(input.lookupHint?.trim() || input.proposedName, input.origin, {
    hardCeilingKm: input.hardCeilingKm,
    fetchFn: input.fetchFn,
    onNominatimWait: input.onNominatimWait,
  });
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
  if (input.contentReady !== false && !verification.duplicate) {
    const [ready] = await db.update(creatorPlaceProposalsTable)
      .set({ contentReady: true, updatedAt: new Date() })
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
      eq(creatorPlaceProposalsTable.contentReady, true),
    ))
    .orderBy(asc(creatorPlaceProposalsTable.createdAt));
  if (rows.length === 0) return [];
  const translations = await db.select().from(creatorProposalTranslationsTable)
    .where(inArray(creatorProposalTranslationsTable.proposalId, rows.map(({ proposal }) => proposal.id)))
    .orderBy(asc(creatorProposalTranslationsTable.language));
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
  }));
}

function categoryNeedsBlankDescriptions(category: { key: string | null; label: string }): boolean {
  return /\b(atm|bankomat|shop|trgov|pharmacy|lekar|fuel|bencin|doctor|zdrav|health|post|pošta|hospitality|restaurant|food|hrana|pijača|gostil|restavr)\b/i
    .test(`${category.key ?? ""} ${category.label}`);
}

export async function editCreatorProposalEditorial(input: {
  tenantId: string;
  proposalId: string;
  actorId: string;
  categoryId: string | null;
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
    const [proposal] = await tx.select({ id: creatorPlaceProposalsTable.id })
      .from(creatorPlaceProposalsTable)
      .where(and(
        eq(creatorPlaceProposalsTable.id, input.proposalId),
        eq(creatorPlaceProposalsTable.tenantId, input.tenantId),
        eq(creatorPlaceProposalsTable.status, "pending"),
        eq(creatorPlaceProposalsTable.contentReady, true),
      ))
      .limit(1);
    if (!proposal) throw new Error("Predlog ni najden ali ga ni mogoče urediti.");
    await tx.update(creatorPlaceProposalsTable)
      .set({ categoryId: category?.id ?? null, updatedAt: new Date() })
      .where(eq(creatorPlaceProposalsTable.id, proposal.id));
    await tx.delete(creatorProposalTranslationsTable)
      .where(eq(creatorProposalTranslationsTable.proposalId, proposal.id));
    await tx.insert(creatorProposalTranslationsTable).values(input.translations.map((row) => ({
      proposalId: proposal.id,
      language: row.language,
      name: row.name.trim(),
      description: category && categoryNeedsBlankDescriptions(category) ? "" : row.description.trim(),
    })));
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
  const [updated] = await db.update(creatorPlaceProposalsTable).set({
    status: "rejected",
    refusalReason: "human-rejected",
    reviewedBy: actorId,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(
    eq(creatorPlaceProposalsTable.id, proposalId),
    eq(creatorPlaceProposalsTable.tenantId, tenantId),
    inArray(creatorPlaceProposalsTable.status, ["pending", "unresolved"]),
    eq(creatorPlaceProposalsTable.contentReady, true),
  )).returning({ id: creatorPlaceProposalsTable.id });
  if (!updated) throw new Error("Predlog ni najden ali ga ni mogoče zavrniti.");
  return (await listCreatorProposalQueue(tenantId)).find((row) => row.id === proposalId);
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
  const [hydrated] = await db.select({
    proposal: creatorPlaceProposalsTable,
    categoryLabel: categoriesTable.label,
  }).from(creatorPlaceProposalsTable)
    .leftJoin(categoriesTable, eq(creatorPlaceProposalsTable.categoryId, categoriesTable.id))
    .where(eq(creatorPlaceProposalsTable.id, updated.id))
    .limit(1);
  const translations = await db.select({
    language: creatorProposalTranslationsTable.language,
    name: creatorProposalTranslationsTable.name,
    description: creatorProposalTranslationsTable.description,
  }).from(creatorProposalTranslationsTable)
    .where(eq(creatorProposalTranslationsTable.proposalId, updated.id))
    .orderBy(asc(creatorProposalTranslationsTable.language));
  return {
    ...(hydrated?.proposal ?? updated),
    categoryLabel: hydrated?.categoryLabel ?? null,
    translations,
  };
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