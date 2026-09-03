---
name: Creator queue re-evaluation
description: Durable safety rules for applying improved Creator classification rules to existing tenant queues.
---

Queue rule improvements must be applicable retroactively through one permanent operator-only, tenant-scoped action. Re-evaluation may change only visible pending or unresolved proposals; approved and rejected operator decisions remain untouched. The same action must also materialize any approved proposal that has no Creator materialization, without reopening or rewriting its decision.

**Why:** New settlement, accommodation, and duplicate rules otherwise improve only future runs and leave existing queues inconsistent. Proposals approved before the guest-materialization bridge can also remain approved but absent from the guide. Rebuilding runs would alter or obscure immutable provenance.

**How to apply:** Reuse current classifiers for open rows and the exact approval materializer for approved rows missing a projection. Preserve evidence, report a separate backfill count, and guarantee a second unchanged run reports zero.