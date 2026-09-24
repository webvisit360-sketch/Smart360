---
name: Official mark white field
description: Owner's binding white-background rule for the Smart360 mark and home-screen icon sizing.
---

The official Smart360 mark must sit on a pure white field. Home-screen icons must be fully opaque, with the original shared artwork centered at roughly 62–70% of canvas width and inside the maskable safe zone.

**Why:** The owner explicitly rejected dark-field home-screen icons. This is a brand requirement, not merely a workaround for iOS transparency handling.

**How to apply:** Reuse official artwork without redrawing or recoloring it. Preserve the separate decision that the print QR sticker has no mark at all. Do not infer transparency from a black-looking icon; inspect its pixels and alpha channel.

**Small icon rasterization:** For 180/192px home icons, render the unchanged official SVG mark at 4x its existing 66%-of-canvas size/position on a 4x pure-white opaque canvas (720/768px), composite first, then Lanczos3 downsample the whole canvas to target size. This deliberately improves the small-size pixel lattice/antialiasing without changing the brand artwork or the direct 512/1024px pipeline. Keep the pre-change 180px PNG comparison baseline intact across generator reruns.

**Installed guest app boundary:** The browser discovers a PWA manifest while parsing the initial HTML head, before React effects or tenant API requests run. Do not put the platform `/admin` manifest in the common static HTML and rely on a guest effect to replace it: iOS can persist the wrong install start page even if the hydrated DOM looks correct. The production static server must render a route-specific initial head (Vite dev should mirror it). Guest and legacy guest deep links, including failed tenant loads and custom-domain root requests, must never initially expose the platform manifest or Smart360 apple install title; the tenant manifest's published name and `/<slug>/` start/scope belong to the tenant. Test raw HTTP HTML, not only the hydrated document or manifest endpoint.