# Shared skeleton status

The earlier seed-vs-Meli-Pu comparison was the decision input for the owner's
new rule. It is now superseded by the implementation in
`artifacts/api-server/src/lib/tenantSeeds.ts`.

Current state:

- The canonical new-tenant skeleton equals Apartmaji Meli Pu: 4 sections and
  37 categories, with matching keys, order, layouts, group assignments, icons,
  and SL/EN/DE/IT names.
- `gate` / `Navodila za ograjo` remains included by owner instruction.
- New rows propagate through the additive synchronizer: existing rows,
  positions, visibility, translations and item content are never replaced,
  moved or deleted.
- Development Gril changed from 18 to 46 categories (+28).
- Production Gril and Camping MENINA remain at 18 categories because this work
  was intentionally not published. On the next approved publish, each will
  receive 28 missing categories and reach 46.
- The Meli Pu gate-name translation repair is complete in development and is
  pending the same future publish in production.