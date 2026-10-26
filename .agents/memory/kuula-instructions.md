---

Kuula's documented `postloaded` event was NOT emitted by the real Kamp Savinja collection during browser verification of command-assisted panorama navigation. Only `frameloaded` and `orientation` were observed; the panorama visibly changed.

**Why:** A first-panorama-only reset-button implementation would have hidden the control on secondary panoramas too. That experiment was removed, not shipped.

**How to apply:** Do not equate documented API support with verified events for this embed. Require genuine panorama-ID transitions before implementing conditional reset visibility; timers, focus and panning cannot distinguish panorama changes. A single-post browser fixture is not proof of a real single-panorama tenant.
name: Kuula instruction overlay
description: External viewer's instruction toggle and precedence, distinct from navigation chrome.
---

Kuula's Export Editor documents an instructions toggle under Options. The publicly served viewer confirms `inst=0` disables the instruction overlay; `inst` takes precedence over legacy `hideinst`.

**Why:** The cross-origin “Click & drag to look around” hint overlaps the landing host block and cannot be styled by the parent app. Do not hide unrelated navigation to remove this hint.

**How to apply:** Prefer the narrow URL option, preserve stored tour identity and other options, and recheck Kuula's live behavior if its viewer changes. Source: https://kuula.co/help/export-editor and the viewer script linked by Kuula's share page.
