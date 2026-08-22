---
name: CodeExecution runtime quirks
description: Durable constraints encountered when creating isolated test fixtures in the CodeExecution sandbox.
---

**Rule:** Do not depend on top-level clock or randomness globals when creating test fixtures in the durable CodeExecution runtime.

**Why:** This runtime can reject `crypto`, `Math.random()`, and `Date.now()` even when generic guidance describes deterministic versions of those APIs. Retrying those primitives wastes time and can prevent a test from starting before any setup call runs.

**How to apply:** Let PostgreSQL generate UUIDs and timestamps, or use a stable, clearly named fixture slug that is deleted before and after a test. Hash an ephemeral test-session value through a local command when a server-side hashed session is required, and never print that value.