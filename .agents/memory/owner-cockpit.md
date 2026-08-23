---
name: Owner cockpit (CP2b)
description: Slug freeze, first-publish e-mail gating, type seeding, readiness/pending overview — the rules behind the owner's tenant cockpit.
---

# Owner cockpit decisions (Instruction #28, CP2b)

## Slug freeze + first publish
- `tenants.first_published_at` is stamped **exactly once**, via compare-and-set
  (`UPDATE … WHERE first_published_at IS NULL`) — never in the general update payload.
  **Why:** a code-review round proved read-then-write raced: parallel publishes double-sent
  the e-mail and a parallel rename could slip past the freeze.
- Slug changes are rejected 409 once stamped; the rename UPDATE also carries
  `WHERE first_published_at IS NULL` so the freeze is atomic, not just pre-checked.
  Printed QR codes are the reason — old slugs additionally live forever as 301 aliases.
- The "guide published" lifecycle e-mail fires only for the CAS winner, best-effort
  (publish never fails on e-mail), idempotency key `published-<tenantId>`.
  Host publishes go through the same PATCH → also trigger it (intended).
- A startup backfill stamped tenants published before the column existed, so they can
  never retro-trigger the e-mail. Duplicated tenants reset `firstPublishedAt` to null
  and record `copiedFromTenantId` (KOPIJA badge in the editor header).

## Type seeding
- `tenantType` ∈ kamp|hotel|apartmaji (CHECK constraint, NULL for legacy tenants).
  Seeds 4 canonical sections (stay/offer/explore/services — same keys as the reference
  tenant so feature detection works) + typed empty categories with stable keys, sprite
  icons and explicit group values. No bottom-bar rows: legacy derives from sections,
  Living Guide resolver defaults when `livingGuideNav` is NULL.
- Tenant insert + seeding run in ONE transaction (seed failure must not squat the slug).
  `seedTenantContent` accepts an executor param for that.

## Readiness & pending counts
- Single source: `buildTenantOverviews()` (api-server lib/tenantOverview.ts) — grouped
  raw-SQL counts, no per-tenant N+1. 8 equal-weight checks → readinessPct. Reuse it for
  any future per-tenant status needs (CP4) instead of re-deriving.
- Pending definitions mirror the live routes: orders = status 'novo' within retention with
  notification sent/skipped; messages = open threads last-spoken-by-guest; locations =
  pending distance proposals; photos = visible categories with no visible item media/tint.

## Attribution
- Changelog rows carry actorType/actorEmail from the actor gate; owner rows render as
  "Smart360 · v imenu gostitelja", host rows as the host e-mail. Per-tenant changelog is
  owner-only (`/admin/tenants/:id/changelog`), like the overview route.

## Still pending (deliberate)
- Welcome (template 1) and guide-ready (template 4) e-mails are built + tested but NOT
  wired to any trigger: the cockpit "send access" action needs a 24h set-password token
  variant (current reset tokens last 60 min) and the /portal/ponastavitev page (CP3).
