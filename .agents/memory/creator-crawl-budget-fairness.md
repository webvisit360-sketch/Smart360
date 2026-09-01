---
name: Creator crawl budget fairness
description: Why multi-source Creator runs need per-seed byte shares and page-local grounding after model batching.
---

Under a fixed global crawl-byte cap, give every approved seed a bounded share and record explicit skips when that share is exhausted. Do not let early, boilerplate-heavy origins consume the whole run.

**Why:** Municipal CMS pages can carry hundreds of kilobytes of repeated HTML while yielding little visible text. A global cap alone can fail before later approved sources receive any coverage.

**How to apply:** Keep the global hard cap fail-closed, make per-seed exhaustion a reported skip rather than a whole-run failure, and filter only unambiguous utility/listing paths.

Model-read multiple stored pages together when request latency threatens the run deadline, but persist a fact for a page only after deterministic grounding independently succeeds against that page's own stored text.

**Why:** Batching reduces provider round trips, but model output from a composite document cannot itself prove which page supports a fact.

**How to apply:** Preserve deterministic page order and delimiters, then re-run name, evidence, settlement, and category grounding per original page before creating provenance.