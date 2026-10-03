---
name: Seven-language product boundary
description: Universal languages, English-first fallback, tenant-content approval and legacy Creator compatibility.
---
All tenants receive sl/en/de/it/fr/nl/hr; stored tenant language selections must not restrict guest choices. Missing translations fall back to English, then Slovenian, using published data only for published guests.

**Why:** The owner explicitly requested universal seven-language availability, while preserving draft isolation.

New fr/nl/hr tenant-content fields start empty. Do not translate existing guides without separate approval. French UI uses vous, Dutch uses je, Croatian is polite and natural. SOS SMS remains Slovenian + English ASCII.

**Why:** UI translation approval did not authorize tenant-content translation or changes to the emergency SMS format.

**How to apply:** Preserve the old Creator readiness requirements when extending language editors; adding empty fields must not invalidate existing reviewed proposals. Verify the real App-level selection guard, not just the sheet or pure language resolver.

The owner approved a separate content rollout for the four production tenants.
Its delivery path is read-only production extraction, one idempotent INSERT-only
SQL file per tenant for the owner console, and separate DEV evidence drafts.
Never execute these SQL files against production on the owner's behalf.
Existing translation rows, including empty fr/nl/hr rows, must be preserved;
published snapshots and announcements are outside this rollout.

**Why:** DEV-only translations never reach live guides. The owner explicitly
changed delivery to owner-executed SQL and kept publication separate.

**How to apply:** Report per-tenant/per-language counts, preserve source formatting
and proper nouns, checksum sl/en/de/it before and after, and verify production
language-tag compatibility before stating the execution order.