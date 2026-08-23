---
name: Host portal access model
description: Three-ring host isolation (gate/fence/RLS) — invariants, BYPASSRLS gotcha, and how to onboard new tables/routes safely
---

# Host portal (per-tenant host accounts) — Instruction #28

Three concentric rings; each must hold alone:
1. **Actor gate**: every /admin request resolves an actor (owner WebAuthn or host cookie) before anything else runs.
2. **Deny-by-default fence**: `actorGate.ts` `ADMIN_ROUTE_REGISTRY` classifies every /admin route (anon / owner-only / host-self / tenant-url / entity / rls). `assertAdminRoutesClassified()` throws at boot on unclassified routes — **any new /admin route must be added to the registry or the server won't start**. Hosts get uniform 404 + `{error:"Not found"}` on anything not explicitly allowed (no existence oracle).
3. **Fail-closed RLS**: policies keyed on `app.role`/`app.tenant_id` GUCs.

## Critical gotchas (learned the hard way)
- **The pool user is a BYPASSRLS superuser** (`postgres`, rolsuper=t) — FORCE RLS does NOTHING for it. Host connections must `SET ROLE smart360_host` (NOLOGIN, NOBYPASSRLS, ensured+granted at boot in `rls.ts`). Any RLS test must SET ROLE too, or it silently tests nothing.
- **Least privilege is deliberate and fail-closed for future tables**: `HOST_ROLE_GRANTS` in `rls.ts` is the single source of truth (boot revokes ALL then grants the list). A NEW table is invisible to host requests until added there (+ a POLICIES entry). If a host-allowed handler starts failing with "permission denied", that's the intended signal — onboard the table, don't broaden grants.
- **No privileged fallback after context release**: the `db` Proxy THROWS if work outlives its host context (fire-and-forget after response). Deliberate system work from a host request must use `escapeHostDbContext()`. Never restore a silent fallback to the pool — that was a review-flagged cross-tenant leak.
- **Drizzle wraps pg errors**: RLS violations sit in `error.cause`, so `assert.rejects(p, /row-level security/)` fails — walk the cause chain.
- Host auth tables (`host_users/sessions/memberships/auth_events`) have membership-scoped policies (password change runs under host ctx); `admin_*`, `host_password_resets`, `cleanup_runs`, `tenant_renewals` have ZERO host grants.

## Credential decisions (owner-approved)
- Argon2id m=64MiB t=3 p=1; session + reset tokens stored only as SHA-256; uniform 401s.
- **No lockout** (lockout = DoS): per-IP 10/15min limiter + DB-backed per-account capped exponential backoff (3 free tries, then 1s→60s cap). Success resets counter.
- All credential mutations are **transactional and conditional**: password change is `UPDATE ... WHERE password_hash = <verified hash>` (stale sessions can't reinstate a password after a reset); reset burns token + sets password + revokes ALL sessions in one tx; the 3/hr reset quota locks the user row (`FOR UPDATE`) so concurrent requests can't bypass the count.
- Account model: `host_users` (account) split from `host_memberships` (unique(tenant)+unique(user)); multi-property later = drop the user-unique index + role column.
- Owner never sets/sees host passwords; owner-side management is email + send-reset only (409 if email bound to another account).
