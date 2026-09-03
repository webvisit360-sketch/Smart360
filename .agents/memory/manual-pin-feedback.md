---
name: Manual pin feedback
description: Durable UX and routing rules for operator-positioned Creator proposals.
---

Manual-pin saves must never have a silent outcome. Success closes the map form and immediately replaces the visible proposal with the server response before any background refetch; failure stays in context and shows the exact Slovenian server reason inline.

**Why:** Gril had a confirmed origin proven by completed Creator runs and a successful manual pin, but first publish later cleared the shared coordinates: a broad settings PATCH resent Creator's intentionally absent `mapUrl` as null, and the generic tenant update treated that as a coordinate clear. The API then correctly rejected later pins, while the queue hid the reason far from the edited card.

**How to apply:** Keep card-local mutation feedback, log rejected coordinate confirmations server-side, and treat the response row as immediate UI truth. An empty Maps field must never clear an already confirmed Creator origin. Recover only with a production-only compare-and-set guard backed by immutable run evidence.