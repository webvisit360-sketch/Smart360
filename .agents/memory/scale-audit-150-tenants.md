---
name: Scale audit for 150 tenants
description: Aug 2026 scale audit verdict and the hardening that shipped from it — cache invalidation invariant, compression, indexes, pool.
---

# Scale audit → hardening (Aug 2026)

**Verdict: one shared app carries 150 tenants — no per-tenant apps.** Every guest query is tenant-scoped.

## What shipped (dev; production gets it at the next publish — schema sync applies the indexes)
- Indexes: sections(tenant_id), categories(section_id), items(category_id), media(item_id), translations(record_id, lang); translations content query now filters `lang` in SQL (all stored lang values verified lowercase in dev AND prod; JS lowercase guard retained).
- `compression()` middleware on the API (~160 KB payload → ~22 KB brotli). Default filter skips image/video streams incl. Range/206 — verified untouched.
- Per-(tenant, lang) built-payload cache in publicTenants.ts (30 s TTL, zod-parse done once); search serves from it; preview and unpublished requests bypass it.
- Explicit `max: 10` on the pg Pool.

## The invariant that matters (do not regress)
**Guest-cache invalidation is centralized**: a middleware in api-server routes/index.ts (`makeAdminMutationInvalidator`) clears the tenant + payload caches after ANY successful mutating `/admin/*` request. **Why:** ad-hoc per-route `invalidateTenantCache()` calls missed most content/media/site-plan routes the moment a payload cache existed (caught by review); centralizing means new admin routes are covered automatically. **How to apply:** never rely on route-level invalidation calls; keep new admin mutations under `/admin/`; guest endpoints (orders/messages) must NOT evict the cache. Cross-instance staleness on autoscale is bounded only by the 30 s TTL — a save clears only its own process.

## Still true / later options
- Media is proxied through the API process (browser-cacheable, immutable+ETag) — CDN/presigned is a cost optimization only.
- `changelog` is the one unbounded table (no tenant index, no retention) — owner wants a retention policy noted for later, not built.
- orders/messages bounded by 90-day delete_after + daily purge; polling is cheap and index-backed.
