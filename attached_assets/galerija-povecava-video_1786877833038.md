# Galerija čez cel zaslon: povečava, vrtenje, video

Referenca: vsi trije `smart360-*.html`. Odpri podrobnosti apartmaja in tapni fotografijo.

Gost si hoče sobo ogledati od blizu. Dosedanji pogled je sliko pomanjšal na sredino zaslona
in to je bilo vse. Zdaj se slika razpne čez celo širino telefona, se da povečati s ščipanjem
ali dvojnim dotikom, zavrteti, in v isti galeriji lahko stoji tudi video.

---

## Navodilo za Replit (prilepi v celoti)

```
Replace the simple lightbox with a full-screen media viewer. Copy the markup, CSS and the
gesture code from the reference build (search for "mv__" and "function lightbox") — it is
finished code, not a description.

=====================================================================
1. LAYERS
=====================================================================

  .detail 100 < .tabdock 105 < .mask 115 < .sheet 120 < .mv 130

The viewer is the topmost layer. Anything below it must not be reachable while it is open;
set document.body.style.overflow = "hidden" on open and restore it on close.

=====================================================================
2. STRUCTURE
=====================================================================

  .mv          fixed inset 0, background #000, display:flex, column
  .mv__top     absolute, gradient to transparent: counter "3 / 12", rotate, close
  .mv__track   horizontal scroll-snap pager, one .mv__it per gallery entry
  .mv__it      grid, place-items:center, overflow hidden
  .mv__z       the transformed wrapper — this is what scales, pans and rotates
  .mv__hint    "Dvakrat tapnite za povečavo", fades out after 2.6 s

  .mv__z{touch-action:none;
    transform:translate(var(--mvx,0px),var(--mvy,0px)) scale(var(--mvs,1)) rotate(var(--mvr,0deg));
    transition:transform .18s ease}
  .mv__z.is-live{transition:none}          /* no easing WHILE the fingers are moving */

  .mv__z img  {max-width:100dvw;max-height:100dvh;width:auto;height:auto;object-fit:contain}
  .mv__z video{width:100dvw;max-height:100dvh;height:auto;object-fit:contain}

  dvw/dvh, not vw/vh: on iOS the toolbar changes the viewport height, and vh would leave a
  strip of the page showing under the viewer.

  The viewer opens with the WHOLE gallery and an index, never with one file:
    lightbox(name, list, index)
  A guest who taps the third photo expects to swipe on to the fourth.

=====================================================================
3. ZOOM — PINCH, DOUBLE TAP, DRAG
=====================================================================

Pointer events, one handler per item, state {s, x, y}:

  - two pointers  -> scale = base.scale * (currentDistance / startDistance), clamped 1…5,
                     and pan by the movement of the midpoint between the fingers
  - one pointer while scaled -> pan
  - double tap (two taps under 300 ms) -> toggle between 1 and 2.6, centred on the tap
  - on release, anything under 1.02 snaps back to 1 and re-centres

  While scaled, the pager must not steal the gesture:
    .mv.is-zoom .mv__track{overflow:hidden;scroll-snap-type:none}
  Add is-zoom whenever scale > 1.02 and remove it on reset. Without this, dragging a
  zoomed photo flips to the next one — the single most annoying bug in photo viewers.

  Reset the zoom of the outgoing item when the pager moves to another one, so the guest
  never returns to a photo left at 3x and pushed off screen.

=====================================================================
4. ROTATION
=====================================================================

Two separate cases, both must work:

  a) The guest turns the phone with rotation UNLOCKED — nothing to code: the sizes are in
     dvw/dvh, so the browser reflows and the photo fills the new width by itself.
  b) The guest has rotation LOCKED, which on iPhones is very common — then turning the
     phone does nothing at all. That is what the rotate button is for: it turns the media
     90° inside the viewer.

    .mv__z.is-turned img  {max-width:100dvh;max-height:100dvw}
    .mv__z.is-turned video{width:100dvh;max-height:100dvw}
    --mvr: 0deg / 90deg

  The swapped constraints are the whole trick: after a 90° rotation the visual width is the
  element's height, so the height limit must be the screen's WIDTH. Without the swap the
  photo rotates but stays small.

  Do not call screen.orientation.lock() — it is unsupported on iOS and throws on some
  Android builds.

=====================================================================
5. VIDEO IN THE SAME GALLERY
=====================================================================

A gallery is a list of file names; an entry ending .mp4/.webm/.mov is a video. Same list,
same pager, same zoom, same rotate button.

  In the viewer:  <video src playsinline controls preload="metadata">
    playsinline is mandatory — without it iOS hijacks the video into its own full-screen
    player and the guest leaves our page.
    Pause every video when the pager moves away and when the viewer closes.

  In the gallery strip: a muted, preload="metadata" video with a white play badge over it,
  so it reads as a video and not as a frozen photo.
    .gvid{position:relative} .gvid video{aspect-ratio:5/3;object-fit:cover}
    .gvid__p — 52 px white circle with a play triangle, pointer-events:none

  If the first entry of an item is a video, its poster frame is the item's tile. Generate
  the poster server-side at upload (first frame at 1 s), because a 5 MB video downloaded
  just to draw a tile ruins the first screen on a hotel wifi.

=====================================================================
6. VERIFY
=====================================================================

  a) Tap a photo: it fills the full width of the phone, edge to edge.
  b) Swipe: you move through the whole gallery, the counter follows.
  c) Pinch to zoom, drag around, release under 1x — it snaps back and re-centres.
  d) Double tap zooms in on the tapped spot, double tap again zooms out.
  e) Zoomed in, drag sideways: you pan the photo, you do NOT flip to the next one.
  f) Rotate button: the photo turns and fills the width. Press again to turn back.
  g) With rotation unlocked, turn the phone: the photo re-fits by itself.
  h) A video plays inside the viewer, does not go into the iOS full-screen player, and
     stops when you swipe away or close.
  i) Escape on a desktop closes the viewer; so does the X.
```
