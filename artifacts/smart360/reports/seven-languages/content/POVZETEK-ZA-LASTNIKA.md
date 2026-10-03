# POVZETEK ZA LASTNIKA

## Rezultat

Pripravljene so štiri popolne SQL datoteke za lastniško produkcijsko konzolo.
Agent jih NI izvedel v produkciji in NI sprožil objave.
Vsebujejo samo INSERT manjkajočih osnutkov fr/nl/hr; ON CONFLICT DO NOTHING
ohrani tudi obstoječe prazne vrstice. Obvestila in objavljeni posnetki niso spremenjeni.

| Nastanitev | FR | NL | HR | Skupaj |
|---|---:|---:|---:|---:|
| meli-pu | 295 | 295 | 295 | 885 |
| camping-menina | 49 | 49 | 49 | 147 |
| kamp-savinja | 191 | 191 | 191 | 573 |
| turizem-drobez | 192 | 192 | 192 | 576 |

Skupaj: 2.181 novih prevodnih vrstic, 727 na jezik.
Prevedeni so obstoječi naslovi, oznake kategorij, opisi, alineje, opombe
in enote cen, vključno s skrito aktivno vsebino. Izbrisana vsebina ni vključena.
Lastna imena se lahko namenoma pojavijo enaka v vseh jezikih.

## Izpuščena polja

- meli-pu: 718 praznih polj brez slovenskega in angleškega vira; 3 polja z angleškim virom. Popoln seznam: meli-pu-skipped.json.
- camping-menina: 5 praznih polj brez slovenskega in angleškega vira; 0 polja z angleškim virom. Popoln seznam: camping-menina-skipped.json.
- kamp-savinja: 441 praznih polj brez slovenskega in angleškega vira; 0 polja z angleškim virom. Popoln seznam: kamp-savinja-skipped.json.
- turizem-drobez: 440 praznih polj brez slovenskega in angleškega vira; 0 polja z angleškim virom. Popoln seznam: turizem-drobez-skipped.json.

- Obstoječih fr/nl/hr vrstic ob izvozu: 0. SQL jih ob kasnejšem trčenju ohrani.
- MENINA nima aktivnih vnosov; njene prazne kategorije so prevedene, novih vnosov ni.
- V vseh štirih nastanitvah ni izpolnjenih eventSchedule.locationText/ageText (Termin)
  ali producerNote. Praznih vrednosti nismo izmišljali; vključene so v sezname izpustov.
- Pri Meli Pu je bilo iz obsega izločenih 47 starih angleških odstavčnih aliasov:
  niso manjkajoča polja, temveč podvojitve obstoječega slovenskega HTML-opisa.
  Končni obseg je 295 polj/jezik, ne začetnih 342.
- Trije angleški viri Meli Pu so: naslov Entrance gate in opisa dveh apartmajev.
- Naslovi URL, koordinate, ure, cene, trajanje, razdalje in geometrija GPX niso prevajani.

## Varovalke in dokazila

- Produkcija je bila samo brana. production-before-after.json vsebuje enake kontrolne
  vsote pred/po delu za slovenski izvor, vse vrstice sl/en/de/it in objavljeni posnetek.
- Slovenščina je praviloma v izvornih tabelah: nič vrstic lang=sl NE pomeni nič
  slovenskega besedila. Varuje jo dodatna kontrolna vsota source.
- Vsaka SQL datoteka pred vnosom preveri te kontrolne vsote, nato še enkrat po njem.
  Če so se spremenile, transakcija odpove brez vnosa; datoteko je treba osvežiti.
- SQL uporablja kratke tabelne zaklepe (čakanje največ 10 s, izvedba največ 60 s).
  Izvedite eno datoteko naenkrat; ob napaki ne odstranjujte varovalk.
- Obstoječi produkcijski sprožilec sam označi osnutek kot spremenjen/operatorjev
  in posodobi njegov čas. To je pričakovan stranski učinek INSERT, ne objava.
- DEV: štiri nove neobjavljene kopije, nove identitete, brez računov in gesel.
  Dodanih 2.181 novih prevodov poleg 2.133 nespremenjenih starih prevodov.
  Ponovljeni INSERT je dodal 0 vrstic. Prejšnji DEV prevodi so ostali enaki.
- Produkcijske datoteke so bile preverjene tudi na DEV kopijah, z zamenjanimi
  identitetami in DEV kontrolnimi vsotami: vsaka je dodala 0 vrstic ob ponovitvi
  in ohranila zaščitene kontrolne vsote. To NI produkcijska izvedba.
- 454 enoličnih izvornih besedil × 3 jeziki je prestalo avtomatsko preverjanje
  nepraznih prevodov ter enakih oznak HTML, prelomov in predlog. Celovit strokovni
  človeški jezikovni pregled vseh besedil ni bil izveden.
- Backend TypeScript preverjanje je uspešno.

## Vrstni red

1. Lastnik izvede štiri .sql datoteke v produkcijski SQL konzoli, vsako v celoti.
   Pri nespremenjenem stanju so pričakovani vnosi 885 / 147 / 573 / 576.
   Ponovitev pred spremembami izvorov/objav doda 0 vrstic.
2. Preveri se, da je objavljena različica kode s podporo sedmim jezikom.
   Če še ni, jo lastnik objavi posebej; ta dostava objave ne sproži.
3. Lastnik posebej pregleda osnutek vsake nastanitve in potrdi objavo njene vsebine.
   Sam SQL in sama objava kode ne nadomestita te potrditve.

Produkcijska baza že sprejema oznake fr/nl/hr: lang je text brez jezikovnega CHECK
ali enum. Zato SQL ne potrebuje predhodne objave kode ali spremembe sheme.
Živi javni zahtevek za Drobež z ?lang=fr je vrnil HTTP 200, a stari posnetek še
vsebuje štiri jezike in slovenske naslove. HTTP 200 torej ni dokaz objavljenih
francoskih vsebinskih prevodov.

## Omejitve slikovnih dokazil

Slike so DEV dokazi resničnih komponent Living Guide z gostujočimi projekcijami
novih neobjavljenih DEV kopij, ne produkcijske slike in ne dokaz prijave.
Samostojni DEV prikaz bere te projekcije iz datotek; normalna avtentikacija in
transport gostujočega API-ja nista predmet tega preverjanja.
Kopije vsebujejo le odobreni izbor stolpcev; ne dokazujejo celotne vizualne
identičnosti produkciji (npr. barve, razdalje, obvestila in vreme).
Vreme, obvestila ter naročanje niso bili ustvarjeni ali preizkušeni.
Morebitna preostala slovenska besedila vmesnika niso del SQL vsebinskih prevodov.

## Kontrolne vsote


### meli-pu

Pred = po:

- slovenski izvor: `f720aac9c9afc8caf977936e233c9241`
- de: 319 vrstic, `6639da12f3abcbd81a88f56c27536cea`
- en: 319 vrstic, `ee375855963f8822ce894d387caf1b30`
- it: 319 vrstic, `0757f4b6b6b7c81c01384b6dc7a4ef09`
- sl: 0 vrstic, `d751713988987e9331980363e24189ce`
- objavljeni posnetek: `76e458bdd697fe1c698b99953eef3fe2`

### camping-menina

Pred = po:

- slovenski izvor: `16b14bbc4268e603da32f5ec6ef899f7`
- de: 34 vrstic, `5589809ba8ec3460b3027eb31b60a2e8`
- en: 34 vrstic, `d5a49eedb99098fbbe3f149c3675436a`
- it: 34 vrstic, `439eb1b31e4616be5cc0210532821b54`
- sl: 0 vrstic, `d751713988987e9331980363e24189ce`
- objavljeni posnetek: `06a2df7455d21e659ccc321ed334ee6a`

### kamp-savinja

Pred = po:

- slovenski izvor: `3ce51c033e19d9e14b7f36ca03c74281`
- de: 179 vrstic, `dfe39a6ebb2775bd3d208f7317252cf9`
- en: 179 vrstic, `1139924a14019723ea0510ed13fb26ba`
- it: 179 vrstic, `ef4d9715f0c50e7cf4d6a1e560d9e5d9`
- sl: 0 vrstic, `d751713988987e9331980363e24189ce`
- objavljeni posnetek: `cf08a09d6e0915f6d0911b91bea9c327`

### turizem-drobez

Pred = po:

- slovenski izvor: `2301243fd1f7dca0f8b433bba4aa0b98`
- de: 179 vrstic, `cd7f78d4c8735325ace84b6ac2d20af0`
- en: 179 vrstic, `e9160702d61ae590b56c6b1cf9b287c2`
- it: 179 vrstic, `b4d99aad0890b4ea35882f12b8d0274f`
- sl: 0 vrstic, `d751713988987e9331980363e24189ce`
- objavljeni posnetek: `67423b4c08b90780e2af80b31b50fdfb`

## Brskalniško preverjanje

Preverjeno pri 390 × 844: vsebinski prevodi v podrobnostih, ponudbi in turi so vidni.
Izmerjena širina dokumenta je 390 px (brez vodoravnega prelivanja).
Hrvaški opis ture je širok 350 px v 350 px vsebniku. Daljši hišni red se pomika.

| Jezik | Domov | Hišni red | Ponudba jajc | Tura |
|---|---|---|---|---|
| FR | 2p7b74 | xpmtg4 | i7numn | popravljena slika tour-fr.jpg |
| NL | pdwcx5 | yyzkn3 | cicgjp | decd36 |
| HR | 6bzqv0 | ni8xaz | tjc6pq | lxn2ze |

Prvi francoski prikaz ture (9onxnt) je pokazal napačno tujo besedo.
Popravljena je v dostavljenem SQL in v datotečnem DEV slikovnem prikazu.
POMEMBNO: dve že vstavljeni DEV vrstici (Savinjin in Drobežev francoski opis
iste ture) še vsebujeta staro napako. Nista bili UPDATE-ani, ker je odobritev
omejena na INSERT. Aktualna francoska slikovna projekcija zato vsebuje en
izrecno označen popravek v pomnilniku, ne ponovnega branja popravljenega DB zapisa.
Produkcijski zapisi teh prevodov še ne obstajajo; produkcijski SQL je popravljen.

Ločena napaka vmesnika: »Vodnik ustvarja Smart360« je na Domov še slovensko.
V tem posegu je nismo spreminjali. Zemljevid GPX v testnem brskalniku ni deloval
zaradi nedostopnega WebGL2; geolokacija je ostala v čakanju. Besedilo ture je vidno.
Avtentikacija, normalni gostujoči API, objava in zagon ture niso bili dokazani.