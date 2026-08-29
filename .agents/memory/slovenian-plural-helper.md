---
name: Slovenian plural helper
description: Deferred type-safety decision for Smart360 Slovenian count formatting.
---

When the next Smart360 code change is made, update the Slovenian count helper so an `Intl.PluralRules` category missing from `SloveneForms` falls back to `other`. Do not add this fix to the current Videz-only publish.

**Why:** TypeScript exposes the locale-agnostic plural union, including `zero` and `many`, although Slovenian never returns them. The fallback changes no Slovenian behavior, closes the type hole, and makes an impossible category harmless instead of producing `undefined`.

**How to apply:** Carry the one-line fallback with the next approved code change, then run typecheck and the existing Slovenian count tests.