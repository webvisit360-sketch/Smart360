---
name: Stale guest bundles on production
description: Why a guest device can keep running the pre-publish frontend after a deploy, and how to verify what production actually serves.
---

# Stale guest bundles

- Production static assets (index.html AND hashed JS) are served with `cache-control: private` and no max-age → browsers apply heuristic freshness. A guest/PWA device that cached index.html before a publish can keep running the ENTIRE old bundle for hours; old behavior "reproduces" on their device while fresh loads are fixed.
- **Why:** owner reproduced an already-fixed defect minutes after publish; fresh browser (tester) got the fixed behavior; his observation matrix exactly matched the old code paths.
- **How to verify what prod serves:** don't grep only the main bundle — the Living Guide shell is a LAZY chunk (`assets/LivingGuideGuestShell-*.js`); resolve the chunk name from the served main bundle and grep that. Definitive proof: testing subagent taps the real button on the prod URL and captures the popup URL (Playwright popup event).
- Recovery for a stuck device: hard refresh / clear site data. Durable fix (proposed as a task): app-level version check with one-shot cache-busting reload.
- Maps intent rules are guarded by source-scan tests in `maps-href.test.ts`: zero "directions" in living-guide pages; in legacy guest pages item-level directions are forbidden (only tenant-level `resolveTenantMapsUrl(tenant,"directions")` or the `item.mapQuery === tenant.mapQuery` property branch).

**Stale-bundle recovery task is OWNER-APPROVED (2026-08-23), not cancelled.** Requirements: detect an outdated bundle, reload ONCE silently, preserve the guest's place and any typed draft, no reload loops, never mid-order or mid-message, and fix caching headers so a normal reload picks up a new build. Build after the named-maps-query work ships.
