---
name: Smart360 conventions
description: Durable decisions for the Smart360 multi-tenant guest PWA
---

- Communication with the user (Frenk, Smart360.info) is in Slovenian.
- EU data requirement: the user must pick the **Europe** region in Advanced settings at publish time (irreversible). Remind on every deploy suggestion.
- Admin auth is passkey-only (WebAuthn via @simplewebauthn, argon2id via @node-rs/argon2 for recovery codes — @node-rs/* must stay external in esbuild config). No passwords, SMTP, TOTP, or third-party auth — user explicitly replaced everything (Aug 2026). Single `admin_users` row, email pi4.doo@gmail.com is a LABEL only, no mail ever sent. Server-side revocable 30-day sessions (hashed tokens), DB-backed single-use WebAuthn challenges, single-use 15-min enroll tokens (`pnpm --filter @workspace/api-server run admin:enroll` prints the link; also last-resort recovery), 10 argon2id-hashed one-time recovery codes shown exactly once at first enrolment. rpID/rpOrigin from RP_ID/RP_ORIGIN env with REPLIT_DEV_DOMAIN fallback — **production deploy MUST set RP_ID/RP_ORIGIN to the real domain and push the schema, then run admin:enroll once**. Enroll token burns only after successful verification; last credential undeletable without another key or unused recovery codes (atomic SQL guard); credential counter updates use GREATEST. NOT Clerk/Replit Auth — the brief demands this. No guest accounts ever.
- `?preview=1` on public endpoints only works for an authenticated admin session (was a data-exposure bug otherwise); unpublished tenants are 404 publicly, including search.
- Robots are blocked at three levels: API `X-Robots-Tag` middleware + robots.txt, web artifact `public/robots.txt` Disallow all, and `<meta name="robots">` in index.html. Keep all three when touching either server.
- `hoursJson` = JSON array of 7 [openMin, closeMin] Mon–Sun entries or null; closing may pass midnight; prototype stored fractional hours (7.5 = 07:30) — convert ×60.
- Demo tenant seed: `node artifacts/api-server/scripts/seed-melipu.mjs` re-derives everything from the binding prototype HTML in attached_assets (CONFIG/DATA extracted via vm; images exported to artifacts/smart360/public/images). Rules items store their icon key in `noteType`.
- Two guest themes per tenant (`Tenant.theme`: mediterran|swipe); load exactly ONE theme CSS (tema-sredozemska/tema-poteg) after tenant fetch. Cover* columns are NULLABLE: null = inherit active theme's CSS :root default (per-theme defaults differ — see ui/urejevalnik-naslovnice.md); emit CSS vars only for non-null values (guest helper cover-vars.ts, set on .app root in mediterran, .cover in swipe). Server clamps cover ranges/enums in the tenant PATCH. After codegen, restart api-server or it serves stale zod schemas (500 ZodError).
- The guest UI is a BINDING design package in `ui/` (README.md + zasloni.html + smart360-sredozemski.css + ikone-sprite.svg): no new CSS, no component libs/Tailwind visuals on guest screens, icons only via inline sprite `<use href="#i-...">` (DB icon keys map through `sprite-icon.ts`), categories are their own pages (no accordions), verify at 390px against zasloni.html. Admin keeps shadcn.
- Item `body` can be a JSON array of paragraphs (seed quirk) — always flatten before render; all API HTML goes through DOMPurify. `priceUnit` already starts with "/". Guest links must preserve `lang`/`preview` via `buildGuestPath`.
- Reorder endpoints require the full, unique sibling set of one parent and update positions in a transaction.

## Content visibility & trash (pre-built for admin content editing)
- `isVisible` on sections/categories/items IS the spec's `published` flag (hide-without-delete); do not add a second column.
- `deletedAt` (categories+items) = 30-day soft-delete trash. THREE scopes in `contentTree.ts`, the only visibility rules: `guestScope` (published+not deleted), `adminScope` (not deleted — hidden entries MUST stay in admin lists, greyed with "Skrito" badge), `trashScope` (deleted only). Never filter visibility elsewhere.
- Reorder endpoints take the FULL ordered id list in one transaction and require exactly the non-deleted siblings.
- Remaining admin-content work (trash UI/endpoints, autosave, paste sanitization, length counters, cover/logo upload UI) is deferred until task-agent work #16–#18 merges.

## Naslovi strank — odločitev (avgust 2026)
- Poti namesto poddomen: smart360.info/<slug>. Stare naloge o poddomenah/lastnih domenah preklicane, TODA lastne domene strank (melipu.si) ostajajo odprta opcija — razreševanje najemnika MORA ostati v eni funkciji (resolveTenant), razširljivi s preslikavo domena→slug.
- Vse povezave skozi en url() pomočnik z basePath; brez <base href>; statika ostane na korenu; localStorage ključi po slugu.
- Polje slug (predlog iz imena, živo preverjanje, rezervirane besede, TenantAlias 301, klikljiv naslov + QR) se zgradi ŽE v nalogi administracije vsebine, na zaslonu nastavitev nastanitve. Usmerjanje, manifest na najemnika in vstopna stran pridejo v ločeni nalogi za tem.

## Naslovnica: NULL = privzetek teme (odločitev)
- Vsa polja naslovnice in nav barv na Tenant so nullable; NULL pomeni "uporabi privzetek teme" (bloka html[data-theme=...] v CSS oz. var(--nv,#...) rezerve). Privzetkov NIKOLI ne zapisuj v bazo.
- Ob izrisu se CSS spremenljivka nastavi SAMO za neprazna polja (cover-vars.ts, navVars v GuestSwipe). "Ročno spremenjeno" == "ni NULL"; gumb Ponastavi polja izprazni; preklop teme ne rabi ponastavljanja.

## Vsebina in slug — implementirano stanje (avgust 2026)
- Brisanje kategorij/postavk je mehko (deletedAt); koš "Nedavno izbrisano" z obnovitvijo, trajni izbris po 30 dneh (leni purge ob GET trash). Sekcije se še vedno brišejo trdo.
- VSA besedila strežniško očisti cleanContentFields (adminContent.ts): body → majhen allowlist (p, b/strong, br, a[href]); ostala polja → golo besedilo; website/mapUrl → samo http(s), sicer null; tudi prevodi ob upsertu. Nikoli ne zaupaj odjemalcu.
- Pravila slugov v api-server/src/lib/slug.ts (rezervirane besede, regex 3–40, checkSlugAvailability upošteva tudi tenant_aliases). Ob preimenovanju se stari slug za vedno zapiše v tenant_aliases; javni resolve najprej slug, nato alias → stari QR delujejo. Podvajanje/ustvarjanje najemnika gre skozi isti validator.
- QR PNG: GET /api/admin/tenants/:id/qr.png (paket qrcode); naslov gostov zaenkrat REPLIT_DEV_DOMAIN/g/<slug>, ob selitvi na smart360.info popravi guestUrl() v adminTenants.ts.

## Deljenje in QR (paket 14)
- QR SVG in publicUrl generira strežnik in ju pošlje v TenantContent; brez odjemalske QR knjižnice.
- **TenantContent shemo delita javni IN admin endpoint** — vsako novo `required` polje je treba dodati v OBA route-a, sicer zod parse na drugem poči šele ob zagonu.
- pdfkit/svg-to-pdfkit/fontkit morajo v esbuild ostati `external` (pdfkit bere .afm pisave z diska; bundlanje poči na @swc/helpers).
- Nalepka A6: en vir (wordmark+QR+ime+dvojezični napis), dva izhoda — #printcard v gosta (window.print) in /admin/.../label.pdf.

## Kanonični naslov (publicUrl/QR)
- `guestUrl()` bere APP_DOMAIN → REPLIT_DOMAINS → REPLIT_DEV_DOMAIN; brez trdo kodirane domene (vrže napako, če ni nobene). Nalepke ne smejo v tisk, dokler produkcijska domena res ne deluje — menjava domene NI pokrita s TenantAlias (ta pokriva samo preimenovanje sluga znotraj iste domene). Ob preklopu na smart360.info nastavi APP_DOMAIN v produkciji.

## Passkey/WebAuthn produkcija (avg 2026)
- Deployment ima LOČEN komplet skrivnosti od delovnega prostora — posodobitev workspace secrets NE vpliva na objavo; produkcijske vrednosti nastavi kot production env vars (setEnvVars environment:"production") ali v Publishing UI.
- V artifact-mode autoscale objavi REPLIT_DEPLOYMENT NI nastavljen — ne uporabljaj ga kot zaznavo produkcije. Zaznava "brez ključev v bazi" je zanesljivejši sprožilec za bootstrap.
- rpID()/rpOrigin(): dev kontejner vedno REPLIT_DEV_DOMAIN, objava vedno RP_ID/RP_ORIGIN. Efektivni rpId preveri v živo: POST /api/admin/webauthn/login/options (javen, vrne options.rpId).
- Bootstrap vpis: ob zagonu z 0 ključi strežnik izpiše enkratno enroll povezavo (15 min) v dnevnik objave.
- Dnevnik objave med zagonom (~prvih 30 s) IZGUBLJA pino stdout vrstice ("Server listening", bootstrap sporočila); stderr z zamikom (setTimeout 30 s + console.error) zanesljivo pride skozi. Zagonski bootstrap zato izpiše kratko obnovitveno kodo na stderr z 30 s ponovitvijo.
