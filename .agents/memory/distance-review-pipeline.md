---
name: Distance review pipeline
description: Binding rules for POI distance proposals, geocoding, and host location input in Smart360.
---

# Distance review pipeline (owner-approved spec)

- **Hosts never type coordinates.** The only host location input anywhere is a pasted Google Maps link. Coordinates are derived server-side from `/maps/search/<lat>,<lng>` or `!3d<lat>!4d<lng>`. The `@lat,lng,zoom` map centre is systematically displaced by the side panel and must never be used, even as a fallback. Admin lat/lng fields are read-only ("samodejno iz povezave"); the single global admin can correct them only via `coordinateOverride: true` in the tenant PATCH.
  - **Why:** typed coordinates were a recurring error source; the owner mandated link-only input.
- **URL-valued legacy `mapQuery` is a destination link, never a search string.** It must never be sent to Nominatim or interpolated into `maps/search?query=`. All guest item map hrefs go through the shared `mapsHrefForQuery` helper. Tenant-origin short links may be expanded server-side through at most three redirects, with every hop restricted to approved Google Maps hosts; off-Google destinations are refused.
- **Google place IDs are identifiers, not facts.** A URL-decoded `!16s` value may be stored to reconstruct the source link, but coordinates, distances, times, and other facts must never be derived from it.
- **Distances are never invented.** No straight-line fallback. Only APPROVED proposals write `items.distanceMeters`; approval is a conditional `UPDATE … WHERE distance_meters IS NULL` inside a transaction (manual host value always wins, race-safe). Manual items are excluded from runs and listed as status `manual`.
- **Free services only:** Nominatim (descriptive UA, permanent cache incl. negative results — but network errors are NOT cached) and public OSRM driving routes (10s abort). The 1 req/s Nominatim limit is enforced deployment-wide via a singleton `geocode_throttle` row (`SELECT … FOR UPDATE`, sleep inside txn, commit, then HTTP), plus a process-local promise queue.
- **Runs terminate:** proposals (incl. failed) with unchanged `inputFingerprint` (sha256 of origin coords + trimmed mapQuery) are skipped; `retryFailed: true` re-eligibilizes failed rows for transient errors. The admin run loop also stops on zero progress.
- **Review list is one row per POI**, least-confident first: failed → pending low (farthest first) → pending high → new → manual.
- Origin is always the tenant's derived coordinates; a run errors when the tenant has no stored link ("Namestitev nima shranjene Google Maps povezave.").
- Geocoding quality on Meli Pu data: ~20% of free-text addresses fail and some resolve to wrong far-away places (e.g. namesakes abroad) — the human review gate is essential; never bulk-approve low-confidence rows.
- **Legacy provenance exception:** the owner explicitly approved the Trieste city-centre correction on 2026-08-28. When the immutable review ledger is introduced, this one legacy decision must be backfilled as an individual owner review; all other pre-ledger approvals remain “human review not proven.”
  - **Why:** the correction is a documented human decision made before the ledger exists and would otherwise become indistinguishable from bulk approvals.

**Review UX rule:** handled rows (approved/manual/skipped) must never disappear or get relabeled — they stay in the list with an explicit status badge and a Razveljavi (undo) path. "Approved" means the stored item value matches the approved proposal; any other stored value is "manual". **Why:** the owner reported approved rows as "vanished" when they were silently relabeled manual and sorted last.
