---
name: Drizzle check constraints
description: Development schema-push quirk for changed PostgreSQL CHECK constraint bodies.
---

When expanding or otherwise changing a PostgreSQL `CHECK` constraint, do not assume a successful development `drizzle-kit push` updated the live constraint if its name stayed the same. Rename the constraint in the Drizzle schema to force replacement, then inspect `pg_constraint` and `pg_get_constraintdef` before exercising the new value.

**Why:** A push reported success while the database retained the old allowed-value set, causing runtime inserts of a newly documented enum value to fail.

**How to apply:** After any CHECK-body change, use the normal schema push, query the live definition read-only, and rename/re-push when the same-named definition was not replaced. Apply the corresponding generated migration during production rollout.