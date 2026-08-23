---
name: Production data repairs via startup backfills
description: How to fix wrong production DATA (not schema) when prod SQL is read-only — self-disabling startup backfill pattern and the maps-link sanitization rule.
---

# Production data repairs

**Rule:** production `executeSql` is read-only (SELECT only). Wrong production *data* can only be fixed by shipping code — the pattern is a self-disabling startup backfill in the API server (runs after retention purges, before listen; best-effort, never blocks boot).

**Why:** publish syncs *schema* (new columns arrive with their defaults) but never *data* — so a column populated by hand in dev (e.g. `categories.explore_group`) reaches prod all-defaulted. This silently broke Okolica grouping in Aug 2026.

**How to apply:**
- Carry the assignment as a row-level ledger (id + expected current value + target), like the PART 5 cutover.
- Global guard: no-op forever once ANY row deviates from the broken signature (so it can never overwrite later host edits).
- Re-check the guard columns (label, default value) inside the UPDATE predicate itself — the pre-read check alone races with concurrent host edits; predicate + `.returning()` count makes a race a skip, never a stale write.
- Make the applier accept injectable tenantId/ledger so tests can exercise apply/no-op/skip paths on scratch fixtures.
- Watch for this whenever a new admin-managed column ships after content already exists in prod.
- Match ledger rows by the STABLE key column, never by host-editable labels (owner-mandated after review); report a full per-row before/after table and log skips at ERROR level.
- The deployment log capture can drop early boot INFO lines (the backfill's result table never surfaced there) — verify a prod data repair via read-only prod SQL before/after, not by log spelunking.

# POI maps links (regression guard)

Item-level "Google Maps" actions must open the PLACE, never directions (broke twice). `itemMapsHref` in smart360 is the only allowed builder: pasted HTTPS link (sanitized — `/dir` path segments, `destination`/`travelmode` params, HTTP, malformed all rejected) > approved review coords as search URL > text search; rejected URL with no coords hides the action. Guarded by unit tests plus a source scan over `pages/living-guide/` forbidding `"directions"` and `/maps/dir`. Approved coords flow to guests via `item_distance_proposals(status='approved')` joined in the content tree; unapproved coords must never leak.
