# Majhna besedila — večja za 40 % in nastavljiva v administraciji

Referenca: paket UI 13.

---

## Navodilo za Replit (prilepi v celoti)

```
Small text on the section screens and subpages is too small. Enlarge it by 40 % and make it
adjustable per accommodation. The BUTTONS THEMSELVES DO NOT CHANGE — same height, radius,
padding and colour; only the label inside them grows.

=====================================================================
1. ONE MULTIPLIER, NOT NEW SIZES
=====================================================================

Do NOT retype the sizes. Multiply each existing declaration, so the hierarchy between the
texts stays exactly as designed and one control changes all of them:

    font-size: 14px;                                   ← before
    font-size: calc(14px * var(--txt-scale,1.4));      ← after

The fallback is 1.4 — that IS the +40 %. If nothing is set anywhere, the app already shows
the enlarged text.

Apply it to these, and only these (guest-facing small text, subpages and section screens):

  .card__sub  .info div  .rule div  .prose  .tip__l  .tip__t  .kv .k  .pill  .banner
  .chip  .card__price span  .lead__s  .sec__sub  .sc__k  .sc__s  .gc .cap
  .hcard b  .hcard>span:not(.im)  .hrow--nav .hcard b  .svc span  .row__t  .qk button
  .srow .t b  .srow .t span  .thumb__t  .tile__t  .empty  .host__s  .host__n
  .search__t  .search__s  .card__badge  .bc .tx b  .bc .tx span
  .act  .mapbtn  .btn                                  ← the button LABELS

Do NOT apply it to: the cover title, subtitle and rating line (they have their own editor),
the large section headings (.sc__t, .sec__title, .card__n, .lead__t, .title), the app bar,
the bottom icon row, or the admin panel itself.

Do NOT change .act / .btn / .mapbtn height, padding, radius or colour. Only font-size.

=====================================================================
2. THREE CONTROLS IN THE ADMIN
=====================================================================

In the cover-appearance panel, under a heading "Majhna besedila":

  | Field      | Control                              | Range      | Default |
  |------------|--------------------------------------|------------|---------|
  | textScale  | slider, %                            | 80–200     | 140     |
  | textFont   | list of typefaces                    | see below  | empty   |
  | textColor  | 6 presets + free colour picker + "Privzeta" | hex | empty   |

  Empty textFont  = small text uses the same typeface as the rest of the app.
  Empty textColor = keep the original grey hierarchy (main text dark, secondary grey).
  All three are nullable, following the rule "empty = theme default".

  Typeface list — load the chosen one only, never all of them:
    (privzeta) · Figtree · Sistemska · Georgia · Verdana · Menlo
  Add more later from a curated list; do not offer a free text field for font names.

=====================================================================
3. APPLYING THE VALUES
=====================================================================

  const r = document.documentElement.style;
  r.setProperty("--txt-scale", t.textScale / 100);
  t.textFont  ? r.setProperty("--txt-font",  FONT_STACKS[t.textFont]) : r.removeProperty("--txt-font");
  t.textColor ? r.setProperty("--txt-color", t.textColor)             : r.removeProperty("--txt-color");

  The last two must be REMOVED when empty, not set to "inherit" or "" — otherwise the
  original per-element colours are lost.

  Typeface is applied through one shared rule listing the same selectors:
    <selectors>{ font-family: var(--txt-font, inherit); }

  Colour is applied per rule, keeping the original value as the fallback, so the hierarchy
  survives when the manager has not chosen a colour:
    .search__s{ color: var(--txt-color, var(--ink-2)); }
    .card__sub{ color: var(--txt-color, var(--ink-2)); }
  Never write color:var(--txt-color) without a fallback — the text would inherit the parent
  colour and every secondary grey would turn dark.

=====================================================================
4. VERIFY
=====================================================================

  a) With nothing set, all small text is 40 % larger than before and buttons are unchanged
     in size — only their labels grew.
  b) Slider to 100 % returns the original sizes exactly.
  c) Pick Georgia: only the small texts change typeface, headings stay as they are.
  d) Pick a colour, then press "Privzeta": the grey hierarchy comes back, not a uniform dark.
  e) At 200 % nothing overflows its card and no button label is clipped; long labels wrap
     rather than being cut.
```

---

## Zakaj množitelj in ne nove velikosti

Če bi vsako velikost prepisali na novo, bi se razmerja med besedili razšla in bi bilo treba ob
vsaki spremembi znova uravnavati vseh štirideset vrednosti. Z množiteljem vsako besedilo obdrži
svoje mesto v hierarhiji, en drsnik pa premakne vse hkrati — in vrednost 100 % kadar koli vrne
natanko izvirno stanje.
