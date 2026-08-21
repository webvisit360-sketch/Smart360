# Memory index

- [Smart360 photo pipeline](photo-pipeline.md) — two-width object-storage images, first media row = tile, idempotent seed, forced public cache header.

- [Smart360 conventions](smart360-conventions.md) — multi-tenant guest PWA: contract quirks, seed pipeline, auth model, EU-region publish reminder.
- [Orval codegen pitfalls](orval-codegen.md) — avoid `type: integer` (zod v3 lacks z.int) and path+query param name collisions; serialize Dates before zod response parse.
- [Smart360 storage cleanup](storage-cleanup.md) — live DB reference set (incl. rich text!), shared dev/prod bucket + 7-day guard, prod SQL fails silently on missing columns.
- [Smart360 translation layer](translation-layer.md) — ui/plurals overlay maps, two-sided lang enforcement (enabledLang + clampLang), export/import takes tenant row not id.
- [Poteg CSS pitfalls](poteg-css-pitfalls.md) — `.lb` class collision (lightbox vs grid card label); must override display/background/inset on `.gc .lb`.
- [Living Guide decisions](living-guide-decisions.md) — approved theme boundaries, guest persistence, price/order rules, event tabs, cutover and staged-review gates.
- [Drizzle check constraints](drizzle-check-constraints.md) — changing a same-named CHECK body may be skipped by db push; rename it and verify the live definition.
