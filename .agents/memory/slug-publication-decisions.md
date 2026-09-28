---
name: Slug publication decisions
description: Owner-approved replacement of slug freezing, reservation namespace and deployment data bootstrap.
---

Previously published addresses must remain permanent redirects. Operator slug edits take effect only on reviewed publication, never on draft save; pre-first-publish edits do not create history. Historical addresses cannot be reclaimed, even by their former owner.

**Why:** The owner approved changing accommodation branding without invalidating printed QR codes and explicitly retained publication isolation.

**How to apply:** Preserve the existing operator-only slug-edit permission. Keep redirect history distinct from draft proposals and preserve path/query in real HTTP 301 responses, including manifests. Resolve every historical address directly to the current canonical address.

The owner expressly approved a separate, globally unique reservation namespace in addition to existing alias history, and an idempotent application-startup data bootstrap from the environment's own current slugs and aliases.

**Why:** Separate unique constraints on current and historical tables cannot enforce cross-table uniqueness. Development rows never transfer on Publish; production must seed reservations from production rows. This is explicit authorization for this bootstrap, not general permission for startup repairs.

**How to apply:** Bootstrap only data after schema migration, before serving requests. Preserve ownership, fail on conflicting owners, and never overwrite existing reservations or manufacture historical aliases. No startup DDL; verify schema separately.