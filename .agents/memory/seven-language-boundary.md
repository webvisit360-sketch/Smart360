---
name: Seven-language product boundary
description: Universal languages, English-first fallback, tenant-content approval and legacy Creator compatibility.
---
All tenants receive sl/en/de/it/fr/nl/hr; stored tenant language selections must not restrict guest choices. Missing translations fall back to English, then Slovenian, using published data only for published guests.

**Why:** The owner explicitly requested universal seven-language availability, while preserving draft isolation.

New fr/nl/hr tenant-content fields start empty. Do not translate existing guides without separate approval. French UI uses vous, Dutch uses je, Croatian is polite and natural. SOS SMS remains Slovenian + English ASCII.

**Why:** UI translation approval did not authorize tenant-content translation or changes to the emergency SMS format.

**How to apply:** Preserve the old Creator readiness requirements when extending language editors; adding empty fields must not invalidate existing reviewed proposals. Verify the real App-level selection guard, not just the sheet or pure language resolver.

The owner approved a separate content rollout for the four production tenants.
Its delivery path is read-only production extraction, one idempotent INSERT-only
SQL file per tenant for the owner console, and separate DEV evidence drafts.
Never execute these SQL files against production on the owner's behalf.
Existing translation rows, including empty fr/nl/hr rows, must be preserved;
published snapshots and announcements are outside this rollout.

**Why:** DEV-only translations never reach live guides. The owner explicitly
changed delivery to owner-executed SQL and kept publication separate.

**How to apply:** Report per-tenant/per-language counts, preserve source formatting
and proper nouns, checksum sl/en/de/it before and after, and verify production
language-tag compatibility before stating the execution order.

Do not treat old indexed English body translations as missing source fields when
the Slovenian body has already been normalized into HTML.

**Why:** These are paragraph aliases of populated Slovenian content. Emitting both
a fresh whole-body translation and English-derived indexed translations can let
the stale paragraph aliases replace the current Slovenian-based result.

**How to apply:** Prefer the populated Slovenian body. Use English indexed fields
only when the source body is genuinely absent; compare against the reader's
paragraph reconstruction before preparing a bulk translation manifest.

Owner-console compatibility requires a test in the actual Replit SQL console,
not executeSql or a PostgreSQL driver. Never label driver-only verification as
console proof.

**Why:** The owner reported silent execution of whole guarded files in the SQL
console despite earlier successful DEV driver tests. The testing browser exposed
only Replit's public signed-out homepage, so the splitter cause remains unknown.

**How to apply:** Establish authenticated platform-console access before promising
a console-tested format. Do not remove transaction or checksum guards to work
around an unconfirmed parser issue.

The owner subsequently confirmed successful execution via psql in the workspace
shell. Deliver owner rollouts as unpacked plain SQL files as well as a ZIP;
this does not establish compatibility with the SQL console UI.

**Why:** The owner explicitly chose the working psql delivery path for missing
legacy translations. Production remains read-only for agent preparation.

**How to apply:** For missing-only rollouts, preserve every existing row, including
blank and stale rows; list stale rows separately. Guard all original languages,
not only the languages outside the insertion scope. Safe repeats may exempt only
the file's originally missing keys, with their exact expected values verified.