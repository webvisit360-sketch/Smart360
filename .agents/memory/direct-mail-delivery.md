---
name: Direct mail delivery
description: Why direct Resend replaced connector delivery, and boundaries for failure evidence.
---

Direct Resend delivery without connector fallback is an explicit owner decision.

**Why:** Production connector delivery returned HTTP 401 despite an Active workspace connection. The retained evidence could not distinguish proxy authorization from provider credential rejection. A fallback would reintroduce that ambiguity and could conceal a missing direct-mail key.

**How to apply:** Keep configuration failures explicit; tests must mock delivery unless actual sending is separately requested. Do not infer that an Active connector proves production mail authentication works.

Invitation delivery errors use the existing invitation ledger with a linked authentication audit event, rather than an unapproved alteration of an existing table.

**Why:** The owner requested durable, redacted error history while existing-table migrations require separate approval. Authentication audit events already cover invitations.

**How to apply:** Keep failure status and its redacted evidence atomic. Preserve old attempts with unknown causes as unknown; never backfill an inferred cause from a later retry. Provider errors must not retain raw responses, message contents, credentials or invitation links.