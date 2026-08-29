---
name: Drizzle check constraints
description: Development schema-push quirk for changed PostgreSQL CHECK constraint bodies.
---

Keep PostgreSQL `CHECK` constraints under stable semantic names, without `_v1`, `_v2`, or similar suffixes. A new table arrives in production complete; an existing table receives only new columns. Constraints, defaults and renames on an existing table never arrive by themselves.

**Why:** The publish schema diff can report `hasDiff: false` while production retains an old constraint, default, or name. Versioned constraint names avoid one symptom but create an unclear naming trail. Environments can also have different histories, so copying a repair script across them can fail.

**How to apply:** Before each environment's migration, read exact constraint definitions plus related columns/indexes. Write and approve one replacement against those facts. The production SQL console rejects explicit BEGIN/COMMIT and wraps selected statements in one batch; run approved DDL that way. Afterward, read `pg_get_constraintdef` back; never treat publish diff output as CHECK verification.