# Smart360

Večnajemniška (multi-tenant) PWA z informacijami za goste turističnih nastanitev. Gost skenira QR kodo in vidi vse o nastanitvi in okolici — brez prijave. En sam operater (lastnik) ureja vse najemnike v admin vmesniku.

## Struktura

- `artifacts/smart360` — React/Vite frontend (previewPath `/`): gostujoči pogled `/g/:slug`, admin `/admin`, `/admin/login`, `/admin/tenants/:id`.
- `artifacts/api-server` — Express 5 API (`/api/...`): javni endpointi (tenant vsebina, iskanje), admin CRUD (tenants → sections → categories → items → media, translations, reorder, duplicate), overview + changelog.
- `lib/db` — Drizzle shema: tenants, sections, categories, items, media, translations, changelog (uuid id-ji, `position` za vrstni red, `isVisible` za skrivanje brez brisanja).
- `lib/api-spec/openapi.yaml` — pogodba; codegen: `pnpm --filter @workspace/api-spec run codegen`.
- Seed demo najemnika: `node artifacts/api-server/scripts/seed-melipu.mjs` (bere prototip HTML iz `attached_assets/`, slike izvozi v `artifacts/smart360/public/images/`).

## Ključne odločitve

- `vrsta-dela.md` je edini merodajni seznam dela. Stanje projektne kartice ga ne prekliče ali zaključi; zaključek zahteva produkcijo in v datoteki zahtevani dokaz.
- Admin avtentikacija: env poverilnice `ADMIN_USER` / `ADMIN_PASSWORD` (dev fallback admin/smart360, v produkciji obvezen `ADMIN_PASSWORD`), HMAC podpisan HTTP-only piškotek (30 dni, `SESSION_SECRET`), rate limit prijave 5/15 min. Brez registracije, brez gostujočih računov.
- Iskalniki povsod blokirani: `X-Robots-Tag` header + `/robots.txt` Disallow.
- Neobjavljeni najemniki na javnem endpointu vrnejo 404; `?preview=1` jih pokaže (za operaterja).
- `hoursJson`: JSON niz 7 vnosov Pon–Ned, vsak `[odprtoMin, zaprtoMin]` ali `null`; zapiranje lahko čez polnoč. `open24` za 24/7.
- Prevodi: tabela translations (model/recordId/field/lang); SL je osnovni jezik v vrsticah, EN/IT/DE prek prevodov; javni endpoint z `?lang=` združi prevode s SL fallbackom.
- Tema "mediterran" je zavezujoča: tokens (accent #3B78DC), radij kartic 26px/fotk 24px, 3D gumbi, brez gradientov.
- Demo najemnik: slug `meli-pu` (Apartmaji Meli Pu, Izola).
- Administracija uporablja Archivo in Smart360 paleto: primarni gumb #157347 (nikoli moder), ozadje #F4F6F2, kartice #FFFFFF, robovi #E8EBE6, besedilo #121A14, umirjeno #66716A; vedno pravi znak in SMART360 napis.

## User preferences

- Komunikacija v slovenščini.
- Baza mora biti v EU — ob objavi (publish) je treba v Advanced settings izbrati regijo Europe (nepovratno). Opomni uporabnika ob vsakem predlogu objave.
