# Smart360

Večnajemniška (multi-tenant) PWA z informacijami za goste turističnih nastanitev. Gost skenira QR kodo in vidi vse o nastanitvi in okolici — brez prijave. En sam operater (lastnik) ureja vse najemnike v admin vmesniku.

## Struktura

- `artifacts/smart360` — React/Vite frontend (previewPath `/`): gostujoči pogled `/g/:slug`, admin `/admin`, `/admin/login`, `/admin/tenants/:id`.
- `artifacts/api-server` — Express 5 API (`/api/...`): javni endpointi (tenant vsebina, iskanje), admin CRUD (tenants → sections → categories → items → media, translations, reorder, duplicate), overview + changelog.
- `lib/db` — Drizzle shema: tenants, sections, categories, items, media, translations, changelog (uuid id-ji, `position` za vrstni red, `isVisible` za skrivanje brez brisanja).
- `lib/api-spec/openapi.yaml` — pogodba; codegen: `pnpm --filter @workspace/api-spec run codegen`.
- Seed demo najemnika: `node artifacts/api-server/scripts/seed-melipu.mjs` (bere prototip HTML iz `attached_assets/`, slike izvozi v `artifacts/smart360/public/images/`).

## Ključne odločitve

- **Oznake funkcij:** nikoli ne dodajaj trditev (npr. »brezplačno«), ki jih specifikacija ne vsebuje. Oznake in opisi morajo natančno opisovati dejansko funkcijo.
- **Admin navigacija:** nedokončane admin strani nikoli ne pošiljaj kot dosegljive navigacijske izbire. Element menija se prikaže šele, ko vodi na delujoč urednik oziroma dejansko funkcionalno površino; »V pripravi« ni funkcionalna stran.

- **Varnostni model (faza 2, razvoj; ni objavljeno):** vsak nov admin endpoint in vsako novo polje morata v centralnem `actorGate` izrecno določiti dostop **gostitelj lastne nastanitve / samo operater**; privzeto zavrni, preveri lastništvo najemnika in RLS. UI ne nadomešča strežniške avtorizacije. Zavrnitve se zabeležijo brez zavrnjenih vrednosti; tuji najemnik ostane neviden (404).

  | Zmožnost | Gostitelj (samo svoja nastanitev) | Operater Smart360 |
  | --- | --- | --- |
  | Vnosi in vrstni red; podvojitev, premik med kategorijami, koš/obnova | Urejanje in ustvarjanje dovoljeno | Dovoljeno |
  | Predstavnost **vnosa** (fotografije, video, vrstni red, izrez), GPX in pregled razdalj | Dovoljeno | Dovoljeno |
  | Naročila (status/opomba), odgovori na sporočila, lastni prevodi in »prevedi manjkajoče« | Dovoljeno | Dovoljeno |
  | Obvestila Living Guide: ustvarjanje, urejanje in mehko brisanje | Dovoljeno samo za svojo nastanitev; shranjevanje učinkuje takoj | Dovoljeno za vse nastanitve |
  | Wi-Fi; telefon, e-pošta, WhatsApp, Viber, Instagram; obvestila in geslo naročil | Dovoljeno | Dovoljeno |
  | Lastno geslo, QR PNG, nalepka PDF, predogled objave in dnevnik sprememb | Dovoljeno (branje/prenos, kjer je ustrezno) | Dovoljeno |
  | **Ločen pregledan obrazec za uvajanje** (shranitev/oddaja, strukturirana polja, kategorije ustvarjene prek obrazca) | **Izjema: dovoljeno samo prek onboarding poti** | Pregled in odprtje obrazca |
  | Struktura: razdelki, kategorije, skupine/zavihki, vse spremembe in koš/obnova | **Ne** | Dovoljeno |
  | Videz: tema, način UI, barve, tipografija, naslovnica, logo, obe hero fotografiji, video/virtualni ogled, tlorisi/lokacijske slike | **Ne** | Dovoljeno |
  | Seznam jezikov, navigacija Living Guide; identiteta (ime, podnaslov, naslov, zemljevid, koordinate po vseh poteh) | **Ne** (razen polj ločenega onboarding obrazca) | Dovoljeno |
  | Objava **in umik** vodnika | **Ne: 403** — »Objavo vodnika opravi Smart360 — sporočite nam, ko so spremembe pripravljene.« | Dovoljeno |

  Obstoječe zmožnosti, ki so že samo operaterske (Creator, upravljanje računov, trajno brisanje, vzdrževanje itd.), ostanejo takšne. Ne dodajaj novih funkcij brez izrecne odločitve v matriki in centralnem registru; preveri tudi posamezna polja mešanih PATCH zahtevkov pred kakršnimkoli zapisom. Tehnični testni doseg in omejitve so v `docs/security-phase2.md`.

- Infrastrukturne napake ne smejo biti tihe: zavrnjeno shranjevanje mora ostati jasno označeno, lokalni vnos se ohrani, ponovni poskusi pa ne smejo prikazovati »shranjeno«, dokler spremembe niso potrjene. Osvežitev strani ni rešitev, če bi zavrgla neshranjen vnos.

- `vrsta-dela.md` je edini merodajni seznam dela. Stanje projektne kartice ga ne prekliče ali zaključi; zaključek zahteva produkcijo in v datoteki zahtevani dokaz.
- Admin avtentikacija: env poverilnice `ADMIN_USER` / `ADMIN_PASSWORD` (dev fallback admin/smart360, v produkciji obvezen `ADMIN_PASSWORD`), HMAC podpisan HTTP-only piškotek (30 dni, `SESSION_SECRET`), rate limit prijave 5/15 min. Brez registracije, brez gostujočih računov.
- Iskalniki povsod blokirani: `X-Robots-Tag` header + `/robots.txt` Disallow.
- Neobjavljeni najemniki na javnem endpointu vrnejo 404; `?preview=1` jih pokaže (za operaterja).
- `hoursJson`: JSON niz 7 vnosov Pon–Ned, vsak `[odprtoMin, zaprtoMin]` ali `null`; zapiranje lahko čez polnoč. `open24` za 24/7.
- Prevodi: tabela translations (model/recordId/field/lang); SL je osnovni jezik v vrsticah, EN/IT/DE prek prevodov; javni endpoint z `?lang=` združi prevode s SL fallbackom.
- Tema "mediterran" je zavezujoča: tokens (accent #3B78DC), radij kartic 26px/fotk 24px, 3D gumbi, brez gradientov.
- Demo najemnik: slug `meli-pu` (Apartmaji Meli Pu, Izola).
- Administracija uporablja Archivo in Smart360 paleto: primarni gumb #157347 (nikoli moder), ozadje #F4F6F2, kartice #FFFFFF, robovi #E8EBE6, besedilo #121A14, umirjeno #66716A; vedno pravi znak in SMART360 napis.
- Uradni Smart360 znak je nespremenjena datoteka `artifacts/smart360/public/brand/smart360-znak-40.png`, ki jo je lastnik izrecno potrdil s priloženim izvirnikom in z znakom v `reports/gril-dobrodoslica-cgp.html`. Ne prebarvaj, prerisuj ali stiliziraj ga. Tudi izraz »zeleni znak« ni navodilo za pretvorbo večbarvnega izvirnika v enobarvno različico. Obrazec in e-pošta uporabljata isto izvirno grafiko.
- Pravilo CGP: Znak vedno izvira iz originalnih uradnih datotek, vedno stoji na beli podlagi in ga nikoli ne prerisujemo, prebarvamo ali približno poustvarimo. Besedni znak »SMART360« je vedno Archivo 800, barve #121A14, z razmikom med črkami 0.02em. Zelena #157347 je poudarna barva in se nikoli ne uporablja za znak ali besedni znak. V e-pošti je celoten logotip (znak + besedni znak) vedno ena vnaprej izrisana slika v retina ločljivosti, nikoli besedilo HTML.
- Barva #DD9A2B je namenjena izključno opozorilom in brisanju, nikoli dekoraciji. E-poštne kartice nimajo okrasne oranžne zgornje črte.
- **Living Guide – SOS:** namenski rdeči token `--sos-red` po zavezujočem SOS prototipu je rezerviran izključno za nujne primere (SOS in nujni telefonski kontakti). Napake GPS, zavrnjena naročila, brisanje in druga nenujna opozorila v gostujočem Living Guide uporabljajo obstoječi jantarni barvi #F2B135 / #DD9A2B, nikoli SOS rdeče. SOS je vedno na voljo vsem najemnikom samo v Living Guide; GPS SOS se hrani samo v pomnilniku med odprtim pogledom, brez pošiljanja, beleženja ali shranjevanja. SOS prekrivni pogled ne spreminja življenjskega cikla ture ali snemalnika.
- **Living Guide – obvestila:** obvestila so sprotni podatki (kot sporočila in naročila), niso del objavljenega posnetka in ne čakajo na Publish. Shranjevanje učinkuje takoj, ob upoštevanju časovnega okna veljavnosti. Zakon 1 za vsebino vodnika ostaja nespremenjen. Stanje prebrano/neprebrano se vodi samo na napravi gosta, ne na strežniku. Prevodi imajo fallback na prvi neprazen jezik v vrstnem redu SL → EN → DE → IT. Obvestila niso na voljo iz predpomnilnika brez povezave.
- **Living Guide – videz obvestil in menija:** priloženi `obvestila-meni-dizajn` določa postavitev, razmike in hierarhijo; površine in besedilo uporabljajo tokene teme najemnika (svetla/temna), s preverjanjem WCAG AA besedilnega kontrasta. Značka »Novo« in neprebrana pikica ohranita zeleno barvo iz reference v obeh temah.

- **Living Guide – snemanje tur:** ob vključenem operaterskem stikalu SNEMANJE TUR je snemalnik zadnja kartica vsake vidne kategorije s ključem `bike`, `hike`, `run` ali `activities` (tudi prazne), nikoli »Vse« ali drugih kategorij. Zavihek »Snemanje tur« ostane samo kot fallback, če noben od teh ključev ni viden; prevedena imena in `act` ne štejejo.

## Backlog — ločena odobritev za RLS

- Obstoječi politiki `host_scope` na `orders` in `message_threads` še uporabljata `NOT (current_setting('app.role', true) = 'host')`. Če `app.role` ni nastavljen, izraz vrne NULL in lahko zavrne povezavo, za katero se politika dejansko uveljavlja. Pregled in uskladitev z `current_setting('app.role', true) IS DISTINCT FROM 'host'` sodita v ločeno, izrecno odobreno nalogo. **V nalogi za obvestila teh politik ne spreminjamo.** Nova politika za `tenant_announcements` uporablja popravljeni izraz v USING in WITH CHECK; preverjanje dostopa na ravni aplikacije ostaja obvezno.

## Brand tagline

The Smart360 brand tagline is always English and never translated: “Everything about your stay, in one place.” Reuse `BRAND_TAGLINE` from `artifacts/smart360/src/lib/brand.ts` on every tagline surface. Keep it out of translation dictionaries and translation jobs; mark rendered slogan text `lang="en" translate="no"`. Typography and CGP remain unchanged.

## User preferences

- Komunikacija v slovenščini.
- Baza mora biti v EU — ob objavi (publish) je treba v Advanced settings izbrati regijo Europe (nepovratno). Opomni uporabnika ob vsakem predlogu objave.
