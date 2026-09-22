-- REVIEW ONLY. DO NOT EXECUTE WITHOUT EXPLICIT OWNER APPROVAL.
-- Development-only draft rename inspected on 2026-09-22.
-- This transaction changes exactly the three listed draft section rows, their
-- en/de/it title translations, any pre-existing sl title overlay, and the
-- corresponding tenant dirty flags. Read-only inspection found zero sl title
-- overlays on these sections; this guard prevents one from overriding the
-- authoritative Slovene sections.title if one is added before execution.
-- It does not read, insert, update, or delete published_snapshots.

BEGIN;

WITH target_sections (tenant_id, section_id) AS (
  VALUES
    ('1071ca18-0281-4a23-b36b-0b0ce601f771'::uuid, '6884e6cf-ea9c-4905-bd97-934ba45f9151'::uuid),
    ('9ef85864-0404-4cd2-984f-2c1295306909'::uuid, 'b9d9e09b-2600-44b7-b8d2-4784ba74c2b3'::uuid),
    ('1bf40460-bca8-418a-b01d-974b436ef3b0'::uuid, 'dbece7f6-18e5-4f68-b0bc-f383e903070a'::uuid)
),
updated_sections AS (
  UPDATE sections AS s
  SET title = 'Vaša destinacija'
  FROM target_sections AS target
  WHERE s.id = target.section_id
    AND s.tenant_id = target.tenant_id
    AND s.key = 'stay'
    AND s.position = 0
  RETURNING s.id, s.tenant_id
),
normalized_sl_translations AS (
  UPDATE translations AS tr
  SET value = 'Vaša destinacija',
      stale = false,
      updated_at = now()
  FROM updated_sections AS section
  WHERE tr.record_id = section.id
    AND tr.model = 'section'
    AND tr.field = 'title'
    AND tr.lang = 'sl'
  RETURNING tr.record_id
),
upserted_translations AS (
  INSERT INTO translations (model, record_id, field, lang, value, stale, updated_at)
  SELECT
    'section',
    section.id,
    'title',
    title.lang,
    title.value,
    false,
    now()
  FROM updated_sections AS section
  CROSS JOIN (
    VALUES
      ('en', 'Your destination'),
      ('de', 'Ihre Destination'),
      ('it', 'La vostra destinazione')
  ) AS title(lang, value)
  ON CONFLICT (model, record_id, field, lang)
  DO UPDATE SET
    value = EXCLUDED.value,
    stale = false,
    updated_at = now()
  RETURNING record_id
),
dirty_tenants AS (
  UPDATE tenants AS t
  SET has_unpublished_changes = true,
      updated_at = now()
  WHERE t.id IN (SELECT tenant_id FROM updated_sections)
    AND EXISTS (SELECT 1 FROM upserted_translations)
  RETURNING t.id
)
SELECT
  (SELECT count(*) FROM updated_sections) AS updated_draft_sections,
  (SELECT count(*) FROM normalized_sl_translations) AS normalized_sl_translations,
  (SELECT count(*) FROM upserted_translations) AS upserted_draft_translations,
  (SELECT count(*) FROM dirty_tenants) AS dirtied_tenants;

COMMIT;