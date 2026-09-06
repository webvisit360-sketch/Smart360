import {
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
import { tenantsTable } from "./tenants";

export const creatorDistanceBackfillRunsTable = pgTable(
  "creator_distance_backfill_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenantsTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("running"),
    originLatitude: doublePrecision("origin_latitude").notNull(),
    originLongitude: doublePrecision("origin_longitude").notNull(),
    computedCount: integer("computed_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    noCoordinatesCount: integer("no_coordinates_count").notNull().default(0),
    failureCount: integer("failure_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    check("creator_distance_backfill_runs_status_check", sql`${t.status} IN ('running','completed','failed')`),
    check("creator_distance_backfill_runs_counts_check", sql`${t.computedCount} >= 0 AND ${t.skippedCount} >= 0 AND ${t.noCoordinatesCount} >= 0 AND ${t.failureCount} >= 0`),
    index("creator_distance_backfill_runs_tenant_created_idx").on(t.tenantId, t.startedAt),
    uniqueIndex("creator_distance_backfill_runs_one_running_uq")
      .on(t.tenantId)
      .where(sql`${t.status} = 'running'`),
  ],
);

export const creatorDistanceBackfillAttemptsTable = pgTable(
  "creator_distance_backfill_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => creatorDistanceBackfillRunsTable.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull(),
    itemName: text("item_name").notNull(),
    outcome: text("outcome").notNull(),
    reason: text("reason"),
    destinationLatitude: doublePrecision("destination_latitude"),
    destinationLongitude: doublePrecision("destination_longitude"),
    roadDistanceM: doublePrecision("road_distance_m"),
    travelDurationS: integer("travel_duration_s"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("creator_distance_backfill_attempts_outcome_check", sql`${t.outcome} IN ('computed','skipped','no_coordinates','failed')`),
    check("creator_distance_backfill_attempts_coordinates_check", sql`(${t.destinationLatitude} IS NULL) = (${t.destinationLongitude} IS NULL)`),
    check("creator_distance_backfill_attempts_distance_check", sql`${t.roadDistanceM} IS NULL OR ${t.roadDistanceM} >= 0`),
    check("creator_distance_backfill_attempts_duration_check", sql`${t.travelDurationS} IS NULL OR ${t.travelDurationS} >= 0`),
    index("creator_distance_backfill_attempts_run_idx").on(t.runId, t.createdAt),
    index("creator_distance_backfill_attempts_item_idx").on(t.itemId, t.createdAt),
    uniqueIndex("creator_distance_backfill_attempts_run_item_uq").on(t.runId, t.itemId),
  ],
);

/** Deployment-wide polite slot for the public OSRM service. */
export const creatorOsrmThrottleTable = pgTable(
  "creator_osrm_throttle",
  {
    id: smallint("id").primaryKey().default(1),
    lastRequestAt: timestamp("last_request_at", { withTimezone: true }),
  },
  (t) => [check("creator_osrm_throttle_singleton", sql`${t.id} = 1`)],
);

export type CreatorDistanceBackfillRun =
  typeof creatorDistanceBackfillRunsTable.$inferSelect;
export type CreatorDistanceBackfillAttempt =
  typeof creatorDistanceBackfillAttemptsTable.$inferSelect;