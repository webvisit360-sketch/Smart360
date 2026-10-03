-- Read-only. $1 is one of the four approved production slugs.
WITH t AS (
  SELECT id, slug, name, subtitle, address, hero_url, living_guide_hero_url, logo_url
  FROM tenants WHERE slug = $1
), s AS (
  SELECT s.* FROM sections s JOIN t ON t.id=s.tenant_id WHERE s.deleted_at IS NULL
), c AS (
  SELECT c.* FROM categories c JOIN s ON s.id=c.section_id WHERE c.deleted_at IS NULL
), i AS (
  SELECT i.* FROM items i JOIN c ON c.id=i.category_id WHERE i.deleted_at IS NULL
), r AS (
  SELECT 'tenant' AS model,id FROM t UNION ALL SELECT 'section',id FROM s
  UNION ALL SELECT 'category',id FROM c UNION ALL SELECT 'item',id FROM i
), tr AS (
  SELECT tr.* FROM translations tr JOIN r ON r.model=tr.model AND r.id=tr.record_id
)
SELECT jsonb_build_object(
  'slug', $1::text,
  'source', md5(jsonb_build_object(
    'tenants',(SELECT jsonb_agg(t ORDER BY id) FROM t),
    'sections',(SELECT jsonb_agg(s ORDER BY id) FROM s),
    'categories',(SELECT jsonb_agg(c ORDER BY id) FROM c),
    'items',(SELECT jsonb_agg(i ORDER BY id) FROM i)
  )::text),
  'legacy', (SELECT jsonb_object_agg(lang, jsonb_build_object('count',n,'md5',digest))
    FROM (SELECT l.lang, count(tr.id) AS n,
      md5(COALESCE(jsonb_agg(to_jsonb(tr) ORDER BY tr.id)
        FILTER (WHERE tr.id IS NOT NULL),'[]'::jsonb)::text) AS digest
      FROM (VALUES ('sl'),('en'),('de'),('it')) l(lang)
      LEFT JOIN tr ON tr.lang=l.lang GROUP BY l.lang) q),
  'snapshot',(SELECT md5(p.content::text) FROM published_snapshots p JOIN t ON t.id=p.tenant_id),
  'snapshotPublishedAt',(SELECT p.published_at FROM published_snapshots p JOIN t ON t.id=p.tenant_id)
)::text AS evidence;