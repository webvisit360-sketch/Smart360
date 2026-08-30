# Kreator vodnika — specifikacija

Operaterjevo orodje. V gostiteljevi konzoli ga ni in ga po izgradnji ne bo.

**Kaj počne:** iz enega naslova pripravi vodnik do približno treh četrtin,
**preden se gostitelj prvič prijavi.** Ko se prijavi, vodnik že stoji in
manjkajo samo njegove stvari.

**Zakaj tako:** gostitelj, ki ga prosiš, naj sestavi seznam znamenitosti, ga
sestavlja mesec dni ali nikoli. Vzpostavitvena cena je poštena prav zato, ker
tega ne zahtevamo.

---

## Sedem korakov

Koraki se lahko opravijo v poljubnem vrstnem redu in se nadaljujejo pozneje.
Vsak pokaže svoje stanje: **urejeno**, **N čaka**, **ni obvezno**.

**1 · Osnovni podatki**
Ime, naslov, tip namestitve, izhodiščna točka.

**2 · Vaša nastanitev**
Gostiteljevo gradivo. Ta korak Kreator **ne izpolnjuje** — čaka na gostitelja
ali na naš ročni vnos.

**3 · Potrdite okolico**
Srce Kreatorja. Podroben opis spodaj.

**4 · Ponudba in naročila**
Izdelki, storitve, oprema za najem. Gostiteljevo.

**5 · Program in obvestila**
Dogodki in obvestila. Ni obvezno.

**6 · Videz vodnika**
Naslovnica, logotip, barve.

**7 · Objava in QR**
Pripravljenost, objava, nalepke.

---

## Tretji korak — kako nastane okolica

Tri stopnje, in vsaka ima svojo nalogo. Nobena ne dela tistega, kar zna
druga.

### Model predlaga

Jezikovni model dobi: **koordinati izhodišča**, **tip namestitve**, **obstoječi
nabor kategorij**, **pravila sloga** in **tri obsege** iz razdelka spodaj.

Vrne naj **okoli šestdeset predlogov** — raje preveč kot premalo. Za vsakega:

- ime kraja,
- kategorijo iz obstoječega nabora, ali predlog nove z utemeljitvijo,
- opis v slovenščini, v hišnem slogu,
- prevode v angleščino, nemščino in italijanščino,
- iskalni niz za geokodiranje (ime + kraj + država).

### Geokodirnik je sito

Vsak predlog gre skozi Nominatim, ki v aplikaciji že obstaja.

**Kar se ne razreši v resničen kraj, ne obstaja.** Pade ven — a ne tiho:
ostane na seznamu *ni bilo mogoče potrditi*, da se vidi, koliko jih je bilo in
zakaj.

Sito presoja **obstoj**, ne primernosti. Razdalja ga ne zanima, razen ene
grobe varovalke: kar se razreši dlje kot **120 km zračne črte**, ni daleč,
ampak drugje, in gre med *ni bilo mogoče potrditi*. Ta številka ni uredniška
in se ne uporablja za odločanje, kaj sodi v vodnik.

---

## Trije obsegi — in zakaj kilometri niso enota

**Odločeno 30. 8.** En polmer 15 km je bil napaka. To niso trije slabo
nastavljeni polmeri, ampak tri različne stvari, ki se merijo vsaka po svoje.

**1 · Praktično** — bankomat, trgovina, lekarna, bencin, zdravnik, pošta.
Enota ni razdalja, ampak **vrstni red**: prikaže se **najbližjih tri do pet**,
ne glede na oddaljenost, z izpisano razdaljo. Gost ne išče vseh bankomatov v
okolici; išče najbližjega. V Ljubljani bo 300 m, v Solčavi 12 km — oboje je
pravilen odgovor na isto vprašanje. Opisov tu ne pišemo.

**2 · Bližnja okolica** — restavracije, kopališča, sprehodi, igrišča; kar se
da narediti nocoj brez načrta. Enota je **čas vožnje: do 20 minut.** V
Ljubljani je to okoli 8 km, v Zgornji Savinjski okoli 20 km, in za gosta je
to isto doživetje. Kilometri se pri tem vprašanju zlomijo, minute ne.

**3 · Izleti in znamenitosti** — načrtovan dan. **Do 90 minut vožnje.**
Postojnska jama je 69 km in 55 minut od Izole; Bled je 75 km in dobrih 70
minut od Menine. Oboje sodi noter. Dlje samo, kadar gre res za vrhunsko
točko in človek to potrdi.

Časi so **OSRM**, ne modelovi. Obsegi ne zavračajo ničesar — **razvrščajo in
označujejo**. Zavrne lahko samo sito (kraja ni) ali človek (kraj ne sodi).

Nobenega stikala mesto/podeželje ni. Vrstni red in minute se prilagodita sama;
stikalo bi nekdo nekoč nastavil narobe in nihče ne bi opazil.

### Usmerjevalnik da razdaljo

OSRM izračuna cestno razdaljo in čas od izhodišča. **Model teh številk ne
sme dati nikoli.**

### Človek potrdi

Kar preživi, gre v vrsto — tisti **»N čaka«**, ki je bil v Kreatorju predviden
od začetka. Vsak predlog pokaže ime, razrešeni naslov, razdaljo, čas,
kategorijo in opis, z dejanji **Potrdi**, **Uredi**, **Zavrni**.

Nepotrjena lokacija se gostu **ne prikaže**.

**Zavrnjeni se zapomnijo.** Ponovni zagon tretjega koraka ne sme znova
predlagati tistega, kar si že zavrnil.

---

## Pravilo o modelu

> **Model sme predlagati in pisati. Nikoli ne sme biti vir dejstva, ki ga zna
> preveriti stroj.**

**Sme:** imena krajev, kategorije, opise, prevode.

**Ne sme:** koordinat, razdalj, časov vožnje, odpiralnih časov, cen,
telefonskih številk, naslovov.

Razlog: model piše enako tekoče, kadar ve in kadar ne ve. Razlike na besedilu
ni videti. Gost, ki se odpelje do muzeja, ki ne obstaja, ne krivi Smart360 —
krivi hišo.

In pravilo, ki velja od začetka in tu ne popusti: **o gostinstvu, trgovinah,
lekarnah, bencinskih servisih in zdravstvu ne pišemo opisov.** Ime, razdalja,
odpiralni čas. Ti podatki se prehitro spreminjajo, da bi zanje jamčili.

---

## Kategorije

Model sme predlagati nove — **Alpinizem**, **Kajtanje**, **Terme**, **Vinske
ceste** — kadar so za tisti kraj upravičene. Vodnik v Bovcu ni vodnik v Izoli.

Tri varovala:

**Najprej obstoječe.** Model dobi cel nabor in vsak predlog najprej razvrsti
vanj. Novo predlaga šele, ko pove, zakaj nobena obstoječa ne ustreza.

**Vsaj trije kraji.** Kategorija z eno kartico je v vodniku videti kot napaka.
Če je alpinizem en sam plezalni vrt, gre pod Aktivnosti.

**V skupni nabor, ne k eni stranki.** Sicer nastanejo *Kajtanje*, *Kitanje* in
*Zmajarjenje* pri treh strankah, zbirka krajev pa istega kraja ne zna povezati.

Vsaka nova kategorija potrebuje **ime v štirih jezikih** in **ikono iz
obstoječega nabora** — model izbira, ne izmišlja.

Kar ustvari gostitelj sam, ostane njegovo in v skupni nabor ne gre.

---

## En kraj, en zapis

Kraj, ki sodi v dve kategoriji, je **en zapis z dvema pripadnostima**, ne dva
zapisa.

To ni podrobnost. Pri Meli Pu je uvoz podvojil Motovun, Portopiccolo in Grad
Miramare — vsak dvojnik je dobil svojo razdaljo, in ko popraviš enega, drugi
ostane napačen in neviden.

Kreator mora to preprečiti od začetka.

---

## Fotografije

**Iz Google Maps ne.** Tiste slike so avtorsko delo uporabnikov in Googla in v
plačljivem izdelku nimajo kaj iskati — tudi ne začasno, ker začasna slika, ki jo
kdo pozabi, postane trajna.

**Wikimedia Commons da**, kjer obstaja prosta fotografija z navedbo avtorja.

**Kjer je ni**, naj bo kartica brez slike — z ikono kategorije in oznako
*fotografija manjka*. Grdo namenoma: tako gostitelj vidi, kaj mora poslati.

Vsaka nadomestna slika mora biti **v podatkih označena kot začasna**, da
Kreator lahko pove, koliko jih je še, preden gre vodnik v objavo.

---

## Prevodi

Vsak potrjen kraj mora imeti ime, kategorijo in opis v **slovenščini,
angleščini, nemščini in italijanščini**. Model jih napiše ob predlogu, ne
naknadno.

Manjkajoč prevod se gostu ne skrije — vidi izvirnik. Zastarel prevod se mu **ne
prikaže**; o tem je odločitev že sprejeta.

---

## Kdaj je tretji korak končan

Ko je **»N čaka« enak nič** in nobena lokacija ni več nepotrjena.

Ne takrat, ko je model končal. Ne takrat, ko so razdalje izračunane. Šele
takrat, ko je vsako lokacijo pogledal človek.

---

Smart360 · smart360hq@gmail.com
