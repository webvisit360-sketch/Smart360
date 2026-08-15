# Smart360 · UI paket — OBVEZNO ZA UPORABO

Ta mapa je **končan dizajn**, ne predlog. Aplikacija mora izgledati točno tako.
Vsebuje **dve temi**, med katerima se izbira **v administraciji za vsako nastanitev posebej**.

## Datoteke

| Datoteka | Kaj je |
|---|---|
| `tema-sredozemska.css` | celoten slog teme **sredozemska** (navpično drsenje, spodnja navigacija) |
| `tema-poteg.css` | celoten slog teme **poteg** (vodoravni zasloni, brez spodnje navigacije) |
| `zasloni-sredozemska.html` | točna oznaka za vsak tip zaslona v sredozemski temi |
| `zasloni-poteg.html` | točna oznaka za naslovnico, sekcijske zaslone, podrobnosti in urejevalnik |
| `urejevalnik-naslovnice.md` | polja, meje, privzete vrednosti in prenos na CSS spremenljivke |
| `ikone-sprite.svg` | vse ikone — vstavi na začetek `<body>`, uporabljaj `<use href="#i-…">` |
| `predogled-sredozemska.html` | delujoč predogled teme |
| `predogled-poteg.html` | delujoč predogled teme (vključno z urejevalnikom naslovnice) |

Odpri predogleda v brskalniku pri širini 390 px — to je videz, ki ga je treba doseči.

## Izbira teme

Polje `Tenant.theme` z vrednostma `mediterran` in `swipe`. Naloži se **samo ena** datoteka CSS, glede na temo. V administraciji je to izbirnik z dvema možnostma in kratkim opisom.

## Pravila, ki jih ni dovoljeno kršiti (za obe temi)

1. **Ne piši novega CSS.** Uporabi razrede iz priloženih datotek. Če komponenta manjka, jo sestavi iz obstoječih razredov.
2. **Ne uporabljaj knjižnice komponent** (shadcn, MUI, Chakra, Bootstrap, DaisyUI). Nobene.
3. **Ne uporabljaj Tailwind pomožnih razredov za videz.** Če je Tailwind v projektu, samo za postavitev.
4. **Barve so točno določene:** akcent `#3B78DC`, spodnji rob gumbov `#2E60B0`, besedilo `#14201F`, sekundarno `#6B7876`, črte `#E8E4DD`, topla podlaga `#F6F1E9`, opečnata `#C4552E`. Nič pastelnih krogov, nič vijolične, roza, zelene ali oranžne.
5. **Brez prelivov** (`linear-gradient`). Čisti rezi, polne barve.
6. **Ikone samo obris**, debelina 1.8, iz priloženega sprite-a. Ne emojiji, ne ikonska knjižnica, ne barvni krogi okoli ikon.
7. **Pisava:** Figtree, naslovi 800, negativen `letter-spacing` kot v CSS.
8. **Nobenih zloženk (accordion).** Kategorija je svoja stran.
9. **Nobenih besedil o stanju izdelave** v vmesniku.
10. **Prehod miške (hover):** beli in obrobljeni gumbi se obarvajo polno modro z belim besedilom, ob izhodu miške nazaj v belo; vrstice in iskalnik dobijo mehko modro `#EAF1FC`; modri gumbi potemnijo. Vse je v CSS pod `@media (hover:hover) and (pointer:fine)` — **ne odstranjuj tega pogoja**.
11. **Vsa vsebina na podstraneh je v okvirju `.card`** — tudi navadno besedilo, pravila, WiFi in zavihki. Vzorec: `.card` → neobvezna fotografija (`.card__ph` ali `.gal`) → `.card__body`.
12. **Fotografija je vedno nad besedilom**, nikoli pod ali ob njem.
13. **Gumbi imajo 3D podstavo** — `box-shadow: 0 4px 0 <temnejša>`, ob dotiku `translateY(4px)`.

## Tema SREDOZEMSKA — struktura

`appbar` → `hero` (radij 28, višina 290, bela pilula »360°«, srček, namig) → `tcard` (bela kartica, ki se s –26 px prekriva čez fotografijo; naslov 24 px, vrstica z oceno, peščeno iskalno polje) → »Kaj vas zanima?« s štirimi velikimi foto-karticami (`.big`/`.bc`) → vrstica hitrih bližnjic (`.qk`) → dve vodoravni vrstici kartic (`.hrow`/`.hcard`) → seznam »Vaša nastanitev« (`.list`/`.row`) → ploščice »Storitve« (`.svcs`/`.svc`) → kartica gostitelja → `tabbar`.

Podstran: `navbar` → `lead` → `chips` → kartice.

## Tema POTEG — struktura

- `.app` → `.pager` (vodoravni `scroll-snap`, `scroll-snap-stop: always`) → zaporedje `.screen`, vsak `100%` širine in `100dvh` višine
- **Prvi `.screen` je naslovnica:** `.cover` s fotografijo ali `<iframe>` 3DVista čez cel zaslon, enakomeren temen film `.cover__veil`, zgoraj logotip in okrogli gumbi, spodaj `.cover__txt` z naslovom, podnaslovom in vrstico z oceno, pod njim namig »Povlecite levo«
- Sledijo sekcijski zasloni (`.sc`): števec, velik naslov, podnaslov, nato mreža foto-kartic (`.grid2`/`.gc`) ali seznam (`.rowlist`/`.row`)
- Zadnji zaslon je kontakt
- **Pikice** (`.dots`) na dnu kažejo položaj in so klikljive; na naslovnici so bele (`.on-dark`)
- **Nobenih puščic levo/desno** — premikanje samo s potegom, pikicami in tipkovnico
- **Podrobnosti** so `#detail` overlay, ki se prismuka z desne in ima **svoj vodoravni pager** (`.dpager`/`.dscreen`): s potegom se premikaš med kategorijami iste sekcije, zgoraj so čipi za neposreden skok. Vsebina se polni sproti (trenutni zaslon in soseda), ne vsa naenkrat.
- Spodnje navigacije v tej temi **ni** (`.tabbar{display:none}`)

## Urejevalnik naslovnice

Glej `urejevalnik-naslovnice.md`. Deluje v obeh temah — v sredozemski nastavlja naslov v `tcard`, v temi poteg naslov na naslovnici.

## Kako preveriš, da je prav

Postavi ustrezen predogled in svojo stran eno ob drugo pri 390 px. Če se karkoli razlikuje — razmik, velikost pisave, barva, oblika gumba, radij — je narobe tvoja stran, ne referenca.
