---
name: Publication-state ordering
description: Transaction and ownership rules for durable unpublished-change tracking.
---

Every saved tenant-scoped admin mutation marks the tenant unpublished, whether or not it changes a guest-visible field. Publish is the only action that clears the flag. When content ownership changes, both the old and new tenant become dirty.

**Why:** The owner chose one predictable operator rule: any saved admin change turns the publish button orange. Distinguishing guest-visible, operational, and Creator-internal writes made the state surprising and incomplete.

**How to apply:** Mark changed tenant settings in their tenant transaction; keep content/media/structure triggers atomic; and mark successful Creator, distance, order-status, admin-message, and tenant host-account actions before success returns. Reads, pure UI state, public guest submissions, and auth/session-only actions do not count.

The admin cache transition must be symmetric: publish success explicitly applies clean state, and every successful tenant admin mutation has a server-authoritative dirty response or refresh path.

**Why:** Relying only on indirect query invalidation lets the header remain on a previously cached clean publish response even though the content mutation succeeded.

**How to apply:** Route mutation success through the exact no-store tenant-detail query; content/media handlers may patch dirty immediately before refetch. Keep the persisted server flag authoritative across reloads.