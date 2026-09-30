---
name: Guest PWA install boundary
description: Approved worker scope, offline exclusion, and evidence limits for guest installation.
---

The approved first PWA worker is tenant-slug scoped and network-only. Do not add content caching, offline fallbacks, root scope, or portal control as incidental improvements.

**Why:** The owner explicitly deferred offline caching and required no interference with portals, API traffic, GPX downloads, or historical slug redirects. Immediate activation is safe for this pass-through worker, not a blanket approval for future caching workers.

**How to apply:** Preserve historical alias 301 precedence over canonical trailing-slash redirects. Custom-domain root installation is not covered by the current slug-scoped manifest/worker; changing that boundary requires deliberate design, not a root worker fallback.

Separate Chromium installability diagnostics from simulated install prompts and physical-device installation.

**Why:** A secure local development guide passed Chromium diagnostics, but simulated beforeinstallprompt, iOS and standalone states do not prove the real OS install interaction.

**How to apply:** Describe the actual test environment and retain safe existing bundle-refresh behavior; service-worker activation must not force reloads during guest activity.