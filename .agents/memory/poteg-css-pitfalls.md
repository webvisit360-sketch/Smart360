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
