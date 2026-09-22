# Host onboarding disposable development fixture

## Safety and ownership

This fixture is development-only and is not an application seed. It creates one uniquely named disposable tenant, one dedicated passwordless host account, one welcome invite, one short-lived disposable owner session, the canonical shared tenant skeleton, and one **test-only frozen published snapshot**. It does not call the real publish route/workflow and it does not send the invitation.

The script refuses to run unless `NODE_ENV=development`, a Replit development domain is present, no deployment marker is present, and the database does not identify itself as production. It never reads or requests operator credentials and does not run a schema push.

No owner account or credential is created. Because the requested browser check includes owner-only read/reopen screens, setup inserts one isolated eight-hour disposable owner **session** and stores its cookie only in the private file. This session is not derived from, and does not alter, the real operator's password, passkeys, recovery codes, account, or existing sessions.

All credentials and IDs are stored only in `/tmp/host-onboarding-fixture.json` with mode `0600`. The script prints only the command name and aggregate counts. Do not paste the private file into chat, reports, logs, or the repository.

## Commands (review first; do not run automatically)

From `artifacts/api-server`:

```sh
NODE_ENV=development pnpm exec tsx src/scripts/verify-host-onboarding-fixture.ts setup
NODE_ENV=development pnpm exec tsx src/scripts/verify-host-onboarding-fixture.ts inspect
NODE_ENV=development pnpm exec tsx src/scripts/verify-host-onboarding-fixture.ts cleanup
```

`setup` must be run once. It refuses to replace an existing private state file. The tester reads the host email, invite token, test-only password, and (only for owner review/reopen) disposable owner session cookie directly from the private path. Activate through the actual welcome-invite UI/API, then log in normally; do not set the password directly in the database.

## Browser/API verification plan

1. Run `setup`, then read the private state file locally without printing it.
2. Open the real welcome link using its private invite token and set the private test-only password. Log in through the normal host login.
3. Confirm the first login opens the onboarding form rather than ordinary host admin.
4. Confirm the prefilled accommodation name is the current tenant name. This field and the existing guest phone are deliberately populated operator values; they are conflict targets and must not be silently overwritten on submit. Address, website, guest email, Wi-Fi, and other targets start empty.
5. Enter distinctive non-secret test values for every section. Include:
   - a different accommodation name;
   - address, guest email, website, and at least two contact rows;
   - check-in/check-out, Wi-Fi, house rules/parking, and two offers;
   - recommendations in an explore category and in each service-category edge case (shops, bakery, fuel, ATM, pharmacy, healthcare);
   - an event with an explicit date and time;
   - one small test image through the real staged-photo upload flow.
6. Wait for `Osnutek shranjen`, log out, log in again, and confirm all autosaved values and rows return.
7. Use `Shrani osnutek`, then submit round 1. Submit the same round/request again and confirm idempotency: one immutable submission, no duplicate proposals/events/notification attempt.
8. Confirm the success message is shown and the next normal login opens regular host admin rather than onboarding.
9. In a separate browser context, install only the private disposable owner-session cookie. Open the fixture tenant's owner read-only review, verify submitted data/photo access, and exercise reopen once (with one idempotency key) if the acceptance pass includes round 2. Never use the real operator login.
10. Run `inspect`. It fails unless the complete frozen public snapshot is byte-semantically unchanged and separately checks the guest-visible name, address, website, phone, and email/contact fields. Also verify through the APIs/database that:
   - operator-populated name and phone remain canonical draft values and host alternatives are visible suggestions;
   - blank address, website, guest email/contact, Wi-Fi, check-in/out, house rules/parking, and offers were filled only as draft content;
   - Creator proposals have host-onboarding provenance and their selected canonical categories;
   - the event suggestion preserves the exact supplied date and time;
   - the staged photo is review-only;
   - exactly one durable operator-notification attempt exists;
   - no onboarding change is guest-visible before a real operator publish.
11. Run `cleanup` even after a failed check.

## Cleanup guarantees

Cleanup first validates the exact private tenant ID, slug, host ID, and fixture prefix. It deletes only this fixture's staged `/objects/` objects and exact fixture-ID rows, including the disposable owner session, then removes the host and tenant so normal foreign-key cascades remove memberships, host sessions, invites, onboarding rounds/photos, canonical skeleton rows, and the test-only published snapshot. It also removes this host's auth events and this tenant's changelog rows. Finally it dynamically checks all public tables exposing `tenant_id` or `host_user_id` and refuses success unless zero fixture rows remain. Real tenants, accounts, sessions, invitations, publications, and media are never selected by name or broad predicates.

If cleanup cannot reach staged object storage, it fails and retains the private state file so cleanup can be retried; it does not silently claim success.
