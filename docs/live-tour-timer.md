# POVZETEK ZA LASTNIKA — merjenje ture

Izvedeno v razvoju. Agent ni sprožil objave. Brez sprememb strežnika, sheme ali novih storitev.

## Funkcije

- Ob GPX zemljevidu je »Začni turo«; prikaz neto časa, premorov, skupnega časa in dejanske zabeležene razdalje.
- Samodejni premor po 20 sekundah zaznanega mirovanja. Kandidat za mirovanje uporablja 12 m in natančnost meritve; nadaljevanje zahteva dobro meritev zunaj 30-metrskega kroga. Meritve z natančnostjo slabšo od 30 m ne sprožijo nadaljevanja.
- Ročni premor/nadaljevanje, zaključek, rezultat ter PNG in GPX prenosa. Ročni premor ne snema položajev/razdalje. Samodejni premor ustavi čas; kakovostni premiki še vedno prispevajo k razdalji.
- Stanje se hrani lokalno z varovanim localStorage. Obnova je najboljši možni poskus, ne jamstvo ob onemogočenem/polnem pomnilniku. Prekinitve GPS, ponovni zagon in ročno nadaljevanje ne narišejo izmišljene povezave med odseki.
- Celozaslonski zemljevid ohrani isti MapLibre zemljevid in prikazuje neto čas, premore ter Wake Lock stanje. Uporabljen je obstoječi OpenFreeMap, brez novega vira ploščic.
- Vsebina je prevedena v SL/EN/DE/IT prek običajnih oznak.

## Wake Lock

Ko je zaklep dejansko pridobljen: »Zaslon ostaja med turo budén.«

Če API manjka ali ponovni prevzem ne uspe, so prikazana navodila za iPhone/iPad, Android oziroma splošna navodila za druge naprave. Ni povezav do sistemskih nastavitev. Ob odhodu zavihka v ozadje se zaklep sprosti; ob vrnitvi aktivna tura samodejno poskusi znova. Zaključek zaklep sprosti, tudi če je zahteva ob zaključku še v teku.

## Zasebnost in izvoz

Položaji, časi in rezultat se obdelujejo samo na napravi; ni novega API-ja ali pošiljanja teh podatkov na strežnik. Brskalnik še vedno nalaga običajne zemljevidne ploščice obstoječega ponudnika.

PNG vsebuje povzetek in **shematski prikaz načrtovane ter zabeležene poti**, ne rastrskega posnetka zemljevidnih ploščic. Ta razlika je označena tudi na sliki v izbranem jeziku. GPX vsebuje lastne zabeležene točke, časovne oznake in ločene odseke, ne kopije načrtovane poti.

## Dokazi

- 22 ciljnih testov uspešnih, 0 neuspešnih; preverjanje tipov uspešno.
- Simulirani brskalniški tok: začetek → premik → mirovanje → samodejni premor → zavrnjena nenatančna meritev → nadaljevanje → zaključek.
- Pri 40 s: **17 s neto + 23 s premora = 40 s; 60 m**.
- PNG je uspešno prenesen in ima veljavno PNG glavo; GPX je veljaven XML s tremi lastnimi zabeleženimi točkami.
- Preverjeni so ročni premor/nadaljevanje, obnova zaključenega rezultata po reloadu, indikator pridobljenega zaklepa, sprostitev v ozadju in ponovni prevzem ob vrnitvi.
- Brskalniško preverjen splošni prikaz brez Wake Lock API-ja; iOS/Android besedili in neuspel ponovni prevzem so pokriti z avtomatiziranimi testi. To ni preizkus dejanskih iOS/Android sistemskih nastavitev.
- Oddaljeni testni brskalnik nima WebGL2. Ločen lokalni Chromium s SwiftShader je prikazal dejansko geografijo in uspešno prejel OpenFreeMap vektorske ploščice (HTTP 200).
- Posnetki `screenshots/live-tour-entry-webgl.png`, `screenshots/live-tour-fullscreen-webgl.png`, `screenshots/live-tour-result-webgl.png` prikazujejo dejansko komponento s **sintetično razvojno potjo**, ne produkcijske nastanitve. Celozaslonski zemljevid in canvas sta izmerjena na 390 × 844 px.

## Kaj ostaja odvisno od resnične naprave

GPS šum na terenu, poraba baterije, varčevanje z energijo, zavrnitve Wake Locka s strani sistema in delovanje v ozadju zahtevajo zunanji preizkus na telefonu. Spletna stran ne more zagotoviti neprekinjenega GPS snemanja v ozadju. Brez sveže dobre meritve se neto čas po največ 30 sekundah ne povečuje več; skupni čas ostaja stenski čas. Manjkajočih delov poti ne izmišljamo.

**Brez objave.**