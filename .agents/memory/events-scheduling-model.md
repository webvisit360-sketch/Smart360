---
name: Events scheduling model
description: Approved boundaries for bounded recurring events, generated occurrences, tenant-local dates, pricing, and historical integrity.
---

Use source event rules plus generated occurrence rows. Recurrence supports only once, daily in a bounded range, or selected weekdays in a bounded range. A tenant-level IANA timezone, defaulting to Europe/Ljubljana, defines every product concept of “today”; stored absolute timestamps remain unchanged.

**Why:** Public “today” and next-event reads must stay cheap, while hosts need reusable seasonal schedules and truthful historical records.

**How to apply:** Generate occurrences on save. Regeneration may update or replace only occurrences dated today or later. Occurrences before the tenant-local current date are immutable records of what actually happened. Preserve individually overridden future occurrences by stable event/date identity when per-occurrence state is introduced.

Null price means free and the guest UI localizes the free label. Non-null price text is translated with title, place, and description, using source-language fallback when a translation is absent.

An optional same-day end time enables “happening now” and takes priority over the next future event in the home strip. Cross-midnight events are intentionally unsupported: enter a 22:00–01:00 party without an end time; it remains otherwise valid but never receives the “happening now” label. Supporting cross-midnight schedules requires separate approval.

Do not begin events until the e-mail sequence is complete in this order: shared webhook, invitation delivery evidence, seven-day invitations plus expired-link recovery, then smart360.info DNS records prepared for the owner.