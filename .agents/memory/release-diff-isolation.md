---
name: Release diff isolation
description: Mandatory evidence boundary before every Smart360 production publish.
---

Before every publish, compare the complete candidate workspace against the revision currently deployed and confirm that every changed or new production file belongs to the approved release scope. Input attachments and parked work are not part of that scope.

**Why:** A prior publish unintentionally included checkpointed work, and an early schema comparison briefly proposed removing live RLS policies while services were restarting. Checkpoints and tool summaries are not release boundaries.

**How to apply:** Identify the deployed revision, inspect tracked and untracked files, run the production schema diff only after startup security setup has completed, and stop if it contains unrelated code, existing-schema changes, data writes, RLS changes, or destructive statements that were not explicitly approved.