---
name: Orval codegen pitfalls
description: OpenAPI spec rules that keep codegen green in this monorepo
---

- Do not use `type: integer` in openapi.yaml. Orval emits `zod.int()` which does not exist in zod v3 (the resolved version). Use `type: number`.
  **Why:** codegen typecheck failed across all integer fields. **How to apply:** positions/counts as `number`.
- An operation with BOTH path and query params generates a zod value `XParams` (path) and a TS type `XParams` (query) — colliding in the `@workspace/api-zod` barrel (TS2308). Fix by explicit `export type { XParams } from "./generated/types"` lines in `lib/api-zod/src/index.ts` for the affected operations.
- Zod response schemas expect ISO strings for date-time fields, but Drizzle returns `Date`. Serialize with `JSON.parse(JSON.stringify(x))` before `Response.parse(...)` in route handlers.
