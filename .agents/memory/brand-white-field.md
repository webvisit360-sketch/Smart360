---
name: Official mark white field
description: Owner's binding white-background rule for the Smart360 mark and home-screen icon sizing.
---

The official Smart360 mark must sit on a pure white field. Home-screen icons must be fully opaque and centered. Standard 180/192/512/1024 icons have a measured ring outer diameter of 74% of the canvas (±1%); separate 192/512 maskable icons retain the 66% safe-zone artwork.

**Why:** The owner explicitly rejected dark-field home-screen icons. This is a brand requirement, not merely a workaround for iOS transparency handling.

**How to apply:** Reuse official artwork without redrawing or recoloring it. Preserve the separate decision that the print QR sticker has no mark at all. Do not infer transparency from a black-looking icon; inspect its pixels and alpha channel.

**Why split:** The owner explicitly approved a larger standard ring for consistent perceived visual size while retaining a separate 66% maskable variant inside the 80%-diameter safe circle; do not constrain every standard icon to maskable geometry.

**Small icon rasterization:** For standard 180/192px and maskable 192px home icons, render the unchanged official SVG mark at 4x its target size/position on a 4x pure-white opaque canvas (720/768px), composite first, then Lanczos3 downsample the whole canvas. Large 512/1024px icons use the direct vector pipeline. Keep both the original pre-supersampling 180px baseline and the immutable supersampled 66% 180px baseline intact across generator reruns.

**Visual sizing measurement:** Use exactly 74% SVG mark viewport for standard icons and 66% for maskable icons, including supersampled small icons. Verify actual visible ring bounds using a fixed RGB channel <240 contrast threshold: a strict non-white test sees barely visible Lanczos3 filter halo and must not be used to shrink the artwork. For maskable safe-zone checks, conversely include *every* non-white pixel (even faint halo).

**Installed guest app boundary:** The browser discovers a PWA manifest while parsing the initial HTML head, before React effects or tenant API requests run. Do not put the platform `/admin` manifest in the common static HTML and rely on a guest effect to replace it: iOS can persist the wrong install start page even if the hydrated DOM looks correct. The production static server must render a route-specific initial head (Vite dev should mirror it). Guest and legacy guest deep links, including failed tenant loads and custom-domain root requests, must never initially expose the platform manifest or Smart360 apple install title; the tenant manifest's published name and `/<slug>/` start/scope belong to the tenant. Test raw HTTP HTML, not only the hydrated document or manifest endpoint.