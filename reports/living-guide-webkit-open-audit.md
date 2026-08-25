# Living Guide WebKit opening audit

**Status: UNVERIFIED — WEBKIT OPEN**

Chromium results below are regression checks only. They do not prove that the iOS WebKit clipping defect is fixed.

## The two unstable clipping surfaces

1. **Detail route view — 30 px top corners:** the transformed route parent previously supplied the only outer clip. Its direct view child now has a matching 30 px rounded standard/WebKit `clip-path`, leaving the parent responsible for transform and shadow.
2. **Detail content panel — 28 px top corners:** the panel previously had radius styling without its own clipping surface. It now has a matching 28 px rounded standard/WebKit `clip-path`; the square solo-sheet variant explicitly resets both clip paths to `none`.

## Fixed-position containment audit

Measured at 390 × 844 in Chromium 138 by switching only the two new clip paths off and on, waiting two animation frames between samples.

| Surface | Position | Clip ancestor after change | Clip off rectangle `(left, top, width, height)` | Clip on rectangle | Result |
|---|---|---|---|---|---|
| Order dock on an orderable offer detail | `fixed` | Detail route view | `(0, 727, 390, 110)` | `(0, 727, 390, 110)` | Sole fixed descendant under a new clip; no Chromium movement. It remains within the 390 × 844 route and is not under the 28 px panel clip. |
| Held bottom bar during detail | `fixed` | None | `(8.78, 767.76, 372.45, 74.49)` | Same | Root/held-stack sibling, not clipped. |
| Messages bottom bar | `fixed` | None | `(0, 766, 390, 78)` | Same | Not clipped. |
| Message composer | `relative` | None | `(0, 758, 390, 79)` | Same | Not fixed and not clipped. |
| Search overlay | `fixed` | None | `(0, 0, 390, 844)` | Same | Root-level sibling, not clipped. |
| Search sheet | `static` | None | `(0, 583.84, 390, 260.16)` | Same | Child of the root overlay, not clipped. |
| Global Sonner toaster | Conditional root sibling | None | No guest toast mounted during the audited flows | No guest toast mounted | `Toaster` is rendered beside the router, not inside the Living Guide route. A future toast portal cannot inherit either detail clip. |

No other application `position: fixed` descendant was found under `.v--det > .lg2-view` or `.lg2-detail-sheet` in accommodation, orderable-offer, messages, or search states. The Replit development banner was excluded.

These are Chromium containment results. WebKit positioning remains part of the open acceptance test.

## Okolica scroll benchmark

Route: fully populated Okolica/Surroundings list.

- 16 POI cards.
- 4,289 px scroll range.
- 300 requestAnimationFrame-driven scroll samples per mode.
- The Okolica list has **no affected clip ancestor**; neither new selector matches this route.
- Engine: Headless Chromium 138, not WebKit.

| Metric | Before: clips forced off | After: clips enabled |
|---|---:|---:|
| Scroll work median | 0.0 ms | 0.0 ms |
| Scroll work p95 | 0.1 ms | 0.1 ms |
| Scroll work maximum | 1.4 ms | 3.8 ms |
| Scroll work samples over 16 ms | 0 / 300 | 0 / 300 |
| RAF cadence median | 16.7 ms | 16.7 ms |
| RAF cadence maximum | 16.8 ms | 16.8 ms |
| Cadence intervals over 16 ms | 299 / 299 | 299 / 299 |
| Cadence intervals over 20 ms | 0 / 299 | 0 / 299 |
| Cadence intervals over 33.34 ms | 0 / 299 | 0 / 299 |

The literal answer to “did any frame interval exceed 16 ms?” is **yes in both modes**, because this 60 Hz runner schedules nominal frames at about 16.7 ms. No interval exceeded 20 ms and no measured scroll work exceeded 16 ms.

This benchmark shows no Chromium regression on the requested route. It does **not** answer WebKit repaint cost because the route is not clipped and no real WebKit page could be launched in this workspace.

## Acceptance gate

The fix remains unverified until one of these exists:

1. The owner's new iPhone Safari/WebKit recording showing rounded panel corners and the grabber throughout opening motion; or
2. A real Safari/Playwright WebKit 25%, 60%, transition-end, and settled frame series.