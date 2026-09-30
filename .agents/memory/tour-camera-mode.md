---
name: Tour camera preference boundary
description: Owner amendment overrides the original north-up default for new tours.
---

Start every new route or free-recording tour in course-up. A manual switch to north-up persists only for that same tour, including reload recovery. Outside an active tour, stay north-up.

**Why:** The owner explicitly amended the original default-north requirement. A general saved camera preference must not prevent the next new tour from automatically entering course-up.

**How to apply:** Tie preference recovery to a recording identity, not just a tenant or route. GPS course only is approved; do not introduce compass permissions or DeviceOrientation as a fallback.