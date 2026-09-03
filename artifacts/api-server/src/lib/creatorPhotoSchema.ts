import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/** Additive startup migration, matching the repository's no-destructive-
 * migration deployment convention. */
export async function ensureCreatorPhotoSchema(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE media ADD COLUMN IF NOT EXISTS provisional boolean NOT NULL DEFAULT false;
    ALTER TABLE media ADD COLUMN IF NOT EXISTS attribution_author text;
    ALTER TABLE media ADD COLUMN IF NOT EXISTS attribution_license text;
    ALTER TABLE media ADD COLUMN IF NOT EXISTS attribution_source_url text;
    ALTER TABLE media ADD COLUMN IF NOT EXISTS provenance_provider text;
    ALTER TABLE media ADD COLUMN IF NOT EXISTS provenance_file text;
    ALTER TABLE media ADD COLUMN IF NOT EXISTS provenance_json text;

    CREATE TABLE IF NOT EXISTS creator_photo_proposals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      materialization_id uuid NOT NULL REFERENCES creator_place_materializations(id) ON DELETE CASCADE,
      item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'pending',
      commons_file text NOT NULL,
      thumbnail_url text NOT NULL,
      original_url text NOT NULL,
      source_page_url text NOT NULL,
      author text NOT NULL,
      license text NOT NULL,
      license_url text,
      confidence text NOT NULL,
      discovery_method text NOT NULL,
      wikidata_id text,
      reviewed_by uuid REFERENCES admin_users(id),
      reviewed_at timestamptz,
      approved_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
      rejection_reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT creator_photo_proposals_status_check CHECK (status IN ('pending','approved','rejected')),
      CONSTRAINT creator_photo_proposals_confidence_check CHECK (confidence IN ('high','low')),
      CONSTRAINT creator_photo_proposals_method_check CHECK (discovery_method IN ('wikidata','geosearch')),
      CONSTRAINT creator_photo_proposals_review_check CHECK (status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS creator_photo_proposals_item_file_uq
      ON creator_photo_proposals(item_id, commons_file);
    CREATE INDEX IF NOT EXISTS creator_photo_proposals_tenant_status_idx
      ON creator_photo_proposals(tenant_id, status, created_at);
    CREATE TABLE IF NOT EXISTS creator_photo_throttle (
      id smallint PRIMARY KEY DEFAULT 1,
      last_request_at timestamptz,
      CONSTRAINT creator_photo_throttle_singleton CHECK (id = 1)
    );
  `);
}