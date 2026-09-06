import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function ensureCreatorDistanceBackfillSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS creator_distance_backfill_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'running',
      origin_latitude double precision NOT NULL,
      origin_longitude double precision NOT NULL,
      computed_count integer NOT NULL DEFAULT 0,
      skipped_count integer NOT NULL DEFAULT 0,
      no_coordinates_count integer NOT NULL DEFAULT 0,
      failure_count integer NOT NULL DEFAULT 0,
      started_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      CONSTRAINT creator_distance_backfill_runs_status_check
        CHECK (status IN ('running', 'completed', 'failed')),
      CONSTRAINT creator_distance_backfill_runs_counts_check
        CHECK (
          computed_count >= 0
          AND skipped_count >= 0
          AND no_coordinates_count >= 0
          AND failure_count >= 0
        )
    );
    CREATE INDEX IF NOT EXISTS creator_distance_backfill_runs_tenant_created_idx
      ON creator_distance_backfill_runs (tenant_id, started_at);
    CREATE UNIQUE INDEX IF NOT EXISTS creator_distance_backfill_runs_one_running_uq
      ON creator_distance_backfill_runs (tenant_id)
      WHERE status = 'running';

    CREATE TABLE IF NOT EXISTS creator_distance_backfill_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id uuid NOT NULL REFERENCES creator_distance_backfill_runs(id) ON DELETE CASCADE,
      item_id uuid NOT NULL,
      item_name text NOT NULL,
      outcome text NOT NULL,
      reason text,
      destination_latitude double precision,
      destination_longitude double precision,
      road_distance_m double precision,
      travel_duration_s integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT creator_distance_backfill_attempts_outcome_check
        CHECK (outcome IN ('computed', 'skipped', 'no_coordinates', 'failed')),
      CONSTRAINT creator_distance_backfill_attempts_coordinates_check
        CHECK ((destination_latitude IS NULL) = (destination_longitude IS NULL)),
      CONSTRAINT creator_distance_backfill_attempts_distance_check
        CHECK (road_distance_m IS NULL OR road_distance_m >= 0),
      CONSTRAINT creator_distance_backfill_attempts_duration_check
        CHECK (travel_duration_s IS NULL OR travel_duration_s >= 0)
    );
    CREATE INDEX IF NOT EXISTS creator_distance_backfill_attempts_run_idx
      ON creator_distance_backfill_attempts (run_id, created_at);
    CREATE INDEX IF NOT EXISTS creator_distance_backfill_attempts_item_idx
      ON creator_distance_backfill_attempts (item_id, created_at);

    DO $upgrade$
    DECLARE
      item_fk_name text;
    BEGIN
      FOR item_fk_name IN
        SELECT constraint_row.conname
        FROM pg_constraint constraint_row
        JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
        JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
        WHERE namespace_row.nspname = current_schema()
          AND table_row.relname = 'creator_distance_backfill_attempts'
          AND constraint_row.contype = 'f'
          AND EXISTS (
            SELECT 1
            FROM unnest(constraint_row.conkey) AS constrained_column(attnum)
            JOIN pg_attribute attribute_row
              ON attribute_row.attrelid = table_row.oid
              AND attribute_row.attnum = constrained_column.attnum
            WHERE attribute_row.attname = 'item_id'
          )
      LOOP
        EXECUTE format(
          'ALTER TABLE creator_distance_backfill_attempts DROP CONSTRAINT %I',
          item_fk_name
        );
      END LOOP;
    END
    $upgrade$;
    UPDATE creator_distance_backfill_attempts
      SET item_id = gen_random_uuid()
      WHERE item_id IS NULL;
    ALTER TABLE creator_distance_backfill_attempts
      ALTER COLUMN item_id SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS creator_distance_backfill_attempts_run_item_uq
      ON creator_distance_backfill_attempts (run_id, item_id);

    CREATE TABLE IF NOT EXISTS creator_osrm_throttle (
      id smallint PRIMARY KEY DEFAULT 1,
      last_request_at timestamptz,
      CONSTRAINT creator_osrm_throttle_singleton CHECK (id = 1)
    );
  `);
}