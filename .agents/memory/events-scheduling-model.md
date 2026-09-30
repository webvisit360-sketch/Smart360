---
name: Events scheduling model
description: Owner-approved snapshot-based weekly event program, migration limits, and legacy conversion.
---

The owner superseded the earlier, unbuilt generated-occurrence-table plan with schedules on existing items and client-side occurrence expansion from the published snapshot. Europe/Ljubljana defines program dates and “today”, regardless of the guest device timezone.

**Why:** The approved request explicitly chose one additive nullable JSONB column, no default, no backfill, and no new occurrence tables. Weekly season bounds are optional.

**How to apply:** Never revive the older generated-row plan or tenant timezone schema without fresh approval. Guest program and home occurrences must use the same published data; draft editing cannot expose changed schedules.

Legacy conversion happens only on a successful editor save: preserve the original eventStart, prefill its local date/start, and require the editor to supply an end time. Opening an editor does not migrate data.

**Why:** The owner explicitly approved missing-end validation rather than inventing durations or backfilling existing entries. Old published entries remain readable without an end.

**How to apply:** New schedules require a same-day increasing time range. Missing camp/outside classification stays unknown; missing prices are omitted rather than described as free. Onboarding schedule fields were explicitly deferred, not the normal entry editor.

The supplied program-dogodkov-dizajn HTML is binding for the guest program and detail, with real calendar dates rather than its illustrative date range.

**Why:** The owner requested precise visual parity, including computed metrics as well as screenshots. Existing detail-sheet heading CSS can override less-specific program rules.

**How to apply:** Verify actual rendered typography and geometry; keep fixture gradients confined to development. Registration must retain the selected occurrence date through the existing sign-in and order-note handoff.

The owner clarified that the program must never become a permanent empty navigation destination, and that inclusive age copy such as “Za vse” belongs only in detail, not on day-list cards.

**Why:** The reference's short card hints convey restrictions, not every populated age field; an old event record alone does not mean a tenant still offers a program.

**How to apply:** Preserve these boundaries when changing navigation or localization. Keep nonrestrictive age information in detail, and evaluate program availability from guest-visible published occurrences, not category existence.