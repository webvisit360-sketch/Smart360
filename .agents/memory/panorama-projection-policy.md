---
name: Panorama projection policy
description: Owner-approved ratio detection, partial-image fallback, and spherical pole semantics.
---

The owner approved no schema change: panorama-marked images near 2:1 use spherical viewing; other ratios retain flat limited panning. Do not infer angular coverage or add projection/angle fields.
**Why:** aspect ratio alone cannot establish a partial panorama's true field of view; the owner explicitly chose the existing undistorted flat fallback.
**How to apply:** preserve ordinary photos, gallery controls and existing media cache URLs.

For a complete sphere, leave Pannellum's pitch bounds unset.
**Why:** explicit ±90° bounds describe image edges, not camera-centre limits; Pannellum subtracts half the vertical viewport and prevents looking straight at the poles.
**How to apply:** verify the actual camera can reach both poles, not just that configuration contains ±90.

Pass an already loaded HTML image to Pannellum rather than using its default URL/XHR loader.
**Why:** guest offline storage intentionally admits browsed images but not arbitrary API XHR. A URL can exist in Cache Storage and still fail offline if the library uses the wrong request destination.
**How to apply:** retain the strict worker boundary; verify compiled-app offline reopening with actual transport disabled, not only cache presence.
