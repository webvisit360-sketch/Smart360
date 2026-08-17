# Izrez fotografij · WiFi kaže oznake · E-pošta na zadnji strani

Tri stvari:

1. **Fotografija parkirišča kaže samo oblake.** Ležeči izrez 5:3 pri fotografiji, kjer je
   vsebina spodaj, odreže vse, kar je pomembno. Rešitev je v administraciji, ne v Photoshopu.
2. **WiFi izpisuje `<p>` oznake** kot besedilo. Napaka izrisa ali podatkov.
3. **E-pošta** manjka med kontakti.

Referenca: `smart360-poteg.html` → Parkirišče (pokončni izrez) in Kontakt (e-pošta).

---

## Navodilo za Replit (prilepi v celoti)

```
Three items. The first is the one that matters.

=====================================================================
1. THE PHOTO CROP — TWO CONTROLS, IN THE ADMIN
=====================================================================

The parking photo shows nothing but clouds: the content sits at the bottom of the frame and
a 5:3 crop takes the middle. This will happen with every second photo a client sends, so it
must be fixable by whoever enters the content, without editing the file.

  a) FOCAL POINT — per image, this solves most cases
     In the media grid, clicking a thumbnail opens a small view where the editor clicks the
     point that must always stay visible. Store it as two percentages and render it as
     object-position:

       media.focus_x, media.focus_y   (default 50 / 50)
       .card__ph img,.galtrack img{object-position:var(--ph-focus,50% 50%)}

     Show a crosshair on the thumbnail so it is obvious the point can be moved, and preview
     the result in the 5:3 frame right there.

  b) FRAME SHAPE — per item, for photos that are simply portrait
     A select on the item: Ležeče (5:3, default) · Pokončno (4:5) · Kvadrat (1:1).

       .card__ph,.galtrack img{aspect-ratio:var(--ph-ratio,5/3)}
       tall -> --ph-ratio:4/5    square -> --ph-ratio:1/1

     Watch for later rules that hardcode the ratio — in the mediterranean theme
     `.card__ph{aspect-ratio:16/10}` and `.card > .gal img{aspect-ratio:16/10}` both had to
     become var(--ph-ratio, 16/10) or the setting has no effect. Check the computed style,
     not the stylesheet.

  The whole gallery of one item shares the frame shape (mixed heights in one swipe track
  jump around), but the focal point is per image.

  For Meli Pu set Parkirišče to Pokončno — the reference shows it.

=====================================================================
2. WIFI SHOWS <p> TAGS AS TEXT
=====================================================================

The WiFi card renders literally: "<p>Network name: MeliPu</p>".

  Find out which it is and say so before changing anything:
    a) the field holds HTML but is rendered as plain text -> render it like every other body
       field; or
    b) the value was escaped on save (&lt;p&gt; stored) -> a data problem; the normalisation
       pass must decode it, and report how many other fields are damaged the same way.

  And a second point: this item should not be a free-text field at all. There are now proper
  SSID / password / encryption fields in the admin. The guest card must be built from those
  three — two rows with copy buttons plus the QR code — not from a text blob that happens to
  contain the same words. A free-text WiFi description may stay as an optional note BELOW
  them, for things like "signal reaches the pool".

=====================================================================
3. E-MAIL AMONG THE CONTACTS
=====================================================================

  Add tenant.email, and a row on the contact screen between Instagram and Address:

    ✉  E-pošta        info@melipu.si      -> mailto:

  Some guests will not phone and will not use WhatsApp — a written question, answered in
  writing, is also proof of what was agreed. Empty field = no row, like every other contact.

  Add the icon to the sprite (#i-mail), do not import an icon library.

=====================================================================
4. VERIFY
=====================================================================

  a) Parking with the portrait frame shows the cars, not the sky. Its tile and gallery both
     follow the setting.
  b) Move a focal point to the bottom of an image: the 5:3 frame follows, in the tile and in
     the detail page.
  c) Change an item back to Ležeče: identical to today.
  d) The WiFi card shows two clean rows plus the QR code, no tags anywhere.
  e) The contact screen shows the e-mail row and it opens the mail app; with the field empty
     there is no row and no gap.
```
