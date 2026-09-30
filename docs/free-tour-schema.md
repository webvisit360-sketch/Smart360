# Free tour recording: approved schema change

The only approved DDL is:

```sql
ALTER TABLE public.tenants ADD COLUMN tour_recording_enabled boolean NOT NULL DEFAULT false;
```

This was already applied in **development** and verified there: boolean, NOT NULL, default false, and all 18 existing tenant rows false. Do not reapply it, run `db:push`, or run broad startup schema installation. Carry this **same additive column change** through the normal migration/Publish process later, with separate production approval. No production schema command was executed as part of this work.

Read-only verification (catalog and current values):

```sql
SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS data_type,
       a.attnotnull AS not_null, pg_get_expr(d.adbin, d.adrelid) AS column_default
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'public' AND c.relname = 'tenants'
  AND a.attname = 'tour_recording_enabled' AND a.attnum > 0 AND NOT a.attisdropped;

SELECT tour_recording_enabled, count(*) FROM public.tenants
GROUP BY tour_recording_enabled ORDER BY tour_recording_enabled;
```

For a future *approved migration only*, use this conditional fallback where a migration may encounter an already-applied development column. It does not rewrite an unexpected existing column: it raises an error instead. Run only via the later approved Publish/migration process, not interactively in production.

```sql
DO $$
DECLARE existing_type oid;
DECLARE existing_not_null boolean;
DECLARE existing_default text;
BEGIN
  SELECT a.atttypid, a.attnotnull, pg_get_expr(d.adbin, d.adrelid)
    INTO existing_type, existing_not_null, existing_default
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE n.nspname = 'public' AND c.relname = 'tenants'
    AND a.attname = 'tour_recording_enabled' AND a.attnum > 0 AND NOT a.attisdropped;

  IF existing_type IS NULL THEN
    ALTER TABLE public.tenants ADD COLUMN tour_recording_enabled boolean NOT NULL DEFAULT false;
  ELSIF existing_type <> 'boolean'::regtype::oid
     OR existing_not_null IS DISTINCT FROM true
     OR existing_default IS DISTINCT FROM 'false'
     OR EXISTS (SELECT 1 FROM public.tenants WHERE tour_recording_enabled IS DISTINCT FROM false)
  THEN
    RAISE EXCEPTION 'Unexpected public.tenants.tour_recording_enabled schema or existing values';
  END IF;
END $$;
```