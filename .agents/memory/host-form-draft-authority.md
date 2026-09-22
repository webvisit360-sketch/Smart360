---
name: Host form draft authority
description: Owner-approved direct binding replaces the former onboarding suggestion-on-conflict policy.
---

The host form and operator editor are two views of the same tenant draft. Intentional host edits to ordinary content are authorized draft edits, not suggestions that silently retain an operator's older value. New Okolica place-name hints remain in the Creator queue with host provenance.

**Why:** The owner explicitly replaced the separate onboarding-copy and suggestion-on-conflict model on 2026-09-22. Operator publication remains the sole boundary for guest visibility; direct host draft editing is not permission to publish.

**How to apply:** Read current canonical content when opening or reopening the form. Preserve stable content/media identities and unedited fields, require explicit deletion intent, and report concurrent-edit conflicts instead of overwriting newer data. Do not restore the old operator-value-wins suggestion behavior as a safety fix.

Canonical content and its convenience aliases must not both be writable. Normalize local state, server responses, dirty comparisons, and queued saves through the same writable projection.

**Why:** A stale house-rules alias made a successful rich-text save look dirty again. The next autosave restored the old first-row body and repeated, while another house row saved correctly.

**How to apply:** Prefer stable item identities when available; retain legacy scalar fields only as a fallback for older payloads. Check that a completed save becomes idle as well as surviving a reopen.

Empty rich-text initialization is not user content, and a server-assigned ID must replace its temporary client identity before another save can create the same entry.

**Why:** Mount-time empty HTML and unreconciled temporary IDs produced repeated empty draft entries. Separately, serializing uncommitted list inputs split an offer's name and price into different records.

**How to apply:** Ignore semantically empty initialization, keep editor render identity stable across creation, reconcile returned IDs while preserving edits made in flight, and keep uncommitted list inputs out of canonical save baselines. Test first-entry creation and idle stability, not only existing-entry edits.