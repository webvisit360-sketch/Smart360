---
name: Operator draft publication boundary
description: Sticky operator provenance, conservative initialization, and parent-only section deletion.
---

These provenance and bootstrap notes do not grant publication or structure permissions; the current standing permission matrix is in `replit.md`. The earlier conditional host-publication and host section-trash access decisions have been superseded.

Host edits must never acknowledge or clear an unpublished operator draft. Publication checks and clear operations belong under the same tenant lock as snapshot replacement; content attribution must commit with its write, not wait for response-side audit.

**Why:** Hosts may edit shared drafts but are not authorized to approve the operator's unpublished changes. Existing dirty drafts had no reliable provenance, so the owner approved conservative one-time marking.

**How to apply:** Preserve the sticky bit through host writes; use trusted tenant-scoped transaction attribution for host onboarding that needs privileged Creator transactions. Unattributed jobs count as operator. Bootstrap uses a durable, host-inaccessible marker in the same transaction as marking existing dirty drafts; never re-mark on each startup.

Section trash affects only the parent. Restore never clears independent child deletion timestamps.

**Why:** The owner required reversible section deletion without reviving previously removed children or changing the published snapshot before publication.

**How to apply:** Keep child trash visible and grouped under deleted parents, but restore parents before children. Invalidate both active-content and trash queries on each transition.