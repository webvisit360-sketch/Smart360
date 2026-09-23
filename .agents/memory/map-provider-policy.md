---
name: Map provider policy
description: Why app maps must not return to the volunteer OpenStreetMap raster servers.
---

Do not restore tile.openstreetmap.org as a map source or error fallback. Use an application-permitted provider; the owner selected OpenFreeMap as the preferred keyless option.

**Why:** The owner confirmed a production policy block on 2026-09-23, not a transient 403. Retrying or hiding it would not resolve the usage-policy issue.

**How to apply:** Keep provider configuration and attribution shared. Distinguish tile rendering from OSRM distance calculation and its throttling: provider changes do not authorize routing changes. Browser acceptance must show actual geography and coordinate interaction, not merely a successful style request.

MapLibre 6 needs an explicitly bundled worker under Vite. Also protect the map container's dimensions from unlayered vendor CSS overriding Tailwind utilities.

**Why:** Vite moved the optimized main module but not its sibling worker, yielding a worker 404 while style/TileJSON returned 200 and markers still moved. Separately, vendor `position: relative` collapsed the container. These failures looked like unavailable WebGL or provider tiles.

**How to apply:** Inspect worker requests and computed canvas dimensions before blaming WebGL. Nix Chromium with ANGLE/SwiftShader can verify real vector rendering when the remote browser lacks WebGL2; require a successful vector tile response as well as visual evidence.