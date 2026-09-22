---
name: Browser tests with disposable database fixtures
description: Remote browser loopback differs from workspace loopback; bridge fixture requests without creating an operator account.
---

Remote browser tools cannot reach a workspace-only service at their own 127.0.0.1. A successful workspace curl does not prove browser reachability.

**Why:** The remote browser runs in a different environment. Local Playwright was not a reliable alternative because required shared libraries were absent.

**How to apply:** Keep the disposable service workspace-local. Hold the browser's intercepted action request, forward it through a workspace HTTP call, then fulfill the same pending browser request with the exact returned status and body. This can prove UI → application service → development database behavior without publishing a test endpoint or creating credentials. Report explicitly that authentication and transport are simulated; it is not evidence of real sign-in or production execution.

Use managed background shell tasks for fixture servers, not detached subprocesses that may be killed when the tool call ends. Always clean the disposable tenant IDs afterward, including IDs from failed attempts.