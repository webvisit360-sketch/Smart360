---
name: Tenant duplication boundary
description: Owner's product and safety requirements for operator-only project duplication.
---

Podvoji is an operator-only content-template action in both management modes, never a host action. Copy the actual source structure rather than aligning or reseeding it. The owner will run real tenant copies himself; development verification must use synthetic tenants only.

**Why:** The owner needs a fresh project based on an existing guide without changing the original or sharing deletable files.

Copies start unpublished, without a snapshot, in concierge mode, even though ordinary tenant creation has a different default. Do not inherit operational records, host accounts, ratings, renewal/subscription state, or redirect history.

**How to apply:** Test source immutability, independent physical media and GPX, quota admission, and cleanup using synthetic fixtures. Do not describe database transactions plus best-effort object deletion as crash-safe distributed atomicity; recovery across process/storage failures requires separate evidence.

Unfinished copies must survive process interruption as operator-visible “nedokončana kopija”, never as a normal editable or guest-visible guide. Cleanup must remain retryable when storage fails; never discard its recovery record before deleting its files. A live copy must not race with cleanup.

**Why:** The owner explicitly requested durable recovery from a killed copy, not merely rollback after a handled exception.

**How to apply:** Persist the full destination manifest before object writes, and mark ready only with complete content. Verify with a genuinely killed synthetic process, failed cleanup followed by retry, and zero-remnant checks. Do not extend this evidence to an atomic transaction across PostgreSQL and object storage.