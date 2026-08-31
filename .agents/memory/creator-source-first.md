---
name: Creator source-first policy
description: Durable discovery, approval, robots, and model boundaries for Creator.
---

Creator place discovery must read only owner-approved municipality source URLs. The model must not propose places from memory, and Overpass must not be used as a discovery fallback. Resolve source-derived names through the existing Nominatim/OSRM layer; use the model only to write descriptions after resolution.

**Why:** Source provenance and owner review are required before any content page is fetched. The retired model-memory and near-ring methods produced ambiguous or unsupported proposals.

**How to apply:** Keep every new source in a proposed state until the owner approves it. Fetch and persist robots evidence first, fail closed on blocks or uncertainty, and retain connection-level SSRF protection. With Node HTTPS pinned DNS, handle lookup requests using `all: true` by returning an address array.

Prefer Slovenian-language official pages so place names match Nominatim. For hiking discovery, use area, starting-point, mountain, or mountain-group indexes rather than hand-picked route pages. Never fetch a blocked domain; use an approved regional source for substitute coverage.