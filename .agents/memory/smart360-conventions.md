---
name: Smart360 conventions
description: Durable decisions for the Smart360 multi-tenant guest PWA
---

- Communication with the user (Frenk, Smart360.info) is in Slovenian.
- EU data requirement: the user must pick the **Europe** region in Advanced settings at publish time (irreversible). Remind on every deploy suggestion.
- Admin auth is env-credential based (`ADMIN_USER`/`ADMIN_PASSWORD`, dev fallback admin/smart360 outside production) with an HMAC-signed cookie (`SESSION_SECRET`), NOT Clerk/Replit Auth — the brief explicitly demands this. No guest accounts ever.
- `?preview=1` on public endpoints only works for an authenticated admin session (was a data-exposure bug otherwise); unpublished tenants are 404 publicly, including search.
- Robots are blocked at three levels: API `X-Robots-Tag` middleware + robots.txt, web artifact `public/robots.txt` Disallow all, and `<meta name="robots">` in index.html. Keep all three when touching either server.
- `hoursJson` = JSON array of 7 [openMin, closeMin] Mon–Sun entries or null; closing may pass midnight; prototype stored fractional hours (7.5 = 07:30) — convert ×60.
- Demo tenant seed: `node artifacts/api-server/scripts/seed-melipu.mjs` re-derives everything from the binding prototype HTML in attached_assets (CONFIG/DATA extracted via vm; images exported to artifacts/smart360/public/images). Rules items store their icon key in `noteType`.
- The guest UI is a BINDING design package in `ui/` (README.md + zasloni.html + smart360-sredozemski.css + ikone-sprite.svg): no new CSS, no component libs/Tailwind visuals on guest screens, icons only via inline sprite `<use href="#i-...">` (DB icon keys map through `sprite-icon.ts`), categories are their own pages (no accordions), verify at 390px against zasloni.html. Admin keeps shadcn.
- Item `body` can be a JSON array of paragraphs (seed quirk) — always flatten before render; all API HTML goes through DOMPurify. `priceUnit` already starts with "/". Guest links must preserve `lang`/`preview` via `buildGuestPath`.
- Reorder endpoints require the full, unique sibling set of one parent and update positions in a transaction.
