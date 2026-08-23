---
name: Stale guest bundles on production
description: Why guest devices ran pre-publish frontends and the durable caching/reload principles behind the fix.
---

# Stale guest bundles

- Platform static hosting (`serve = "static"`) sends `cache-control: private` with no max-age and its headers are NOT configurable → browsers apply heuristic freshness; a device that cached index.html before a publish keeps running the ENTIRE old bundle for hours. **Why this matters:** owner reproduced an already-fixed defect minutes after a publish; a fresh browser got the fixed behavior.
- Durable principles of the fix (in repo): serve production through a self-owned static server so headers are controllable (hashed assets immutable, HTML no-cache, version endpoint no-store); stamp builds with an id and poll a version endpoint, reloading at most ONCE per new build id; gate any auto-reload on guest activity (open sheets, drafts, focused inputs) and keep navigation URL-driven so a reload restores the guest's place.
- **Status: owner-approved to ship (2026-08-23) with conditions** — /healthz startup gate, 4xx/5xx logging in the static server, and a repo rollback doc (docs/rollback-smart360-static-hosting.md) all in place. Owner publishes personally; agent never publishes.
- **Verification protocol:** needs TWO owner publishes — after the FIRST, verify production headers (asset 1y immutable, index no-cache, reload picks up new build) and report actual values; after the SECOND, prove a held-open guest session self-reloads once, silently, preserving place, never mid-order/mid-message.
- Missing files under /assets/ (and /version.json) must 404 loudly, never SPA-fallback to index.html — HTML handed to a `<script>` tag hides a broken deploy.
- How to verify what prod actually serves: don't grep only the main bundle — guest shells load as LAZY chunks; resolve the chunk name from the served main bundle and grep that. Definitive proof: testing subagent exercises the real UI on the prod URL.
- Maps intent rules are guarded by source-scan tests: living-guide pages must contain zero "directions" intents; legacy guest pages allow directions only at tenant level.
