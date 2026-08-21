# Living Guide Part 5 cutover checklist

## Blocking e-mail recipient gate

Development/staging currently uses `info@webvisit360.com` as the Meli Pu order-notification recipient.

Before any Living Guide cutover or publish:

- [ ] The owner opens the Meli Pu tenant in the Smart360 admin.
- [ ] The owner replaces `info@webvisit360.com` with Meli Pu's real order-notification e-mail.
- [ ] The owner saves the tenant and reopens it to confirm the real address persisted.
- [ ] “E-mail notification for new orders” remains enabled only after the real recipient is confirmed.
- [ ] Any delivery test to the real recipient is performed only with the owner's explicit approval.
- [ ] The cutover reviewer confirms the staging placeholder is no longer stored on the Meli Pu tenant.

This is a blocking gate. The tenant recipient must remain editable tenant data and must never be hardcoded in application code.