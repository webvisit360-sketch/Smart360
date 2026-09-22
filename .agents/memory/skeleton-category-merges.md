---
name: Skeleton category merge boundaries
description: Lossless dedupe, historical age uncertainty, and preservation of custom Stay/Offer metadata.
---

Skeleton alignment may merge only categories with the same normalized name at the start of the action. Adding Stay/Offer coverage must not reset unrelated host labels, icons, layouts, translations, or positions.

**Why:** Canonicalizing names before dedupe can manufacture apparent duplicates and undo deliberate host customization. The legacy `rules` and canonical `house` identities produced duplicate Hišni red rows through key-only additive provisioning, not the older alignment action.

**How to apply:** Prefer the skeleton identity, adopt a normalized-name fallback only when its key is absent, and preserve all item IDs and translation values. Conflicting source provenance must fail safely rather than be discarded.

Category creation age is not generally recoverable from this historical schema. Translation update times and PostgreSQL `xmin` are not creation timestamps.

**Why:** `xmin` changes on updates, and translation timestamps reflect edits. Neither proves which category was originally created first.

**How to apply:** Use exact unambiguous creation evidence if present; otherwise disclose the deterministic ordering fallback. Do not claim an older-row guarantee or silently add a schema migration.