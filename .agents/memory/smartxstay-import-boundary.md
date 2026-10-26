---
name: Smartxstay import boundary
description: Owner-approved operator-only, additive draft imports and source verification limits.
---

Smartxstay imports must only run after an explicit operator click, never at startup or publication. Existing curated content must not be overwritten or deleted. Repeated imports skip original identities, including intentionally deleted imported items. Production import is the owner's post-publication action.

**Why:** The owner is manually curating existing Okolica entries in Kamp Savinja and requires additive imports only.

**How to apply:** Verify with a disposable development tenant, prove unchanged existing entries and zero additions on repeat, then remove the temporary access and all fixture assets. A source's language query may fall back to another language: check the rendered HTML language rather than treating every successful response as a translation.

Autoscale imports must be request-owned and resumable, not detached background promises. Closing the operator editor pauses further work; reopening resumes it. Cancellation preserves already committed draft entries and their images, removes only unused manifest objects, and must not release the active-run restriction until cleanup succeeds.

**Why:** A production incident reached photo storage while the report remained empty. Zero displayed counters did not mean no source fetch occurred; telemetry did not prove an instance kill. Progress must be persisted per step, not only at termination.

**How to apply:** Verify restart after every request, cancellation concurrent with a live step, failed cleanup retry, referenced-image protection and source-identity deduplication. Deploy the cancellation UI before asking the owner to cancel an old production run; never cancel or restart production imports automatically.

Legacy draft cleanup may use separate per-entry manual approval after showing differences when the original import checksum is missing. Never label today's content as the original import or silently enroll legacy entries in checksum-protected cleanup.

**Why:** The owner explicitly approved this exception because older imports have neither original content hashes nor retained source checkpoints.

**How to apply:** Keep the legacy warning and individual approval separate from unchanged, checksum-verified imports; revalidate the reviewed content before applying. The owner subsequently approved postal-pattern address removal without map proof, provided it is marked “preveri naslov” and individually confirmed after reviewing differences.
