---
name: Creator source lifecycle
description: Owner-approved edit, delete, and archive boundaries for source-first registry entries.
---

Source metadata may be edited only while proposed, or while revoked if it has
never contributed a snapshot to a completed run. Editing returns it to proposed
and requires approval again.

**Why:** Operators need to correct mistakes, but changing the identity of a
source already cited by a completed run would rewrite provenance.

**How to apply:** Never edit or hard-delete completed-run source provenance.
Allow it to be revoked and archived. Deleting a non-provenance source removes
it from the active ledger without deleting any robots or page evidence.

Treat revoke as idempotent: a duplicate request against an already-revoked
source returns success rather than turning the successful first transition
into an operator-facing error.

**Why:** Operator requests can be repeated against stale UI state after the
first request has already committed.

**How to apply:** Diagnose transition failures by source existence,
municipality, and current status separately. Return a specific Slovenian reason
for a genuinely forbidden transition. When a provisional municipality was used
before the first Creator-origin confirmation, atomically re-key that provisional
source list to the confirmed municipality. Every lifecycle mutation response
must include the same completed-provenance projection as the source-list API;
otherwise the database commit can succeed while response validation returns 500.