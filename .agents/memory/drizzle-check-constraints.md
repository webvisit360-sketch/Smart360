---
name: Drizzle check constraints
description: Development schema-push quirk for changed PostgreSQL CHECK constraint bodies.
---

Keep PostgreSQL `CHECK` constraints under stable semantic names, without `_v1`, `_v2`, or similar suffixes. When the body changes, replace the constraint explicitly with approved `DROP CONSTRAINT` and `ADD CONSTRAINT` statements, then inspect `pg_constraint` and `pg_get_constraintdef`.

**Why:** The publish schema diff does not detect changed `CHECK` bodies: it can report `hasDiff: false` while production retains an old allowed-value set. Versioned names avoid one symptom but create an unclear naming trail. Development and production can also have different constraint histories, so copying a repair script across environments can fail.

**How to apply:** Before each environment's migration, read exact constraint definitions plus related columns/indexes. Write and approve one transactional replacement against those facts. Afterward, read `pg_get_constraintdef` back from that environment; never treat publish diff output as CHECK verification.