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

Manual guide-ready mail must follow the owner's explicit visual specification, not assume every version of the shared welcome renderer matches it.

**Why:** The existing welcome renderer had a 20px mark and an orange stripe, while the owner explicitly required a 46px official mark, no new decoration, green pill buttons and a 16px card. The requested PDF also requires distinct Archivo 800/600 weights, not merely an Archivo font.

**How to apply:** Compare actual rendered previews and computed measurements against the approved specification before presenting mail for visual approval. Never send a real preview email without approval. Archive delivery is a separate best-effort send so an archive failure cannot invalidate the host's successful delivery.

The owner explicitly removed the Smart360 mark from the print sticker only on 2026-09-24; email branding remains unchanged.

**Why:** The print layout should contain only the centered tenant name, QR and URL with its existing cutting border, not reserve space for brand imagery.

**How to apply:** Do not reintroduce the email's logo into the PDF when sharing rendering assets.