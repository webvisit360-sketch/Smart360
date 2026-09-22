---
name: Production data repairs via startup backfills
description: How to fix wrong production DATA (not schema) when prod SQL is read-only — self-disabling startup backfill pattern and the maps-link sanitization rule.
---

# Production data repairs

**Rule:** production `executeSql` is read-only (SELECT only, replica). This limits the agent tool, not all production editing: the owner can edit production data in Replit's Database → My Data edit mode without republishing, and an authorized existing application writer can also update data. Without an available authenticated writer, a shipped, owner-approved guarded data repair is an option; do not claim publishing is inherently required for every data edit.

**Why this distinction matters:** Official documentation checked on 2026-09-22 confirms production visual edits take effect without republishing. Agent approval alone does not turn the read-only replica tool into a writer. A development-only fixture applier is not an executable production repair.

**Project authorization boundary:** The owner requires production data writes to go through application code, not direct database editing. Platform edit capability is not permission to use it in this project.

**Why:** The owner explicitly chose operator-controlled execution after publishing the code. Approval to ship a repair is not permission to run it automatically during startup.

**How to apply:** When execution is reserved for the owner, keep the repair opt-in and tenant-scoped. Do not replace the requested manual action with a startup backfill. Previously approved startup repairs are a separate historical authorization.

**Why:** publish syncs *schema* (new columns arrive with their defaults) but never *data* — so a column populated by hand in dev (e.g. `categories.explore_group`) reaches prod all-defaulted. This silently broke Okolica grouping in Aug 2026.

**How to apply:**
- Carry the assignment as a row-level ledger (id + expected current value + target), like the PART 5 cutover.
- Global guard: no-op forever once ANY row deviates from the broken signature (so it can never overwrite later host edits).
- Re-check the guard columns (label, default value) inside the UPDATE predicate itself — the pre-read check alone races with concurrent host edits; predicate + `.returning()` count makes a race a skip, never a stale write.
- Make the applier accept injectable tenantId/ledger so tests can exercise apply/no-op/skip paths on scratch fixtures.
- Watch for this whenever a new admin-managed column ships after content already exists in prod.
- Match ledger rows by the STABLE key column, never by host-editable labels (owner-mandated after review); report a full per-row before/after table and log skips at ERROR level.
- The deployment log capture can drop early boot INFO lines (the backfill's result table never surfaced there) — verify a prod data repair via read-only prod SQL before/after, not by log spelunking.
- For large owner-supplied content ledgers, validate and bundle the authoritative upload at build time rather than reading `attached_assets` at runtime or manually transcribing it. The build must fail on count/order/language mismatches, while the runtime applier still uses stable IDs and empty-only guards.

**Why:** deployment runtimes should not depend on workspace upload paths, and manual duplication of long multilingual copy creates silent wording drift.

**How to apply:** expose the validated build output as a typed virtual module consumed only by the production startup wrapper; keep the database mutation core data-injectable so tests do not depend on the virtual module.

# POI maps links (regression guard)

Item-level "Google Maps" actions must open the PLACE, never directions (broke twice). `itemMapsHref` in smart360 is the only allowed builder: pasted HTTPS link (sanitized — `/dir` path segments, `destination`/`travelmode` params, HTTP, malformed all rejected) > approved review coords as search URL > text search; rejected URL with no coords hides the action. Guarded by unit tests plus a source scan over `pages/living-guide/` forbidding `"directions"` and `/maps/dir`. Approved coords flow to guests via `item_distance_proposals(status='approved')` joined in the content tree; unapproved coords must never leak.
