import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { adminUsersTable } from "./admin";
import { tenantsTable } from "./tenants";
import { categoriesTable, itemsTable } from "./content";

export const creatorPlaceProposalsTable = pgTable(
  "creator_place_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    runId: uuid("run_id").notNull(),
    // C1 adds metadata to the existing ledger without making run_id a foreign
    // key: Step B rows predate creator_runs and must remain readable.
    categoryId: uuid("category_id").references(() => categoriesTable.id),
    range: text("range"),
    geocodingLookupHint: text("geocoding_lookup_hint"),
    inclusionReason: text("inclusion_reason"),
    // Ready means the full run and all four editorial language rows are
    // durable. It deliberately includes unresolved rows so infrastructure and
    // lookup failures remain visible and manually confirmable.
    contentReady: boolean("content_ready").notNull().default(false),
    proposedName: text("proposed_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    originalQuery: text("original_query").notNull(),
    confirmedQuery: text("confirmed_query"),
    confirmationMethod: text("confirmation_method"),
    coordinateConfirmedBy: uuid("coordinate_confirmed_by").references(() => adminUsersTable.id),
    coordinateConfirmedAt: timestamp("coordinate_confirmed_at", { withTimezone: true }),
    requiresIndividualReview: boolean("requires_individual_review").generatedAlwaysAs(
      sql`COALESCE(${sql.identifier("confirmation_method")} IN ('shortened_query','operator_coordinates'), false)`,
    ),
    status: text("status").notNull().default("pending"),
    supersededBy: uuid("superseded_by").references(
      (): AnyPgColumn => creatorPlaceProposalsTable.id,
    ),
    refusalReason: text("refusal_reason"),
    rejectionIdentity: text("rejection_identity"),
    rejectedFromStatus: text("rejected_from_status"),
    rejectedFromReason: text("rejected_from_reason"),
    resolvedName: text("resolved_name"),
    resolvedAddress: text("resolved_address"),
    // Manual coordinates do not make a Nominatim address authoritative.
    // This is deliberately nullable for ordinarily geocoded proposals.
    operatorAddress: text("operator_address"),
    osmType: text("osm_type"),
    osmId: bigint("osm_id", { mode: "number" }),
    osmCategory: text("osm_category"),
    osmFeatureType: text("osm_feature_type"),
    osmAddressType: text("osm_address_type"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    straightLineDistanceM: doublePrecision("straight_line_distance_m"),
    roadDistanceM: doublePrecision("road_distance_m"),
    travelDurationS: integer("travel_duration_s"),
    reviewedBy: uuid("reviewed_by").references(() => adminUsersTable.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    check("creator_place_proposals_status_check", sql`${t.status} IN ('pending','unresolved','approved','rejected','superseded')`),
    check("creator_place_proposals_confirmation_method_check", sql`${t.confirmationMethod} IS NULL OR ${t.confirmationMethod} IN ('exact','generic_type','address_token','shortened_query','overpass_near','operator_coordinates')`),
    check("creator_place_proposals_operator_provenance_check", sql`${t.confirmationMethod} <> 'operator_coordinates' OR (${t.coordinateConfirmedBy} IS NOT NULL AND ${t.coordinateConfirmedAt} IS NOT NULL AND ${t.latitude} IS NOT NULL AND ${t.longitude} IS NOT NULL)`),
    check("creator_place_proposals_review_check", sql`${t.status} NOT IN ('approved','rejected') OR (${t.reviewedBy} IS NOT NULL AND ${t.reviewedAt} IS NOT NULL)`),
    check("creator_place_proposals_unresolved_reason_check", sql`${t.status} <> 'unresolved' OR ${t.refusalReason} IS NOT NULL`),
    check("creator_place_proposals_superseded_pointer_check", sql`${t.status} <> 'superseded' OR ${t.supersededBy} IS NOT NULL`),
    check("creator_place_proposals_no_self_supersede_check", sql`${t.supersededBy} IS NULL OR ${t.supersededBy} <> ${t.id}`),
    check("creator_place_proposals_confirmed_query_check", sql`${t.confirmationMethod} IS NULL OR ${t.confirmedQuery} IS NOT NULL`),
    check("creator_place_proposals_shortened_query_check", sql`${t.confirmationMethod} <> 'shortened_query' OR ${t.confirmedQuery} <> ${t.originalQuery}`),
    check("creator_place_proposals_osm_identity_check", sql`(${t.osmType} IS NULL) = (${t.osmId} IS NULL)`),
    check("creator_place_proposals_latitude_check", sql`${t.latitude} IS NULL OR ${t.latitude} BETWEEN -90 AND 90`),
    check("creator_place_proposals_longitude_check", sql`${t.longitude} IS NULL OR ${t.longitude} BETWEEN -180 AND 180`),
    check("creator_place_proposals_straight_distance_check", sql`${t.straightLineDistanceM} IS NULL OR ${t.straightLineDistanceM} >= 0`),
    check("creator_place_proposals_road_distance_check", sql`${t.roadDistanceM} IS NULL OR ${t.roadDistanceM} >= 0`),
    check("creator_place_proposals_duration_check", sql`${t.travelDurationS} IS NULL OR ${t.travelDurationS} >= 0`),
    check("creator_place_proposals_range_check", sql`${t.range} IS NULL OR ${t.range} IN ('practical','near','excursion')`),
    // A human rejection is durable across runs. An unresolved sieve result is
    // run evidence and may be checked again after the verification pipe changes.
    uniqueIndex("creator_place_proposals_rejected_identity_uq")
      .on(t.tenantId, t.rejectionIdentity)
      .where(sql`${t.status} = 'rejected' AND ${t.rejectionIdentity} IS NOT NULL`),
    // Still suppress duplicate names inside one model run.
    uniqueIndex("creator_place_proposals_run_unresolved_name_uq")
      .on(t.runId, t.normalizedName)
      .where(sql`${t.osmId} IS NULL`),
    index("creator_place_proposals_tenant_status_idx").on(t.tenantId, t.status, t.createdAt),
    index("creator_place_proposals_run_status_idx").on(t.runId, t.status),
  ],
);

/** Durable C1 execution ledger. run_id on the older proposal table intentionally
 * stays an unconstrained UUID for backward compatibility with Step B. */
export const creatorRunsTable = pgTable(
  "creator_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("running"),
    originLatitude: doublePrecision("origin_latitude").notNull(),
    originLongitude: doublePrecision("origin_longitude").notNull(),
    reportJson: text("report_json"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: doublePrecision("cost_usd"),
    nominatimThrottleWaitMs: integer("nominatim_throttle_wait_ms").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    check("creator_runs_status_check", sql`${t.status} IN ('running','completed','failed')`),
    check("creator_runs_latitude_check", sql`${t.originLatitude} BETWEEN -90 AND 90`),
    check("creator_runs_longitude_check", sql`${t.originLongitude} BETWEEN -180 AND 180`),
    check("creator_runs_tokens_check", sql`${t.inputTokens} >= 0 AND ${t.outputTokens} >= 0`),
    check("creator_runs_wait_check", sql`${t.nominatimThrottleWaitMs} >= 0`),
    index("creator_runs_tenant_status_idx").on(t.tenantId, t.status, t.createdAt),
    // Preserve run history while preventing concurrent C1 execution.
    uniqueIndex("creator_runs_one_running_per_tenant_uq")
      .on(t.tenantId)
      .where(sql`${t.status} = 'running'`),
  ],
);

/** Municipality-scoped source registry for the source-first Creator.
 * Content retrieval is permitted only after an owner changes status to
 * approved; proposal-time robots checks do not retrieve content pages. */
export const creatorSourcesTable = pgTable(
  "creator_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    municipality: text("municipality").notNull(),
    label: text("label").notNull(),
    sourceKind: text("source_kind").notNull(),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    status: text("status").notNull().default("proposed"),
    approvedBy: uuid("approved_by").references(() => adminUsersTable.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    check("creator_sources_status_check", sql`${t.status} IN ('proposed','approved','rejected','revoked')`),
    check(
      "creator_sources_approval_check",
      sql`${t.status} <> 'approved' OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
    uniqueIndex("creator_sources_municipality_url_uq")
      .on(t.municipality, t.canonicalUrl)
      .where(sql`${t.deletedAt} IS NULL`),
    index("creator_sources_municipality_status_idx").on(t.municipality, t.status),
  ],
);

/** Immutable robots.txt retrieval and authorization evidence. The latest
 * unexpired successful row is the controlled cache entry. */
export const creatorRobotsEvidenceTable = pgTable(
  "creator_robots_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id").notNull().references(() => creatorSourcesTable.id, { onDelete: "cascade" }),
    requestedRobotsUrl: text("requested_robots_url").notNull(),
    finalRobotsUrl: text("final_robots_url"),
    userAgent: text("user_agent").notNull(),
    decision: text("decision").notNull(),
    allowed: boolean("allowed").notNull(),
    httpStatus: integer("http_status"),
    policyText: text("policy_text"),
    policySha256: text("policy_sha256"),
    matchedRule: text("matched_rule"),
    error: text("error"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    check("creator_robots_evidence_decision_check", sql`${t.decision} IN ('allowed','disallowed','error')`),
    check("creator_robots_evidence_allow_check", sql`${t.allowed} = (${t.decision} = 'allowed')`),
    index("creator_robots_evidence_source_expiry_idx").on(t.sourceId, t.expiresAt, t.fetchedAt),
  ],
);

/** Immutable extracted page snapshots. No row can exist without the exact
 * robots evidence that authorized its retrieval. */
export const creatorSourceContentsTable = pgTable(
  "creator_source_contents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id").notNull().references(() => creatorSourcesTable.id, { onDelete: "cascade" }),
    robotsEvidenceId: uuid("robots_evidence_id").notNull().references(() => creatorRobotsEvidenceTable.id),
    sourceUrl: text("source_url").notNull(),
    finalUrl: text("final_url").notNull(),
    httpStatus: integer("http_status").notNull(),
    contentType: text("content_type").notNull(),
    title: text("title"),
    // Legacy snapshots predate exact-body retention; every new guarded read
    // writes this value, while old rows remain valid and untouched.
    rawContent: text("raw_content"),
    extractedText: text("extracted_text").notNull(),
    contentSha256: text("content_sha256").notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("creator_source_contents_source_hash_uq").on(t.sourceId, t.contentSha256),
    index("creator_source_contents_source_retrieved_idx").on(t.sourceId, t.retrievedAt),
  ],
);

/** One isolated, model-free source extraction execution. Source-first runs
 * never share the C1 run ledger because their inputs and cost semantics differ. */
export const creatorSourceRunsTable = pgTable(
  "creator_source_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("running"),
    reportJson: text("report_json"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    check("creator_source_runs_status_check", sql`${t.status} IN ('running','completed','failed')`),
    uniqueIndex("creator_source_runs_one_running_per_tenant_uq")
      .on(t.tenantId)
      .where(sql`${t.status} = 'running'`),
    index("creator_source_runs_tenant_idx").on(t.tenantId, t.startedAt),
  ],
);

/** Exact set of guarded snapshots read by one source-first run, including
 * snapshots that deterministically yield zero place facts. */
export const creatorSourceRunSnapshotsTable = pgTable(
  "creator_source_run_snapshots",
  {
    runId: uuid("run_id").notNull().references(() => creatorSourceRunsTable.id, { onDelete: "cascade" }),
    sourceContentId: uuid("source_content_id").notNull().references(() => creatorSourceContentsTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("creator_source_run_snapshots_uq").on(t.runId, t.sourceContentId),
    index("creator_source_run_snapshots_content_idx").on(t.sourceContentId),
  ],
);

/** Immutable deterministic fact extracted from one exact source snapshot. */
export const creatorSourceFactsTable = pgTable(
  "creator_source_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => creatorSourceRunsTable.id, { onDelete: "cascade" }),
    sourceContentId: uuid("source_content_id").notNull().references(() => creatorSourceContentsTable.id),
    placeName: text("place_name").notNull(),
    settlement: text("settlement"),
    categoryKey: text("category_key").notNull(),
    sourceUrl: text("source_url").notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("creator_source_facts_snapshot_fact_uq")
      .on(t.runId, t.sourceContentId, t.placeName, t.settlement, t.categoryKey),
    index("creator_source_facts_run_idx").on(t.runId),
  ],
);

/** One normalized candidate per source-first run. Resolution and routing
 * outcomes are stored here even when the candidate cannot be confirmed. */
export const creatorSourceCandidatesTable = pgTable(
  "creator_source_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => creatorSourceRunsTable.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id").references(() => creatorPlaceProposalsTable.id, { onDelete: "set null" }),
    normalizedName: text("normalized_name").notNull(),
    officialName: text("official_name").notNull(),
    settlement: text("settlement"),
    categoryKey: text("category_key").notNull(),
    outcome: text("outcome").notNull().default("pending"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("creator_source_candidates_outcome_check", sql`${t.outcome} IN ('pending','resolved','unresolved')`),
    check("creator_source_candidates_failure_check", sql`${t.outcome} <> 'unresolved' OR ${t.failureReason} IS NOT NULL`),
    uniqueIndex("creator_source_candidates_run_name_uq").on(t.runId, t.normalizedName),
    uniqueIndex("creator_source_candidates_proposal_uq").on(t.proposalId).where(sql`${t.proposalId} IS NOT NULL`),
  ],
);

/** Many-to-many provenance: duplicate facts merge to one candidate without
 * losing any supporting source snapshot. */
export const creatorSourceCandidateFactsTable = pgTable(
  "creator_source_candidate_facts",
  {
    candidateId: uuid("candidate_id").notNull().references(() => creatorSourceCandidatesTable.id, { onDelete: "cascade" }),
    factId: uuid("fact_id").notNull().references(() => creatorSourceFactsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("creator_source_candidate_facts_uq").on(t.candidateId, t.factId),
    index("creator_source_candidate_facts_fact_idx").on(t.factId),
  ],
);

/** C1 content is queue-only; no guest item is created from these rows. */
export const creatorProposalTranslationsTable = pgTable(
  "creator_proposal_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id").notNull().references(() => creatorPlaceProposalsTable.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    check("creator_proposal_translations_language_check", sql`${t.language} IN ('sl','en','de','it')`),
    uniqueIndex("creator_proposal_translations_proposal_language_uq").on(t.proposalId, t.language),
  ],
);

/**
 * Durable bridge from Creator evidence to the one canonical guest place.
 * Evidence tables are never copied or deleted: proposalId/runId lead back to
 * verification attempts and the source-candidate/fact/snapshot graph.
 */
export const creatorCanonicalPlacesTable = pgTable(
  "creator_canonical_places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    entityKey: text("entity_key").notNull(),
    itemId: uuid("item_id").notNull().references(() => itemsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("creator_canonical_places_tenant_entity_uq").on(t.tenantId, t.entityKey),
    uniqueIndex("creator_canonical_places_item_uq").on(t.itemId),
  ],
);

export const creatorPlaceMaterializationsTable = pgTable(
  "creator_place_materializations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    entityKey: text("entity_key").notNull(),
    canonicalPlaceId: uuid("canonical_place_id").notNull().references(() => creatorCanonicalPlacesTable.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id").notNull().references(() => creatorPlaceProposalsTable.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull().references(() => itemsTable.id, { onDelete: "cascade" }),
    runId: uuid("run_id").notNull(),
    confirmationMethod: text("confirmation_method").notNull(),
    authoritativeAddress: text("authoritative_address").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    roadDistanceM: doublePrecision("road_distance_m").notNull(),
    travelDurationS: integer("travel_duration_s").notNull(),
    range: text("range").notNull(),
    // Exact four-language editorial payload captured at first approval.
    editorialJson: text("editorial_json").notNull(),
    // Self-contained audit index; immutable source snapshots remain canonical.
    provenanceJson: text("provenance_json").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("creator_place_materializations_proposal_uq").on(t.proposalId),
    index("creator_place_materializations_tenant_entity_idx").on(t.tenantId, t.entityKey),
    index("creator_place_materializations_tenant_active_idx").on(t.tenantId, t.isActive),
    check("creator_place_materializations_range_check", sql`${t.range} IN ('practical','near','excursion')`),
  ],
);

export const creatorVerificationAttemptsTable = pgTable(
  "creator_verification_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id").notNull().references(() => creatorPlaceProposalsTable.id, { onDelete: "cascade" }),
    attemptNumber: smallint("attempt_number").notNull(),
    generation: smallint("generation").notNull().default(0),
    query: text("query").notNull(),
    verdict: text("verdict").notNull(),
    refusalRule: text("refusal_rule"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("creator_verification_attempts_number_check", sql`${t.attemptNumber} IN (1, 2)`),
    check("creator_verification_attempts_verdict_check", sql`${t.verdict} IN ('resolved','refused')`),
    check("creator_verification_attempts_refusal_check", sql`${t.verdict} <> 'refused' OR ${t.refusalRule} IS NOT NULL`),
    uniqueIndex("creator_verification_attempts_proposal_generation_number_uq").on(t.proposalId, t.generation, t.attemptNumber),
  ],
);

export const creatorVerificationCandidatesTable = pgTable(
  "creator_verification_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id").notNull().references(() => creatorVerificationAttemptsTable.id, { onDelete: "cascade" }),
    candidatePosition: smallint("candidate_position").notNull(),
    osmType: text("osm_type"),
    osmId: bigint("osm_id", { mode: "number" }),
    osmCategory: text("osm_category"),
    osmFeatureType: text("osm_feature_type"),
    osmAddressType: text("osm_address_type"),
    resolvedName: text("resolved_name"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    straightLineDistanceM: doublePrecision("straight_line_distance_m"),
    selected: boolean("selected").notNull().default(false),
  },
  (t) => [
    check("creator_verification_candidates_position_check", sql`${t.candidatePosition} >= 0`),
    check("creator_verification_candidates_osm_identity_check", sql`(${t.osmType} IS NULL) = (${t.osmId} IS NULL)`),
    uniqueIndex("creator_verification_candidates_attempt_position_uq").on(t.attemptId, t.candidatePosition),
    uniqueIndex("creator_verification_candidates_selected_uq").on(t.attemptId).where(sql`${t.selected}`),
  ],
);

export type CreatorPlaceProposal = typeof creatorPlaceProposalsTable.$inferSelect;
export type CreatorVerificationAttempt = typeof creatorVerificationAttemptsTable.$inferSelect;
export type CreatorVerificationCandidate = typeof creatorVerificationCandidatesTable.$inferSelect;
export type CreatorRun = typeof creatorRunsTable.$inferSelect;
export type CreatorProposalTranslation = typeof creatorProposalTranslationsTable.$inferSelect;
export type CreatorPlaceMaterialization = typeof creatorPlaceMaterializationsTable.$inferSelect;
export type CreatorSource = typeof creatorSourcesTable.$inferSelect;
export type CreatorRobotsEvidence = typeof creatorRobotsEvidenceTable.$inferSelect;
export type CreatorSourceContent = typeof creatorSourceContentsTable.$inferSelect;
export type CreatorSourceRun = typeof creatorSourceRunsTable.$inferSelect;
export type CreatorSourceRunSnapshot = typeof creatorSourceRunSnapshotsTable.$inferSelect;
export type CreatorSourceFact = typeof creatorSourceFactsTable.$inferSelect;
export type CreatorSourceCandidate = typeof creatorSourceCandidatesTable.$inferSelect;