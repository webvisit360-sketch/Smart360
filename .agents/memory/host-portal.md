---
name: Operator and client access model
description: Two-role model plus three-ring client isolation, password ownership, and audit invariants.
---

# Operator and client access

Exactly two roles exist:
- **Smart360 operator:** the business owner, globally trusted, enters any tenant cockpit using the operator session without impersonating the client or knowing its password.
- **Client account:** exactly one shared account per tenant, opened on the client's email address. The client alone sets and changes its password; there are no staff accounts or staff invitation flow.

Operator sessions deliberately carry no tenant identity. Operator-only tenant tools select an existing tenant through the path, while HOST tools derive tenant identity from the HOST session.

**Why:** The operator works across all tenants and cannot be bound to one; applying the HOST session rule to operator routes would make the cross-tenant cockpit impossible.

**How to apply:** Validate every operator path tenant before domain queries, scope all downstream reads/writes by it, and keep the active tenant name visible in consequential actions.

**Why:** The client company needs one shared tenant identity, while the Smart360 operator needs global operational access with separate attribution. Per-person staff membership would add complexity without serving the approved workflow.

**How to apply:** Preserve owner/client actor separation. Never mint a client session for operator access. Attribute every mutation and timestamp it. Client password set/change remains a single client-only action.

Three concentric rings; each must hold alone:
1. **Actor gate**: every /admin request resolves an actor (owner WebAuthn or host cookie) before anything else runs.
2. **Deny-by-default fence**: `actorGate.ts` `ADMIN_ROUTE_REGISTRY` classifies every /admin route (anon / owner-only / host-self / tenant-url / entity / rls). `assertAdminRoutesClassified()` throws at boot on unclassified routes — **any new /admin route must be added to the registry or the server won't start**. Hosts get uniform 404 + `{error:"Not found"}` on anything not explicitly allowed (no existence oracle).
3. **Fail-closed RLS**: policies keyed on `app.role`/`app.tenant_id` GUCs.

## Critical gotchas (learned the hard way)
- **The pool user is a BYPASSRLS superuser** (`postgres`, rolsuper=t) — FORCE RLS does NOTHING for it. Host connections must `SET ROLE smart360_host` (NOLOGIN, NOBYPASSRLS, ensured+granted at boot in `rls.ts`). Any RLS test must SET ROLE too, or it silently tests nothing.
- **Least privilege is deliberate and fail-closed for future tables**: `HOST_ROLE_GRANTS` in `rls.ts` is the single source of truth (boot revokes ALL then grants the list). A NEW table is invisible to host requests until added there (+ a POLICIES entry). If a host-allowed handler starts failing with "permission denied", that's the intended signal — onboard the table, don't broaden grants.
- **Creator-table temporary exception:** Creator proposal/evidence tables may remain without RLS while the Creator is operator-only, provided hosts have no grants and real HOST-session tests knock every Creator route and receive the uniform owner-only rejection. Add Creator RLS to the pre-public hardening list alongside the final operator/host split.

  **Why:** With application connections currently using the PostgreSQL superuser, meaningful RLS would require a wider role-architecture change; absence of host grants plus the central owner-only gate is the accepted interim boundary.

  **How to apply:** Keep Creator tables out of host grants, expand the negative HOST-session test whenever a Creator route is added, and do not make Creator public until its RLS/role design is completed.
- **No privileged fallback after context release**: the `db` Proxy THROWS if work outlives its host context (fire-and-forget after response). Deliberate system work from a host request must use `escapeHostDbContext()`. Never restore a silent fallback to the pool — that was a review-flagged cross-tenant leak.
- **Drizzle wraps pg errors**: RLS violations sit in `error.cause`, so `assert.rejects(p, /row-level security/)` fails — walk the cause chain.
- Host auth tables (`host_users/sessions/memberships/auth_events`) have membership-scoped policies (password change runs under host ctx); `admin_*`, `host_password_resets`, `cleanup_runs`, `tenant_renewals` have ZERO host grants.

## Credential decisions (owner-approved)
- Argon2id m=64MiB t=3 p=1; session + reset tokens stored only as SHA-256; uniform 401s.
- Owner session cookies use the `__Host-` prefix with HttpOnly, Secure, SameSite=Strict, Path=/, no Domain, and a fixed 30-day absolute lifetime. Never make this sliding on activity.
- **No lockout** (lockout = DoS): per-IP 10/15min limiter + DB-backed per-account capped exponential backoff (3 free tries, then 1s→60s cap). Success resets counter.
- All credential mutations are **transactional and conditional**: password change is `UPDATE ... WHERE password_hash = <verified hash>` (stale sessions can't reinstate a password after a reset); reset burns token + sets password + revokes ALL sessions in one tx; the 3/hr reset quota locks the user row (`FOR UPDATE`) so concurrent requests can't bypass the count.
- Operator recovery may create a fresh authenticated session and redirect immediately after resetting the password. It must still revoke all old sessions, close the audit attempt, and send the security notification.
- Account model remains exactly one client account per tenant; do not evolve it into staff membership or multi-property personal accounts.
- Operator never sets/sees client passwords. Client performs password set/change alone; changing the account email remains an operator action.

**Why:** The person who successfully completed recovery already knows the new password; forcing an immediate second sign-in adds friction without meaningful protection.

**How to apply:** Keep recovery completion atomic for password replacement, old-session revocation, fresh-session creation, and audit closure. Send the approved notification after success; tests should assert this session behavior.

The fixed session expiry is deliberate: a sliding lifetime could let a stolen cookie remain valid indefinitely through attacker activity, while the absolute deadline always ends it.

## Enrolment-token replacement

Only one unused operator enrolment token may exist at a time, across all sources. Issuing any new token invalidates every older unused token.

**Why:** This prevents forgotten enrolment links from remaining valid. The accepted consequence is that issuing a shell token while a recovery enrolment is mid-flow invalidates that recovery link; the operator must use another recovery code.

**How to apply:** Keep replacement global rather than source-specific, and make the invalidation, new-token insertion, and issuance audit one transaction.

The replacement invariant and issuance-audit hash correlation are proven in development. Production has no owner-accessible exec/shell path, so production proof is limited to read-only catalog and runtime checks; never present workspace-shell issuance as production evidence.

**Why:** The workspace shell targets development, while the supported production database channel is read-only. Manufacturing a production credential merely to prove session behavior would create unnecessary operator-account cleanup.

**How to apply:** Label shell issuance/invalidation evidence as development-proven and production schema evidence as production-proven. Let the next real security event prove production e-mail delivery rather than changing credentials for a test.

Production proof was completed on 2026-08-29: the owner set the operator password and signed in with e-mail and password on the first attempt from his own machine.

## Audit and deletion decisions (owner-approved)

- There is one tenant history, **Zgodovina sprememb**, visible to both roles. It combines client and Smart360 changes rather than maintaining a separate or redacted operator log.
- Client-action IP addresses are visible in that history. Smart360/system IP addresses are stored for internal evidence but must always be projected as null to clients.
- Clear stored IP values after 12 calendar months while retaining the timestamped audit rows and their safe descriptions.
- Slovenian summaries may identify the bounded entity title and affected language because the history must explain what changed and where. Centrally redact recognizable contact data, and never persist bodies, URLs, passwords, tokens, guest contact data, messages, or legacy free-form detail.
- Clients may soft-delete and restore categories/items. Permanent purge, including expiry cleanup that physically deletes rows, is Smart360-operator-only.

**Why:** The owner chose transparent shared accountability while limiting security metadata and sensitive content exposure. Permanent deletion remains an operator responsibility so a client cannot irreversibly destroy content.

**How to apply:** Route every approved mutation—including cutovers, site-plan media, invite activation, and password reset—through the same actor/IP/privacy policy. New client reads must never trigger physical purge as a side effect.
