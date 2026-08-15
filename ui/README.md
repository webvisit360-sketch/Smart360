# Smart360 · sredozemski UI paket — OBVEZNO ZA UPORABO

Ta mapa je **končan dizajn**, ne predlog. Aplikacija mora izgledati točno tako.
Uporablja se **samo sredozemska tema**. Druge teme ni.

## Datoteke

| Datoteka | Kaj je | Kako se uporabi |
|---|---|---|
| `smart360-sredozemski.css` | celoten slog aplikacije | vključi ga **v celoti in nespremenjenega** |
| `zasloni.html` | točna oznaka (markup) za vsak tip zaslona | prepiši strukturo v komponente |
| `ikone-sprite.svg` | vse ikone | vstavi na začetek `<body>`, uporabljaj `<use href="#i-…">` |

Odpri `zasloni.html` v brskalniku pri širini 390 px — to je videz, ki ga je treba doseči.

## Pravila, ki jih ni dovoljeno kršiti

1. **Ne piši novega CSS.** Uporabi razrede iz priložene datoteke. Če komponenta manjka, jo sestavi iz obstoječih razredov.
2. **Ne uporabljaj knjižnice komponent** (shadcn, MUI, Chakra, Bootstrap, DaisyUI). Nobene.
3. **Ne uporabljaj Tailwind pomožnih razredov za videz.** Če je Tailwind v projektu, samo za postavitev — nikoli za barve, sence, robove in tipografijo.
4. **Barve so točno določene:**
   - akcent `#3B78DC` (Google modra, potemnjena za 10 %), spodnji rob gumbov `#2E60B0`
   - besedilo `#14201F`, sekundarno `#6B7876`, črte `#E8E4DD`
   - topla podlaga blokov `#F6F1E9`, opečnata samo za zvezdico ocene in oznako priporočila `#C4552E`
   - **nič pastelnih krogov, nič vijolične, roza, zelene ali oranžne**
5. **Brez prelivov** (`linear-gradient`). Čisti rezi, polne barve.
6. **Ikone so samo obris**, debelina 1.8, brez barvne podlage. Uporabi sprite — ne emojijev, ne ikonske knjižnice, ne barvnih krogov okoli ikon.
7. **Pisava:** Figtree (CSS jo naloži sam), naslovi 800, `letter-spacing` negativen kot v CSS.
8. **Nobenih zloženk (accordion).** Kategorija je **svoja stran**, ne razpiralnik na domači strani.
9. **Nobenih besedil o stanju izdelave** v vmesniku (npr. »Postavitev še ni optimizirana«). Če česa ni, se ne prikaže nič.
10. **Gumbi imajo 3D podstavo** — `box-shadow: 0 4px 0 <temnejša>` in ob dotiku `translateY(4px)`. To ni okras, to je del dizajna.

## Struktura domače strani (po vrsti od zgoraj)

1. `appbar` — logotip 40×40 z radijem 14, ime nastanitve z manjšim naslovom pod njim, desno okrogel gumb za jezik na peščeni podlagi
2. `hero` — fotografija, radij 28, višina 290; zgoraj levo bela pilula »360° sprehod«, zgoraj desno bel krog s srčkom, spodaj namig »Povlecite za razgled«
3. `tcard` — **bela kartica, ki se s –26 px prekriva čez fotografijo**; v njej naslov 24 px, vrstica z oceno in peščeno iskalno polje
4. »Kaj vas zanima?« — **štiri velike kartice s fotografijami** (`.big` + `.bc`), vsaka s temnim prekrivom, belo ikono v kotu in naslovom spodaj
5. Vrstica hitrih bližnjic (`.qk`) — WiFi, Prijava, Pot do nas, Bazen, Nujna pomoč
6. »Priljubljeno pri gostih« in »Za danes« — **vodoravni vrstici kartic** (`.hrow` + `.hcard`), slika 158×112, pod njo naslov in cena
7. »Vaša nastanitev« — seznam vrstic z ločilnimi črtami (`.list` + `.row`), ikone modre
8. »Storitve v bližini« — dva stolpca ploščic (`.svcs` + `.svc`)
9. Kartica gostitelja na peščeni podlagi z modrim 3D gumbom
10. `tabbar` — pet postavk, aktivna modra

## Podstran

`navbar` (nazaj + iskanje, oba okrogla na peščeni podlagi) → `lead` (naslov 24 px + število vnosov) → `chips` (sosednje kategorije, aktivna polna modra) → kartice.

**Kartica lokala** (`.card`): uokvirjena, radij 26, fotografija 16:10 brez zaobljenih vogalov znotraj okvirja, srček v belem krogu, pod fotografijo `card__body` z naslovom 17 px, pilulo stanja, vrsticami `info` (ura, telefon, splet), po potrebi blokom `tip` z avatarjem gostitelja, na dnu ozek gumb za klic in poln moder gumb »Navigacija«.

## Kako preveriš, da je prav

Postavi `zasloni.html` in svojo stran eno ob drugo pri 390 px. Če se karkoli razlikuje — razmik, velikost pisave, barva, oblika gumba, radij — je narobe tvoja stran, ne referenca.
