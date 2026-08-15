# Prva stran: logotip stranke namesto znamke Smart360

Znamka Smart360 gre s prve strani ven. Na njeno mesto pride **logotip stranke**, ki ga v
administraciji premikam in povečujem po volji — vsaka stranka ima svojo postavitev.

Znamka Smart360 **ostane** na nalepki za tisk (`.pc__logo`); tam je pošiljatelj sistema,
ne stranke.

Referenca: `smart360-poteg.html` (naslovnica) in `smart360-melipu-sredozemsko.html` (hero).
V urejevalniku naslovnice je nova skupina **Logotip stranke** in logotip se da tudi
primeti in povleči.

---

## Navodilo za Replit (prilepi v celoti)

```
Remove the Smart360 wordmark from the guest app's first screen and put the TENANT's logo
there instead, freely positionable and resizable from the admin.

=====================================================================
1. WHAT GOES AWAY, WHAT STAYS
=====================================================================

Remove the Smart360 wordmark from:
  - the cover of the swipe theme (.cover__top)
  - the header of the mediterranean/base theme (.appbar)

Keep it where it is not the tenant's surface:
  - the printable A6 label (.pc__logo) — that card comes from the system, not the tenant
  - the admin UI

Nothing else changes in those bars: the search / share / language buttons stay exactly
where they are.

=====================================================================
2. THE ELEMENT
=====================================================================

One element, same class in both themes, rendered inside the first screen's image box —
.cover in the swipe theme, .hero in the mediterranean theme:

  <img class="brandlogo" id="brandlogo" src="{tenant.logoTransparent}" alt="{tenant.name}">

  .brandlogo{position:absolute;left:var(--lg-x,50%);top:var(--lg-y,6%);
    width:var(--lg-w,22%);max-width:70%;height:auto;
    transform:translate(-50%,0);opacity:var(--lg-op,1);
    z-index:6;display:block;pointer-events:none;
    filter:drop-shadow(0 2px 10px rgba(0,0,0,.34))}

  /* .cover>img and .hero img force width:100%;height:100% — the logo must outrank both */
  .cover>img.brandlogo,.hero>img.brandlogo,.hero img.brandlogo,.cover img.brandlogo{
    width:var(--lg-w,22%);height:auto;object-fit:contain;object-position:50% 50%}

  Defaults, swipe theme:          --lg-x:15.5%; --lg-y:2.5%; --lg-w:22%; --lg-op:1
  Defaults, mediterranean theme:  --lg-x:50%;   --lg-y:6%;   --lg-w:26%; --lg-op:1

  The swipe default puts the logo exactly where the Smart360 wordmark used to sit —
  top left, clear of the round buttons on the right.

WHY PERCENTAGES, NOT PIXELS
  left/top are percentages of the image box and width is a percentage of its width, so one
  saved position holds on a 360 px phone and on a 430 px phone alike. Pixels would drift.
  transform:translate(-50%,0) makes X the logo's CENTRE, which is what dragging expects.

WHY THE FILE MUST BE TRANSPARENT
  The logo sits on a photo. Use the tenant's transparent PNG (logo-prosojni.png in the
  reference), never the square white avatar file — a white box on a photo looks broken.
  Keep both files per tenant: the square white one for the round host avatar, the
  transparent one for the first screen. Every var() carries a fallback, so a missing
  setting degrades to the default instead of collapsing the layout.

=====================================================================
3. ADMIN CONTROLS
=====================================================================

In the cover editor add a group "Logotip stranke" with four sliders, live preview:

  Velikost     lgw   8 – 60 %   of the image box width
  Vodoravno    lgx   0 – 100 %
  Navpično     lgy   0 – 100 %
  Prosojnost   lgop  20 – 100 %

plus two buttons: "Na sredino" (lgx = 50) and "Ponastavi logotip" (all four back to the
theme default). Store the four values per tenant, per theme, next to the existing cover
settings, and write them as the CSS variables above.

DRAG IT DIRECTLY — this is the part that matters in practice
  While the editor is open the logo becomes draggable, with a dashed outline so it is
  obvious it can be moved:

    .brandlogo.is-drag{pointer-events:auto;cursor:grab;
      outline:2px dashed rgba(59,120,220,.9);outline-offset:6px;border-radius:6px}

    el.addEventListener("pointerdown", e => { if(!el.classList.contains("is-drag")) return;
      box = el.parentElement.getBoundingClientRect();
      el.setPointerCapture(e.pointerId); e.preventDefault(); });
    el.addEventListener("pointermove", e => { if(!box||!el.hasPointerCapture(e.pointerId)) return;
      lgx = clamp((e.clientX-box.left)/box.width *100, 0, 100);
      lgy = clamp((e.clientY-box.top )/box.height*100, 0, 100);
      applyVars(); });                    // sliders repaint on pointerup, not on every move

  Pointer events, not mouse events: the same code then works with a finger on the iPad,
  which is where this will actually be used. setPointerCapture keeps the drag alive when
  the finger leaves the logo. Outside the editor pointer-events stays none, so the logo
  never swallows a guest's swipe.

=====================================================================
4. UPLOAD IN THE ADMIN
=====================================================================

The tenant form takes ONE logo upload and derives both files server-side:
  - trim to the alpha bounding box (or to the uniform border colour if the file is opaque)
  - transparent PNG, longest side 480 px      -> first-screen logo
  - square 384 px PNG on white, artwork at 72 % -> round avatar (see logotip-melipu.md)
If the uploaded file has no alpha, warn once: "Logotip nima prosojnega ozadja — na
fotografiji bo viden bel okvir."

=====================================================================
5. VERIFY
=====================================================================

  a) No Smart360 wordmark on the first screen in either theme; it is still on the A6 label.
  b) Drag the logo to each corner, reload — it stays where it was put.
  c) Same position at 360, 390 and 430 px wide: the logo keeps its relative place.
  d) Close the editor and swipe across the cover — the swipe works over the logo.
  e) A tenant with no logo uploaded: the first screen renders normally, no broken image.
  f) Size slider at 60 %: the logo never overlaps the round buttons enough to block them —
     the buttons stay clickable because .brandlogo has pointer-events:none.
```
