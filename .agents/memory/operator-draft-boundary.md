---
name: Operator draft publication boundary
description: Sticky operator provenance, conservative initialization, and parent-only section deletion.
---

These provenance and bootstrap notes do not grant publication or structure permissions; the current standing permission matrix is in `replit.md`. The earlier conditional host-publication and host section-trash access decisions have been superseded.

Ordinary host edits must never acknowledge or clear an unpublished operator draft. The two-mode policy now explicitly permits self-service hosts to clear it through reviewed publication; concierge hosts cannot publish. Publication checks and clear operations belong under the same tenant lock as snapshot replacement; content attribution must commit with its write, not wait for response-side audit.

**Why:** The owner changed the earlier blanket publication restriction to independent self-service management. Ordinary saves are still not approval. Existing dirty drafts had no reliable provenance, so the earlier conservative one-time marking must not be rerun.

**How to apply:** Preserve the sticky bit through host writes; use trusted tenant-scoped transaction attribution for host onboarding that needs privileged Creator transactions. Unattributed jobs count as operator. Bootstrap uses a durable, host-inaccessible marker in the same transaction as marking existing dirty drafts; never re-mark on each startup.

Section trash affects only the parent. Restore never clears independent child deletion timestamps.

**Why:** The owner required reversible section deletion without reviving previously removed children or changing the published snapshot before publication.

**How to apply:** Keep child trash visible and grouped under deleted parents, but restore parents before children. Invalidate both active-content and trash queries on each transition.