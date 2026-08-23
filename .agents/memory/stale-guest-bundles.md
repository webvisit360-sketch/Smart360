---
name: Stale guest bundles on production
description: Why guest devices ran pre-publish frontends and the durable caching/reload principles behind the fix.
---

# Stale guest bundles

- Platform static hosting (`serve = "static"`) sends `cache-control: private` with no max-age and its headers are NOT configurable → browsers apply heuristic freshness; a device that cached index.html before a publish keeps running the ENTIRE old bundle for hours. **Why this matters:** owner reproduced an already-fixed defect minutes after a publish; a fresh browser got the fixed behavior.
- Durable principles of the fix (in repo): serve production through a self-owned static server so headers are controllable (hashed assets immutable, HTML no-cache, version endpoint no-store); stamp builds with an id and poll a version endpoint, reloading at most ONCE per new build id; gate any auto-reload on guest activity (open sheets, drafts, focused inputs) and keep navigation URL-driven so a reload restores the guest's place.
- **Status: NOT approved to ship.** The owner accepted the header-fix goal but treats replacing platform static hosting with the self-owned server as an infrastructure change requiring explicit sign-off first (review 2026-08-23). Do not publish it without that. Without the hosting change, the version-check self-reload is only best-effort (client no-store polling detects new builds, but the one-shot reload may be satisfied from heuristic cache, esp. iOS PWA).
- **Verification once approved:** needs TWO publishes — the first ships the new server + check; only a publish AFTER that (while a session is open) can demonstrate self-recovery on a real device.
- How to verify what prod actually serves: don't grep only the main bundle — guest shells load as LAZY chunks; resolve the chunk name from the served main bundle and grep that. Definitive proof: testing subagent exercises the real UI on the prod URL.
- Maps intent rules are guarded by source-scan tests: living-guide pages must contain zero "directions" intents; legacy guest pages allow directions only at tenant level.
