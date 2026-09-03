---
name: Manual pin feedback
description: Durable UX and routing rules for operator-positioned Creator proposals.
---

Manual-pin saves must never have a silent outcome. Success closes the map form and immediately replaces the visible proposal with the server response before any background refetch; failure stays in context and shows the exact Slovenian server reason inline.

**Why:** A production tenant without origin coordinates caused repeated rejected saves. The API returned the correct reason, but the queue displayed mutation errors only at the top of a long page, so the operator saw an unchanged open form and no feedback.

**How to apply:** Keep card-local mutation feedback, log rejected coordinate confirmations server-side, and treat the response row as the immediate UI truth. OSRM recomputation requires tenant origin coordinates; if they are missing, leave the proposal unchanged and report that exact precondition.