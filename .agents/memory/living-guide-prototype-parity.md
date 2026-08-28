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

## Opening splash cadence

The guest opening splash remains on every real page open for four seconds. Returning through the iOS app switcher does not reload the page, so the splash does not replay there. Keep the existing ring rotation timing unless the owner separately approves synchronizing one full turn to the fade.

**Why:** The owner explicitly chose predictable branding on infrequent real opens; app-switcher returns already avoid repetition.

**How to apply:** Do not add once-per-session suppression or shorten the splash. Treat rotation-duration changes as a separate, still-open design decision.

## Detail opening readiness

Do not start the detail-sheet transform until fonts are ready, the visible hero is decoded, required chrome is present, and first-screen geometry is unchanged across consecutive paints. Readiness checks must be template-aware: if an optional visual branch exists, require its ready state; if it is absent by design, do not block the sheet.

**Why:** Title-only/two-frame gating allowed radius, grabber, dots, and hero geometry to appear after the sheet landed. A negative optional-chain comparison also treated a deliberately absent photo hero as “not ready” forever.

**How to apply:** Gate the motion on final rendered structure and geometry, then compare the exact `transitionend` frame with a frame 500 ms later for gallery, single-photo, and no-photo templates. Any non-zero pixel difference or post-end signature change is a defect.

Presentation mode, route rendering, and readiness must agree before the base layer is held. Derive the held state from an actually active sheet, not from navigation intent alone, and release it if no active sheet exists.

**Why:** A standard Explore route was requested as a detail presentation, but its sheet renderer and non-hero readiness path were absent. The URL changed without an exception while the base became permanently non-interactive.

**How to apply:** For every presented route, register its sheet renderer and template-appropriate readiness gate together. Test every route and close by asserting that the top active view computes to `pointer-events:auto` and that a held base always has an active sheet.

Every Living Guide scroller shown above the fixed bottom navigation must reserve enough end space for its final visible child to finish above the navigation, including safe-area inset. Detail presentations use 94 px plus the inset; transient bottom sheets use 28 px plus the inset.

**Why:** At 402×874, list and detail content extended 50–59 px behind the navigation. Final descriptions remained in the DOM but appeared missing because only their card titles cleared the bar.

**How to apply:** For every route and presented detail, scroll the actual active vertical scroller to its maximum and assert the final visible child's bottom is no lower than the bottom navigation's top. Run this geometry check alongside the pointer-events invariant.

The primary bottom navigation remains visible and interactive above every detail. A tab tap must close the entire detail stack and navigate directly in one step, leaving no held or inactive layer behind.

**Why:** Guests use the five tabs to switch categories directly from details. Production showed the bar but made it inert, forcing an unwanted Back tap; hiding it matched the prototype but contradicted the owner-confirmed workflow.

**How to apply:** With a detail settled, require all five tab centers to hit their own controls above the sheet. Test each tab independently and require its destination, zero detail/held layers, no detail-open state, and an interactive base afterward.

The opening transform carrier must be the final resting DOM node, with the same ancestor objects throughout travel. Treat object identity as an acceptance invariant, not something pixel comparison can substitute for.

**Why:** A device recording appeared to show a clone-to-real swap. Strict first-frame-to-one-second-post-transition identity proof is required to distinguish replacement from paint or bundle-version symptoms.

**How to apply:** Retain the carrier and every ancestor by JavaScript reference on the first animation frame; later assert strict equality, unchanged probe IDs, grabber presence, radius, and transform-corrected top.

For nested detail tests, fully settle the parent transition before arming the child probe, and bind observations to the child carrier object rather than the first matching selector.

**Why:** A probe armed during the parent category transition attributed the parent’s 488 px hero to the child’s first frame, then compared it with the child gallery’s 380 px rest state. That false cross-route comparison looked exactly like a late geometry rewrite.

**How to apply:** Wait until the parent carrier transform is `none`, then arm the child transition. Retain the child carrier reference and assert it is still the queried carrier at rest.

## Structural detail panel

The moving detail sheet has square top corners. The rounded 28 px white panel, grabber, background, and content are one element that overlaps the photo by 26 px. Its position and hero height both come from one immutable root CSS variable set before first paint.

**Why:** The owner corrected the diagnosis: overlap is visually required and safe once it is derived from write-once root geometry. The real fault was measurement-derived height. The route’s own rounded corners incorrectly cut the photo; only the white panel should be rounded.

**How to apply:** Use a root-owned grid boundary at `heroHeight - 26px`, let the fixed-height hero overflow beneath the rounded panel, and keep route radius at zero. Test photo pixels and coordinates at 25%, 60%, and rest, plus one root-variable write.
