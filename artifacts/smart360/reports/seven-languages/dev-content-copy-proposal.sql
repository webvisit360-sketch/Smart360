-- PROPOSAL ONLY. Not executed.
-- DEV database only. Run these six parameterized statements sequentially on
-- one connection inside BEGIN / COMMIT. Each $1 is its own prepared JSON array.
-- All UUIDs are NEW, remapped evidence-copy IDs, never production IDs.
-- Slugs: translation-evidence-meli-pu, translation-evidence-camping-menina,
-- translation-evidence-kamp-savinja, translation-evidence-turizem-drobez.
-- A slug collision aborts the transaction; existing DEV tenants are not reused.
-- No accounts, messages, orders, announcements, credentials or snapshots copied.
-- Existing public image URLs are read-only references; no files are changed.

INSERT INTO tenants
  (id, slug, name, subtitle, address, hero_url, living_guide_hero_url,
   logo_url, guest_ui_mode, management_mode, is_published, has_unpublished_changes)
SELECT id, slug, name, subtitle, address, hero_url, living_guide_hero_url,
       logo_url, 'living-guide', 'concierge', false, true
FROM jsonb_to_recordset($1::jsonb) AS v(
  id uuid, slug text, name text, subtitle text, address text,
  hero_url text, living_guide_hero_url text, logo_url text);

INSERT INTO sections (id, tenant_id, key, title, subtitle, position, is_visible)
SELECT id, tenant_id, key, title, subtitle, position, is_visible
FROM jsonb_to_recordset($1::jsonb) AS v(
  id uuid, tenant_id uuid, key text, title text, subtitle text,
  position integer, is_visible boolean);

INSERT INTO categories
  (id, section_id, key, label, icon, layout, position, is_visible)
SELECT id, section_id, key, label, icon, layout, position, is_visible
FROM jsonb_to_recordset($1::jsonb) AS v(
  id uuid, section_id uuid, key text, label text, icon text, layout text,
  position integer, is_visible boolean);

INSERT INTO items
  (id, category_id, title, body, bullets, note_text, price, price_unit,
   event_schedule, gpx_route, producer_name, producer_note, position, is_visible)
SELECT id, category_id, title, body, bullets, note_text, price, price_unit,
       event_schedule, gpx_route, producer_name, producer_note, position, is_visible
FROM jsonb_to_recordset($1::jsonb) AS v(
  id uuid, category_id uuid, title text, body text, bullets text[],
  note_text text, price text, price_unit text, event_schedule jsonb,
  gpx_route jsonb, producer_name text, producer_note text,
  position integer, is_visible boolean);

INSERT INTO media (id, tenant_id, item_id, url, alt, position, kind, purpose)
SELECT id, tenant_id, item_id, url, alt, position, kind, 'item'
FROM jsonb_to_recordset($1::jsonb) AS v(
  id uuid, tenant_id uuid, item_id uuid, url text, alt text,
  position integer, kind text);

-- Copies legacy translations unchanged into the NEW DEV IDs, then adds new
-- fr/nl/hr results. No existing row is overwritten, even if its value is blank.
INSERT INTO translations (model, record_id, field, lang, value, stale)
SELECT model, record_id, field, lang, value, stale
FROM jsonb_to_recordset($1::jsonb) AS v(
  model text, record_id uuid, field text, lang text, value text, stale boolean)
WHERE lang IN ('sl', 'en', 'de', 'it', 'fr', 'nl', 'hr')
ON CONFLICT (model, record_id, field, lang) DO NOTHING;