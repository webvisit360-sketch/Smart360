---
name: Scale audit for 150 tenants
description: Findings of the Aug 2026 read-only scale audit of the guest render path — what is already fine and which four cheap fixes carry 150 tenants.
---

# Scale audit (Aug 2026, production-verified)

**Verdict: one shared app carries 150 tenants — no per-tenant apps.** Every guest query is tenant-scoped (directly or via id lists). The gaps are performance-only.

## Facts that stay true until the fix task ships
- Guide payload (`GET /api/public/tenants/:slug`) is rebuilt per request (~10 queries), served `no-store`, no ETag, **uncompressed** (~160 KB/lang for meli-pu; platform front end does NOT gzip API responses). Only the tenant row lookup is cached (60 s in-process, invalidated on save). Search rebuilds the full tree per request.
- Missing FK indexes: sections(tenant_id), categories(section_id), items(category_id), media(item_id). translations lookup by record_id can't use `translations_ref_idx` (leads with `model`) and fetches ALL languages, filtering in JS (contentTree.ts ~:168-187) — the biggest scaling cliff (~1,080 translation rows/tenant).
- Today's seq scans are planner-optimal (tiny tables) — do not read a current EXPLAIN seq scan as a bug; the indexes matter only as tenants multiply.
- Media is proxied through the API process from object storage (immutable + ETag headers, browser caches well); fine for 150 tenants, CDN/presigned is a cost optimization only.
- orders / message_threads / messages: well-indexed (tenant+device composite), bounded by 90-day `delete_after` + daily purge — verified live. `changelog` is the one unbounded table (admin audit, no tenant index, no retention).
- DB: single `pg.Pool`, node-postgres defaults (max 10, idle 10 s), one pool per autoscale instance, dev = prod config.

**How to apply:** the approved smallest fix set lives in the follow-up task "Keep the guest guide fast when 150 tenants are onboard" (indexes + SQL lang filter, compression middleware, per-(tenant,lang) payload cache with save-hook invalidation, explicit pool max). If implementing, re-verify EXPLAIN on production afterwards.
