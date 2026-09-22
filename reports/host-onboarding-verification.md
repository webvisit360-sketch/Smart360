# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.# Obrazec za gostitelja — razvojno preverjanje

Datum: 22. september 2026. Preverjanje je potekalo samo v razvojnem okolju.
Nič ni bilo objavljeno. Produkcijskih računov ali podatkov nismo spreminjali.

## Izvedeno

- Aktivacija novega gostitelja prek dobrodošlice pripravi obrazec. Prijava ga
  odpira do oddaje; naslednja prijava po oddaji odpre običajno administracijo.
  Obstoječi gostitelji brez obrazca niso samodejno preusmerjeni.
- Vseh šest sklopov, slovenska besedila, ponovljive kontaktne osebe, ponudba,
  priporočila, dogodki in fotografije.
- Samodejno strežniško shranjevanje s preverjanjem revizije in zaporednim
  izvajanjem zahtev. Shranjuje se tudi besedilo v novi vrstici pred klikom
  na »Dodaj«. Izrecno shranjevanje ostane na obrazcu.
- Sedemnajst kategorij priporočil se bere iz skupnega ogrodja vodnika.
  Vključene so trgovine, pekarne, bencinski servisi, bankomati, lekarne in
  zdravstvo. Dogodki imajo ločen vnos datuma in ure.
- Oddaja dopolni prazna polja osnutka. Obstoječe vrednosti ostanejo nedotaknjene,
  gostiteljeve alternative pa so prikazane operaterju kot predlogi.
- Spletna stran in kontaktne osebe se obravnavajo ločeno. Skupno prosto besedilo
  hišnega reda in parkiranja se prenese dobesedno v oba prazna cilja oziroma
  shrani kot predlog ob zasedenem cilju; dejstev ne razčlenjujemo ali izmišljamo.
- Priporočila vstopijo v obstoječo čakalno vrsto Kreatorja kot nerazrešena,
  z izbrano kategorijo in izvorom »vnesel gostitelj prek obrazca«.
  Isto ime v različnih kategorijah ohrani obe uvrstitvi.
- Dogodki se shranijo kot predlogi z nespremenjenima datumom in uro.
- Fotografije so zasebno shranjene za pregled, ne v medijih vodnika.
  Omejitev je 20 fotografij; priporočilo 10–20 ni obvezno, saj jih je dovoljeno
  dodati pozneje. Preverimo dejanske slikovne podatke in odstranimo metapodatke.
  Preverjena slika uporablja drug ključ kot podpisani naslov za nalaganje,
  zato je po potrditvi ni mogoče prepisati prek prvotnega naslova.
- Operater ima v nastavitvah nastanitve zavihek »Obrazec za gostitelja«:
  pregled brez urejanja, primerjave vrednosti, dogodke, fotografije, stanje
  obvestila, zgodovino krogov in ponovno odprtje.
- Obvestilo se vedno pošlje na info@webvisit360.com prek obstoječega neposrednega
  pošiljanja Resend. Kanal nastanitve se za to obvestilo ne uporablja.

## Preverjeno v brskalniku in prek API-ja

| Preverjanje | Rezultat |
|---|---|
| Aktivacija prek prave strani s povabilom, običajna prijava | Prva prijava odpre obrazec |
| Vnos vseh sklopov, izrecno shranjevanje, odjava in prijava | Podatki in fotografija ostanejo shranjeni |
| Nova kontaktna oseba, ponudba, priporočilo in dogodek brez klika na »Dodaj« | Vsi štirje vnosi se samodejno shranijo; po ponovni prijavi vsak obstaja natanko enkrat |
| Prva oddaja | Prikazano zahtevano zahvalno sporočilo |
| Ponovitev oddaje s celotnimi podatki | Vrne že obstoječo oddajo brez podvajanja |
| Ponovitev samo z `{round: 1}`, ko že obstaja drugi krog | HTTP 200, `alreadySubmitted: true`; prvi krog v celoti nespremenjen |
| Ponovna običajna prijava po oddaji | Odpre običajno administracijo |
| Operaterjev pregled | Obstoječa naziv in telefon ohranjena; alternative vidne; prazni cilji dopolnjeni kot osnutki |
| Kreator | Sedem predlogov; pravilne kategorije in izvor; enako ime ohranjeno posebej v trgovinah in pekarnah |
| Dogodek | Točno `2026-12-15` in `18:30`, brez premika datuma ali ure |
| Fotografija | Naložena in vidna v pregledu; anonimni dostop 401, napačna nastanitev 404 |
| E-pošta | Ponudnik je sprejel eno testno obvestilo; stanje »Poslano« vidno operaterju |
| Ponovno odprtje in ponovitev istega odprtja | Oba odgovora vrneta isti drugi krog; število krogov ostane dve |
| Javni podatki | Celoten objavljeni posnetek in vseh pet posebej primerjanih polj ostanejo nespremenjeni |

Prejema v dejanski e-poštni nabiralnik nismo preverjali; potrjena sta sprejem
pri ponudniku in shranjeno stanje pošiljanja. Drugi krog ni bil oddan.

## Končne vizualne meritve

Mobilni obrazec je preverjen pri 390 × 844, operaterjev pregled pri 1440 × 900.

- Razmik od uradnega znaka/besednega logotipa do naslova: **48 px**.
- Pisava: **Archivo**, besedilo v poljih **16 px**.
- Kartice: **#F4F6F2**, običajni rob **#E8EBE6**, polmer **16 px**.
- Kartica okolice: **2 px**, **#157347**.
- Brez vodoravnega prelivanja: končno `scrollWidth = clientWidth = 390`.
- Polja dogodka ostanejo znotraj zaslona; območje za fotografijo je mogoče
  v celoti pomakniti nad spodnja gumba.
- Končno začetno stanje pravilno kaže »Osnutek shranjen«.

Končni meritvi in sliki:

- `reports/host-onboarding-final-style-metrics.json`
- `reports/screenshots/host-onboarding-mobile-header.png`
- `reports/screenshots/host-onboarding-mobile-explore.png`

Modra obvestilna pasica na slikah je del razvojnega predogleda platforme,
ne uporabniškega obrazca.

## Tehnično preverjanje in omejitve dokazov

- Preverjanje tipov celotnega projekta uspešno; po zadnjih popravkih je ponovno
  uspešno tudi preverjanje tipov uporabniškega vmesnika.
- Uspešnih 12 usmerjenih testov obrazca/Kreatorja in 79 obstoječih testov
  uporabniškega vmesnika.
- Širši strežniški paket je vrnil 36 uspehov in 2 neuspešna rezultata:
  en neuspešen podtest in njegov nadrejeni test. Gre za običajno urejanje
  postavke gostitelja v nespremenjeni poti `adminContent`, ne za oddajo obrazca.
  Poizvedba uporablja `FOR UPDATE` na `creator_place_materializations`,
  medtem ko ima vloga gostitelja pravico SELECT, ne UPDATE. Tega ločenega
  problema nismo prikrili ali širili dovoljenj za njegovo odpravo.
- Prvotna testna nastanitev je imela 41-mestni identifikator v URL-ju, gostov
  prikaz pa sprejme največ 40 znakov. Zato je njen vgrajeni vizualni predogled
  kazal 404. To je omejitev testnih podatkov, ne sprememba gostovega prikaza.
  Nespremenjenost celotnega objavljenega posnetka in javnih podatkov je
  neodvisno potrjena. Generator prihodnjih testnih podatkov je popravljen;
  obstoječega posnetka zaradi ohranitve dokazov nismo spreminjali.

## Baza in varnost

Dodane so bile samo tri nove razvojne tabele za kroge obrazca, fotografije
in predloge dogodkov, skupaj z njihovimi indeksi in omejitvami dostopa.
Ni bilo migracije obstoječih tabel ali dopolnjevanja obstoječih podatkov.
Nove tabele so vključene v obstoječi zagonski seznam dovoljenj gostitelja;
pravi dostop gostitelja je preverjen tudi po ponovnem zagonu.

## Odstranitev testnih podatkov

Potrjeno po zaključenem preverjanju:

- odstranjena ena testna nastanitev;
- odstranjen en začasni račun gostitelja;
- odstranjena začasna operaterjeva seja in povezane gostiteljeve seje;
- odstranjena testna fotografija;
- **nič preostalih vrstic testnih podatkov**;
- nekdanja gostiteljeva in operaterjeva seja pri zaščitenem dostopu vrneta **401**;
- zasebna začasna datoteka s testnimi prijavnimi podatki je odstranjena.

Resničnih operaterjevih prijavnih podatkov nismo zahtevali, brali ali spreminjali.
Dokaz odstranitve: `reports/host-onboarding-cleanup.json`.

## Končno stanje

Funkcija je izdelana in preverjena v razvoju. Ni objavljena.
Objavljanje ostaja izključno v obstoječem operaterjevem postopku.