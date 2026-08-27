---
name: Town-pack onboarding direction
description: Records the approved near-term onboarding direction and mandatory photograph-provenance policy.
---

Do not build the shared place catalogue now. Keep tenant-owned surroundings compatible with a future catalogue, but prioritize a tenant-agnostic town-pack importer, proposed origin geocoding, and pending distance/duration proposals.

**Why:** Cross-tenant maintenance does not justify a 22–43 developer-day catalogue before the first campsite is signed; reducing owner onboarding time is the immediate business need.

**How to apply:** Use stable pack keys and explicit importer provenance rather than titles or tenant-specific UUIDs. Never introduce dependencies that prevent a later mapping from tenant-local imported places to a shared catalogue.

Every photograph added from now on must record its source and usage rights. Existing photographs must be marked unknown rather than assigned reconstructed or assumed rights.

**Why:** Current media provenance is absent and cannot be reliably reconstructed; future legal and operational review needs explicit evidence.

**How to apply:** Require provenance at every new-photo ingestion boundary. Permit unknown only for legacy backfill, not for newly added photographs.