# Varnostna faza 2 — razvoj, brez objave

## Končna matrika dostopa

| Področje | Prej (faza 1) | Zdaj (faza 2) |
| --- | --- | --- |
| Vnosi (CRUD, premiki, vrstni red, podvojitev, koš/obnova), njihova predstavnost (slika/video, izrez), GPX in pregled razdalj | Gostitelj za lastno nastanitev | Gostitelj za lastno nastanitev |
| Naročila (status/opomba), odgovori na sporočila, prevodi lastne vsebine, Wi-Fi, kontaktni podatki in nastavitve obvestil/gesla naročil | Gostitelj za lastno nastanitev | Gostitelj za lastno nastanitev |
| Lastno geslo, QR PNG/PDF, predogled objave, dnevnik sprememb | Gostitelj za lastno nastanitev | Gostitelj za lastno nastanitev (predogled/dnevnik le branje) |
| Ločen onboarding: shranitev in oddaja obrazca, strukturirana polja ter obrazcem ustvarjene kategorije | Gostitelj skozi obrazec | **Izjema ostaja**: gostitelj samo skozi obrazec; ne daje pravice do splošnega urejanja strukture/identitete |
| Razdelki, kategorije, skupine/zavihki: ustvarjanje, preimenovanje, vidnost, razporeditev, brisanje/obnova | Gostitelj je lahko urejal svojo strukturo | **Samo operater** |
| Videz, tema/UI, barve, tipografija, naslovnica, logotip, hero sliki, tour/video URL, tlorisi/lokacijske slike | Gostitelj je lahko urejal svoje nastavitve | **Samo operater** |
| Jezikovni seznam, Living Guide navigacija; ime, podnaslov, naslov, zemljevid in koordinate (vse poti) | Gostitelj je lahko urejal lastno identiteto | **Samo operater** |
| Objava/umik vodnika | Gostiteljeva objava je bila pogojno dovoljena | **Vedno operater**; gostitelju 403: »Objavo vodnika opravi Smart360 — sporočite nam, ko so spremembe pripravljene.« |
| Prej omejene zmožnosti (Creator, lastniški računi, vzdrževanje, trajni izbris) | Samo operater | Samo operater |

Vir stalnega pravila za prihodnji razvoj: `replit.md`. Nov endpoint ali polje dobi izrecno odločitev v centralnem `actorGate`, tudi če UI kontrola ni vidna; zavrnitev ne sme beležiti zavrnjenih vrednosti. Tuja nastanitev ostaja 404.

## Regresije in meje dokazovanja

`artifacts/api-server/src/tests/phase2-keep-regressions.test.ts` uporablja resnične Express obdelovalnike, zaupanja vrednega v procesu injiciranega akterja `createAdminGateForTests`, RLS in odstranljiva razvojna najemnika. Brez računa/seje operaterja in brez DDL. Preizkusi preverjajo 403 za posamezna novo omejena polja z mešano zahtevo in brez delnega zapisa, kontrolno pot operaterja skozi isti endpoint, 404 za tujega najemnika, gostiteljeve nastavitve in osnovne CRUD/premik/podvojitev/koš/obnovo vnosov, dodajanje/izrez/vrstni red/odstranitev medija, prevod, bralne poti in **dejanski onboarding save + submit**. Za »prevedi manjkajoče« se kliče obdelovalnik z že prevedenimi štirimi jeziki: rezultat je prazen, klic plačljivega modela se ne zgodi.

Za GPX nalaganje/zamenjavo/odstranitev, multipart sliko/video (in video vrstni red), pregled predlogov razdalje, spremembo statusa/opombe naročila in odgovor v neobstoječi niti so vključene **le kontrolne poti skozi vrata** z neveljavnim/neobstoječim virom; te same **ne dokazujejo uspešne dostave ali celotnega življenjskega cikla**. Vnos medija prek URL in njegov izrez/vrstni red/odstranitev pa dejansko uporablja handler in bazo. Dodatni obstoječi integracijski testi (`gpx-integration.test.ts`, `distance-review.test.ts`, `orders.test.ts`, `messages.test.ts`, `concurrent-upload.test.ts`) pokrivajo domensko obnašanje ločeno; ne pripisujte jim dokazovanja nove avtorizacije, če ne uporabljajo teh vrat. Noben test ne kliče dejanskega prevajalskega modela. Pred objavo je potreben ločen pregled izvršenih testov in neodvisna odločitev operaterja; ta dokument ne pomeni objave.

Zastarela pričakovanja v `authorization-gate-phase1.test.ts` (ime, razdelki, slug/customDomain) in `host-access.test.ts` (ime, struktura, slug/customDomain) so usklajena z zavrnitvami 403; pozitivne kontrole operaterja in gostiteljevega Wi-Fi/vnosa ostanejo. Opt-in `operator-publication-db.test.ts` preverja objavo in umik: gostitelj dobi 403 z natančnim slovenskim sporočilom; dejanska operaterska objava deluje. Test ne kliče funkcij, ki nameščajo DB shemo/sprožilce.

**Izvedba v razvoju (po združitvi strežniških sprememb):**

| Nabor | Rezultat | Dokazuje |
| --- | --- | --- |
| `phase2-keep-regressions`, `phase2-permissions`, `authorization-gate-phase1`, `host-access`, `operator-publication-db` (brez opt-in) | **17 uspešnih, 0 neuspešnih, 2 preskočena** | Osrednja vrata, 403/404, pozitivne operaterske in gostiteljeve poti, dejanski onboarding; opt-in publikacijska DB testa sta tukaj preskočena |
| `SMART360_OPERATOR_DRAFT_DB_TEST=1 ... operator-publication-db.test.ts` | **2 uspešna, 0 neuspešnih, 0 preskočenih** | Objava/umik 403 gostitelju, operaterska objava in ohranitev izvora host-onboarding |
| `gpx-integration`, `distance-review`, `orders`, `messages`, `concurrent-upload` | **229 uspešnih, 0 neuspešnih, 0 preskočenih** | Domenski tokovi, vključno z dejanskim GPX in obdelavo naročil/sporočil, ločeno od vseh phase-2 avtorizacijskih preverjanj |

Testi so izvedeni samo v razvoju; to ni dokaz produkcijskega delovanja ali objava.

## Vmesnik in odprte meje preverjanja

Gostitelju so operaterske kontrole skrite oziroma nadomeščene z umirjenim pojasnilom. Samodejno shranjevanje pošilja samo dovoljena polja Wi-Fi, kontaktov, obvestil in gesla naročil. Ustvarjanje gostiteljskih vnosov v Okolici uporablja običajen vnos, ne operaterskega ustvarjanja krajev. Posamezni prevodi ostanejo dostopni; uvoz/izvoz prevodov ostaneta samo operaterju.

Frontend: **12/12 ciljnih testov uspešnih**, preverjanji tipov frontenda in API-ja uspešni. Širši frontend nabor ni v celoti zelen: ostajata dve napaki nalaganja modula `lucide-react/dynamicIconImports` v Node testih (`content-editor-helpers`, `empty-category-row`). Ne navajamo uspeha celotne zbirke.

Brskalniški preizkus prijavljenega gostitelja ni bil zaključen: prvi poskus s testnim mostom je obstal pri nalaganju, drugi prek prave prijave pa v opazovanem času ni zaključil zahteve. V strežniškem dnevniku ustrezne zaključene POST zahteve ni bilo; zato to ni potrjena regresija prijavnega obdelovalnika. Neposredna zahteva na razvojni `/api/admin/host/login` z neobstoječim računom je vrnila pričakovani 401 v približno 0,23 s. Prijavna stran je vizualno preverjena, spremenjeni prijavljeni zasloni in njihove mobilne meritve pa **niso potrjeni z brskalnikom**. Začasni gostiteljski podatki so odstranjeni.

Shema ni bila razširjena ali spremenjena. Produkcijske operacije in objava niso bile izvedene.