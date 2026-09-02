---
name: Creator guest materialization
description: Durable rules for turning approved Creator proposals into Living Guide places.
---

Approved Creator proposals must project immediately into one tenant-scoped canonical guest place, identified by OSM identity or rounded operator coordinates. Multiple proposal/category attachments may share that place; they must never create duplicate items.

**Why:** Creator approval previously changed only the review ledger, so accepted places never reached guests. Per-proposal items would also repeat the Meli Pu duplicate-place failure.

**How to apply:** Keep first-approval provenance immutable, update only the guest projection on editorial edits, preserve category attachments from other active proposals, and hide the item only when no active approval remains. Approval, rejection, undo, unapprove, and category moves must be transactional and invalidate the public payload cache.

Photo-less Creator places remain eligible for Living Guide surfaces and use the category-icon “fotografija manjka” state. Culinary, shop, pharmacy, and health descriptions stay stored but are suppressed across cards, Danes, and details.