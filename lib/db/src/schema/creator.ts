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
import { categoriesTable } from "./content";

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
    resolvedName: text("resolved_name"),
    resolvedAddress: text("resolved_address"),
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
    uniqueIndex("creator_place_proposals_osm_identity_uq").on(t.tenantId, t.osmType, t.osmId).where(sql`${t.osmId} IS NOT NULL`),
    // A human rejection is durable across runs. An unresolved sieve result is
    // run evidence and may be checked again after the verification pipe changes.
    uniqueIndex("creator_place_proposals_rejected_name_uq")
      .on(t.tenantId, t.normalizedName)
      .where(sql`${t.osmId} IS NULL AND ${t.status} = 'rejected'`),
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

export const creatorVerificationAttemptsTable = pgTable(
  "creator_verification_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id").notNull().references(() => creatorPlaceProposalsTable.id, { onDelete: "cascade" }),
    attemptNumber: smallint("attempt_number").notNull(),
    query: text("query").notNull(),
    verdict: text("verdict").notNull(),
    refusalRule: text("refusal_rule"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("creator_verification_attempts_number_check", sql`${t.attemptNumber} IN (1, 2)`),
    check("creator_verification_attempts_verdict_check", sql`${t.verdict} IN ('resolved','refused')`),
    check("creator_verification_attempts_refusal_check", sql`${t.verdict} <> 'refused' OR ${t.refusalRule} IS NOT NULL`),
    uniqueIndex("creator_verification_attempts_proposal_number_uq").on(t.proposalId, t.attemptNumber),
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