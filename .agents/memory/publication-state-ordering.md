---
name: Publication-state ordering
description: Transaction and ownership rules for durable unpublished-change tracking.
---

Any guest-visible mutation and its unpublished-state transition must share the same database transaction and tenant-row serialization boundary as publish. A post-commit audit marker is not authoritative. If content ownership can change, both the old and new tenant must become dirty.

**Why:** A publish can otherwise clear the flag in the gap between a content commit and its later marker, producing either a false clean or a false dirty state depending on timing. Marking only the new owner also misses the source guide losing content.

**How to apply:** Keep publish serialized on the tenant row. Mark ordinary guest tables within their write transaction, include old/new ownership paths, and exclude internal-only Creator source/queue tables. Direct tenant-setting writes must set dirty atomically in their tenant update.

The admin cache transition must be symmetric: publish success explicitly applies clean state, and every successful guest-content mutation explicitly applies dirty state before revalidating from a no-store tenant response.

**Why:** Relying only on indirect query invalidation lets the header remain on a previously cached clean publish response even though the content mutation succeeded.

**How to apply:** Route text, structure, translation, distance, restore/purge, and media mutation success handlers through one tenant-dirty cache helper, then invalidate the exact tenant-detail query. Keep the server flag authoritative across reloads.