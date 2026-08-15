# Ploski gumbi in Google Maps

Dve spremembi, obe v obeh temah. Referenca: paket UI 12.

---

## Navodilo za Replit (prilepi v celoti)

```
Two changes across both themes.

=====================================================================
1. BUTTONS ARE FLAT — REMOVE THE 3D EDGE
=====================================================================

Remove the raised "3D base" from every action button. No box-shadow, no lift, no
translateY on press. The press feedback is a colour change only.

  .act{height:48px;border-radius:16px;font-weight:800;border-color:var(--line);box-shadow:none}
  .act:active{transform:none;background:var(--wash)}
  .act--fill{background:var(--sea);border-color:var(--sea);color:#fff;box-shadow:none}
  .act--fill:active{transform:none;background:var(--sea-d);border-color:var(--sea-d)}
  .btn{border-radius:16px;background:var(--sea);box-shadow:none;font-weight:800}
  .btn:active{transform:none;background:var(--sea-d)}
  .mapbtn{background:var(--sea);border-radius:16px;height:48px;font-weight:800;box-shadow:none}

  In the hover block, the white button must not gain a shadow either:
  @media (hover:hover) and (pointer:fine){ .act:hover:not(.act--fill){box-shadow:none} }

  This supersedes the earlier rule "buttons have a 3D base". Remove it from the styles; do
  not leave it on some buttons and not others — flat everywhere.

=====================================================================
2. "NAVIGACIJA" BECOMES "GOOGLE MAPS", AND OPENS THE PLACE CARD
=====================================================================

Every button that opens Google Maps for a PLACE — restaurants, beaches, routes, shops,
pharmacies, the hospital, petrol stations, ATMs, bakeries, events — is labelled

    Google Maps

and links to the PLACE CARD, not to driving directions:

    https://www.google.com/maps/search/?api=1&query=<encoded query>     ← use this
    https://www.google.com/maps/dir/?api=1&destination=<encoded query>  ← not this

Rationale: the guest usually wants to see what the place is — opening hours, photos,
reviews, phone — and can start navigation from the card in one tap. Dropping them straight
into turn-by-turn directions skips the step they actually want.

Use the pin icon (#i-pin), not the arrow (#i-nav).

  <a class="act act--fill" href="https://www.google.com/maps/search/?api=1&query=..."
     target="_blank" rel="noopener">
    <svg class="ic" viewBox="0 0 24 24"><use href="#i-pin"></use></svg>Google Maps</a>

THE ONE EXCEPTION — THE ACCOMMODATION ITSELF

At the accommodation, the button keeps its name and its behaviour:

    Navigacija do nas     →  https://www.google.com/maps/dir/?api=1&destination=<tenant address>
    icon #i-nav

This applies in two places: the "Lokacija" item's call-to-action and the contact screen.
A guest arriving for the first time wants directions, not a place card.

ROUTES: ONE BUTTON, NOT TWO

Route cards had two buttons, "Izhodišče" and "Navigacija", both pointing at the same
coordinates. Keep only one: "Google Maps" with the place-card URL.

VERIFY
  a) Every place card in Odkrij okolico and Storitve shows exactly one blue "Google Maps"
     button; tapping it opens the Google Maps place card for that place, not directions.
  b) Lokacija and the contact screen still say "Navigacija do nas" and open directions.
  c) No button anywhere has a raised edge or moves down when pressed.
```
