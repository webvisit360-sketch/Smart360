---
name: Living Guide prototype parity
description: How to resolve Architecture 29 differences between prose specs, stylesheet declarations, and rendered browser values.
---

For Architecture 29 binding work, use browser-computed styles at 390×844 as the final arbiter when the prose table and prototype stylesheet appear to disagree. Percentage heights resolve inside the guide stage above its fixed navigation, not against the full device viewport. Measure text descendants such as bold labels separately from their button containers.

**Why:** Directly converting a stage percentage to viewport units and reading only parent font declarations both produced visible, measurable drift even though the source values looked equivalent.

**How to apply:** Activate the prototype’s target view, render the live state with equivalent content, and compare computed geometry, padding, radius, typography, line height, and descendant styles before declaring parity.

Two recurring inheritance traps in this prototype:
- A bare `<b>` inside a container with a numeric font-weight resolves via UA `bolder` (e.g. 650 → **900**); replicate the computed weight, not the container's declared one.
- Prototype headings often declare no line-height and inherit ~1.5 from an ancestor (28px heading → 42px computed); a live rule with `line-height: 1` will mismatch even though every declared property looks identical.
## Danes strip snap geometry
With `padding: 2px 16px 18px` and `scroll-snap-align: start` (no scroll-padding — prototype has none either), the first card's snap point is scrollLeft=16, not 0. Whenever mandatory snap re-engages (return visit, post-cancel), Chrome settles at 16; the prototype behaves identically, so this is parity, not a bug. Don't "fix" it with scroll-padding — that would shift every snap point away from the prototype.
The auto-scroll nudge (650 ms delay, 11 ms/px clamped 4–14 s, 12% soft start) lives in living-guide-home.ts with its values locked by a unit test; once per page load via module flag (no StrictMode in this app, so effects don't double-fire).
