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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { adminUsersTable } from "./admin";
import { tenantsTable } from "./tenants";

export const creatorPlaceProposalsTable = pgTable(
  "creator_place_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    runId: uuid("run_id").notNull(),
    proposedName: text("proposed_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    originalQuery: text("original_query").notNull(),
    confirmedQuery: text("confirmed_query"),
    confirmationMethod: text("confirmation_method"),
    requiresIndividualReview: boolean("requires_individual_review").generatedAlwaysAs(
      sql`COALESCE(${sql.identifier("confirmation_method")} = 'shortened_query', false)`,
    ),
    status: text("status").notNull().default("pending"),
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
    check("creator_place_proposals_confirmation_method_check", sql`${t.confirmationMethod} IS NULL OR ${t.confirmationMethod} IN ('exact','generic_type','address_token','shortened_query')`),
    check("creator_place_proposals_review_check", sql`${t.status} NOT IN ('approved','rejected') OR (${t.reviewedBy} IS NOT NULL AND ${t.reviewedAt} IS NOT NULL)`),
    check("creator_place_proposals_unresolved_reason_check", sql`${t.status} <> 'unresolved' OR ${t.refusalReason} IS NOT NULL`),
    check("creator_place_proposals_confirmed_query_check", sql`${t.confirmationMethod} IS NULL OR ${t.confirmedQuery} IS NOT NULL`),
    check("creator_place_proposals_shortened_query_check", sql`${t.confirmationMethod} <> 'shortened_query' OR ${t.confirmedQuery} <> ${t.originalQuery}`),
    check("creator_place_proposals_osm_identity_check", sql`(${t.osmType} IS NULL) = (${t.osmId} IS NULL)`),
    check("creator_place_proposals_latitude_check", sql`${t.latitude} IS NULL OR ${t.latitude} BETWEEN -90 AND 90`),
    check("creator_place_proposals_longitude_check", sql`${t.longitude} IS NULL OR ${t.longitude} BETWEEN -180 AND 180`),
    check("creator_place_proposals_straight_distance_check", sql`${t.straightLineDistanceM} IS NULL OR ${t.straightLineDistanceM} >= 0`),
    check("creator_place_proposals_road_distance_check", sql`${t.roadDistanceM} IS NULL OR ${t.roadDistanceM} >= 0`),
    check("creator_place_proposals_duration_check", sql`${t.travelDurationS} IS NULL OR ${t.travelDurationS} >= 0`),
    uniqueIndex("creator_place_proposals_osm_identity_uq").on(t.tenantId, t.osmType, t.osmId).where(sql`${t.osmId} IS NOT NULL`),
    uniqueIndex("creator_place_proposals_unresolved_name_uq").on(t.tenantId, t.normalizedName).where(sql`${t.osmId} IS NULL`),
    index("creator_place_proposals_tenant_status_idx").on(t.tenantId, t.status, t.createdAt),
    index("creator_place_proposals_run_status_idx").on(t.runId, t.status),
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