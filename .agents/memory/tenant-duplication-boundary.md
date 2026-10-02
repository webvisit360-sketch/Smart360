---
name: Tenant duplication boundary
description: Owner's product and safety requirements for operator-only project duplication.
---

Podvoji is an operator-only content-template action in both management modes, never a host action. Copy the actual source structure rather than aligning or reseeding it. The owner will run real tenant copies himself; development verification must use synthetic tenants only.

**Why:** The owner needs a fresh project based on an existing guide without changing the original or sharing deletable files.

Copies start unpublished, without a snapshot, in concierge mode, even though ordinary tenant creation has a different default. Do not inherit operational records, host accounts, ratings, renewal/subscription state, or redirect history.

**How to apply:** Test source immutability, independent physical media and GPX, quota admission, and cleanup using synthetic fixtures. Do not describe database transactions plus best-effort object deletion as crash-safe distributed atomicity; recovery across process/storage failures requires separate evidence.