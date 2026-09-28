---
name: GPX route boundaries
description: Owner constraints on full-resolution files, bounded snapshot data, and environment separation.
---

Full-resolution GPX belongs only in private object storage; draft and published JSON must contain only bounded, downsampled geometry/profile. Calculate statistics before downsampling. Preserve track-segment gaps rather than inventing connecting routes.

**Why:** The owner explicitly required long routes not to inflate draft and published snapshots. The original download must remain byte-identical, not regenerated from the map data.

**How to apply:** Keep global point budgets across all segments, not independent budgets per segment; reject excess segment counts rather than joining gaps. Any future route metadata must fit the same bounded payload rule.

Private GPX storage must remain environment-partitioned, and guest download authorization must derive from the published snapshot. Draft replacement/removal must not delete a still-published original.

**Why:** Development and production share the project bucket; “files are not copied during deployment” alone does not establish isolation.

**How to apply:** Do not add generic private-file URLs or use draft item lookup to authorize public downloads. Retain old objects until a future snapshot-aware cleanup is explicitly scoped.