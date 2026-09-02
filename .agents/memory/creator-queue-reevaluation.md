---
name: Creator queue re-evaluation
description: Durable safety rules for applying improved Creator classification rules to existing tenant queues.
---

Queue rule improvements must be applicable retroactively through one permanent operator-only, tenant-scoped action. Re-evaluation may change only visible pending or unresolved proposals; approved and rejected operator decisions remain untouched.

**Why:** New settlement, accommodation, and duplicate rules otherwise improve only future runs and leave existing queues inconsistent. Rebuilding runs would alter or obscure immutable provenance.

**How to apply:** Reuse the current classifiers against stored proposals in one transaction, preserve run/source/verification evidence, return category counts, invalidate the queue view, and guarantee that a second unchanged run reports zero changes.