---
name: Smart360 translation layer
description: How the 4-language (sl/en/de/it) translation layer works across API and guest app; pitfalls when extending it.
---

Design:
- Translations stored per (model, recordId, field, lang) with `stale` flag; path-keys (CONFIG.*, DATA.*, UI.*) are only an import/export interchange format, resolved via `buildKeyList(tenant)`.
- Public tenant JSON carries `ui` (key→string) and `plurals` (key→CLDR-form→template) maps for the requested lang; guest overlays them via `makeT`/`plural` (Intl.PluralRules, never if/else).
- **Language enforcement is two-sided**: server (`enabledLang` in publicTenants) refuses un-enabled langs (falls back to source), client `clampLang(lang, tenant.languages)` after tenant arrives. `resolveLang(..., null)` pre-tenant accepts all four supported langs — clamping later is mandatory, or ?lang=en silently renders Slovene UI (was a real bug).
- Built-in extra UI keys (not from the original en.json spec) live in `SL_UI`; their EN values must be seeded as `model='ui'` rows per tenant, or EN guests see Slovene.
- `exportTranslations`/`importTranslations` take the **tenant row object**, not tenant.id — passing the id silently exports 0 rows (translations table has no tenantId column; everything is keyed by recordId).
- **Why:** silent Slovene fallback is a product rule; export→reimport must be a zero-change no-op (verified for meli-pu).
- **How to apply:** when adding guest UI strings, add to SL_UI + seed per-tenant EN row; when adding a new lang, extend CONTENT_LANGS (api) and the resolveLang/manifest whitelists; A6 print label and QR stay tenant default language.
