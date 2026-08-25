---
name: Playwright WebKit runtime
description: Limits of the workspace's local WPE WebKit runtime for real-engine visual tests.
---

**Rule:** Do not claim a Playwright WebKit result from this workspace unless a page actually opens and reports WebKit. Chromium emulation is not a substitute.

**Why:** The matched WPE WebKit process starts but aborts while creating an EGL display in this container. Software Mesa, a headless Wayland compositor, a version-matched runner, downloaded browser bundles, and direct GTK MiniBrowser launches did not produce a controllable page. Adding system packages did not solve it.

**How to apply:** Keep WebKit as a real Playwright project, but execute it on a supported WebKit host/CI runner or a real iOS device. Report the local engine as blocked rather than passed. Do not retain infrastructure packages added only to probe this limitation without owner approval.