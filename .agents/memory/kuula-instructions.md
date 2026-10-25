---
name: Kuula instruction overlay
description: External viewer's instruction toggle and precedence, distinct from navigation chrome.
---

Kuula's Export Editor documents an instructions toggle under Options. The publicly served viewer confirms `inst=0` disables the instruction overlay; `inst` takes precedence over legacy `hideinst`.

**Why:** The cross-origin “Click & drag to look around” hint overlaps the landing host block and cannot be styled by the parent app. Do not hide unrelated navigation to remove this hint.

**How to apply:** Prefer the narrow URL option, preserve stored tour identity and other options, and recheck Kuula's live behavior if its viewer changes. Source: https://kuula.co/help/export-editor and the viewer script linked by Kuula's share page.
