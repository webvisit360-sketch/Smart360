---
name: Creator run handoff
description: Preserving exact source-first inputs across isolated task merges and delayed retries.
---

Any source-first run that may be retried or continued outside its current environment must export an immutable manifest containing snapshot hashes, extracted facts, deduplicated candidates, and provenance links. Do not reconstruct that run from live source pages.

**Why:** Isolated task database rows do not merge into the main development database, while approved web pages can change between runs. Re-fetching later can produce a materially different candidate set and is not valid evidence for retrying the original rows.

**How to apply:** Persist the manifest as a reviewable project artifact before handoff. On resume, verify its hashes and import the exact manifest into a development-only run; if no exact manifest exists, stop and report the evidence gap instead of silently rerunning discovery.