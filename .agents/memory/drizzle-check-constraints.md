---
name: Drizzle check constraints
description: Development schema-push quirk for changed PostgreSQL CHECK constraint bodies.
---

Keep PostgreSQL `CHECK` constraints under stable semantic names, without `_v1`, `_v2`, or similar suffixes. When the body changes, replace the constraint explicitly with approved `DROP CONSTRAINT` and `ADD CONSTRAINT` statements, then inspect `pg_constraint` and `pg_get_constraintdef`.

**Why:** A push once retained an old allowed-value set under the same name. Versioned names avoid that one symptom but create an unbounded naming trail whose current member becomes unclear. Development and production can also have different constraint histories, so copying a development repair script into production can fail at rollout.

**How to apply:** Before each environment's migration, read that environment's exact constraint names and definitions plus related columns/indexes. Write and approve a transaction against those observed facts; never reuse a script that assumes another environment's migration history.