# PONUDBA and NASTANITEV — same treatment as Okolica

Binding reference: `prototip-2030.html`, views `#v-shop` and `#v-grid`.
Copy the values; do not re-derive them. Measured at **390 × 844**, theme
`dan`. Colours are theme tokens.

Why: Okolica now uses ONE scrolling row of group tabs and large readable
cards. Ponudba and Nastanitev must follow the same pattern, so the guide
reads as one product instead of three different screens.

## Shared with Okolica — reuse the existing components, do not re-implement

- `.gtabs` — one horizontally scrolling row, never wrapping. Tab: height 44,
  padding 11px 18px, radius 999px, font 16px/750. Selected: bg `var(--acc)`,
  text `var(--onacc)`. Unselected: bg `var(--card)`, text `var(--tx2)`,
  1px border `var(--line)`.
- `.pcard` — card 358 wide, radius 24, 1px border `var(--line)`; photo 16/9
  `object-fit: cover` with focal point; body padding 14px 16px 16px;
  meta row 15px/750 with a 4px dot separator and a 12px/700 uppercase
  category label in `var(--tx2)`; title 22px/800; description 16px/400
  clamped to two lines. Whole card tappable. No "read more" control.
- A group with no visible content is not rendered. The first group with
  content is selected on open. Selecting a group scrolls the list to top.
- Group names localized SL/EN/DE/IT. The category→group mapping is DATA the
  host can change later, exactly as for Okolica.

---

## PONUDBA (`#v-shop`)

Header: kicker (tenant name) + title "Ponudba". The old full-width photo hero
is removed — it consumed a third of the screen and said nothing.

**Default groups → categories**

| Group | Categories |
|---|---|
| Najem | SUP deska, Skuter |
| Izleti in prevozi | Čoln s skiperjem, Ladijski prevoz |
| Domači izdelki | Oljčno olje, Sladoled 24/7 |
| Pri hiši | Zunanji fitnes, Žar, Družabne igre |

**Card meta line:** `<price> · <CATEGORY>` — the price in `var(--accg)`,
15px/750, exactly the authored text ("25 € / dan", "Po dogovoru"). Never a
computed total. When an item has no price, the meta line shows the category
alone.

**"Moja naročila" row** stays at the top of the list, above the first card:
the existing `.hello` component, 358 × 62, radius 16, border `var(--accg)`,
title 13.5px/650, showing the count of open orders. Rendered only when this
device has at least one order.

## NASTANITEV (`#v-grid`)

Header: kicker + title "Vaša nastanitev", bell fab on the right (unchanged).
The greeting strip stays directly under the tabs.

**Default groups → categories**

| Group | Categories |
|---|---|
| Vaše bivanje | Dobrodošli, Apartmaji, Bazen |
| Prihod in dostop | Lokacija, Parkirišče, Navodila za ograjo, Prijava / Odjava |
| Praktično | WiFi, Navodila za opremo, Hišni red |

**Card meta line:** the category label alone, in the same 12px/700 uppercase
style. Where the category has live status (e.g. Bazen), the status may
precede it: `odprto do 21:00 · BAZEN`, using the rules already implemented.

The quiet "Pomoč in nujni primeri" link stays at the bottom of the list.

---

## Verification

Computed-style pairs (prototype vs live) for both screens: header kicker and
title, tab row padding and gap, a selected and an unselected tab, card width
and radius, photo aspect ratio, body padding, meta row and its price colour,
category label, title, description clamp, and the "Moja naročila" row.

Screenshots at 390 × 844: Ponudba default group; Ponudba switched group;
Ponudba for a device with no orders (no "Moja naročila" row); Nastanitev
default group; Nastanitev switched group; a card with live status.
