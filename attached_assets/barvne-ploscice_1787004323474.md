# Barvne ploščice za utilitarne kategorije

Fotografija ostane tam, kjer sama nosi informacijo. Kjer bi bila fotografija samo okras —
WiFi, hišni red, prijava in odjava, navodila za opremo — pride **polna barva z ikono**.

Referenca: `smart360-poteg.html` → zaslon *Vaša nastanitev*.

Dvoje, kar to reši:

- gost pet notranjščin neha ločevati; barvna ploščica se med fotografijami vidi takoj;
- pri vsaki novi stranki ne boš iskal fotografije za »Hišni red«.

---

## Navodilo za Replit (prilepi v celoti)

```
Category tiles get an alternative: a flat colour with an icon instead of a photo.

=====================================================================
1. THE RULE — NOT A MATTER OF TASTE
=====================================================================

  PHOTO   when the picture shows a real thing at this address:
          apartments, pool, barbecue, beach, restaurant, the entrance gate, the way here.
  COLOUR  when the item is an instruction or a piece of data and any photo would be
          decoration: WiFi, house rules, check-in/check-out, appliance instructions,
          emergency numbers.

  If this is applied by feel, it looks like the owner ran out of photos. Applied by the
  rule, it looks deliberate — and it is: a stock photo of a door tells a guest nothing about
  the house rules, and five interior shots in a row stop being distinguishable.

=====================================================================
2. THE FIELD
=====================================================================

  item.tint = "#3B78DC" | null

  A colour in the admin, per item, empty by default. Empty = photo tile, as today.
  Offer a small palette of tested colours plus a free picker:

    #3B78DC  blue      · connectivity, information
    #2F6F62  teal      · instructions, how things work
    #14201F  near-black· times, arrival and departure
    #C4552E  terracotta· rules and warnings

  Show the same four suggestions to every tenant so the whole product stays one family. A
  free colour is allowed; a rainbow is what happens when nobody suggests anything.

  When tint is set, the item's photos are NOT deleted — they still appear inside the detail
  page. Only the tile changes.

=====================================================================
3. THE TILE
=====================================================================

  <button class="gc gc--tint" style="--tint:#3B78DC">
    <span class="gc__ic">…icon…</span>
    <span class="cap">WiFi</span>
  </button>

  .gc--tint{background:var(--tint,#3B78DC);display:flex;flex-direction:column;
    align-items:flex-start;justify-content:flex-end;padding:13px}
  .gc--tint .gc__ic{position:absolute;top:13px;left:13px;display:grid;place-items:center}
  .gc--tint .gc__ic .ic{width:34px;height:34px;color:#fff;stroke-width:1.6}
  .gc--tint .cap{position:static;color:#fff;text-shadow:none}

  Same size, same radius, same grid position as a photo tile — only the surface differs.
  No veil, no shadow behind the caption: there is no photo to fight, and a text-shadow on a
  flat colour looks like a mistake.
  The icon is bigger than on a photo tile (34 px, not the small white badge) because here it
  is the only picture there is.

  Flat colour. No gradient, no image behind it, no transparency — the same rule as
  everywhere else in this product.

  Contrast: the four suggested colours all carry white text safely. If a tenant picks a
  light colour with the free picker, switch the icon and caption to the dark ink token by
  luminance, exactly as the page background does.

=====================================================================
4. WHERE IT APPLIES
=====================================================================

  Every place an item is shown as a tile: the section screens in the swipe theme, and the
  thumbnails on the sub-pages of the mediterranean theme. The reference demonstrates it in
  the swipe theme; the mediterranean tiles follow the same rule and the same class.

  For Meli Pu, set it on exactly four items: WiFi (#3B78DC), Navodila za opremo (#2F6F62),
  Prijava / Odjava (#14201F), Hišni red (#C4552E). Everything else keeps its photo.

=====================================================================
5. VERIFY
=====================================================================

  a) The four items show colour tiles; every other tile is unchanged.
  b) The colour tile is exactly the same size and radius as its neighbours, aligned in the
     same grid.
  c) The detail page of a colour-tiled item still shows its photos, if it has any.
  d) Clear the colour in the admin: the tile goes back to a photo with no other change.
  e) Pick a light colour (e.g. #F2D06B): the icon and caption turn dark and stay readable.
  f) On a dark page background the colour tiles are unchanged — they are their own surface,
     not a themed one.
```
