---
name: Admin preview editing boundary
description: Parent-owned iframe editing, record identity precedence, and draft announcements.
---

Click-to-edit belongs solely to the authenticated admin parent, not to guest
components. Preserve ordinary guest navigation when editing is off; reuse the
existing save forms and authorization gates.
**Why:** The owner explicitly requires no guest application changes and the same
behavior for Enostaven and Trend across tenants.
**How to apply:** Validate every candidate against the current tenant tree. A
child component may carry a category prop before the enclosing card exposes its
item key: entry identity must win over that ancestor metadata. Never map by
translated text. React-internal metadata is a compatibility dependency, not a
public API; retain real browser checks after changes to guest markup or React.

Unpublished tenants' announcements cannot be fetched from the published guest
endpoint. The admin-owned iframe may use the authenticated admin endpoint;
never publish fixture content or weaken the public endpoint to make evidence work.
**Why:** An unpublished browser fixture returned 404 despite having announcements.
**How to apply:** Keep any adapter confined to the same-origin admin preview and
remove it on iframe replacement/unmount. Distinguish unchanged guest sources
from claims of byte-identical production bundles.

Selection geometry must be independent of record lookup: persist the clicked
visual anchor, including through the asynchronous parent-state commit, and never
recover a lost field by outlining its React data-owner ancestor.
**Why:** Correct form mapping can still identify a viewport-sized owner; clearing
the clicked node before selection commits loses the only precise visual anchor.
**How to apply:** Use the hover target for selection, remeasure in iframe CSS
coordinates on scroll, and fail closed if its exact replacement is unavailable.
For interactive tiles, the visual anchor is the tile's own button/article,
including clicks on its nested pictogram or label—not the icon's SVG path.
**Why:** Enostaven and Trend have different tile markup; anchoring the nested
icon can look like an unselectable tile even when the record resolver succeeds.

Browser evidence must wait for the entry splash to disappear and use genuine
hit-tested clicks (not forced clicks through it).
**Why:** The detail mounts underneath the fullscreen splash. A forced title click
can actually hit that overlay and resolve via the route, misleadingly appearing
to be a field-selection failure. Never treat a fixture title that includes a
field label as evidence of that field's selection.
**How to apply:** Keep splash chrome non-editable and exclude its loading interval
from geometry assertions; check the element hit at the intended coordinates.
