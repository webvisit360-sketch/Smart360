-- REVIEW ONLY. Do not execute automatically.
-- Additive-only host onboarding schema. No existing table or row is altered.

BEGIN;

CREATE TABLE host_onboarding_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  host_user_id uuid NOT NULL REFERENCES host_users(id) ON DELETE CASCADE,
  round integer NOT NULL CHECK (round > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  draft_data jsonb NOT NULL,
  target_review jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation_review jsonb NOT NULL DEFAULT '[]'::jsonb,
  notification_status text NOT NULL DEFAULT 'not_admitted'
    CHECK (notification_status IN ('not_admitted', 'pending', 'sending', 'sent', 'failed')),
  notification_recipient text,
  notification_provider_message_id text,
  notification_error text,
  notification_attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  CONSTRAINT host_onboarding_rounds_submission_check
    CHECK ((status = 'submitted') = (submitted_at IS NOT NULL))
);

CREATE UNIQUE INDEX host_onboarding_rounds_tenant_round_uq
  ON host_onboarding_rounds (tenant_id, round);
CREATE UNIQUE INDEX host_onboarding_rounds_one_draft_uq
  ON host_onboarding_rounds (tenant_id) WHERE status = 'draft';
CREATE INDEX host_onboarding_rounds_host_status_idx
  ON host_onboarding_rounds (host_user_id, status);

CREATE TABLE host_onboarding_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id uuid NOT NULL REFERENCES host_onboarding_rounds(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  object_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  -- MIME allowlist and actual image decoding are enforced by the upload API.
  content_type text NOT NULL,
  expected_size integer NOT NULL CHECK (expected_size > 0 AND expected_size <= 20971520),
  actual_size integer CHECK (actual_size IS NULL OR actual_size > 0),
  width integer,
  height integer,
  status text NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'ready', 'submitted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  submitted_at timestamptz
);

CREATE INDEX host_onboarding_photos_round_status_idx
  ON host_onboarding_photos (onboarding_id, status);
CREATE INDEX host_onboarding_photos_tenant_idx
  ON host_onboarding_photos (tenant_id);

CREATE TABLE host_onboarding_event_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id uuid NOT NULL REFERENCES host_onboarding_rounds(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_row_id text NOT NULL,
  name text NOT NULL,
  event_date text NOT NULL CHECK (event_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  event_time text NOT NULL CHECK (event_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX host_onboarding_events_round_source_uq
  ON host_onboarding_event_suggestions (onboarding_id, source_row_id);
CREATE INDEX host_onboarding_events_tenant_status_idx
  ON host_onboarding_event_suggestions (tenant_id, status);

ALTER TABLE host_onboarding_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE host_onboarding_rounds FORCE ROW LEVEL SECURITY;
ALTER TABLE host_onboarding_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE host_onboarding_photos FORCE ROW LEVEL SECURITY;
ALTER TABLE host_onboarding_event_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE host_onboarding_event_suggestions FORCE ROW LEVEL SECURITY;

CREATE POLICY host_onboarding_rounds_host_scope ON host_onboarding_rounds
  FOR ALL TO smart360_host
  USING (
    current_setting('app.role', true) = 'host'
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'host'
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );
CREATE POLICY host_onboarding_photos_host_scope ON host_onboarding_photos
  FOR ALL TO smart360_host
  USING (
    current_setting('app.role', true) = 'host'
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'host'
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );
CREATE POLICY host_onboarding_events_host_scope ON host_onboarding_event_suggestions
  FOR ALL TO smart360_host
  USING (
    current_setting('app.role', true) = 'host'
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'host'
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON host_onboarding_rounds TO smart360_host;
GRANT SELECT, INSERT, UPDATE, DELETE ON host_onboarding_photos TO smart360_host;
GRANT SELECT, INSERT, UPDATE, DELETE ON host_onboarding_event_suggestions TO smart360_host;

COMMIT;