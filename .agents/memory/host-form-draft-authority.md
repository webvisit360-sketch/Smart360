---
name: Host form draft authority
description: Owner-approved direct binding replaces the former onboarding suggestion-on-conflict policy.
---

The host form and operator editor are two views of the same tenant draft. Intentional host edits to ordinary content are authorized draft edits, not suggestions that silently retain an operator's older value. The newer owner decision supersedes the old Creator-queue rule: submitted Okolica names create ordinary unpublished draft items directly; never enqueue new host recommendations.

**Why:** The owner explicitly replaced the separate onboarding-copy and suggestion-on-conflict model on 2026-09-22. Operator publication remains the sole boundary for guest visibility; direct host draft editing is not permission to publish.

**How to apply:** Read current canonical content when opening or reopening the form. Preserve stable content/media identities and unedited fields, require explicit deletion intent, and report concurrent-edit conflicts instead of overwriting newer data. Do not restore the old operator-value-wins suggestion behavior as a safety fix.

Canonical content and its convenience aliases must not both be writable. Normalize local state, server responses, dirty comparisons, and queued saves through the same writable projection.

**Why:** A stale house-rules alias made a successful rich-text save look dirty again. The next autosave restored the old first-row body and repeated, while another house row saved correctly.

**How to apply:** Prefer stable item identities when available; retain legacy scalar fields only as a fallback for older payloads. Check that a completed save becomes idle as well as surviving a reopen.

Empty rich-text initialization is not user content, and a server-assigned ID must replace its temporary client identity before another save can create the same entry.

**Why:** Mount-time empty HTML and unreconciled temporary IDs produced repeated empty draft entries. Separately, serializing uncommitted list inputs split an offer's name and price into different records.

**How to apply:** Ignore semantically empty initialization, keep editor render identity stable across creation, reconcile returned IDs while preserving edits made in flight, and keep uncommitted list inputs out of canonical save baselines. Test first-entry creation and idle stability, not only existing-entry edits.

Shared-draft media writes belong to the same serialization boundary as text autosave, including the post-upload revision refresh.

**Why:** Flushing text only before an upload does not prevent autosave from racing the upload itself. Deferred uploads also leave time for further typing; restoring the pre-upload local snapshot would lose those edits.

**How to apply:** Serialize the entire media operation and revision refresh, reconcile against the latest local edits afterward, and avoid re-entering that queue for uploads already inside an entry-creation save. Keep submission blocked throughout upload processing and failed-file recovery.

Queued saves must derive their write from the latest acknowledged baseline when they execute, not replay a patch captured before a preceding merge.

**Why:** A stale full-row patch can silently overwrite an unrelated operator edit after a previous queued request already refreshed the shared revision.

**How to apply:** Test queued edits across a three-way rebase, including different properties of one row. A local conflict choice must retain any further typing, not the value captured when the conflict first appeared.

Recovery records need full local snapshots or explicit stable-ID reconstruction; sparse API patches are not replacement arrays.

**Why:** Shallowly overlaying a changed-row patch onto its base drops untouched rows when the page reloads.

**How to apply:** Exercise refresh recovery with multiple rows and only one edited row. Retain the original base for conflict comparison and never interpret an omitted patch row as deletion.

Host recommendation names remain workflow hints until form submission. Submitted names are materialized in a privileged, tenant-scoped post-commit transaction, not Creator proposals; actor identity alone does not reproduce host database permissions.

**Why:** The host database role deliberately cannot read privileged item-identity/coordinate tables. Processing in the ordinary save transaction reproduced SQLSTATE 42501 and rolled back unrelated fields. The operator no longer wants proposal rows in the structure or a Creator review step.

**How to apply:** Exercise real host DB context in tests. Only submission runs privileged direct-draft materialization after the host transaction commits, with revision/tenant scoping and independent failure reporting. A confident unique geocode plus routable OSRM distance gives a pinned draft; ambiguity or routing failure gives an editable coordinate-less draft. Deduplicate by verified identity or unambiguous same-category name, persist host provenance and status, and never publish automatically. Existing pending Creator proposals remain dormant; matching hints are silently resolved when an operator adds the place through Dodaj kraj. Keep failure-status persistence errors from poisoning the already committed form save.

Recovered hydration must skip the stale render frame before autosave/persistence can read form state.

**Why:** React effects from the pre-hydration render observed an empty form after the recovery effect restored refs, then overwrote both the restored input and its browser recovery record.

**How to apply:** Test full browser reload while a conflict is unresolved, not merely GET refetch or reload after successful save. Unit tests of the merge function alone do not establish lifecycle safety.

Draft equality must ignore object-key insertion order while preserving array order.

**Why:** Canonical responses and three-way merges construct equivalent objects in different key orders. Raw JSON string equality kept acknowledged drafts dirty and scheduled idle saves.

**How to apply:** Use the same semantic snapshot for baseline, rebase, queue deduplication and dirty comparisons. Verify a lost successful response settles without manual intervention.

Submission failure is not evidence that the draft failed to save.

**Why:** A successful save followed by a rejected submission displayed a false unsaved warning. Its retry called an empty save and returned without feedback, leaving the user stuck.

**How to apply:** Keep submission errors and retry actions separate from persistence errors. A retry of a legacy warning must visibly verify server state even when there is no local delta. Exercise production route validation in browser fixtures rather than calling submission services directly.