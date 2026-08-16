# Apartmaji: naslov nad fotografijo · Povečava zamrznjena

Dvoje:

1. **Apartmaji** — nad fotografijo stoji samo naslov (*Apartma 1*), pod njo opis.
2. **Povečava slik je zamrznjena.** Ne izbriši je — izklopi jo z eno zastavico, ker jo bomo
   vklopili nazaj, ko bo delovala pravilno.

---

## Navodilo za Replit (prilepi v celoti)

```
Two changes.

=====================================================================
1. APARTMENTS: TITLE ABOVE THE PHOTO
=====================================================================

For the "apartments" item type only, the order inside each card is:

  <h3 class="card__n">Apartma 1</h3>      <- title, above the photo
  …gallery…                                <- the photo(s)
  <div class="card__sub">4 osebe · 1 spalnica · terasa</div>
  <div class="prose">…description…</div>

  This does not contradict "photo before text". The title names what the photo shows, so
  the guest knows which apartment they are looking at before they look. Everything that
  DESCRIBES the apartment still comes after the photo.

  Helper in the reference: cardTitled(title, inner, imgs) — a copy of cardWrap with the
  heading emitted first. Use it only for apartments; every other type keeps cardWrap.

  .card__body--head{padding-bottom:0}
  .card__body--head + .card__ph,.card__body--head + .gal{margin-top:12px}

  The photo still spans the full width of the card, edge to edge, with no top radius —
  it now sits in the middle of the card, not at its top.

=====================================================================
2. FREEZE IMAGE ZOOM
=====================================================================

Pinch zoom, double-tap zoom and the rotate button are not behaving well enough to ship.
Turn them off — do NOT delete the code:

  const ZOOM_ON = false;    // one switch, one place

  - the gesture handler returns immediately when ZOOM_ON is false
  - the rotate button is not rendered
  - the "Double tap to zoom" hint is not shown
  - the media viewer itself STAYS: full-screen photo, swipe between photos, the counter,
    the close button, and video playback all keep working

Frozen, not removed, because the work is done and the fix will be about gesture tuning,
not about rewriting the viewer. When we turn it back on it must be one value, not a
re-implementation.

Report which specific behaviours were misbehaving on your side (did the zoom fight the
pager, did the image jump on the second finger, did it fail to reset?) — that list is what
we will fix before switching it back on.

=====================================================================
3. VERIFY
=====================================================================

  a) Apartments: title, then photo, then the meta line and the description. Both apartments.
  b) Every other detail type is unchanged: the photo is still the first thing.
  c) Tap a photo: it still opens full screen, swiping between photos still works, the
     counter is right, the × closes it.
  d) Pinching does nothing, double tap does nothing, there is no rotate button and no hint.
  e) A video in a gallery still plays.
```
