---
name: Smart360 storage cleanup
description: Explicit media cleanup design, shared dev/prod bucket danger, prod SQL silent-failure pitfall
---

# Storage cleanup (explicit, never automatic)

- References computed LIVE from DB in `mediaCleanup.ts`, not stored refcounts. The reference set MUST cover: media.url/posterUrl, sections.imageUrl, tenants.heroUrl/logoUrl/logoSquareUrl, embedded URLs in items.body/items.noteText/translations.value, and the `-ikona-*` siblings of a referenced `-kvadrat.png`.
- **Why:** first version missed sections.imageUrl and deleted live section banners + prod's logo from the bucket (recovered from fotografije zip + logo_melipu.jpg). Any new *_url or rich-text column must be added to `getReferencedKeys()` in the same change.
- **Shared bucket:** dev and the published deployment share ONE object-storage bucket, but each environment only sees its own DB when computing references. Mitigation: files younger than 7 days are never cleanup candidates. Prod tenant meli-pu still references old logo `2f213332-...jpg` (restored) — don't free it until prod is re-synced.
- Execute path recomputes references at delete time; deletes grouped per file name across width folders; invalidates usage cache.

# Prod SQL pitfall

- `executeSql environment:"production"` FAILS SILENTLY (output = only `START TRANSACTION / ROLLBACK`, no error) when the query references a column that doesn't exist in prod (e.g. additive dev columns like media.poster_url before publish). Always test column existence or query tables separately; empty output ≠ no rows.

## Trash + audit rework (post-incident)
- Execution is PROD-ONLY: `CLEANUP_EXECUTE_ENABLED = NODE_ENV==='production'` (403 in dev), UI buttons hidden via `import.meta.env.PROD`. Root cause of incident: shared bucket, separate DBs — never compute orphans in dev.
- Never hard-deletes: objects move to `trash/<runId>/<originalPath>`; `cleanup_runs` table (jsonb files ledger) = audit + Koš; 30-day lazy purge on execute; restore is per-file, skips existing destinations (never overwrites newer uploads), purge claims run via conditional update before deleting.
- Crash safety: audit intent written BEFORE moving; restore treats "original exists" as in-place.
- Test-only `minAgeMs` override param on cleanupExecute — never exposed via HTTP.
