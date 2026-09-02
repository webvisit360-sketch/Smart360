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