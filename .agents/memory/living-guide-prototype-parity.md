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

## Bottom-sheet held views

Preserve a source view's scroll offset before detail navigation, but apply it to the held clone only after that clone is connected and laid out. Scope destination scroll resets to the active route, never the whole guide. For nested sheets, held layers must be siblings; only the immediate layer carries the active hold class, while deeper layers retain one static dim/scale state.

**Why:** Browsers clamp `scrollTop` assigned to a detached overflow clone back to zero, and resetting every marked scroller also resets the visible held background. Nesting held views compounds scale and brightness.

Held clones are visual-only: remove IDs and ID-reference attributes, strip active embeds, refuse sources containing live form/media state, and cap the sibling stack at two. Detail history uses a resting base/guard pair; replace the guard on open, then compact forward detail entries after close so the resting length stays constant. Nested closes record their source presentation/depth and return to the parent sheet without triggering standard-route compaction.

A held visual surface must include route chrome outside the route body (especially the bottom tab bar), preserve every horizontal scroller, and remain on top until the matching real route has painted.

**Why:** Besides duplicate IDs and doubled embeds, ordinary `pushState` + `back` leaves forward entries counted in `history.length`; repeated modal navigation can appear bounded while still trapping Back navigation. Scroll/node checks cannot detect a missing tab bar, stale horizontal offset, or a post-animation clone-to-real flinch.

**How to apply:** Store offsets as clone metadata, insert and force layout, then restore them. Verify source/held/restored pixels exactly; inspect both held wrappers during list → category → item flows; run mixed phone/on-screen close cycles; and pixel-diff the complete source view against the first post-close handoff frame.

Also compare the final real route after the held surface is removed: a perfect held clone can hide a replayed route-entry animation or a lost scroll offset at the actual swap.

Any non-zero close-fidelity pixel mismatch is a defect until a diff mask localizes and explains it; never attribute it to antialiasing without that evidence. The close-fidelity pixel test belongs in the normal test suite, not only incident-driven verification.

**Why:** The first small mismatch exposed real corner-clipping drift, and hard-state comparisons then exposed a hidden route-entry animation at the actual swap.

**How to apply:** Always retain and inspect the diff mask, test held and post-swap frames, and keep close fidelity in routine validation.

## Detail opening readiness

Do not start the detail-sheet transform until fonts are ready, the visible hero is decoded, required chrome is present, and first-screen geometry is unchanged across consecutive paints. Readiness checks must be template-aware: if an optional visual branch exists, require its ready state; if it is absent by design, do not block the sheet.

**Why:** Title-only/two-frame gating allowed radius, grabber, dots, and hero geometry to appear after the sheet landed. A negative optional-chain comparison also treated a deliberately absent photo hero as “not ready” forever.

**How to apply:** Gate the motion on final rendered structure and geometry, then compare the exact `transitionend` frame with a frame 500 ms later for gallery, single-photo, and no-photo templates. Any non-zero pixel difference or post-end signature change is a defect.

## Transform-time rounded clipping

For a rounded surface inside a transform-animated detail route, do not rely on `border-radius` plus an ancestor’s `overflow: hidden` alone. Give each visual clipping surface its own matching rounded `clip-path`, include the WebKit-prefixed form, and explicitly remove that clip from square variants.

**Why:** iOS WebKit can keep the content and animation timing correct while dropping a descendant panel’s rounded clip for the full transform. The radius and grabber then reappear only after motion ends. A readiness gate and post-transition screenshots cannot detect this compositor behavior.

**How to apply:** Assert radius/grabber/dot state on the first RAF after opening starts. Pause the real animation near 25% and 60%, align its translation to an integer pixel, retain full screenshots, and compare sheet-local normalized pixels with the settled frame. Exclude only a separately explained outer-corner compositor-antialias band, never the inner panel boundary under test.
