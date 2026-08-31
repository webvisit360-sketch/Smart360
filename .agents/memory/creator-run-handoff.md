---
name: Creator run handoff
description: Preserving exact source-first inputs across isolated task merges and delayed retries.
---

Once a source-first candidate set has received human editorial review, any retry or continuation outside its current environment must use an immutable manifest containing snapshot hashes, extracted facts, deduplicated candidates, and provenance links. Before human review, set identity has no value of its own: a run may be regenerated from approved sources when that improves extraction quality.

**Why:** Isolated task database rows do not merge into the main development database, while approved web pages can change between runs. Human decisions must remain attached to the exact reviewed evidence, but preserving an unreviewed noisy set would optimize for accidental identity instead of source quality.

**How to apply:** Record whether owner review has begun. If it has, persist and verify the exact manifest before handoff. If it has not, discard incomplete runs and execute a fresh guarded run; compare snapshot hashes/sizes and report extraction noise plainly.