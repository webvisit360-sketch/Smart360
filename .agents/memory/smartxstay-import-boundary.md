---
name: Smartxstay import boundary
description: Owner-approved operator-only, additive draft imports and source verification limits.
---

Smartxstay imports must only run after an explicit operator click, never at startup or publication. Existing curated content must not be overwritten or deleted. Repeated imports skip original identities, including intentionally deleted imported items. Production import is the owner's post-publication action.

**Why:** The owner is manually curating existing Okolica entries in Kamp Savinja and requires additive imports only.

**How to apply:** Verify with a disposable development tenant, prove unchanged existing entries and zero additions on repeat, then remove the temporary access and all fixture assets. A source's language query may fall back to another language: check the rendered HTML language rather than treating every successful response as a translation.
