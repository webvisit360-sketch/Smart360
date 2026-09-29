---
name: Migration approval boundaries
description: Approval boundary for schema changes and data backfills in Smart360.
---

# Migration approval boundaries

An approval applies only to the schema and data statements explicitly described. Approval for an additive table does not authorize altering defaults, constraints, columns, or rows in an existing table.

Before running any migration or backfill that touches an existing table or existing data, present the exact SQL statements, explain which rows can change, and wait for explicit approval. Do this before applying the change in development as well as before publishing it to production.

**Why:** A decimal media-quota default change and exact-value backfill were harmless, but they exceeded approval that was limited to adding the enquiries table.

**How to apply:** Inspect the full schema diff and every startup/backfill write before execution. Separate purely additive statements from existing-schema alterations and data writes; never infer approval for the latter from approval of the former.

Function replacements require the same production verification ritual as existing constraints: state whether the ORM manages them, provide catalog SELECTs, and supply conditional operator SQL that accepts a fully patched definition unchanged and rejects partial/unexpected definitions atomically.

**Why:** The owner explicitly requires proof for schema objects that Publish may not synchronize; a non-idempotent repair that fails on an already patched function is not an acceptable release procedure.

**How to apply:** Count complete approved expressions, not just a field-name substring; validate before executing replacement and retain startup/data-marker checks separately from schema verification.