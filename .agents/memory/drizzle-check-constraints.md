---
name: PostgreSQL publish schema replacements
description: Production publish schema-diff limitations for replacing existing constraints and generated columns.
---

Keep PostgreSQL `CHECK` constraints under stable semantic names, without `_v1`, `_v2`, or similar suffixes. A new table arrives in production complete; additive changes can arrive on an existing table, but replacing a CHECK or regenerating an existing generated column does not reliably arrive through publish.

**Why:** Replit Publish applies a development-to-production schema diff rather than replaying an approved SQL transaction. It can report success after additive objects arrive while existing CHECK bodies and generated expressions remain unchanged.

**How to apply:** Before each environment's migration, read exact constraint and generated-column definitions plus related columns/indexes. Write and approve replacements against those facts. The production SQL console rejects explicit BEGIN/COMMIT and wraps selected statements in one batch. Afterward, read the catalog back; never treat publish success as replacement verification.