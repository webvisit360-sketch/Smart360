# Pike v galeriji · Brez celozaslonskega pregleda · Brez brisanja stranke · Ozadje se ne drži

Štiri stvari, zadnja je napaka.

---

## Navodilo za Replit (prilepi v celoti)

```
Four items. The last one is a bug.

=====================================================================
1. DOTS UNDER EVERY MULTI-PHOTO GALLERY
=====================================================================

A gallery with more than one photo must show dots. Without them nobody knows there is
anything to swipe to, and the second to fifth photo of every apartment are simply never
seen. This is the cheapest fix in the whole app and the one with the largest effect.

  <div class="gal">
    <div class="galtrack">…images…</div>
    <div class="galdots"><i class="on"></i><i></i><i></i></div>
  </div>

  .galdots{position:absolute;left:0;right:0;bottom:10px;display:flex;justify-content:center;
    gap:6px;pointer-events:none}
  .galdots i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.55);
    box-shadow:0 1px 3px rgba(0,0,0,.45);transition:background .2s,transform .2s}
  .galdots i.on{background:#fff;transform:scale(1.15)}

  The dots are ALWAYS white with a shadow. They lie on the photo, so they must not follow
  the page background colour — on a dark background a "themed" dot turns dark and vanishes
  against a dark photo. (That is a real trap: our own reference had exactly this bug.)

  Update the active dot on scroll, from scrollLeft / clientWidth. One photo: no dots at all.
  pointer-events:none so the dots never swallow a swipe.

=====================================================================
2. TURN OFF THE FULL-SCREEN PHOTO VIEWER
=====================================================================

Tapping a photo must do nothing. No black overlay, no full-screen view.

  const LIGHTBOX_ON = false;   // one switch, next to ZOOM_ON

  - the open function returns immediately
  - photos are not focusable and do not show a pointer cursor
  - the gallery still swipes in place, with its dots
  - the code stays; this is frozen, like the zoom

=====================================================================
3. REMOVE "DELETE TENANT" FROM THE ADMIN
=====================================================================

Take the delete (bin) control off the tenant card and the tenant editor. A misclick there
destroys a paying client's content, and there is no reason to have it in daily reach.

  - what remains is the draft/published switch (pause), which already hides a tenant from
    guests without touching anything
  - the API endpoint stays but is no longer reachable from the UI
  - if a tenant ever really must be removed, we will do it deliberately, together

Also check every other destructive control in the admin: anything that deletes content
must have a confirmation naming what will be lost, not a plain "Are you sure?".

=====================================================================
4. BUG: THE BACKGROUND COLOUR DOES NOT STICK
=====================================================================

After changing the background colour a few times, and having set it back to white long
before, a black page appeared: opening a detail page and then tapping a bottom icon
rendered a screen with the dark background. So an old value survives somewhere.

Find the actual cause before changing anything, and report which of these it is:

  a) the colour and the dark flag are applied once at app start, and some screen (the detail
     overlay, or a screen re-mounted by the pager) re-applies a stale value it captured
     earlier;
  b) the value is read from a cache — the 60-second tenant cache, or a client-side store —
     that was not invalidated when the setting was saved;
  c) data-dark is toggled on <html> by one component and never recomputed when the colour
     changes back, so --paper is white while the dark token set is still active (this would
     look exactly like the screenshot: dark surfaces on a light setting);
  d) two places compute "is this dark?" with different thresholds.

Then fix it so there is ONE source of truth: the tenant's saved colour, applied in one
place, with data-dark derived from it at the same moment. No component may cache either
value. Changing the colour and navigating anywhere must never show the previous colour.

VERIFY
  a) Set the background dark, walk through three screens, set it back to white, then walk:
     cover -> detail -> bottom icon -> another detail. No dark surface anywhere.
  b) Repeat five times, quickly. This bug appeared after several changes, so one pass proves
     nothing.
  c) Hard-reload after each change and confirm the saved colour is what renders.
  d) Two tenants with different background colours, opened one after the other in the same
     browser: neither inherits the other's colour.
```
