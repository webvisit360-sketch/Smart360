---
name: Tour calorie privacy and estimation boundary
description: Device-only profiles, per-tour immutability, and GPS grade estimation constraints.
---

Keep guest calorie profiles and accumulators device-only. No default body weight, API/analytics transmission, or GPX metadata expansion. Profile edits affect the next tour, not previous segments of an active tour.

**Why:** The owner explicitly requires optional local profiles and no estimate without weight. Per-tour snapshots avoid silently rewriting past energy estimates after a profile edit.

**How to apply:** Preserve snapshot recovery, weightless UI/export omission, and separate local PNG summaries from unchanged GPX serialization. Explicitly label model results approximate and preset/age/sex adjustments as heuristics, not validated individual physiology.

Estimate grade across a bounded rolling window of accepted moving fixes, not by demanding a long distance from every individual fix.

**Why:** Normal walking/running updates can exceed the distance acceptance threshold yet remain shorter than the grade window. Rejecting every such segment as too short silently models real climbs as flat.

**How to apply:** Reset grade evidence on pauses, gaps or unreliable altitude; keep accumulation independent of downsampled retained tracks. Test streams of short fixes on a climb, not only hand-fed aggregate model inputs.