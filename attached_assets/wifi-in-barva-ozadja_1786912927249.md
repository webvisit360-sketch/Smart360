# WiFi v administraciji in barva ozadja

Dvoje:

1. **WiFi** mora biti polje v administraciji, ne nekaj, kar se vpisuje v kodo. Dodano je
   tudi to, kar gostu resnično prihrani čas: **QR koda za samodejno povezavo**.
2. **Barva ozadja** za vso aplikacijo, nastavljiva v administraciji, z eno samo izbiro —
   pri temni barvi se besedilo, črte in ploskve preklopijo same.

Referenca: `smart360-poteg.html` → WiFi (QR koda) in urejevalnik naslovnice → *Ozadje strani*.

---

## Navodilo za Replit (prilepi v celoti)

```
Two additions.

=====================================================================
1. WIFI AS A PROPER FIELD, PLUS A JOIN-BY-SCAN QR CODE
=====================================================================

In the tenant settings add: SSID, password, and encryption (WPA / WEP / none, default WPA).
If these already exist, say so and skip to the QR part.

Then generate, server-side, a QR code that JOINS the network:

  WIFI:T:WPA;S:<ssid>;P:<password>;;

  Escape \\ ; , : and " in the SSID and password with a backslash — a password containing a
  semicolon produces a code that silently fails to connect, and nobody will work out why.
  If encryption is "none": WIFI:T:nopass;S:<ssid>;;

Render it on the WiFi page under the two copy rows, in the same .qrbox plate the share
sheet uses, captioned "Skenirajte za samodejno povezavo" (translated per language). The
caption must NOT inherit word-break:break-all from .qrbox__u — that rule exists for URLs
and it chops ordinary words in half.

Keep the SSID and password rows with their copy buttons: Android joins from the QR code,
older iPhones and laptops still need to type.

Regenerate the QR whenever the SSID or password changes. Never cache it by tenant id alone.

=====================================================================
2. BACKGROUND COLOUR FOR THE WHOLE APP
=====================================================================

One colour setting in the admin, applied on every page. Not a per-page setting: two pages
with different backgrounds look like two different apps.

  --paper   the page background (default #FFFFFF)
  --page    the surface around the phone column on a desktop screen

  Offer six tested swatches plus a free colour picker:
    #FFFFFF  #F7F5F1  #EEF2F6  #14201F  #101820  #0B1B2B

EVERY WHITE MUST BECOME A TOKEN
  Replace every hardcoded background:#fff in the guest app with background:var(--paper,#fff)
  — cards, sheets, the detail overlay, chips, the bottom icon row, the search bar, the
  language list. One forgotten white panel on a dark background is worse than no dark
  background at all. Leave rgba(255,255,255,…) pills that sit ON PHOTOS as they are: they
  must stay white whatever the page colour.

DARK IS DERIVED, NOT CHOSEN
  The editor picks ONE colour. Compute its relative luminance and, below 0.42, set
  data-dark="1" on <html>; the theme then swaps the text and line tokens:

    html[data-dark="1"]{
      --ink:#F3F6F8; --ink-2:#AAB4BC; --ink-3:#7F8A92; --prose:#D6DDE3;
      --line:rgba(255,255,255,.14); --line-2:rgba(255,255,255,.22);
      --wash:rgba(255,255,255,.06); --page:#0E1319;
    }

    lum(hex): sRGB -> linear (v<=0.03928 ? v/12.92 : ((v+0.055)/1.055)^2.4),
              0.2126R + 0.7152G + 0.0722B

  Never ask the editor to set text colour separately. Someone will choose black on black,
  and it will be a guest who finds out.

  The bottom icon colour: if the tenant has not changed it from the theme default, force it
  light on a dark background. If they HAVE set it deliberately, leave their choice alone.

  Body text uses var(--txt-color, var(--prose, #3A3A3A)) so an explicitly chosen text colour
  still wins over the automatic one.

=====================================================================
3. VERIFY
=====================================================================

  a) Change the WiFi password in the admin: the page and the QR code both update.
  b) Scan the WiFi QR with an Android phone: it offers to join the network.
  c) A password containing ; and , still produces a working code.
  d) Set the background to #101820 and walk all five screens plus a detail page, a sheet,
     the search bar and the language list: no white panel is left behind, every text is
     readable, the bottom icons are visible.
  e) Set it back to #FFFFFF: identical to today.
  f) On a desktop screen the surface around the phone column follows the dark theme too.
```
