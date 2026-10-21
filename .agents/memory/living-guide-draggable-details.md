---
name: Living Guide draggable details
description: Owner-approved motion model and browser gesture constraints for guest detail surfaces.
---

Living Guide detail text stays fixed on one continuous sheet; the entire sheet moves from its initial photo-revealing position to the point where its content end reaches the viewport bottom. No inner text scrolling or automatic expansion is allowed. No-photo sheets start at the top.

**Why:** The owner approved a physical-sheet model that must behave identically for short, long, photo, no-photo, orderable, and gallery details.

**How to apply:** Keep the motion controller shared across every detail template. Preserve intermediate positions, allow only short momentum, close below the initial position, and keep the Order dock fixed to the viewport.

Device-invariant photo framing includes the sheet's initial occlusion, not only the image's object-fit. Preserve the measured iPhone reference while making both image sizing limits and exposed-photo proportions width-based.

**Why:** The owner reported the A-frame subject hidden on Samsung with browser chrome, although the image itself was centered; viewport-height-dependent sheet positioning changes which part is visible.

**How to apply:** Compare fresh navigations at each width; resizing an already-open detail retains the route's height lock and gives misleading baseline measurements.

Enostaven details must have exactly one back control returning to the one-page grid, alongside downward close gestures. This supersedes the earlier no-arrow direction for Enostaven only. Other draggable detail sheets retain the grabber/backdrop behavior; non-draggable full-screen views keep their back button.

**Why:** After real guest/host testing, the owner explicitly requested one consistent back control plus working swipe-down for all six Enostaven detail types.

**How to apply:** Count visible controls across the outer shell and nested content, not just inside each component. Preserve independent back controls on full-screen Explore and Messages. Test long content to its true end; short fixtures cannot prove scroll reachability.

Gallery mouse dragging must disable native image drag and suspend mandatory scroll snap only after the horizontal direction has won the threshold. Touch galleries use native horizontal scrolling and scroll snap; vertical touch gestures originating over a gallery move the shared sheet.

**Why:** Chromium consumed mouse movement as an image drag and snap immediately restored slide one, even though the pointer handler and scroll container were otherwise correct.

**How to apply:** Do not capture or prevent default at press-down. Lock once at a 6px threshold, with diagonal ties deterministically owned by the sheet. For mouse, capture only the winning axis, manually update gallery scroll during horizontal drag, then restore snap and settle. For touch, keep `touch-action: pan-x` on the gallery so the browser can scroll it horizontally, and `pan-y` on the sheet; use non-passive touchmove on the detail root to prevent native vertical panning only once the sheet owns the gesture. These elements are siblings; if a gallery is ever nested inside the sheet, pan-x and pan-y intersect to no native pan, so revisit the touch handling. Pointercancel should release ownership without closing the sheet. The old press-down capture rule was superseded because mobile browser panning could cancel or starve the gallery's pointermove stream before a horizontal swipe was recognized.