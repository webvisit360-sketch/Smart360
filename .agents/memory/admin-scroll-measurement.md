---
name: Admin scroll diagnosis
description: Distinguish document overflow from legitimate inner-panel scrolling before changing admin layout.
---

Measure document scroll range separately from the active editor scroll range before identifying a blank-tail cause.

**Why:** Initial probes blamed short-page spare space, a tiny preview overflow and normal editor bottom padding. Only scrolling the document itself exposed the actual inaccessible-label containing-block problem. Reducing padding would have hidden symptoms without fixing the layout.

**How to apply:** Reproduce on the specifically reported active tab, measure both scroll roots, and use a reversible browser-only causal probe before editing. Inspect absolutely positioned screen-reader labels even when no visible descendant extends beyond the page; preserve accessibility rather than deleting hidden labels.

For detached editor footers, verify both containment and reachability; clipping
an overflowing form is not a fix.
**Why:** Adding flex sizing and overflow clipping to permission fieldsets hid
the category footer rather than shrinking the form body. The permission
boundary must preserve the form's participation in the dialog's flex layout.
**How to apply:** Test category, section and entry forms with actual wrappers,
scroll the body to both ends, hit-test the action buttons, and verify disabled
fieldset semantics still hold when permissions are revoked.