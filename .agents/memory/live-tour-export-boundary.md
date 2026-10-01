---
name: Live tour export and verification boundary
description: Device-only real-map exports, schematic fallback, offline brand assets and hardware verification limits.
---

Tour summary exports now prefer a verified, client-rendered OpenFreeMap snapshot and fall back to an explicitly labeled schematic. Keep image-export evidence distinct from an on-screen map: successful tiles alone do not prove a readable/exportable canvas.

**Why:** The owner replaced schematic-only exports with real-map exports while retaining device-only composition and offline fallback. Direct CORS canvas capture has been verified; no screenshot proxy or route upload is authorized.

**How to apply:** Include map attribution only for real geographic captures; use the localized schematic label for fallback. Bundle original brand artwork and font with the composer: first-time offline export must not depend on an earlier font/image fetch or a service-worker cache hit. Test preview/download byte equality and offline first composition. Browser share spies do not prove native sharing on a physical phone; simulated geolocation and Wake Lock do not prove outdoor GPS, battery usage or background operation.

Free recording deliberately favors bounded device storage and re-importable GPX over indefinite lossless history. If retention ever omits complete old segments, disclose it visibly; never bridge missing GPS intervals or present the exported path as complete.

**Why:** Segment boundaries and the importer’s limits must coexist with all-day recording. Accumulated session metrics may cover more history than a retained export.

**How to apply:** Keep retention-loss notices and distinguish recorded session totals from statistics recomputed after importing a simplified or truncated GPX.