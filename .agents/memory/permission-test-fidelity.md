---
name: Permission test fidelity
description: Avoid false authorization regressions from outdated or incomplete server test fixtures.
---

Permission tests must explicitly choose self-service or concierge and include the production central authorization gate. Directly mounting a content router is not a test of the full authorization boundary.

**Why:** Historical concierge tests silently inherited the newer self-service default, while a direct-router SOS fixture bypassed the gate altogether. Both falsely suggested missing production permission checks.

**How to apply:** Preserve negative assertions and positive controls; correct the fixture only after comparing the current policy. For direct middleware tests, provide real HTTP request properties and await the response or next callback, not the return value of middleware that launches asynchronous audit work.
