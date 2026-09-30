---
name: Live tour export and verification boundary
description: Why local tour image exports are schematic and hardware claims require outdoor evidence.
---

Keep image-export evidence distinct from rendered map evidence: the local PNG uses an explicitly labeled schematic of both tracks, while the live result map uses the shared vector provider.

**Why:** The export must remain device-only without adding services or depending on capture of cross-origin tile imagery. Do not silently describe this PNG as a screenshot of geographic tiles.

**How to apply:** Preserve the localized schematic label unless implementing and verifying actual client-side tile capture. Simulated geolocation and Wake Lock tests prove application transitions, not GPS quality, battery usage or background operation on physical phones.

Free recording deliberately favors bounded device storage and re-importable GPX over indefinite lossless history. If retention ever omits complete old segments, disclose it visibly; never bridge missing GPS intervals or present the exported path as complete.

**Why:** Segment boundaries and the importer’s limits must coexist with all-day recording. Accumulated session metrics may cover more history than a retained export.

**How to apply:** Keep retention-loss notices and distinguish recorded session totals from statistics recomputed after importing a simplified or truncated GPX.