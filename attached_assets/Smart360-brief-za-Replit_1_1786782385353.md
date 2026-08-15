# Smart360 — tehnični brief za izdelavo (Replit)

**Naročnik:** Frenk Potočnik · Smart360.info
**Izdelek:** mobilna spletna aplikacija (PWA) za goste turističnih nastanitev + administracija za enega samega upravitelja
**Prototip dizajna:** `smart360-melipu.html` in `smart360-melipu-sredozemsko.html` (priloženo — to sta referenci za videz in obnašanje)

---

## 1. Kaj gradimo

Gost nastanitve (hotel, hostel, apartma, kamp) skenira QR kodo ali odpre povezavo in dobi aplikacijo, ki mu pove **vse o nastanitvi** (dobrodošlica, WiFi, hišni red, navodila za opremo, prijava/odjava) in **vse o okolici** (restavracije, plaže, poti, znamenitosti, storitve, dogodki). Gost se **nikoli ne prijavlja** — aplikacija je javno dostopna na svoji povezavi.

Ključna poslovna zahteva: **serijska izdelava**. En sam sistem streže poljubno število strank; vsaka stranka dobi svojo poddomeno (`meli-pu.smart360.info`) z lastnimi vsebinami in fotografijami. Vsebine ureja **izključno upravitelj (jaz)** prek administracije — stranka nima dostopa.

---

## 2. Tehnični sklad (predlog)

| Plast | Predlog | Opomba |
|---|---|---|
| Framework | **Next.js 14+ (App Router) + TypeScript** | SSR za hitro nalaganje na mobilnih omrežjih |
| Baza | **PostgreSQL** (Neon ali Replit PostgreSQL) | ne SQLite — potrebujemo sočasen dostop |
| ORM | **Prisma** | migracije, tipi |
| Slike | **Cloudflare R2 / UploadThing / Supabase Storage** | + samodejno pomanjšanje na 3 velikosti |
| Slog | **Tailwind CSS** z žetoni iz prototipa | glej razdelek 8 |
| Seja admina | **iron-session** ali podpisan cookie | brez zunanjega ponudnika prijave |
| Namestitev | Replit Deployments (Autoscale) | wildcard poddomena `*.smart360.info` |

Če je Next.js preveč, je sprejemljiva tudi kombinacija **Vite + React (javni del)** in **Express + Prisma (API in admin)**. Pomembno je, da javni del ostane hiter in da so slike optimizirane.

---

## 3. Večnajemniška arhitektura

- Vsaka stranka = zapis `Tenant` s poljem `slug` (npr. `meli-pu`)
- Naslovi: `https://<slug>.smart360.info` — poddomena določi najemnika prek middlewara
- Podpri tudi lastno domeno stranke (polje `customDomain`), če jo kdaj kdo želi
- **Klonanje:** v administraciji gumb »Podvoji nastanitev« — ustvari novega najemnika s celotno strukturo kategorij in praznimi vsebinami. To je jedro serijske izdelave.
- Predloga (`isTemplate: true`) — ena vzorčna nastanitev, ki služi kot izhodišče za vse nove

---

## 4. Podatkovni model

```prisma
model Tenant {
  id            String   @id @default(cuid())
  slug          String   @unique          // meli-pu
  customDomain  String?  @unique
  name          String                    // Apartmaji Meli Pu
  subtitle      String?                   // Malija 143b, Izola
  rating        String?                   // 4,95
  reviewsCount  String?                   // 128
  logoId        String?
  heroId        String?
  tourUrl       String?                   // iframe 3DVista
  phone         String?
  whatsapp      String?
  viber         String?
  instagram     String?
  address       String?
  mapQuery      String?
  wifiSsid      String?
  wifiPass      String?
  theme         String   @default("airbnb")   // airbnb | mediterran | swipe

  /* --- naslovnica: vse nastavljivo iz administracije --- */
  coverTitle        String?                    // če je prazno, se uporabi name
  coverSubtitle     String?                    // če je prazno, se uporabi subtitle
  coverTitleSize    Int      @default(56)      // px, 24–84
  coverTitleOpacity Int      @default(66)      // %, 20–100
  coverTextColor    String   @default("#FFFFFF")
  coverSubSize      Int      @default(22)      // px, 12–40
  coverSubOpacity   Int      @default(50)      // %
  coverMetaSize     Float    @default(19.5)    // px
  coverMetaOpacity  Int      @default(60)      // %
  coverVeil         Int      @default(26)      // zatemnitev fotografije v %, 0–60
  coverAlign        String   @default("left")  // left | center
  coverShowRating   Boolean  @default(true)
  languages     String[] @default(["sl","en","it","de"])
  isTemplate    Boolean  @default(false)
  isPublished   Boolean  @default(false)
  sections      Section[]
}

model Section {              // Vaša nastanitev / Ponudba / Odkrij okolico / Storitve
  id        String  @id @default(cuid())
  tenantId  String
  key       String                        // stay | offer | explore | services
  title     String
  subtitle  String?
  icon      String
  position  Int                           // vrstni red — poljubno spremenljiv
  isVisible Boolean @default(true)
  categories Category[]
}

model Category {             // WiFi, Kulinarika, Plaže, Lekarne ...
  id         String  @id @default(cuid())
  sectionId  String
  label      String
  icon       String
  layout     String                       // text | gallery | rules | products | poi | routes | events | tabs | wifi
  position   Int
  isVisible  Boolean @default(true)
  items      Item[]
}

model Item {                 // posamezen lokal, pravilo, izdelek, pot, odstavek
  id          String  @id @default(cuid())
  categoryId  String
  title       String?
  body        String?      @db.Text
  price       String?
  priceUnit   String?
  phone       String?
  website     String?
  mapQuery    String?
  difficulty  String?      // easy | mod | hard
  duration    String?
  distance    String?
  open24      Boolean  @default(false)
  hours       Json?        // [[12,22],[12,22], ...] pon–ned, null = zaprto
  noteType    String?      // info | recommendation
  noteText    String?      @db.Text
  bullets     String[]     // vključeno v ceni ipd.
  position    Int
  isVisible   Boolean  @default(true)
  media       Media[]
}

model Media {
  id        String @id @default(cuid())
  itemId    String?
  tenantId  String?
  url       String        // original
  urlLarge  String        // 1200 px
  urlThumb  String        // 400 px
  alt       String?
  position  Int
}

model Translation {         // prevodi katerega koli polja
  id       String @id @default(cuid())
  model    String          // "Item" | "Category" | "Tenant"
  recordId String
  field    String          // "title" | "body" ...
  lang     String          // en | it | de
  value    String @db.Text
  @@unique([model, recordId, field, lang])
}
```

**Ključno:** povsod, kjer je `position`, mora biti vrstni red **poljubno spremenljiv z vlečenjem**. Nič ni fiksno zakodirano — niti sekcije, niti kategorije, niti posamezni vnosi.

---

## 5. Administracija — zahteve

Dostopna na `/admin` (ali na ločeni poddomeni `admin.smart360.info`).

### Prijava — passkey (WebAuthn)

**Samo jaz.** Brez registracije, brez prijave za goste, brez gesla, brez e-pošte, brez SMS-a in brez katerekoli zunanje storitve.

**Zakaj passkey**
- Zasebni ključ nikoli ne zapusti naprave; strežnik hrani samo javni ključ
- Vezan je na domeno, zato **lažne strani ne delujejo** — edina oblika prijave, ki je odporna na phishing
- Ni gesla, ki bi ga lahko kdo uganil, ukradel iz baze ali prestregel
- Potrditev je odtis prsta, obraz ali PIN naprave — hitreje kot tipkanje gesla

**Knjižnica:** `@simplewebauthn/server` in `@simplewebauthn/browser`. To je paket v projektu, ne zunanji servis.

**Nastavitve**
- `rpID` = domena (npr. `smart360.info`; med razvojem naslov Replita), `rpName` = »Smart360«
- `userVerification: "required"`, `residentKey: "preferred"`, `attestation: "none"`
- Deluje samo prek HTTPS — Replit ga ima

**Podatkovni model**
```prisma
model AdminUser {
  id            String       @id @default(cuid())
  email         String       @unique      // samo oznaka računa, ne pošilja se nič
  displayName   String       @default("Skrbnik")
  createdAt     DateTime     @default(now())
  credentials   Credential[]
  recoveryCodes RecoveryCode[]
}

model Credential {
  id            String   @id @default(cuid())
  userId        String
  credentialId  Bytes    @unique
  publicKey     Bytes
  counter       BigInt
  transports    String[]
  deviceName    String                    // "iPhone Frenk", "MacBook"
  createdAt     DateTime @default(now())
  lastUsedAt    DateTime?
}

model RecoveryCode {
  id      String   @id @default(cuid())
  userId  String
  hash    String                          // argon2id
  usedAt  DateTime?
}
```

**Prva vključitev**
- Ukaz `npm run admin:enroll` v konzoli izpiše **enkratno povezavo, veljavno 15 minut**
- Povezava odpre stran, kjer registriram prvi passkey (brskalnik zahteva odtis/obraz/PIN)
- Takoj po tem se ustvari **10 rezervnih kod**, prikažejo se enkrat in se shranijo zgoščeno
- Povezava se po uporabi razveljavi

**Prijava**
- Na `/admin` en sam gumb »Prijava s passkeyjem« → brskalnik odpre sistemsko okno → potrditev z biometriko → notri
- Brez uporabniškega imena; z `residentKey` brskalnik sam ponudi pravi ključ
- Prijava s tuje naprave: v sistemskem oknu »uporabi drugo napravo« → QR koda → potrditev na telefonu (vgrajeno v OS, brez aplikacije)

**Več naprav**
- V administraciji stran **»Ključi«**: seznam vseh passkeyjev (ime naprave, datum, zadnja uporaba), gumb **Dodaj passkey**, preimenovanje in brisanje
- Priporočeno: registriran passkey na telefonu **in** na računalniku
- Zadnjega ključa ni mogoče izbrisati, dokler ne obstaja drugi ali dokler niso na voljo neporabljene rezervne kode

**Če izgubim vse naprave**
- Vpis ene od 10 rezervnih kod → takojšnja registracija novega passkeyja → uporabljena koda se razveljavi
- Skrajna sila: `npm run admin:enroll` iz konzole Replita (dostop do konzole ima samo lastnik projekta)

**Omejitve in seja**
- Največ 10 poskusov prijave na 15 minut po IP
- Seja: HTTP-only, `Secure`, `SameSite=Lax`, veljavnost 30 dni z obnavljanjem; odjava izbriše sejo na strežniku
- Stran **»Ključi«** ima tudi gumb »Odjavi vse seje«
- Vsaka prijava, registracija ključa in poraba rezervne kode se zapiše v dnevnik (čas, IP, brskalnik)

**Spremenljivke okolja**
```
DATABASE_URL=
SESSION_SECRET=        # naključnih 32+ znakov
RP_ID=                 # smart360.info (med razvojem naslov Replita)
RP_ORIGIN=             # https://smart360.info
```
Nobenih SMTP, Twilio, TOTP ali API ključev tretjih storitev.

### Kaj mora znati
1. **Seznam nastanitev** — vse stranke, iskanje, status objavljeno/skrito, gumb »Podvoji«.
2. **Urejanje ene nastanitve** — osnovni podatki, kontakti, WiFi, povezava do 3DVista sprehoda, izbira teme (Airbnb / sredozemska), izbira jezikov.
3. **Sekcije, kategorije, vnosi** — vse tri ravni:
   - **dodajanje** kjerkoli v seznamu (ne samo na koncu),
   - **brisanje** s potrditvijo (»Res izbrišem kategorijo Plaže in vseh 8 vnosov?«),
   - **skrivanje** brez brisanja (stikalo »vidno / skrito«),
   - **prerazporejanje z vlečenjem** (drag & drop) znotraj ravni,
   - **premik vnosa v drugo kategorijo** (npr. lokal iz Kulinarike v Picerije),
   - **podvajanje** vnosa.
4. **Fotografija pri vsakem vnosu** — vsak vnos, ne glede na tip (tudi navadno besedilo, pravilo, WiFi ali zavihek), ima možnost dodati **eno ali več fotografij, ki se prikažejo NAD besedilom**. Polje za fotografije je vedno prisotno; če je prazno, se kartica preprosto izriše brez slike.
5. **Urejevalnik naslovnice** — ločen zavihek pri nastavitvah nastanitve, z **živim predogledom** ob strani (ali pod obrazcem na ozkem zaslonu). Nastavljivo:
   - **vsebina:** naslov in podnaslov kot navadni besedilni polji, ki ju napišem po želji (privzeto se prevzameta ime in naslov nastanitve)
   - **velikost naslova** (drsnik 24–84 px), **prosojnost naslova** (20–100 %)
   - **barva besedila** (izbirnik barve + šest prednastavljenih: bela, peščena, kremna, modra, temna, opečnata)
   - **velikost in prosojnost podnaslova**, **velikost vrstice z oceno**
   - **zatemnitev fotografije** (0–60 %) — enakomerna čez celo fotografijo, brez preliva
   - **poravnava** (levo / sredina) in **stikalo za vrstico z oceno**
   - gumba **Ponastavi** in **Shrani**; vrednosti se hranijo pri nastanitvi, ne globalno
   Delujoč vzorec tega urejevalnika je v `smart360-poteg.html` — gumb z drsniki zgoraj desno na naslovnici. Uporabi enaka polja, enake meje in enake privzete vrednosti.
6. **Vsa vsebina se na javni strani izriše v okvirju** (`.card`) — tudi tam, kjer je samo besedilo. Nič ne "plava" na podlagi.
7. **Urejevalnik vnosa** — polja se prilagodijo tipu kategorije:
   - *poi* (lokal): naziv, fotografije, odpiralni čas po dnevih, telefon, splet, cilj navigacije, opomba/priporočilo
   - *products*: naziv, opis, cena, enota, alineje »kaj je vključeno«, pogoji, gumb Rezerviraj
   - *routes*: naziv, težavnost, čas, dolžina, izhodišče, cilj
   - *rules*: ikona + besedilo
   - *text*: naslov, besedilo (krepko, alineje), galerija
   - *events*: naziv, opis, povezava
8. **Fotografije** — nalaganje z vlečenjem, več naenkrat, prerazporejanje, izbira naslovne, samodejno pomanjšanje in pretvorba v WebP, brisanje.
9. **Prevodi** — ob vsakem polju zavihki SL / EN / IT / DE. Če prevoda ni, se prikaže slovensko besedilo.
10. **Predogled** — gumb »Poglej kot gost«, ki odpre javno stran v novem zavihku (deluje tudi za neobjavljene).
11. **QR koda** — samodejno ustvarjena za povezavo nastanitve, prenos v PNG in SVG (za nalepko v apartmaju).
12. **Dnevnik sprememb** — kdaj je bilo kaj spremenjeno (koristno pri več strankah).

### Česa ne sme biti
- Nobene prijave, registracije ali računa za goste ali za lastnike nastanitev.
- Nobenega javnega obrazca, ki bi karkoli zapisoval v bazo (brez komentarjev, ocen, rezervacij).

---

## 6. Javni del — zahteve

- **Mobile-first**, širina zasnove 390 px, deluje tudi na namizju (vsebina centrirana, največ 390–420 px).
- **PWA**: manifest, ikona, možnost »Dodaj na začetni zaslon«, delovanje brez povezave za že obiskane strani (service worker).
- **360° sprehod**: `<iframe>` z URL-jem iz polja `tourUrl`. Če je polje prazno, se prikaže naslovna fotografija z oznako »360°«. Iframe potrebuje `allow="fullscreen; gyroscope; accelerometer; xr-spatial-tracking"`.
- **Odpiralni čas v realnem času**: iz polja `hours` se izračuna »Odprto / Zaprto« in »Danes 12:00–22:00«, upoštevaj čase čez polnoč (npr. 22:00–03:00).
- **Navigacija**: gumb odpre `https://www.google.com/maps/dir/?api=1&destination=<mapQuery>` — na iPhonu naj se odpre Apple Maps, če je tako nastavljeno.
- **Kontakt**: klic (`tel:`), WhatsApp (`https://wa.me/…`), Viber (`viber://chat?number=…`), Instagram.
- **Iskanje** čez vse vsebine nastanitve.
- **Zvok klika** in vibracija ob dotiku gumbov (Web Audio, generirano v brskalniku — brez zvočne datoteke), s stikalom za izklop v meniju.
- **Hitrost**: prva vsebina vidna v manj kot 2 sekundi na 4G. Slike v WebP, `loading="lazy"`, pravilne velikosti.

---

## 7. Robots — obvezno onemogočeno branje

Aplikacija **ne sme biti dostopna iskalnikom, arhivom in avtomatskim pajkom**. Zahtevano na vseh treh ravneh:

**1) `robots.txt` (za vse poddomene):**
```
User-agent: *
Disallow: /
```
Brez `sitemap.xml`. Datoteka mora biti dinamična (Next.js `app/robots.ts`), da velja za vsako poddomeno.

**2) Glava HTTP na vsakem odgovoru:**
```
X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex
```

**3) Meta oznaka v `<head>`:**
```html
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
<meta name="googlebot" content="noindex, nofollow">
```

**Dodatno:**
- Administracija (`/admin`) tudi `noindex` in dodatno zaščitena s prijavo.
- Neobjavljene nastanitve vračajo `404`.
- Priporočeno: pred aplikacijo Cloudflare z vklopljenim »Bot Fight Mode«.
- Ne pošiljaj naslovov v Google Search Console in ne dodajaj strukturiranih podatkov.

---

## 8. Dizajn — dve temi

Prototipa v priloženih datotekah sta zavezujoča za videz. Iz njiju prevzemi žetone:

**Tema »airbnb« (privzeta)**
```
--ink:#222222  --ink-2:#717171  --line:#EBEBEB  --wash:#F7F7F7
--accent:#FF385C
radij fotografij 16px, ploščic 12px
pisava Figtree (ali Plus Jakarta Sans), naslovi 600, letter-spacing -0.035em
ikone: samo obris, debelina 1.45, brez podlage
```

**Tema »mediterran«**
```
--ink:#14201F  --ink-2:#6B7876  --line:#E8E4DD  --wash:#F6F1E9
--accent:#3B78DC        (Google modra, potemnjena za 10 %)
--accent-dark:#2E60B0   (spodnji rob 3D gumbov)
radij fotografij 24px, kartic 26px
gumbi imajo 3D podstavo (box-shadow: 0 4px 0 var(--accent-dark)) in se ob dotiku pogreznejo
```

Skupno za obe temi: **bela podlaga, čiste polne barve, brez prelivov (nič `linear-gradient`), čisti rezi, veliko belega prostora.** Tema se izbere v administraciji za vsako nastanitev posebej.

---

## 9. Faze izdelave

1. **Temelj** — podatkovni model, prijava za admina, ena nastanitev, javni prikaz z vsemi tipi kategorij
2. **Administracija** — CRUD na treh ravneh, vlečenje za vrstni red, nalaganje fotografij
3. **Večnajemniška raba** — poddomene, podvajanje nastanitve, predloga
4. **Prevodi** — zavihki jezikov, preklop na javnem delu
5. **Poliranje** — PWA, zvok, hitrost, QR kode, dnevnik sprememb

---

## 10. Prompt za Replit Agent (za kopiranje)

> Build a multi-tenant guest-information PWA called **Smart360** with Next.js 14 (App Router, TypeScript), Prisma and PostgreSQL, styled with Tailwind.
>
> **Public side** (no user accounts, no login, no signup, no public forms): each tenant is served on its own subdomain (`<slug>.smart360.info`) resolved in middleware. Mobile-first, 390 px design width. Sections → categories → items, all ordered by a `position` field. Category layouts: `text`, `gallery`, `rules`, `products`, `poi`, `routes`, `events`, `tabs`, `wifi`. POI items compute Open/Closed live from a weekly `hours` JSON (support past-midnight ranges). Buttons for `tel:`, `wa.me`, `viber://`, and Google Maps directions. A 360° virtual tour is embedded via iframe from the tenant's `tourUrl`; if empty, show the hero photo with a "360°" badge. Full-text search across the tenant's content. Two selectable themes: `airbnb` (accent `#FF385C`) and `mediterran` (accent `#3B78DC`, buttons with a 4px solid bottom edge). No gradients anywhere. PWA with manifest and offline caching.
>
> **Admin at `/admin`, single operator only — passkey login (WebAuthn), no password, no email, no SMS, no third-party service.** Use `@simplewebauthn/server` and `@simplewebauthn/browser` with `userVerification: "required"`, `residentKey: "preferred"`, `attestation: "none"`, `rpID`/`rpOrigin` from env. Models: `AdminUser`, `Credential` (credentialId, publicKey, counter, transports, deviceName, lastUsedAt) and `RecoveryCode` (argon2id hash, usedAt). First enrolment: `npm run admin:enroll` prints a **single-use link valid 15 minutes** that registers the first passkey and then shows **10 recovery codes once**, stored hashed. Login is one button — no username — and must also support cross-device sign-in via the browser's built-in QR flow. Add a **Ključi** page listing all passkeys with device name, created and last-used dates, plus Add, Rename, Delete and "Sign out all sessions"; refuse to delete the last credential unless another one or unused recovery codes exist. Losing every device is recovered by entering a recovery code, which immediately enrols a new passkey and burns the code. Rate-limit to 10 attempts per 15 minutes per IP. Session in an HTTP-only, Secure, SameSite=Lax cookie valid 30 days, revoked server-side on logout. Log every sign-in, enrolment and recovery-code use with time, IP and user agent. **Remove all password, SMTP, email-code and TOTP code paths and their env vars.** The admin must include a **cover editor** with a live preview, exposing every cover field on the Tenant model: title and subtitle as free text, title size (24–84 px), title opacity (20–100 %), text colour (picker + six presets), subtitle size and opacity, rating-line size, photo veil (0–60 %, flat, no gradient), alignment (left/center) and a show/hide toggle for the rating line, with Reset and Save. A working example of this editor is in `smart360-poteg.html` (slider button at the top right of the cover) — copy its fields, ranges and defaults. The admin must also allow: creating tenants and duplicating an existing tenant including its full category tree; adding, editing, hiding, duplicating and deleting sections, categories and items **at any position**; drag-and-drop reordering at all three levels; moving an item to another category; an optional image field on EVERY item type (text, rules, wifi, tabs included) rendered above the text, multi-image upload with drag-to-reorder, cover selection, automatic WebP resizing to 1200 px and 400 px; per-field translation tabs for SL/EN/IT/DE with fallback to SL; a "Preview as guest" button; and QR code generation (PNG + SVG) for each tenant URL.
>
> **Crawling must be disabled everywhere**: dynamic `app/robots.ts` returning `User-agent: * / Disallow: /` for every subdomain, an `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` header on every response via middleware, and the matching `<meta name="robots">` tag in the root layout. No sitemap. Unpublished tenants return 404.
>
> Seed the database with one demo tenant so the app is usable immediately.

---

## 11. Kaj priložim izvajalcu

- `smart360-melipu.html` — tema Airbnb, delujoč prototip z vsemi zasloni
- `smart360-melipu-sredozemsko.html` — sredozemska tema
- Obe datoteki vsebujeta tudi celotno strukturo vsebin (`CONFIG` in `DATA` na vrhu skripte) — to je natančen opis, kakšne podatke mora znati hraniti baza.
