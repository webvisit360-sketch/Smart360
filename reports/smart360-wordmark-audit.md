# Pregled besednega znaka SMART360 — površine zunaj e-pošte

Izvorni pregled: `artifacts/smart360/src`, `artifacts/api-server/src`, `artifacts/mockup-sandbox/src`, uporabljene CSS-datoteke ter izvorni prototipi. E-poštni renderji, njihova kontrola in štirje predogledi so posebej popisani v `reports/smart360-email-lockup-audit.md`. Izvorne `attached_assets` prototipe, predhodne izvoze pod `reports/`, generirane `dist` datoteke, navadno besedilo v opisih/metapodatkih/imenih podjetja in logotipe najemnikov ločujemo od *prikazanega besednega znaka*. Ni bilo objave ali pošiljanja e-pošte.

| Prikaz in izvor | Pred spremembo: barva; pisava, teža, razmik | Po spremembi |
| --- | --- | --- |
| Prijava gostitelja »Portal za gostitelje« (`artifacts/smart360/src/pages/admin/login.tsx`, `login.css`) | Odobren obrisani SVG iz `attached_assets/Smart360-prijava_1787872268224.html`: **#121A14**; črke so SVG poti, zato brez preverljivega CSS fonta/teže/razmika | Originalni znak + `BrandLockup`: **#121A14; Archivo 800; 0.02em**, bela podlaga |
| Operaterski stranski meni (`artifacts/smart360/src/components/admin/admin-sidebar-brand.tsx`, `vite.config.ts`) | Uvoženi SVG iz `attached_assets/admin-2030_7_1788039435751.html`: **#121A14**; obrisane poti, brez določljivega runtime CSS fonta/razmika | `BrandLockup`: **#121A14; Archivo 800; 0.02em**, bela podlaga; arhivski SVG ni več uporabljen |
| Povpraševanje (`artifacts/smart360/src/pages/enquiry.tsx`) | SVG iz `attached_assets/Smart360-povprasevanje_1_1787894314826.html`: **#121A14**; obrisane poti, brez določljivega runtime CSS fonta/razmika | `BrandLockup`: **#121A14; Archivo 800; 0.02em**, bela podlaga |
| Račun gostitelja in mobilna zgornja vrstica admina (`artifacts/smart360/src/components/admin/admin-layout.tsx`, obe mesti) | Modra rastrska datoteka `logo-smart360-moder.png`: **#3B78DC**; brez preverljive pisave/teže/razmika | `BrandLockup`: **#121A14; Archivo 800; 0.02em**, bela podlaga |
| Uvodni gostov zaslon (`artifacts/smart360/src/App.tsx`, `src/index.css`) | Isti modri raster kot CSS maska na ozadju **#121A14**; oblika iz bitmapa, brez določljive pisave/teže/razmika | Živo besedilo: **#121A14; Archivo 800; 0.02em**, bela podlaga |
| Pristajalna stran v gradnji (`artifacts/smart360/src/pages/landing.tsx`, `src/index.css`) | Bitmap maska obarvana **#121A14**; brez določljive pisave/teže/razmika | Živo besedilo: **#121A14; Archivo 800; 0.02em**, bela podlaga |
| Rezervni naslov pristajalne strani (`artifacts/smart360/src/pages/landing.tsx`) | `text-primary`: **#157347**; podedovana Archivo, `font-bold` **700**, `tracking-tight` **−0.025em** | **#121A14; Archivo 800; 0.02em** |
| Povabilo in ponastavitev gesla gostitelja (`artifacts/smart360/src/pages/portal/password-token-page.tsx`, ista predloga za obe poti) | `text-primary`: **#157347**; podedovana Archivo, `font-extrabold` **800**, privzeti razmik **normal** | **#121A14; Archivo 800; 0.02em** |
| Aktivni prototip admina (`artifacts/mockup-sandbox/src/components/mockups/smart360-admin-current/Current.tsx`, `_group.css`) | Modra `hsl(217 69% 54%)`; **Outfit 800**, razmik **−1.8px** | **#121A14; Archivo 800; 0.02em**, bela podlaga; Archivo je vključen v pisave prototipa |
| Starejša A6 nalepka z besednim znakom (`artifacts/api-server/src/routes/adminTenants.ts`) | Obrisani sprite iz `src/lib/wordmark.ts`: **#3B78DC**; font ni določen, razmik ni določen | Vdelana `assets/Archivo-800.ttf`: **#121A14; Archivo 800; razmik 0.02 × velikost pisave**; položaj pred QR-kodo in velikost strani ostajata |
| Gostiteljev obrazec (`artifacts/smart360/src/pages/host/onboarding.tsx`) | **#121A14; Archivo 800; 0.02em**, na belem ozadju | **Nespremenjeno, že skladno** |

Skupni `BrandLockup` je v `artifacts/smart360/src/components/brand-lockup.tsx`. Uporablja uradni, večbarvni `brand/smart360-znak-40.png` brez spreminjanja barv in dejansko brskalniško pisavo Archivo; ne uporablja nekdanjega modrega bitmapa. Gostov recovery zaslon prikazuje le uradni znak, ne besednega znaka. Besedilo »Vodnik ustvarja Smart360« je opis, ne logotip. Samostojni izvorni sprite `src/lib/wordmark.ts` je star arhivski izvoz; po tej spremembi se ne uporablja za tisk.

## Preverjanje v brskalniku in PDF

- Posnetek dejanske razvojne strani `/admin/login`: `reports/smart360-login-cgp-header.jpg` (950 × 760 px). Brez prijave.
- Computed-style pregled dejanskega elementa `.smart-login__logo span`: `textContent=SMART360`, `font-family=Archivo, sans-serif`, `font-weight=800`, `font-size=26px`, `letter-spacing=0.52px` (= 0.02em), `color=rgb(18, 26, 20)` (= #121A14); ozadje nadrejenega logotipa `rgb(255, 255, 255)` (= #FFFFFF); `document.fonts.status=loaded` in `document.fonts.check('800 26px Archivo', 'SMART360')=true`. Znak ima izvor `/brand/smart360-znak-40.png`.
- Izoliran PDFKit izris istega novega bloka A6 besednega znaka v začasni `/tmp/smart360-wordmark-pdf-layout-qa.pdf`: format 297.638 × 419.528 pt (105 × 148 mm), `pdftotext` prebere **SMART360**, `pdffonts` potrdi vdelan **Archivo-ExtraBold**. Dejanskega avtenticiranega endpointa za A6 nalepko ni mogoče preskusiti brez avtorizacije; vzorčni PDF zato ni dokaz celotne nalepke.
- Namenski PDF QR-nalepke (`artifacts/api-server/src/lib/guideReadyNotice.ts`, `makeReadySticker`) je **nedotaknjen**; ne vsebuje znaka.
- `pnpm --filter @workspace/smart360 typecheck`, `pnpm --filter @workspace/api-server typecheck`, `pnpm --filter @workspace/mockup-sandbox typecheck` in `git diff --check` uspešni.

## Trajno zapisano pravilo

V `replit.md`, ob obstoječih pravilih za znak in obravnavo tihih napak, je dodano natanko:

> Pravilo CGP: Znak vedno izvira iz originalnih uradnih datotek, vedno stoji na beli podlagi in ga nikoli ne prerisujemo, prebarvamo ali približno poustvarimo. Besedni znak »SMART360« je vedno Archivo 800, barve #121A14, z razmikom med črkami 0.02em. Zelena #157347 je poudarna barva in se nikoli ne uporablja za znak ali besedni znak. V e-pošti je celoten logotip (znak + besedni znak) vedno ena vnaprej izrisana slika v retina ločljivosti, nikoli besedilo HTML.