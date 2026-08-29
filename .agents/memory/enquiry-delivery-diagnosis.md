---
name: Enquiry delivery diagnosis
description: Permanent boundary for diagnosing public-enquiry email delivery.
---

Do not request Gmail access again and do not propose app passwords, IMAP, or another route into the owner's mailbox. Diagnose delivery through the persisted enquiry row and the email provider's status API.

**Why:** The owner permanently declined mailbox access and confirmed that provider delivery evidence is sufficient; folder placement and Reply-To can be checked manually in seconds.

**How to apply:** For any enquiry-delivery investigation, report the stored delivery state, provider message ID, provider response/status, and submission time. Never send a test to the owner's address unless the owner explicitly instructs it in chat.

**Proven production case:** Enquiry `app444`, provider message `f1ff068d-b5a8-45b2-b59e-2f4c09a0f3b5`, reached `email.delivered` 1.226 seconds after the attempt. After the production CHECK was widened, the provider retry at 05:09:05.469 UTC returned 200 and self-healed the row without a data patch. The owner UI then showed »E-pošta dostavljena« with the provider ID and event.