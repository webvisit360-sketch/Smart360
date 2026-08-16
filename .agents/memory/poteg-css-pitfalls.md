---
name: Poteg CSS pitfalls
description: CSS naming collision in tema-poteg.css that hides grid card labels
---

## `.lb` class collision — lightbox vs grid card label

`tema-poteg.css` defines `.lb` twice:
1. Lightbox root: `display:none; position:fixed; inset:0; background:#000; z-index:120` — invisible by default
2. Grid card label: `.gc .lb { position:absolute; left:13px; right:13px; bottom:11px; color:#fff; ... }` — does NOT override `display`

**Why it bites:** `.gc .lb` has higher specificity but doesn't set `display`, so card labels inherit `display:none` from the lightbox rule and are invisible.

**Fix:** The `.gc .lb` rule must explicitly reset all lightbox properties:
```css
.gc .lb { ...; display:block; background:transparent; z-index:auto; inset:auto; align-items:unset; justify-content:unset }
```

**Apply to:** both `ui/tema-poteg.css` (reference) and `artifacts/smart360/src/styles/tema-poteg.css` (implementation).

---

## `SwipeDetail` animation — mount with `.on` kills CSS transition

If `SwipeDetail` returns `null` when closed and mounts fresh with `className="detail on"`, the CSS slide-in transition never fires (element goes straight to final position).

**Fix:** Always keep `<div className="detail ...">` in the DOM; toggle the `on` class based on whether a category is selected. This lets the CSS `transform` transition animate on class change.

---

## `dscreen` padding — don't add inner wrapper div

`.dscreen` CSS already has `padding: 0 16px 40px`. Adding an extra inner `<div style={{ padding: '0 24px' }}>` doubles the horizontal padding to 40px per side. Render `CategoryContent` directly inside `.dscreen`.

## var() rezerve na naslovnici (paket 10)
Vsak var() spremenljivke naslovnice MORA imeti rezervno vrednost enako privzetku svoje teme (npr. var(--tt-size,56px) v potegu, var(--tt-size,24px) v sredozemski). Neveljaven var() v calc() da width:auto in SVG ikona se razlije čez zaslon. Blok html[data-theme=...] je le prvi sloj; data-theme nastavlja useThemeAttr (useLayoutEffect) v guest-home, guest-category IN GuestSwipe. Dokaz pravilnosti: izprazni vse cover stolpce in stran mora izgledati enako.

## Tematska CSS-a sta v glavnem svežnju, ne asinhrona
Obe temi se uvozita statično in ju vite vtičnik (vite-plugin-scope-themes.ts) ob prevodu predpne s html[data-theme="swipe"/"mediterran"] (:root/html → prefiks, body → prefiks + body; @keyframes nedotaknjeni). Preklop teme je izključno atribut data-theme, ki se nastavi ŽE MED RENDERJEM (use-theme-attr) — otroški layout effecti tečejo pred starševskimi.
**Zakaj:** asinhroni <link> je pomenil, da so bile ob prvem izrisu vse meritve (clientWidth/scrollWidth) napačne in je scroll-snap porezal programske skoke na 0 (prazne globoke povezave).
**Kako uporabiti:** pri programskem pozicioniranju pagerjev ostaja varovalka: rAF zanka (max 20 okvirjev) čaka display:flex, nato snap off → scrollLeft → reflow → snap on → razkrij; po izteku se pager VEDNO razkrije. Novi tematski CSS iz paketov mora ostati neskopiran — vtičnik skopira sam; pazi na ujemanje id-ja z query stringom (?t=...).

## Scope-vtičnik in at-pravila
- Vtičnik prefiksa samo selektorje (postcss walkRules); `@page`, `@font-face`, `@media`, `@supports`, `@keyframes` ostanejo nedotaknjeni, selektorji ZNOTRAJ @media pa se prefiksajo (`html,body` → `html[data-theme=..],html[data-theme=..] body`). Preverjeno v postreženem CSS ob paketu 14 (tisk nalepke A6 je odvisen od nepredponjenega `@page{size:A6;margin:8mm}`).

## Theme CSS scoping & the shared cover
The guest theme stylesheets are NOT what ships: `vite-plugin-scope-themes.ts` prefixes every selector with `:is(html[data-theme="X"], [data-theme="X"])` at build time. Judge scoping by compiled CSS (`curl .../src/styles/tema-*.css?direct`), never by the source files. The `[data-theme]` alternative in the anchor exists so the admin cover preview (a `<div data-theme>` frame around the shared guest `Cover` component in `pages/guest/Cover.tsx`) gets the real theme CSS.
**Why:** the admin preview once carried its own copy of the cover markup (own DOM order, hardcoded rating) and drifted from the guest page.
**How to apply:** any cover change goes into `Cover.tsx`; editing affordances (draggable logo via `.is-drag`, fixed preview height) are passed via its `edit` prop, never forked markup.
