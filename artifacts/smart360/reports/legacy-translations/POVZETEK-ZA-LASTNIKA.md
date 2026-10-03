# POVZETEK ZA LASTNIKA

## Rezultat

Pripravljene so štiri samostojne SQL datoteke za lastnikovo izvedbo s psql.
Produkcija je bila samo brana. Agent ni izvedel produkcijskih zapisov in ni sprožil objave.
Skupaj 267 novih osnutkov: 89 en, 89 de in 89 it. Vir je izključno izvorno slovensko polje; brez angleškega nadomestnega vira.
Obvestila niso vključena. Vse obstoječe vrstice, tudi prazne in zastarele, so ohranjene.

| Nastanitev | Slovenska polja | EN: obstoječa / nova | DE: obstoječa / nova | IT: obstoječa / nova | Skupaj novih |
|---|---:|---:|---:|---:|---:|
| meli-pu | 292 | 268 / 24 | 268 / 24 | 268 / 24 | 72 |
| camping-menina | 49 | 33 / 16 | 33 / 16 | 33 / 16 | 48 |
| kamp-savinja | 191 | 167 / 24 | 167 / 24 | 167 / 24 | 72 |
| turizem-drobez | 192 | 167 / 25 | 167 / 25 | 167 / 25 | 75 |

Obstoječa v tej tabeli pomeni vrstico za trenutni izvorni ključ, ne vseh zgodovinskih prevodnih vrstic.
Skupne števce vseh vrstic po jezikih vsebuje manifest.json; vključujejo tudi stare ključe in izbrisano vsebino.
MENINA ima 34 obstoječih vrstic na stari jezik, vendar le 33 pripada sedanjim 49 poljem. Zato potrebuje 16 novih na jezik.

## Zastarele vrstice — brez sprememb

| Nastanitev | Zastarele EN/DE/IT za trenutna polja | Vse zastarele EN/DE/IT, tudi stari ključi |
|---|---|---|
| meli-pu | 30/30/30 | 81/81/81 |
| camping-menina | 0/0/0 | 0/0/0 |
| kamp-savinja | 1/1/1 | 13/13/13 |
| turizem-drobez | 1/1/1 | 13/13/13 |

Popolni seznami so v datotekah <nastanitev>-stale.json: jezik, model, record_id, polje, obstoječi prevod, trenutni vir in oznaka inCurrentSource.
Zastarelost je ugotovljena iz shranjene oznake stale, ki jo uporablja admin; časovnega ali pomenskega odstopanja brez te oznake ne ugibamo.
Ločena seznama source-empty in existing-blank po nastanitvi pojasnita izpuščene vire in zaščitene prazne prevode.

## Pričakovani števci vseh šestih zavihkov

| Nastanitev | EN | DE | IT | FR | NL | HR |
|---|---|---|---|---|---|---|
| meli-pu | 292/292 | 292/292 | 292/292 | 292/292 | 292/292 | 292/292 |
| camping-menina | 49/49 | 49/49 | 49/49 | 49/49 | 49/49 | 49/49 |
| kamp-savinja | 191/191 | 191/191 | 191/191 | 191/191 | 191/191 | 191/191 |
| turizem-drobez | 192/192 | 192/192 | 192/192 | 192/192 | 192/192 | 192/192 |

Admin šteje prisotne vrstice, tudi zastarele; poln števec zato ne pomeni, da so zastareli prevodi osveženi. Njihove oznake ostanejo.
Meli Pu ima 292 trenutnih slovenskih polj. Prejšnjih 295 je vključevalo tri polja z angleškim nadomestnim virom; ta niso predmet te dostave.
FR/NL/HR so bili ob tem produkcijskem branju že prisotni za vsa trenutna polja; ta paket jih ne spreminja.
Števci so preverjeni s trenutnim seznamom ključev admina na DEV kopijah in s produkcijskim inventarjem, ne s prijavljenim produkcijskim brskalnikom.

## Varovalke

- Ena transakcija na datoteko, INSERT-only in ON CONFLICT DO NOTHING.
- Tabelni zaklepi varujejo preverjanje pred sočasnimi spremembami. Čakanje na zaklep največ 10 s, izvajanje stavka največ 60 s.
- Kontrolna vsota izvora, vseh obstoječih prevodnih vrstic vseh jezikov (vključno z izbrisanimi potomci) in celotnih vrstic objavljenih posnetkov.
- Predhodna in naknadna kontrola; vsako odstopanje prekine transakcijo.
- Varno ponavljanje dovoljuje le nove ključe tega paketa z enako vrednostjo in stale=false. Drugačne vmes dodane vrstice povzročijo prekinitev, nikoli prepisovanja.
- Preverjeno je tudi, da so po vnosu vsi predvideni prevodi prisotni in nespremenjeni.
- NOTICE navede dejansko število vstavljenih vrstic in potrdi kontrolne vsote ter varno ponovitev.
- Obstoječi sprožilec lahko označi osnutek kot spremenjen/operatorjev in posodobi njegov čas. To ni objava ali sprememba posnetka.

## DEV dokazi

| Nastanitev | Prva izvedba | Druga izvedba | Zaščitene kontrolne vsote |
|---|---:|---:|---|
| meli-pu | 72 | 0 | enake |
| camping-menina | 48 | 0 | enake |
| kamp-savinja | 72 | 0 | enake |
| turizem-drobez | 75 | 0 | enake |

Izvedene so bile dostavljene datoteke s prilagojenimi identitetami in DEV osnovnimi kontrolnimi vsotami na neobjavljenih dokaznih kopijah.
Uporabljen je PostgreSQL odjemalec na eni povezavi na datoteko, ne Replitov SQL urejevalnik.
Vsi predhodno obstoječi DEV prevodi so bili primerjani pred/po in ostali enaki. Druga izvedba ni dodala ničesar.
Negativni preizkus z namerno napačno pričakovano kontrolno vsoto je prekinil vsako datoteko brez sprememb prevodov.
Ponovno produkcijsko branje po pripravi ima enake kontrolne vsote izvora, vseh prevodov in posnetkov kot začetni izvoz.
Preverjenih je 56 enoličnih izvornih besedil × 3 jeziki: oznake HTML, prelomi, zaščiteni nadomestni znaki, številke in nepraznost.
Imena in naslovi v namenskih poljih so ohranjeni dobesedno. Vse besedilo ni bilo neodvisno pregledano s strani človeškega prevajalca.

## Izvedba za lastnika

1. V lupini uporabite že delujočo varno produkcijsko povezavo. Povezovalnega niza ne lepite v poročila ali klepet.
2. Za vsako datoteko posebej: psql -X -v ON_ERROR_STOP=1 -f <datoteka.sql>.
   Ukaz predpostavlja, da vaša obstoječa nastavitev psql že izbere pravo produkcijsko bazo; brez nje ga ne izvajajte.
3. Vrstni red: meli-pu.sql (72), camping-menina.sql (48), kamp-savinja.sql (72), turizem-drobez.sql (75).
4. Ob napaki se ustavite. Ne odstranjujte varovalk, ne izvajajte po kosih in ne popravljajte kontrolnih vsot na roko.
5. Varna ponovitev ob nespremenjenem zaščitenem stanju doda 0. Po spremembi izvora, obstoječih prevodov ali objavi je potrebna nova priprava.
6. Lastnik pregleda osnutke; objava vsake nastanitve ostaja ločena lastnikova odločitev.

SQL sam ne objavi ničesar. Agent se po dostavi ustavi.

## Osnovne kontrolne vsote

### meli-pu

- source: `f720aac9c9afc8caf977936e233c9241`
- snapshots: `3e43a8734677de29bb724d4f96d21d18`
- translations: `53774d5d1c0faf8b0b9d34e0039d5d7f`
- SHA-256 datoteke: `d3675354cc9237da5115afac5697b558696924c836e0f45db1c26d947feebf32`

### camping-menina

- source: `16b14bbc4268e603da32f5ec6ef899f7`
- snapshots: `25ed9cc963f5858a9faac8f19ecf953d`
- translations: `6a94e31321750f24bbbd082f3fc03c6e`
- SHA-256 datoteke: `9e5c4429b3dc5f63e81b58887863a0a845e6d32c9cc3345e17d507406a675be9`

### kamp-savinja

- source: `3ce51c033e19d9e14b7f36ca03c74281`
- snapshots: `8b7c7bf8c70a767a4cf375120767f840`
- translations: `ecb53764f3784906d72f0f2683b7be08`
- SHA-256 datoteke: `3574e3d084a1fffbbc5fca3cb37590f6f164da21f22cf4c39b21b29bac583a6b`

### turizem-drobez

- source: `2301243fd1f7dca0f8b433bba4aa0b98`
- snapshots: `31e394f9e89e7c18bf040821ae5ad9b0`
- translations: `2a32ac934bd36c2fcb6cd38e445f7693`
- SHA-256 datoteke: `ca2d65a32e99e7dcbe941079a07657aa7128e34090913fb1f140c33cc857193c`
