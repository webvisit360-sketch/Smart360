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
