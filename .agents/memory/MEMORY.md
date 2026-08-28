# Memory index

- [Smart360 photo pipeline](photo-pipeline.md) — two-width object-storage images, first media row = tile, idempotent seed, forced public cache header.

- [Smart360 conventions](smart360-conventions.md) — multi-tenant guest PWA: contract quirks, seed pipeline, auth model, EU-region publish reminder.
- [Orval codegen pitfalls](orval-codegen.md) — avoid `type: integer` (zod v3 lacks z.int) and path+query param name collisions; serialize Dates before zod response parse.
- [Smart360 storage cleanup](storage-cleanup.md) — live DB reference set (incl. rich text!), shared dev/prod bucket + 7-day guard, prod SQL fails silently on missing columns.
- [Smart360 translation layer](translation-layer.md) — ui/plurals overlay maps, two-sided lang enforcement (enabledLang + clampLang), export/import takes tenant row not id.
- [Poteg CSS pitfalls](poteg-css-pitfalls.md) — `.lb` class collision (lightbox vs grid card label); must override display/background/inset on `.gc .lb`.
- [Living Guide decisions](living-guide-decisions.md) — approved theme boundaries, guest persistence, price/order rules, event tabs, cutover and staged-review gates.
- [Drizzle check constraints](drizzle-check-constraints.md) — keep stable semantic names; replace explicitly and derive production SQL from observed production state.
- [CodeExecution runtime quirks](codeexecution-runtime-quirks.md) — deterministic test runtime may disable clock/random globals; use database IDs or fixed fixtures with cleanup.
- [Living Guide prototype parity](living-guide-prototype-parity.md) — trust 390×844 computed styles; stage percentages and descendant font cascades can differ from prose tables.
- [Guest sign-in delivery status](guest-sign-in-delivery.md) — unified sheet is production-approved; do not reimplement unless the owner reports a regression.
- [Distance review pipeline](distance-review-pipeline.md) — link-only host location input, mapQuery URL = destination, manual-wins conditional approve, DB-wide Nominatim 1 rps throttle.
- [Stale guest bundles](stale-guest-bundles.md) — fix built: self-owned static server + version.json one-shot safe reload; platform static headers are NOT configurable; verify needs two publishes.
- [Prod data backfills](prod-data-backfills.md) — prod SQL is read-only; publish syncs schema not data; fix via self-disabling startup backfill with race-safe predicates. Also: itemMapsHref is the only POI maps builder.
- [Scale audit 150 tenants](scale-audit-150-tenants.md) — one app suffices; hardening shipped (indexes, brotli, payload cache); guest-cache invalidation is CENTRALIZED middleware — never per-route.
- [Operator and client access](host-portal.md) — two roles, shared audit/IP policy, client-owned passwords, and operator-only permanent purge.
- [Owner cockpit](owner-cockpit.md) — slug frozen after first publish (CAS stamp!), published e-mail fires once via CAS winner, type seeding in one tx, buildTenantOverviews is the single readiness source.
- [Playwright WebKit runtime](playwright-webkit-runtime.md) — local WPE starts but cannot create EGL; only claim WebKit after a real page opens on a supported host.
- [Town-pack onboarding direction](town-pack-onboarding.md) — shared place catalogue is deferred; optimize tenant-local onboarding and require provenance for every new photograph.
- [Enquiry delivery diagnosis](enquiry-delivery-diagnosis.md) — Gmail access is permanently declined; use persisted delivery state and provider status, never mailbox workarounds.
- [Migration approval boundaries](migration-approval-boundaries.md) — additive approval never covers existing-schema changes or backfills; show exact SQL and wait.
- [Events scheduling model](events-scheduling-model.md) — generated occurrences, tenant-local days, translation fallback, immutable history, and cross-midnight limit.
