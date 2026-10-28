---
name: Living Guide draggable details
description: Owner-approved motion model and browser gesture constraints for guest detail surfaces.
---

Trend detail text stays fixed on one continuous sheet; the entire sheet moves from its initial photo-revealing position to the point where its content end reaches the viewport bottom. No inner text scrolling or automatic expansion is allowed. No-photo sheets start at the top. Enostaven now explicitly uses native scrolling instead, per the owner's corrected category-list requirement.

**Why:** The owner approved a physical-sheet model that must behave identically for short, long, photo, no-photo, orderable, and gallery details.

**How to apply:** Keep the motion controller shared across every detail template. Preserve intermediate positions, allow only short momentum, close below the initial position, and keep the Order dock fixed to the viewport.

Opening and closing have different contracts: Enostaven's immediate destination paint must not disable its exit animation. A cancelled CSS transition is not evidence that a new close has finished; the whole closing composition must finish before releasing the held source.

**Why:** The no-flash destination override also suppressed Enostaven exits, while a shared cancellation listener could complete closing before its transform ended. Real touch tests did not reproduce the owner's unreliable first pull on iPhone; Chromium success is not physical-iOS proof.

Do not equate an early disappearing panel with early route unmount: independently timed child and photo motion can expose a photo fragment even when the route listener correctly ignores bubbled child events.

**Why:** The owner reported a mid-close snap. Local frame inspection found the inner panel finishing ahead of the photo-bearing route, not the suspected child event completing navigation.

**How to apply:** Keep the close composition's time envelope aligned, wait for all its actual motion (including the held source), and inspect intermediate frames as well as navigation timing. Preserve the separate opening and finger-tracking contracts.

For entry closes, the underlying source must already be full-size and static before release, throughout closing and until the real source replaces its snapshot. Preserve source scroll and route-inherited sizing when cloning. Do not alter category→home mechanics to achieve this.

**Why:** The owner explicitly designated category→home as the reference and rejected a moving/re-measured source underneath entry closes. Matching outgoing durations alone does not establish a stable background.

**How to apply:** Compare source geometry before and during close, including nested category snapshots and gallery entries. Never infer stability just from a correct final frame.

**How to apply:** Preserve the instant-open rule, scope animation to closing, and assert intermediate frames before route replacement. Do not diagnose gesture reliability from CSS changes or a synthetic cancellation event alone.

The owner's close interaction requires continuous 1:1 finger tracking in both designs, with the photo lagging; a top-down close that reverses must return to neutral without feeding momentum into content scrolling.

**Why:** A release-only gesture and an animated exit are not interactive dragging. Equal stacking levels for a retained category and the later base route can also expose Home despite correctly preserving the category DOM.

**How to apply:** Verify actual mid-drag geometry and exposed layer ordering, not just successful navigation. Keep native Enostaven content scrolling separate from top-down close ownership.

Enostaven category lists must be tested with touch gestures STARTING ON CLICKABLE LOCATION ROWS, with enough rows to overflow. Never substitute mouse-wheel tests or individual-detail tests. Native scrolling owns upward, sideways and mid-scroll gestures. Closing may engage only from the true top with an initially downward drag; reversing an upward gesture must not turn it into a close.

**Why:** The owner reproduced unreachable category rows after an earlier fix that only verified individual detail content. The old sheet controller ignored button-row touches while overflow prevented native scrolling.
**How to apply:** Verify the actual last row plus return-to-top and downward close at both requested heights. Keep this change Enostaven-specific; it supersedes that design's continuous-sheet rule, not Trend's.

Device-invariant photo framing includes the sheet's initial occlusion, not only the image's object-fit. Preserve the measured iPhone reference while making both image sizing limits and exposed-photo proportions width-based.

**Why:** The owner reported the A-frame subject hidden on Samsung with browser chrome, although the image itself was centered; viewport-height-dependent sheet positioning changes which part is visible.

**How to apply:** Compare fresh navigations at each width; resizing an already-open detail retains the route's height lock and gives misleading baseline measurements.

All guest-guide back controls in Enostaven AND Trend use the same 44×44 palette/theme-filled circle, pale tile border/gap and strong white solid arrow, top-left on subpages. Exactly one visible back control accompanies the existing downward close gestures. Nested details return to their originating LIST, not directly to the home grid; only closing the top-level list returns home. This includes announcement details. This supersedes both the earlier no-arrow Trend direction and unconditional home-return direction.

**Why:** After real guest/host testing, the owner requested one consistent back control plus working swipe-down, then clarified that nested navigation must preserve the source list without flashing the home grid.

**How to apply:** Count visible controls across the outer shell and nested content. Test both directions under network throttling; a resting screenshot cannot prove absence of an intermediate home frame. Preserve independent back controls on full-screen Explore and Messages. Test long content to its true end; short fixtures cannot prove scroll reachability.

Native-scroll guards must use browser touch input, not wheel events or assigned scrollTop. Start inside actual scrollable content, above fixed action docks. A fixed-height landing is not itself a scroller: test its touch targeting and transition to the grid instead. Chromium history-back and a dispatched pageshow event are not evidence of actual iOS BFCache restoration.

**Why:** Repeated owner reports concern physical iPhone touch scrolling, which screenshots, mouse-wheel checks and synthetic restoration events cannot establish.

**How to apply:** Report browser engine and whether pageshow.persisted was native. Do not call a device-only symptom fixed when it did not reproduce. Run browser-bearing Node test files serially in this workspace; unrestricted file concurrency exhausted process resources during Vite/Chromium startup.

Enostaven route destinations paint immediately, without the Trend slide-in/media-readiness wait. Nested back restores the originating list's scroll position.

**Why:** Changing the held-background source alone did not eliminate the observed home-grid flash; the destination was still offscreen while media readiness and entry animation ran. Immediate destination rendering passed throttled per-frame checks.
**How to apply:** Do not reintroduce an offscreen preparation phase for Enostaven. Loading media belongs inside the destination. Validate foreground layers during transition, not merely after settling.

Gallery mouse dragging must disable native image drag and suspend mandatory scroll snap only after the horizontal direction has won the threshold. Touch galleries use native horizontal scrolling and scroll snap; vertical touch gestures originating over a gallery move the shared sheet.

**Why:** Chromium consumed mouse movement as an image drag and snap immediately restored slide one, even though the pointer handler and scroll container were otherwise correct.

**How to apply:** Do not capture or prevent default at press-down. Lock once at a 6px threshold, with diagonal ties deterministically owned by the sheet. For mouse, capture only the winning axis, manually update gallery scroll during horizontal drag, then restore snap and settle. For touch, keep `touch-action: pan-x` on the gallery so the browser can scroll it horizontally, and `pan-y` on the sheet; use non-passive touchmove on the detail root to prevent native vertical panning only once the sheet owns the gesture. These elements are siblings; if a gallery is ever nested inside the sheet, pan-x and pan-y intersect to no native pan, so revisit the touch handling. Pointercancel should release ownership without closing the sheet. The old press-down capture rule was superseded because mobile browser panning could cancel or starve the gallery's pointermove stream before a horizontal swipe was recognized.