---
name: Living Guide runtime weather boundary
description: Weather must stay outside published content and localization workflows; cache scope needs explicit release review.
---

Weather is runtime information from stored tenant coordinates, not authored or published-snapshot content. Guest weather requests go through the server; WMO descriptions stay in code.

**Why:** The owner approved Living Guide weather only, prohibited guest-IP exposure to Open-Meteo, and required no database schema changes without separate approval.

**How to apply:** Keep legacy/Swipe out of scope. Hide unavailable, previous-local-day, or over-three-hour forecasts rather than displaying errors or misleading current conditions. Rain probabilities must not invent thunderstorms.

The owner's supplied `vreme-domov-celota` HTML is the binding visual reference for the Home weather card, not a loose inspiration.

**Why:** The owner rejected an improvised header and unlabeled metric pills, while explicitly approving the tour strip and amber warning separately.

**How to apply:** Compare Home card rendering and computed geometry against the supplied reference. Preserve the existing line icons and do not restyle the approved tour weather surfaces during Home corrections.

The initial development cache is process-local, not a shared distributed quota.

**Why:** No schema or infrastructure change was authorized. The development implementation proves cooldown and single-flight within one process, not across restarts or replicas.

**How to apply:** Explicitly disclose this limitation; do not claim a global once-per-30-minute guarantee. A horizontally scaled release needs a reviewed shared-cache approach before claiming that stronger guarantee.