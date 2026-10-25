---
name: System tiles and publication refresh
description: Owner-approved visibility and non-interrupting published-content refresh rules.
---
System tile visibility is tenant-owned draft content, exposed only after publication,
with absent values treated as visible. Self-service hosts may edit; concierge requires
an operator. Hiding Pomoč in SOS requires an extra confirmation and hides its
equivalents in both designs. Install visibility never overrides standalone hiding.
**Why:** The Meli Pu owner requested control of built-in tiles without changing defaults.
**How to apply:** Gate all entry points, not only the Enostaven tile.

Published content refresh must never interrupt an active/paused tour or unsent message.
This includes existing PWA foreground landing resets and bundle updates, not only
the publication fetch. A publication identity must come from the same stored
snapshot as its payload, and cached old offline responses are not new publications.
**Why:** The owner explicitly requires silent refresh only when safe; independent
foreground logic could otherwise close the recorder before the refresh guard runs.
**How to apply:** Verify real activity continuity on foreground, then apply pending
content after the activity ends. Physical OS process termination is not covered.
