---
name: Passkey cancellation
description: Non-obvious cancellation boundary between UI watchdogs and SimpleWebAuthn's browser ceremony.
---

An external `AbortController` or `Promise.race` can release application state but does not itself own the signal passed to `navigator.credentials.get()` by SimpleWebAuthn. Any timeout or manual cancel must also call the library's ceremony cancellation service.

**Why:** A hanging authentication attempt survived an external abort in browser testing because SimpleWebAuthn had created its own internal controller. Headless browsers may additionally place a native WebAuthn prompt over the page, so ordinary pointer automation cannot prove the page button while that modal is open.

**How to apply:** Couple every UI watchdog/manual cancel to both the application controller and `WebAuthnAbortService.cancelCeremony()`. Verify page state through a DOM-dispatched click when native headless UI intercepts pointer input, and reserve real pointer proof for a browser state with no native prompt.

Operationally blocking sign-in fixes must be published independently from queued administration changes.

**Why:** The owner confirmed that isolating this revision is the correct release boundary: if sign-in regresses, there is one candidate instead of an accumulated unpublished queue.

**How to apply:** Park unrelated dashboard, wording, or history work in a checkpoint; publish and verify the sign-in revision on the production domain before restoring that work.