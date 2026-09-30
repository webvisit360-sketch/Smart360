---
name: Live tour export and verification boundary
description: Why local tour image exports are schematic and hardware claims require outdoor evidence.
---

Keep image-export evidence distinct from rendered map evidence: the local PNG uses an explicitly labeled schematic of both tracks, while the live result map uses the shared vector provider.

**Why:** The export must remain device-only without adding services or depending on capture of cross-origin tile imagery. Do not silently describe this PNG as a screenshot of geographic tiles.

**How to apply:** Preserve the localized schematic label unless implementing and verifying actual client-side tile capture. Simulated geolocation and Wake Lock tests prove application transitions, not GPS quality, battery usage or background operation on physical phones.