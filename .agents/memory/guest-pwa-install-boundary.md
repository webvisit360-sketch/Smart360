---
name: Guest PWA install boundary
description: Approved tenant-scoped offline boundary, legacy compatibility, and evidence limits for guest installation.
---

The owner approved tenant-slug-scoped offline caching for Living Guide on 2026-09-30, superseding the original network-only restriction for that theme alone. Swipe/legacy retain their existing pass-through worker and installation behavior. Custom-domain root, admin/portal requests, mutations, redirects and weather remain outside offline caching; only the exact published tenant content and its published GPX GETs are API exceptions.

**Why:** Offline support was initially deferred, then explicitly approved with these isolation boundaries. Restricting registration to Living Guide would accidentally remove pre-existing Swipe/legacy PWA behavior rather than leaving it unchanged.

**How to apply:** Preserve historical alias 301 precedence over canonical trailing-slash redirects. Custom-domain root installation is not covered by the current slug-scoped manifest/worker; changing that boundary requires deliberate design, not a root worker fallback.

Published guest requests must omit preview parameters entirely rather than serialize `preview=false`.

**Why:** The generated API client serializes false values. Strict preview exclusion then bypasses the offline worker, breaking a real cold offline boot even though synthetic fixtures without that parameter pass.

**How to apply:** Exercise the actual built application and actual generated client when verifying offline boot, not only a simplified shell. Never relax true preview isolation to hide this mismatch.

An offline device cannot discover a server-side slug rename until it reconnects.

**Why:** No offline cache can know a server-side change without communication.

**How to apply:** Retire old scopes/caches when the canonical identity or redirect is observed online, and distinguish that guarantee from impossible immediate invalidation on disconnected devices.

Separate Chromium installability diagnostics from simulated install prompts and physical-device installation.

Do not identify slow service-worker activation as a proven WebAPK disqualifier. The production persistent-profile Chromium audit returned no installability errors even while the worker was installing. First activation should not await the full offline asset graph; existing-worker updates must retain warm-before-replacement protection.

**Why:** A reported Samsung Chrome-badged shortcut was not reproducible as a manifest failure; ordinary and maskable production icons already had opaque white fields. A stalled-asset test proved the activation delay independently, not the cause of the phone's shortcut.

**How to apply:** Record manifest diagnostics, worker lifecycle and physical Android installation as separate evidence. Incognito-only diagnostics cannot establish production installability.

For offline proofs, verify that service-worker-owned fetches actually fail, not only page requests.

**Why:** In this workspace's Chromium 138/Playwright runner, context offline mode blocked the page while worker-initiated refresh requests still reached the fixture server. That produced false offline evidence and misleading banner failures.

**How to apply:** Pair browser offline mode with an explicit transport cut in the disposable server fixture, clear the browser HTTP cache, and assert CacheStorage behavior using the actual built application.

Offline map verification must inspect rendered map geometry and the map's live position marker, not merely the elevation-profile dot, start/end markers, timer or stored track points.

**Why:** Those other elements passed while the map had no usable style or GeoJSON worker. In the tested Chromium, direct dedicated-worker bootstrap outside the tenant URL scope bypassed the service worker entirely, despite the script being present in CacheStorage.

**How to apply:** Cold-open the first map after a cover-only online visit and a real transport cut. Use a neutral local style when an unvisited provider style is unavailable; bootstrap cached map-worker bytes through a controlled page fetch and a document-lifetime Blob URL. Never prefetch tiles or broaden worker admission to unrelated clients.

**Why:** A secure local development guide passed Chromium diagnostics, but simulated beforeinstallprompt, iOS and standalone states do not prove the real OS install interaction.

**How to apply:** Describe the actual test environment and retain safe existing bundle-refresh behavior; service-worker activation must not force reloads during guest activity.