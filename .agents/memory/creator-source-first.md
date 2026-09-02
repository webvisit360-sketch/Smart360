---
name: Creator source-first policy
description: Durable discovery, approval, robots, and model boundaries for Creator.
---

Creator place discovery must read only owner-approved municipality source URLs. The model must not propose places from memory, and Overpass must not be used as a discovery fallback. Resolve source-derived names through the existing Nominatim/OSRM layer; use the model only to write descriptions after resolution.

**Why:** Source provenance and owner review are required before any content page is fetched. The retired model-memory and near-ring methods produced ambiguous or unsupported proposals.

**How to apply:** Keep every new source in a proposed state until the owner approves it. Fetch and persist robots evidence first, fail closed on blocks or uncertainty, and retain connection-level SSRF protection. With Node HTTPS pinned DNS, handle lookup requests using `all: true` by returning an address array.

Prefer Slovenian-language official pages so place names match Nominatim. For hiking discovery, use area, starting-point, mountain, or mountain-group indexes rather than hand-picked route pages. Never fetch a blocked domain; use an approved regional source for substitute coverage.

List approval must bind the tenant, normalized municipality, and exact source-state fingerprint. Any municipality or source-status change invalidates approval.

**Why:** Timestamp-only approval can be replayed across changed source sets or race a concurrent decision.

**How to apply:** Serialize source mutations, approval, origin changes, and run admission with municipality advisory locks. Hold a dedicated non-pooled municipality lease for each run, cap active runs globally at three, and recover only from captured source IDs.

Creator must exclude lodging competitors before source facts are persisted. Tourist farms are food candidates only with entity-local evidence of public food service.

**Why:** A host guide must not advertise competing accommodation, and page-wide restaurant text can falsely authorize an unrelated lodging farm.

**How to apply:** Deduplicate canonical URLs run-wide, prefer Slovenian/unprefixed locale variants within the same content class, and rank attraction details ahead of news or event-calendar pages.