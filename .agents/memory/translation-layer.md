---
name: Smart360 translation layer
description: Translation interchange and operator regeneration pitfalls; see seven-language-boundary for current language policy.
---

Design:
- Translations stored per (model, recordId, field, lang) with `stale` flag; path-keys (CONFIG.*, DATA.*, UI.*) are only an import/export interchange format, resolved via `buildKeyList(tenant)`.
- Public tenant JSON carries `ui` (key→string) and `plurals` (key→CLDR-form→template) maps for the requested lang; guest overlays them via `makeT`/`plural` (Intl.PluralRules, never if/else).
- Historical per-tenant language clamping is superseded by [universal seven-language availability](seven-language-boundary.md). Do not restore it.
- `exportTranslations`/`importTranslations` take the **tenant row object**, not tenant.id — passing the id silently exports 0 rows (translations table has no tenantId column; everything is keyed by recordId).
- **Why:** export→reimport must be a zero-change no-op.
- **How to apply:** UI additions need bundled translations for offline use; do not require tenant data writes to localize application UI.

Item-editor regeneration must use the current Slovenian draft exclusively, not another populated language as a fallback.

**Why:** The generic translator's first-populated-language behavior is inappropriate when an operator is correcting Slovenian source; an older target could otherwise become the new source.

**How to apply:** Missing and stale fields are eligible, but populated replacements require explicit confirmation. Preserve target edits made after that confirmation while the request is running. Generated suggestions remain drafts until saving.

Translation incident diagnosis must distinguish the application's HTTP response from the provider's response; never infer quota exhaustion or rate limiting from repeated use alone.

**Why:** On 2026-09-24, production translation failures retained only `error: {}` and the application's generic 502. The historical provider reason could not be recovered.

**How to apply:** Preserve allowlisted provider category/status/code in server logs, not raw SDK errors, messages, prompts or translated content. Treat historical empty-error records as unknown. Only genuine rate limits qualify for automatic retries; quota exhaustion does not.
