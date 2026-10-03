# POVZETEK ZA LASTNIKA — snemalnik »Moja tura«

## Rezultat

Popravek je v razvojnem okolju. Agent ni sprožil objave.
Produkcijski ogled je potrdil javno hrvaško naslovnico pri 390 × 844,
ne lastnikovega lokalnega zapisa iz prejšnjega dne.

- Ob zagonu aplikacije se počistijo zaključeni posnetki, tudi free-tour.
- Nov zaključeni rezultat ostane samo v trenutnem pogledu, ne v trajni shrambi.
- Zapiranje, odhod iz pogleda ali menjava kategorije odstrani zaključeni povzetek.
- Aktivna in začasno ustavljena snemanja preživijo ponovno nalaganje.
- Menjava kategorije ne prekine aktivnega snemanja.
- Brez aktivnega snemanja ali povzetka se prikaže Start.
- Zapiranje je nad povzetkom, pred sliko, ne na dnu dolge vsebine.
- Pod 50 m velja isto pravilo kot pri vodenih turah: opozorilo, brez povzetka,
  nov Start. Pri natanko 50 m se povzetek prikaže.

## Preverjanje

TypeScript preverjanje uspešno; 59 ciljnih testov uspešnih.
Brskalniški preizkus uporablja dejanske komponente vodnika in snemalnika ter
sintetične lokalne zapise v ločenem DEV prikazu. Nobenih zapisov v bazo.

Potrjeno:
1. Star zaključen zapis → ponovno nalaganje → počiščen zapis in nov Start.
2. Veljaven aktiven zapis 120 m → ponovno nalaganje → ostane aktiven.
3. Ročno ustavljen zapis 120 m → ponovno nalaganje → ostane ustavljen,
   z možnostjo nadaljevanja in zaključka.
4. Dejanski klik Zaključi → povzetek → Zapri → nov Start.
5. Dejanski klik Zaključi → ponovno nalaganje → nov Start.
6. Zaključi → Domov → Okolica → nov Start.
7. Zaključi → druga kategorija → nazaj → nov Start.
8. Aktivno snemanje → druga kategorija → nazaj → ostane aktivno.
9. 49,9 m → opozorilo in Start; 50 m → povzetek.

## Meritve zapiranja pri 390 × 844

V vseh sedmih jezikih: širina 326 px, višina 48,5 px, x=32 px.
Gumb je v celoti v vidnem delu brez pomikanja povzetka.
Preverjanje elementFromPoint na sredini zadene dejanski gumb.
Širina dokumenta je v vseh primerih 390 px.

| Jezik | Zgornji rob gumba |
|---|---:|
| sl | 288 px |
| en | 271 px |
| de | 271 px |
| it | 271 px |
| fr | 271 px |
| nl | 271 px |
| hr | 271 px |

Zajemi brskalniškega preverjanja:
- HR povzetek: y372bi; HR nov Start: e37m83.
- SL povzetek: xlewla; SL nov Start: vz88d5.
- Kratko snemanje: 28c9nu; meja 50 m: himh78.

## Omejitve

To ni preizkus na fizičnem iPhonu. WebGL2 v testnem brskalniku ni bil na voljo,
dovoljenje za geolokacijo pa je bilo zavrnjeno; uporabljeni so sintetični GPS
podatki. Življenjski cikel in kontrole so bili preverjeni, terenski GPS,
izris zemljevida na iPhonu in domače deljenje pa niso predmet tega dokaza.
V DEV prikazu obstajajo nespremenjena vsebinska imena kategorij iz hrvaške
projekcije; preverjeni gumbi snemalnika uporabljajo izbrani jezik.