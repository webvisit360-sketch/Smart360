---
name: Living Guide draggable details
description: Owner-approved motion model and browser gesture constraints for guest detail surfaces.
---

Living Guide detail text stays fixed on one continuous sheet; the entire sheet moves from its initial photo-revealing position to the point where its content end reaches the viewport bottom. No inner text scrolling or automatic expansion is allowed. No-photo sheets start at the top.

**Why:** The owner approved a physical-sheet model that must behave identically for short, long, photo, no-photo, orderable, and gallery details.

**How to apply:** Keep the motion controller shared across every detail template. Preserve intermediate positions, allow only short momentum, close below the initial position, and keep the Order dock fixed to the viewport.

Custom horizontal gallery dragging must disable native image drag and suspend mandatory scroll snap from pointer-down until release.

**Why:** Chromium consumed mouse movement as an image drag and snap immediately restored slide one, even though the pointer handler and scroll container were otherwise correct.

**How to apply:** Claim the primary pointer at press-down, axis-lock after a small threshold, prevent native drag, update horizontal scroll continuously, then restore snap and settle to the nearest slide. Vertical sheet offset must remain unchanged.