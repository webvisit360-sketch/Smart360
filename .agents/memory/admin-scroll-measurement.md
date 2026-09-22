---
name: Admin scroll diagnosis
description: Distinguish document overflow from legitimate inner-panel scrolling before changing admin layout.
---

Measure document scroll range separately from the active editor scroll range before identifying a blank-tail cause.

**Why:** Initial probes blamed short-page spare space, a tiny preview overflow and normal editor bottom padding. Only scrolling the document itself exposed the actual inaccessible-label containing-block problem. Reducing padding would have hidden symptoms without fixing the layout.

**How to apply:** Reproduce on the specifically reported active tab, measure both scroll roots, and use a reversible browser-only causal probe before editing. Inspect absolutely positioned screen-reader labels even when no visible descendant extends beyond the page; preserve accessibility rather than deleting hidden labels.