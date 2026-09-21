---
name: Single published snapshot
description: Owner-approved draft isolation and pre-publish comparison mechanism.
---

Use exactly one replaceable published snapshot per tenant, never version history. Guests read the snapshot; admin edits remain draft. The same snapshot is the accurate pre-publish comparison baseline. Initialize missing rollout snapshots from current live state without changing what guests see.

**Why:** The owner rejected an unavailable-comparison first publish and chose to fix guest publication isolation and confirmation together with one mechanism.

**How to apply:** Preserve all guest language projections and published media references, atomically replace the snapshot on explicit publish, and invalidate guest caches. Do not introduce a separate comparison baseline or history. Non-additive schema/security changes must be reported before applying.

Non-host RLS safety must not be justified by an unset `app.role`: SQL `NOT(NULL = 'host')` is NULL, not true. The inspected non-host development pool bypasses RLS; production catalogue evidence of a bypass-capable role does not prove the deployed application's actual session identity.

**Why:** The owner explicitly required that FORCE RLS not silently break startup, background jobs, or Creator materialization. Host-scoped tests alone cannot establish non-host safety.

**How to apply:** Verify pool role capabilities and real materialization after RLS changes. Distinguish read-only production catalogue evidence from production runtime proof, especially if the connection role changes.