---
name: Browser tests with disposable database fixtures
description: Remote browser loopback differs from workspace loopback; bridge fixture requests without creating an operator account.
---

Remote browser tools cannot reach a workspace-only service at their own 127.0.0.1. A successful workspace curl does not prove browser reachability.

**Why:** The remote browser runs in a different environment. Local Playwright was not a reliable alternative because required shared libraries were absent.

**How to apply:** Keep the disposable service workspace-local. Hold the browser's intercepted action request, forward it through a workspace HTTP call, then fulfill the same pending browser request with the exact returned status and body. This can prove UI → application service → development database behavior without publishing a test endpoint or creating credentials. Report explicitly that authentication and transport are simulated; it is not evidence of real sign-in or production execution.

Use managed background shell tasks for fixture servers, not detached subprocesses that may be killed when the tool call ends. Always clean the disposable tenant IDs afterward, including IDs from failed attempts.

For mocked browser checks, preserve API envelopes and canonical category keys rather than using blanket arrays or label-only objects.

**Why:** An array in place of the storage-usage envelope caused a false dialog crash, and an omitted category key made a valid offer placeholder appear broken.

**How to apply:** Before changing application code for a fixture-only failure, compare the intercepted payload with the real response contract and report whether the defect was in the fixture or the app.