# PART 5 — Stage 1b Row-Level Write Plan

**Generated:** 2026-08-22 08:13:04 CEST  
**Status:** PLAN ONLY — no database write, code change, schema change, deployment, setting change, or backup/restore operation has been performed.  
**Scope:** production tenant `meli-pu` only. This snapshot is invalid if any pre-apply hash or old value changes.

## Approval boundary

This ledger contains exactly the owner-authorized content sync: 37 category keys, 9 order flags, width and height for 131 shared media records, 3 complete media-row inserts, and 2 media-row removals. Operational tables, dev-only tenants, storage objects, recipient/password settings, translations, plural forms, and orders are excluded.

## Snapshot fingerprints — mandatory pre-apply compare-and-swap gate

| Surface | Development | Production |
|---|---:|---:|
| Schema | 287 / `f9d423308dcae235d5f4cc6a7fd0629a` | 287 / `f9d423308dcae235d5f4cc6a7fd0629a` |
| categories | 37 / `6ec36fdc5e276e354f6a939539a711fc` | 37 / `bd0cce5e43c91f734f8185918e23e4b7` |
| items | 136 / `dcdf0e96a1787d64fda35716a5173afa` | 136 / `54a66a2bff47cdaaeeba54f44bd94f39` |
| media | 134 / `5f576ae9b973c02dc9d8a29c69c54814` | 133 / `87a1a47094045f81cf8c9fbe135150d0` |

## Mutation totals

| Mutation category | Affected rows | Ledger field lines |
|---|---:|---:|
| Category key updates | 37 | 37 |
| Item order-enabled updates | 9 | 9 |
| Shared-media dimension updates | 131 | 262 |
| Media inserts | 3 | 39 |
| Media-row removals | 2 | 2 |
| **Total** | **182 logical row operations** | **349 ledger lines** |

## Totals by guest-content category

| Category | Keys | Order flags | Dimension fields | Insert rows / fields | Row removals | Total ledger lines |
|---|---:|---:|---:|---:|---:|---:|
| Aktivnosti | 1 | 0 | 18 | 0 / 0 | 0 | 19 |
| Apartmaji | 1 | 0 | 40 | 0 / 0 | 0 | 41 |
| Bankomati | 1 | 0 | 8 | 0 / 0 | 0 | 9 |
| Bazen | 1 | 0 | 0 | 1 / 13 | 0 | 14 |
| Bencinske črpalke | 1 | 0 | 8 | 0 / 0 | 0 | 9 |
| Bolnišnica | 1 | 0 | 2 | 0 / 0 | 0 | 3 |
| Dobrodošli | 1 | 0 | 4 | 0 / 0 | 0 | 5 |
| Dogodki | 1 | 0 | 6 | 0 / 0 | 0 | 7 |
| Družabne igre | 1 | 0 | 2 | 0 / 0 | 0 | 3 |
| Hišni red | 1 | 0 | 0 | 0 / 0 | 0 | 1 |
| Izleti | 1 | 0 | 12 | 0 / 0 | 0 | 13 |
| Kolesarjenje | 1 | 0 | 10 | 0 / 0 | 0 | 11 |
| Kulinarika | 1 | 0 | 14 | 0 / 0 | 0 | 15 |
| Kulturna dediščina | 1 | 0 | 14 | 0 / 0 | 0 | 15 |
| Ladijski prevoz | 1 | 2 | 4 | 0 / 0 | 0 | 7 |
| Lekarne | 1 | 0 | 8 | 0 / 0 | 0 | 9 |
| Lokacija | 1 | 0 | 2 | 0 / 0 | 0 | 3 |
| Naravna dediščina | 1 | 0 | 8 | 0 / 0 | 0 | 9 |
| Navodila za ograjo | 1 | 0 | 4 | 0 / 0 | 0 | 5 |
| Navodila za opremo | 1 | 0 | 2 | 0 / 0 | 0 | 3 |
| Nočno življenje | 1 | 0 | 10 | 0 / 0 | 0 | 11 |
| Oljčno olje | 1 | 1 | 2 | 0 / 0 | 0 | 4 |
| Parkirišče | 1 | 0 | 4 | 0 / 0 | 0 | 5 |
| Pekarne | 1 | 0 | 4 | 0 / 0 | 0 | 5 |
| Picerije | 1 | 0 | 6 | 0 / 0 | 0 | 7 |
| Plaže | 1 | 0 | 16 | 0 / 0 | 0 | 17 |
| Pohodništvo | 1 | 0 | 14 | 0 / 0 | 0 | 15 |
| Prijava / Odjava | 1 | 0 | 0 | 0 / 0 | 0 | 1 |
| SUP deska | 1 | 2 | 2 | 1 / 13 | 1 | 19 |
| Skuter | 1 | 1 | 0 | 1 / 13 | 1 | 16 |
| Sladoled 24/7 | 1 | 0 | 2 | 0 / 0 | 0 | 3 |
| Trgovine | 1 | 0 | 18 | 0 / 0 | 0 | 19 |
| WiFi | 1 | 0 | 0 | 0 / 0 | 0 | 1 |
| Zajtrk | 1 | 0 | 4 | 0 / 0 | 0 | 5 |
| Zunanji fitnes | 1 | 0 | 4 | 0 / 0 | 0 | 5 |
| Čoln s skiperjem | 1 | 3 | 6 | 0 / 0 | 0 | 10 |
| Žar | 1 | 0 | 4 | 0 / 0 | 0 | 5 |

## A. Category keys — 37 approved updates

| Table | Row ID | Field | Old production value | New development value | Label |
|---|---|---|---|---|---|
| categories | `21cb2473-1300-47d4-9384-47a41225c9e5` | key | NULL | sup | SUP deska |
| categories | `4897801f-1a9c-4cd6-a450-cada02eab542` | key | NULL | welcome | Dobrodošli |
| categories | `c6be1fe2-8963-46fc-b78e-a49c89bbf28b` | key | NULL | shops | Trgovine |
| categories | `f65e2b4b-8676-404a-8bb5-a325a3faea87` | key | NULL | breakfast | Zajtrk |
| categories | `976dc2cc-c4a9-4076-b445-8afd89cc478f` | key | NULL | culinary | Kulinarika |
| categories | `c0ede9a5-a37d-4587-a8ab-0faab9074e29` | key | NULL | bakery | Pekarne |
| categories | `cf1244bb-4a02-437f-b3f4-1f41dfe15040` | key | NULL | apart | Apartmaji |
| categories | `de87fe75-9953-41e7-9824-e631033388bf` | key | NULL | scooter | Skuter |
| categories | `28a42bea-ebe9-44f6-a107-f4e24b495069` | key | NULL | night | Nočno življenje |
| categories | `47947381-e1f2-4e15-9a45-2d0808237622` | key | NULL | loc | Lokacija |
| categories | `67a74032-88bb-4fe5-9fef-bbe0a46116af` | key | NULL | gas | Bencinske črpalke |
| categories | `6d19fcf0-98c6-41e5-8bc5-c46fac82a0a0` | key | NULL | fitness | Zunanji fitnes |
| categories | `27ce2c01-15db-45f6-9636-9c45484e165f` | key | NULL | atm | Bankomati |
| categories | `2dc2eca3-bcc9-4100-be3c-e21786ac0395` | key | NULL | pizza | Picerije |
| categories | `3c6acafd-be82-4571-a012-bf96848961a8` | key | NULL | grill | Žar |
| categories | `c55b5370-3c59-43c3-983a-fb0d00af2ecf` | key | NULL | park | Parkirišče |
| categories | `0599e07d-169d-4071-bd27-93bb19a25d79` | key | NULL | pharm | Lekarne |
| categories | `282c13fc-564e-406e-9786-b0193d06396e` | key | NULL | gate | Navodila za ograjo |
| categories | `669a7449-51c6-474a-b4bd-31f806146780` | key | NULL | boat | Čoln s skiperjem |
| categories | `98631274-2c83-42c8-8e75-8be310c5ce1a` | key | NULL | act | Aktivnosti |
| categories | `4d525c41-4a6d-4ab1-8254-0e51b7825f44` | key | NULL | equip | Navodila za opremo |
| categories | `5c319f5a-6a81-4a9a-a3ab-6aec6483b620` | key | NULL | hike | Pohodništvo |
| categories | `73c86a5f-ec98-42d1-af0f-3aff8a515bea` | key | NULL | ferry | Ladijski prevoz |
| categories | `7985d054-9791-44eb-9c9a-0a768e366d24` | key | NULL | hosp | Bolnišnica |
| categories | `71000420-5f94-4ea4-8807-d1798fbdf786` | key | NULL | games | Družabne igre |
| categories | `a585c160-a224-4fa4-8ab0-d68eeff2d0ac` | key | NULL | bike | Kolesarjenje |
| categories | `c5b3b98e-2029-42a2-bbb0-1d5c1d82ae96` | key | NULL | check | Prijava / Odjava |
| categories | `402e6388-1bcc-4f09-94da-7d1f5c927847` | key | NULL | oil | Oljčno olje |
| categories | `67f8a2a3-3822-4639-a408-271a7d3cfe91` | key | NULL | wifi | WiFi |
| categories | `f8941ef0-5321-4265-b161-c34f770154ee` | key | NULL | beach | Plaže |
| categories | `0653c49c-fe0c-4ece-8f14-fc6c2e97ba20` | key | NULL | house | Hišni red |
| categories | `6f4b5883-1171-41d0-b215-46285d12322c` | key | NULL | culture | Kulturna dediščina |
| categories | `7945d7ae-404e-4018-8911-72e77f978eb1` | key | NULL | ice | Sladoled 24/7 |
| categories | `59ca6db5-ee1d-4bca-9b36-76a6f16ae117` | key | NULL | pool | Bazen |
| categories | `d955e77a-ae1d-403c-9d73-da1abdc2fc5f` | key | NULL | nature | Naravna dediščina |
| categories | `cfcb60a5-a705-4246-aec2-8d98b59d08a9` | key | NULL | trips | Izleti |
| categories | `6a56aae7-01b0-41c5-b364-14f0a9ad9e75` | key | NULL | events | Dogodki |

## B. Item order flags — 9 approved updates

| Table | Row ID | Field | Old production value | New development value | Category / item |
|---|---|---|---|---|---|
| items | `4860043d-3db3-4c26-bd6e-714ebfdbe8ce` | order_enabled | false | true | SUP deska / SUP — dnevni najem |
| items | `048efd21-d9ed-45ce-a017-cda9776fd651` | order_enabled | false | true | SUP deska / Najem za 3-4 ure |
| items | `d16868d6-d2c1-4485-9380-b9ebe3c04b40` | order_enabled | false | true | Skuter / Skuter — najem za 3 do 4 ure |
| items | `a1b3f0a4-4d72-4698-ae00-2c975cad3d09` | order_enabled | false | true | Čoln s skiperjem / Izlet s čolnom in skiperjem — 3 ure |
| items | `6617360c-fdc5-455e-9e72-5269106f9a52` | order_enabled | false | true | Čoln s skiperjem / Izlet s čolnom in skiperjem — 5 ur |
| items | `6a4d3a34-8d54-49d4-bd68-8ea31f019edf` | order_enabled | false | true | Čoln s skiperjem / Izlet po dogovoru |
| items | `6856f026-65cc-40c2-8b50-b76bb5d43037` | order_enabled | false | true | Ladijski prevoz / Zlatoperka: Ankaran → Koper |
| items | `f007f8c0-5e32-43b0-b2c7-cdfc49115eb8` | order_enabled | false | true | Ladijski prevoz / Zlatoperka: Koper → Izola → Piran |
| items | `d06aa2f4-ae23-4bd4-8beb-adc590c681a2` | order_enabled | false | true | Oljčno olje / Domače ekološko oljčno olje |

## C. Shared-media dimensions — 262 approved field updates on 131 existing rows

| Table | Row ID | Field | Old production value | New development value | Category / item |
|---|---|---|---|---|---|
| media | `140a93b2-2392-44c4-a01b-4d906937f16b` | width | NULL | 1400 | Zajtrk / Restavracija Kamin |
| media | `140a93b2-2392-44c4-a01b-4d906937f16b` | height | NULL | 771 | Zajtrk / Restavracija Kamin |
| media | `4f65b35c-7ac1-493d-9d93-ff6009ef3853` | width | NULL | 700 | Dobrodošli / Dobrodošli |
| media | `4f65b35c-7ac1-493d-9d93-ff6009ef3853` | height | NULL | 379 | Dobrodošli / Dobrodošli |
| media | `77e1952b-1745-45f3-b41e-b3599b2c519c` | width | NULL | 960 | Trgovine / Mercator |
| media | `77e1952b-1745-45f3-b41e-b3599b2c519c` | height | NULL | 960 | Trgovine / Mercator |
| media | `0ca0fd2b-a6d8-41d8-9f17-2bc103b7ddfe` | width | NULL | 500 | Dobrodošli / Dobrodošli |
| media | `0ca0fd2b-a6d8-41d8-9f17-2bc103b7ddfe` | height | NULL | 492 | Dobrodošli / Dobrodošli |
| media | `86b285b7-d8c2-4e1e-8d55-9959dfdfc986` | width | NULL | 1200 | Trgovine / Hipermarket SPAR |
| media | `86b285b7-d8c2-4e1e-8d55-9959dfdfc986` | height | NULL | 900 | Trgovine / Hipermarket SPAR |
| media | `dc4ebe8a-d932-43c1-97e9-8e9858b4492c` | width | NULL | 1100 | Zajtrk / Cafinho Piran |
| media | `dc4ebe8a-d932-43c1-97e9-8e9858b4492c` | height | NULL | 1100 | Zajtrk / Cafinho Piran |
| media | `f6d2680d-41e7-4851-a858-7f4aa65c2319` | width | NULL | 800 | SUP deska / Najem za 3-4 ure |
| media | `f6d2680d-41e7-4851-a858-7f4aa65c2319` | height | NULL | 800 | SUP deska / Najem za 3-4 ure |
| media | `b03791cb-0a9a-425f-bf5b-b1d33336b520` | width | NULL | 888 | Trgovine / HOFER |
| media | `b03791cb-0a9a-425f-bf5b-b1d33336b520` | height | NULL | 601 | Trgovine / HOFER |
| media | `b0e7fc1e-c389-45f4-b264-1c26fb40ae7f` | width | NULL | 600 | Trgovine / Lidl Portorož |
| media | `b0e7fc1e-c389-45f4-b264-1c26fb40ae7f` | height | NULL | 325 | Trgovine / Lidl Portorož |
| media | `52807332-4f48-41ae-8316-e189828830d3` | width | NULL | 1400 | Trgovine / Tuš supermarket Lucija |
| media | `52807332-4f48-41ae-8316-e189828830d3` | height | NULL | 510 | Trgovine / Tuš supermarket Lucija |
| media | `1f1cc6f5-7004-4fbd-9e37-868a53e6fb4c` | width | NULL | 600 | Trgovine / Eurospin Izola |
| media | `1f1cc6f5-7004-4fbd-9e37-868a53e6fb4c` | height | NULL | 225 | Trgovine / Eurospin Izola |
| media | `0ae0bf9f-8514-4c11-90fd-dcc4e2c72261` | width | NULL | 1400 | Trgovine / Planet Tuš Koper |
| media | `0ae0bf9f-8514-4c11-90fd-dcc4e2c72261` | height | NULL | 1049 | Trgovine / Planet Tuš Koper |
| media | `46c22880-8cc9-418f-a058-c1e8ffd3c7b2` | width | NULL | 1024 | Trgovine / Supernova Koper |
| media | `46c22880-8cc9-418f-a058-c1e8ffd3c7b2` | height | NULL | 683 | Trgovine / Supernova Koper |
| media | `a77d3b69-b873-4efe-8c01-01b7a6d36fea` | width | NULL | 1400 | Trgovine / Palmanova Designer Village |
| media | `a77d3b69-b873-4efe-8c01-01b7a6d36fea` | height | NULL | 788 | Trgovine / Palmanova Designer Village |
| media | `599fcc7d-2019-48fc-94bd-4dc9aded51b1` | width | NULL | 1200 | Pekarne / Pekarna Dan in noč |
| media | `599fcc7d-2019-48fc-94bd-4dc9aded51b1` | height | NULL | 676 | Pekarne / Pekarna Dan in noč |
| media | `fa847f9a-5586-4757-b1bc-ee0004c69b53` | width | NULL | 1181 | Kulinarika / Takamaka Cocktails & Food |
| media | `fa847f9a-5586-4757-b1bc-ee0004c69b53` | height | NULL | 1080 | Kulinarika / Takamaka Cocktails & Food |
| media | `474df897-f37e-431a-a4fc-991c40095588` | width | NULL | 1400 | Apartmaji / Apartma 1 |
| media | `474df897-f37e-431a-a4fc-991c40095588` | height | NULL | 1750 | Apartmaji / Apartma 1 |
| media | `355b5bec-3e5a-4212-8a12-98e41da08327` | width | NULL | 1400 | Apartmaji / Apartma 1 |
| media | `355b5bec-3e5a-4212-8a12-98e41da08327` | height | NULL | 1050 | Apartmaji / Apartma 1 |
| media | `c26fc44f-29f0-4aee-a61b-434fc6638f9b` | width | NULL | 1200 | Apartmaji / Apartma 1 |
| media | `c26fc44f-29f0-4aee-a61b-434fc6638f9b` | height | NULL | 1600 | Apartmaji / Apartma 1 |
| media | `da0ffd73-b578-4720-8570-a59e28c42878` | width | NULL | 1400 | Apartmaji / Apartma 1 |
| media | `da0ffd73-b578-4720-8570-a59e28c42878` | height | NULL | 1050 | Apartmaji / Apartma 1 |
| media | `c33cc565-eddc-4e95-b87a-7a97f831c559` | width | NULL | 1400 | Apartmaji / Apartma 1 |
| media | `c33cc565-eddc-4e95-b87a-7a97f831c559` | height | NULL | 1050 | Apartmaji / Apartma 1 |
| media | `8b48d70f-5940-40f6-b843-b3e35dfb1b4e` | width | NULL | 1400 | Apartmaji / Apartma 1 |
| media | `8b48d70f-5940-40f6-b843-b3e35dfb1b4e` | height | NULL | 1050 | Apartmaji / Apartma 1 |
| media | `4d75afcc-067d-4ee3-ac25-f5335432fbdf` | width | NULL | 1024 | Kulinarika / Restavracija Marina Portorož |
| media | `4d75afcc-067d-4ee3-ac25-f5335432fbdf` | height | NULL | 683 | Kulinarika / Restavracija Marina Portorož |
| media | `f12f7065-7643-4e2e-b287-328aee14328d` | width | NULL | 1200 | Apartmaji / Apartma 2 |
| media | `f12f7065-7643-4e2e-b287-328aee14328d` | height | NULL | 1600 | Apartmaji / Apartma 2 |
| media | `fac98b55-82a3-4e79-baee-1ff67256c7c3` | width | NULL | 1400 | Pekarne / Pekarna Portorož — Panificio |
| media | `fac98b55-82a3-4e79-baee-1ff67256c7c3` | height | NULL | 943 | Pekarne / Pekarna Portorož — Panificio |
| media | `42cf29c7-b7ad-4788-b442-3a3ddd4b2f82` | width | NULL | 1200 | Apartmaji / Apartma 2 |
| media | `42cf29c7-b7ad-4788-b442-3a3ddd4b2f82` | height | NULL | 1600 | Apartmaji / Apartma 2 |
| media | `737286ae-ea49-42fb-82c9-1827e36cb167` | width | NULL | 1200 | Apartmaji / Apartma 2 |
| media | `737286ae-ea49-42fb-82c9-1827e36cb167` | height | NULL | 1600 | Apartmaji / Apartma 2 |
| media | `5306300b-e025-4fd0-bc97-e14fe7ddc967` | width | NULL | 839 | Apartmaji / Apartma 2 |
| media | `5306300b-e025-4fd0-bc97-e14fe7ddc967` | height | NULL | 1600 | Apartmaji / Apartma 2 |
| media | `16020523-2d25-4b78-92f9-032f44187594` | width | NULL | 1179 | Apartmaji / Apartma 2 |
| media | `16020523-2d25-4b78-92f9-032f44187594` | height | NULL | 1527 | Apartmaji / Apartma 2 |
| media | `bede3f11-b5e6-40f1-ade2-89baaad4f5c3` | width | NULL | 1200 | Apartmaji / Apartma 2 |
| media | `bede3f11-b5e6-40f1-ade2-89baaad4f5c3` | height | NULL | 1600 | Apartmaji / Apartma 2 |
| media | `690007ac-e899-49e1-b7bc-b7c9661f5a0c` | width | NULL | 1400 | Apartmaji / Apartma 3 |
| media | `690007ac-e899-49e1-b7bc-b7c9661f5a0c` | height | NULL | 1050 | Apartmaji / Apartma 3 |
| media | `7b6c4aba-345b-4a17-9331-b5bf179a844d` | width | NULL | 900 | Kulinarika / Restavracija Pavel |
| media | `7b6c4aba-345b-4a17-9331-b5bf179a844d` | height | NULL | 500 | Kulinarika / Restavracija Pavel |
| media | `ce64cc7a-5204-4e68-bddb-b55c4adb3368` | width | NULL | 1200 | Apartmaji / Apartma 3 |
| media | `ce64cc7a-5204-4e68-bddb-b55c4adb3368` | height | NULL | 1600 | Apartmaji / Apartma 3 |
| media | `0d9c0429-8906-4d98-bf31-979ab3a39bc3` | width | NULL | 1400 | Apartmaji / Apartma 3 |
| media | `0d9c0429-8906-4d98-bf31-979ab3a39bc3` | height | NULL | 1050 | Apartmaji / Apartma 3 |
| media | `32265866-e85f-4aed-bcfd-01365aa82e75` | width | NULL | 1200 | Apartmaji / Apartma 4 |
| media | `32265866-e85f-4aed-bcfd-01365aa82e75` | height | NULL | 1600 | Apartmaji / Apartma 4 |
| media | `46b7bd28-ec61-49da-b401-3c44ab20c141` | width | NULL | 900 | Kulinarika / Restavracija Pavel 2 |
| media | `46b7bd28-ec61-49da-b401-3c44ab20c141` | height | NULL | 500 | Kulinarika / Restavracija Pavel 2 |
| media | `1db34899-9d3b-44ce-bafb-ba1bd0f3b6ea` | width | NULL | 1200 | Apartmaji / Apartma 4 |
| media | `1db34899-9d3b-44ce-bafb-ba1bd0f3b6ea` | height | NULL | 1600 | Apartmaji / Apartma 4 |
| media | `1e237ce9-d351-4edf-a9b5-40b7b384fb46` | width | NULL | 1200 | Apartmaji / Apartma 4 |
| media | `1e237ce9-d351-4edf-a9b5-40b7b384fb46` | height | NULL | 1600 | Apartmaji / Apartma 4 |
| media | `72a2583b-41af-4e7a-a5dc-e026241ca69d` | width | NULL | 1280 | Apartmaji / Apartma 4 |
| media | `72a2583b-41af-4e7a-a5dc-e026241ca69d` | height | NULL | 1600 | Apartmaji / Apartma 4 |
| media | `f08c5a6f-b9bf-4a44-bc26-88dcb1544741` | width | NULL | 839 | Apartmaji / Apartma 4 |
| media | `f08c5a6f-b9bf-4a44-bc26-88dcb1544741` | height | NULL | 1600 | Apartmaji / Apartma 4 |
| media | `53f96fdf-fe91-4b9e-9738-e458f801f4be` | width | NULL | 259 | Kulinarika / Hiša Dual |
| media | `53f96fdf-fe91-4b9e-9738-e458f801f4be` | height | NULL | 194 | Kulinarika / Hiša Dual |
| media | `988997bc-ed47-4af4-9342-fcf77ed43cab` | width | NULL | 1024 | Kulinarika / Gostilna Karjola |
| media | `988997bc-ed47-4af4-9342-fcf77ed43cab` | height | NULL | 683 | Kulinarika / Gostilna Karjola |
| media | `d5524523-9ee2-4aaf-99db-02b4467f85d3` | width | NULL | 750 | Kulinarika / Primavera |
| media | `d5524523-9ee2-4aaf-99db-02b4467f85d3` | height | NULL | 468 | Kulinarika / Primavera |
| media | `20a3050b-29e0-42be-a8ce-e8292358851f` | width | NULL | 1179 | Zunanji fitnes / Zunanji fitnes |
| media | `20a3050b-29e0-42be-a8ce-e8292358851f` | height | NULL | 1433 | Zunanji fitnes / Zunanji fitnes |
| media | `9a85a985-960a-4253-bb17-f9d697fd7306` | width | NULL | 1280 | Bencinske črpalke / Petrol — Jagodje jug |
| media | `9a85a985-960a-4253-bb17-f9d697fd7306` | height | NULL | 805 | Bencinske črpalke / Petrol — Jagodje jug |
| media | `f1dceb8d-27e6-4a89-8d66-9873d3b55bf8` | width | NULL | 800 | Nočno življenje / Club Alaya |
| media | `f1dceb8d-27e6-4a89-8d66-9873d3b55bf8` | height | NULL | 533 | Nočno življenje / Club Alaya |
| media | `32012743-a4d2-4224-bc39-7d212f76ed59` | width | NULL | 1200 | Zunanji fitnes / Zunanji fitnes |
| media | `32012743-a4d2-4224-bc39-7d212f76ed59` | height | NULL | 1600 | Zunanji fitnes / Zunanji fitnes |
| media | `610ffffd-77bd-45e9-8a46-0d6e51faae89` | width | NULL | 1400 | Lokacija / Lokacija |
| media | `610ffffd-77bd-45e9-8a46-0d6e51faae89` | height | NULL | 1050 | Lokacija / Lokacija |
| media | `04178975-54e7-4b6f-b2de-5c88b9cd87fd` | width | NULL | 1400 | Nočno življenje / Coco cafe Portorož |
| media | `04178975-54e7-4b6f-b2de-5c88b9cd87fd` | height | NULL | 1050 | Nočno življenje / Coco cafe Portorož |
| media | `cddb4681-8fc4-4d6f-9595-cb6c369b3b11` | width | NULL | 960 | Bencinske črpalke / Petrol Izola |
| media | `cddb4681-8fc4-4d6f-9595-cb6c369b3b11` | height | NULL | 720 | Bencinske črpalke / Petrol Izola |
| media | `588fa343-5050-41ed-a439-123efac9fb1a` | width | NULL | 1400 | Nočno življenje / Barba bar & more |
| media | `588fa343-5050-41ed-a439-123efac9fb1a` | height | NULL | 987 | Nočno življenje / Barba bar & more |
| media | `9983f64d-a2e5-4fa7-b455-07ad032b3437` | width | NULL | 1400 | Bencinske črpalke / MOL Izola |
| media | `9983f64d-a2e5-4fa7-b455-07ad032b3437` | height | NULL | 957 | Bencinske črpalke / MOL Izola |
| media | `85b2f508-38ea-43a4-8846-bfb8221dcb43` | width | NULL | 1400 | Nočno življenje / Snack Bar 1964 |
| media | `85b2f508-38ea-43a4-8846-bfb8221dcb43` | height | NULL | 911 | Nočno življenje / Snack Bar 1964 |
| media | `e9532467-f90d-4c52-bced-3be36a19e8e7` | width | NULL | 1400 | Bencinske črpalke / MOL Koper |
| media | `e9532467-f90d-4c52-bced-3be36a19e8e7` | height | NULL | 788 | Bencinske črpalke / MOL Koper |
| media | `275bd275-b194-45db-8f8b-027cabf3823e` | width | NULL | 737 | Nočno življenje / Wakanda Beach Bar |
| media | `275bd275-b194-45db-8f8b-027cabf3823e` | height | NULL | 1080 | Nočno življenje / Wakanda Beach Bar |
| media | `08cfa5c2-35c5-48af-a0c5-a2642e076b53` | width | NULL | 1024 | Bankomati / NLB poslovalnica Izola |
| media | `08cfa5c2-35c5-48af-a0c5-a2642e076b53` | height | NULL | 539 | Bankomati / NLB poslovalnica Izola |
| media | `8290d59f-40f0-4174-b746-31818ad7193a` | width | NULL | 492 | Parkirišče / Parkirišče |
| media | `8290d59f-40f0-4174-b746-31818ad7193a` | height | NULL | 226 | Parkirišče / Parkirišče |
| media | `cdbf6112-2622-4a20-879a-c2a294ff5402` | width | NULL | 1200 | Žar / Žar |
| media | `cdbf6112-2622-4a20-879a-c2a294ff5402` | height | NULL | 1600 | Žar / Žar |
| media | `ef880772-577b-442c-aab9-ecfbd473fc71` | width | NULL | 900 | Picerije / Fuoriseria — Pizza & More |
| media | `ef880772-577b-442c-aab9-ecfbd473fc71` | height | NULL | 500 | Picerije / Fuoriseria — Pizza & More |
| media | `34b26310-bfbd-49de-b354-9cdcd8b1604f` | width | NULL | 928 | Žar / Žar |
| media | `34b26310-bfbd-49de-b354-9cdcd8b1604f` | height | NULL | 1101 | Žar / Žar |
| media | `ec98bd3f-c00c-45da-af4a-78aefcb3b901` | width | NULL | 492 | Parkirišče / Parkirišče |
| media | `ec98bd3f-c00c-45da-af4a-78aefcb3b901` | height | NULL | 201 | Parkirišče / Parkirišče |
| media | `005070a4-b36a-4075-87fa-48fe003e6f13` | width | NULL | 786 | Bankomati / Bankomat SKB |
| media | `005070a4-b36a-4075-87fa-48fe003e6f13` | height | NULL | 442 | Bankomati / Bankomat SKB |
| media | `b622133d-23cc-455c-9ae4-d185768984ec` | width | NULL | 906 | Picerije / Picerija Vesuvio |
| media | `b622133d-23cc-455c-9ae4-d185768984ec` | height | NULL | 604 | Picerije / Picerija Vesuvio |
| media | `71f1efa7-a62b-4739-b129-e9e7bf7efb80` | width | NULL | 275 | Picerije / Casa della Pizza |
| media | `71f1efa7-a62b-4739-b129-e9e7bf7efb80` | height | NULL | 183 | Picerije / Casa della Pizza |
| media | `a32b70ce-16cc-41d0-a917-be9f570cab5d` | width | NULL | 1400 | Bankomati / NLB bankomat |
| media | `a32b70ce-16cc-41d0-a917-be9f570cab5d` | height | NULL | 506 | Bankomati / NLB bankomat |
| media | `03c29b41-68df-48f4-8dfc-debcf7a6584d` | width | NULL | 1069 | Bankomati / Bankomat Intesa Sanpaolo |
| media | `03c29b41-68df-48f4-8dfc-debcf7a6584d` | height | NULL | 960 | Bankomati / Bankomat Intesa Sanpaolo |
| media | `5801a9a6-7fca-46a1-b165-a618529c0bdf` | width | NULL | 577 | Navodila za ograjo / <NULL> |
| media | `5801a9a6-7fca-46a1-b165-a618529c0bdf` | height | NULL | 957 | Navodila za ograjo / <NULL> |
| media | `6123ae86-4c48-45b1-b9dd-c1ac5bf1db78` | width | NULL | 1024 | Aktivnosti / Vinska fontana Marezige |
| media | `6123ae86-4c48-45b1-b9dd-c1ac5bf1db78` | height | NULL | 683 | Aktivnosti / Vinska fontana Marezige |
| media | `90baa668-6ce3-4879-8492-70318b03fcf1` | width | NULL | 850 | Lekarne / Lekarna San Simon |
| media | `90baa668-6ce3-4879-8492-70318b03fcf1` | height | NULL | 600 | Lekarne / Lekarna San Simon |
| media | `960b66d0-3e15-4fe1-b5ce-40ae6acfcb7d` | width | NULL | 590 | Čoln s skiperjem / Izlet s čolnom in skiperjem — 3 ure |
| media | `960b66d0-3e15-4fe1-b5ce-40ae6acfcb7d` | height | NULL | 1385 | Čoln s skiperjem / Izlet s čolnom in skiperjem — 3 ure |
| media | `0291fc20-3a59-48da-b639-0b08925b068f` | width | NULL | 1400 | Navodila za ograjo / <NULL> |
| media | `0291fc20-3a59-48da-b639-0b08925b068f` | height | NULL | 1050 | Navodila za ograjo / <NULL> |
| media | `3cdec354-5259-45e0-98bb-94c7888a91ee` | width | NULL | 590 | Čoln s skiperjem / Izlet s čolnom in skiperjem — 5 ur |
| media | `3cdec354-5259-45e0-98bb-94c7888a91ee` | height | NULL | 1385 | Čoln s skiperjem / Izlet s čolnom in skiperjem — 5 ur |
| media | `5a993e61-4b4b-4fe9-8eea-58e08187b980` | width | NULL | 1400 | Aktivnosti / Krajinski park Sečoveljske soline |
| media | `5a993e61-4b4b-4fe9-8eea-58e08187b980` | height | NULL | 933 | Aktivnosti / Krajinski park Sečoveljske soline |
| media | `d3c4ea05-1832-4d81-818f-c1344ca05e7f` | width | NULL | 1024 | Lekarne / Obalne lekarne — Izola |
| media | `d3c4ea05-1832-4d81-818f-c1344ca05e7f` | height | NULL | 711 | Lekarne / Obalne lekarne — Izola |
| media | `b696ee7d-9235-42c1-a9ec-6d38ffd91f18` | width | NULL | 1400 | Aktivnosti / Krajinski park Sečoveljske soline |
| media | `b696ee7d-9235-42c1-a9ec-6d38ffd91f18` | height | NULL | 1051 | Aktivnosti / Krajinski park Sečoveljske soline |
| media | `c112eabf-da50-4a37-a479-a37446a4ffad` | width | NULL | 1000 | Aktivnosti / Akvarij Piran |
| media | `c112eabf-da50-4a37-a479-a37446a4ffad` | height | NULL | 667 | Aktivnosti / Akvarij Piran |
| media | `d81715bc-39fa-4a3e-8b68-04d638aac322` | width | NULL | 590 | Čoln s skiperjem / Izlet po dogovoru |
| media | `d81715bc-39fa-4a3e-8b68-04d638aac322` | height | NULL | 1385 | Čoln s skiperjem / Izlet po dogovoru |
| media | `e2b85551-93b6-4baf-929c-797b0607c528` | width | NULL | 1024 | Lekarne / Obalne lekarne — Lucija |
| media | `e2b85551-93b6-4baf-929c-797b0607c528` | height | NULL | 683 | Lekarne / Obalne lekarne — Lucija |
| media | `022aab2f-b5d9-4c5d-86b8-b0410ef7d24f` | width | NULL | 1000 | Lekarne / Obalne lekarne — Koper |
| media | `022aab2f-b5d9-4c5d-86b8-b0410ef7d24f` | height | NULL | 667 | Lekarne / Obalne lekarne — Koper |
| media | `be7c6d8a-21d8-4c65-adb8-085ff39b401e` | width | NULL | 590 | Aktivnosti / Aquapark Istralandia |
| media | `be7c6d8a-21d8-4c65-adb8-085ff39b401e` | height | NULL | 394 | Aktivnosti / Aquapark Istralandia |
| media | `5666a944-48ef-49ed-8c5e-033bbdbc918f` | width | NULL | 1400 | Aktivnosti / Grad Miramare, Trst |
| media | `5666a944-48ef-49ed-8c5e-033bbdbc918f` | height | NULL | 1050 | Aktivnosti / Grad Miramare, Trst |
| media | `86620e7f-8a74-46f9-be72-f4931548a490` | width | NULL | 1400 | Aktivnosti / Grad Socerb |
| media | `86620e7f-8a74-46f9-be72-f4931548a490` | height | NULL | 933 | Aktivnosti / Grad Socerb |
| media | `a9ed873c-471c-4342-a6fb-ad97e054ada3` | width | NULL | 1024 | Aktivnosti / Portopiccolo Sistiana |
| media | `a9ed873c-471c-4342-a6fb-ad97e054ada3` | height | NULL | 683 | Aktivnosti / Portopiccolo Sistiana |
| media | `a3663383-b49f-4972-b2fc-4973ae702a33` | width | NULL | 1400 | Aktivnosti / Motovun |
| media | `a3663383-b49f-4972-b2fc-4973ae702a33` | height | NULL | 934 | Aktivnosti / Motovun |
| media | `49db55b1-166d-4e40-b8d0-f0cb8fc8b2f0` | width | NULL | 492 | Navodila za opremo / Bojler |
| media | `49db55b1-166d-4e40-b8d0-f0cb8fc8b2f0` | height | NULL | 355 | Navodila za opremo / Bojler |
| media | `827eea1e-2a7c-45a0-a0e0-42213b061809` | width | NULL | 780 | Bolnišnica / Splošna bolnišnica Izola |
| media | `827eea1e-2a7c-45a0-a0e0-42213b061809` | height | NULL | 470 | Bolnišnica / Splošna bolnišnica Izola |
| media | `a1a9f7b8-402f-414c-9f18-572007f6f22f` | width | NULL | 1400 | Ladijski prevoz / Zlatoperka: Ankaran → Koper |
| media | `a1a9f7b8-402f-414c-9f18-572007f6f22f` | height | NULL | 933 | Ladijski prevoz / Zlatoperka: Ankaran → Koper |
| media | `ea3587b6-bebf-49a0-8d20-a849b79b2f31` | width | NULL | 600 | Pohodništvo / Pot srca, Strunjan |
| media | `ea3587b6-bebf-49a0-8d20-a849b79b2f31` | height | NULL | 300 | Pohodništvo / Pot srca, Strunjan |
| media | `1e9161c3-e707-4473-af8a-0a21c750b891` | width | NULL | 1400 | Ladijski prevoz / Zlatoperka: Koper → Izola → Piran |
| media | `1e9161c3-e707-4473-af8a-0a21c750b891` | height | NULL | 933 | Ladijski prevoz / Zlatoperka: Koper → Izola → Piran |
| media | `e4c246e5-8629-48fa-a101-edd88c2e921b` | width | NULL | 723 | Pohodništvo / Krajša pot navkreber |
| media | `e4c246e5-8629-48fa-a101-edd88c2e921b` | height | NULL | 482 | Pohodništvo / Krajša pot navkreber |
| media | `467c4b52-fb06-49fc-aaf0-feb501f42452` | width | NULL | 1200 | Pohodništvo / Slavnik |
| media | `467c4b52-fb06-49fc-aaf0-feb501f42452` | height | NULL | 628 | Pohodništvo / Slavnik |
| media | `534353f1-c981-4b38-86d7-1828f5546299` | width | NULL | 600 | Pohodništvo / Mesečev zaliv |
| media | `534353f1-c981-4b38-86d7-1828f5546299` | height | NULL | 300 | Pohodništvo / Mesečev zaliv |
| media | `58fe01cf-da6a-47fe-94b3-4fba7f770f04` | width | NULL | 1348 | Pohodništvo / Koper — Izola |
| media | `58fe01cf-da6a-47fe-94b3-4fba7f770f04` | height | NULL | 954 | Pohodništvo / Koper — Izola |
| media | `6d6fb3fd-7d0c-49a0-96d2-2f72629909d4` | width | NULL | 1400 | Pohodništvo / Ušesa Istre |
| media | `6d6fb3fd-7d0c-49a0-96d2-2f72629909d4` | height | NULL | 934 | Pohodništvo / Ušesa Istre |
| media | `a4f1f086-9fe5-43e7-a24c-950284c24cb5` | width | NULL | 1200 | Pohodništvo / Napoleonska pot |
| media | `a4f1f086-9fe5-43e7-a24c-950284c24cb5` | height | NULL | 900 | Pohodništvo / Napoleonska pot |
| media | `cbf46116-c543-4f16-ac5f-7795cabc9817` | width | NULL | 1400 | Družabne igre / Družabne igre |
| media | `cbf46116-c543-4f16-ac5f-7795cabc9817` | height | NULL | 1050 | Družabne igre / Družabne igre |
| media | `fb82829f-7ad9-4d70-8d4e-6bf1e34c0748` | width | NULL | 844 | Kolesarjenje / Parenzana: Izola — Piran |
| media | `fb82829f-7ad9-4d70-8d4e-6bf1e34c0748` | height | NULL | 563 | Kolesarjenje / Parenzana: Izola — Piran |
| media | `a415dece-5ec5-400a-b7bd-7a0f6495f9e4` | width | NULL | 492 | Kolesarjenje / Parenzana — celotna trasa |
| media | `a415dece-5ec5-400a-b7bd-7a0f6495f9e4` | height | NULL | 267 | Kolesarjenje / Parenzana — celotna trasa |
| media | `60cbd1a2-ae85-4a07-8694-7e7b6eeafb1f` | width | NULL | 1400 | Kolesarjenje / Portorož — Izola — Strunjanske soline |
| media | `60cbd1a2-ae85-4a07-8694-7e7b6eeafb1f` | height | NULL | 933 | Kolesarjenje / Portorož — Izola — Strunjanske soline |
| media | `c12303cc-413e-4007-9e64-a04f1f552c49` | width | NULL | 1400 | Kolesarjenje / Portorož — Piran |
| media | `c12303cc-413e-4007-9e64-a04f1f552c49` | height | NULL | 937 | Kolesarjenje / Portorož — Piran |
| media | `08adfd97-6b12-40f1-8161-90db196a21b6` | width | NULL | 1400 | Kolesarjenje / Portorož — istrsko zaledje — Padna |
| media | `08adfd97-6b12-40f1-8161-90db196a21b6` | height | NULL | 933 | Kolesarjenje / Portorož — istrsko zaledje — Padna |
| media | `116d8132-5927-4def-98df-74461da557ca` | width | NULL | 1400 | Oljčno olje / Domače ekološko oljčno olje |
| media | `116d8132-5927-4def-98df-74461da557ca` | height | NULL | 763 | Oljčno olje / Domače ekološko oljčno olje |
| media | `e7c046a0-ed5b-46a4-8a68-c428531b22fa` | width | NULL | 1200 | Plaže / Plaža Svetilnik, Izola |
| media | `e7c046a0-ed5b-46a4-8a68-c428531b22fa` | height | NULL | 677 | Plaže / Plaža Svetilnik, Izola |
| media | `bc2079ed-910b-444a-b10e-021d8cd18a8a` | width | NULL | 1200 | Plaže / Plaža San Simon |
| media | `bc2079ed-910b-444a-b10e-021d8cd18a8a` | height | NULL | 900 | Plaže / Plaža San Simon |
| media | `ab85221f-5255-4287-bf9e-dbaf3014e76f` | width | NULL | 1080 | Plaže / Plaža Mesečev zaliv |
| media | `ab85221f-5255-4287-bf9e-dbaf3014e76f` | height | NULL | 721 | Plaže / Plaža Mesečev zaliv |
| media | `168f676b-308a-4090-87d2-dca572f8ccf7` | width | NULL | 1400 | Plaže / Pomol pod Belvederjem, Izola |
| media | `168f676b-308a-4090-87d2-dca572f8ccf7` | height | NULL | 933 | Plaže / Pomol pod Belvederjem, Izola |
| media | `2379a198-ba67-4299-b34e-847d88d1ec40` | width | NULL | 1400 | Plaže / Plaža Portorož |
| media | `2379a198-ba67-4299-b34e-847d88d1ec40` | height | NULL | 933 | Plaže / Plaža Portorož |
| media | `739350d0-c23a-48f8-986f-2d2fc58cd76a` | width | NULL | 1200 | Plaže / Plaža Ankaran |
| media | `739350d0-c23a-48f8-986f-2d2fc58cd76a` | height | NULL | 628 | Plaže / Plaža Ankaran |
| media | `71fb92d5-bea9-4f0d-8ab2-f0779600d064` | width | NULL | 936 | Plaže / Plaža Fiesa |
| media | `71fb92d5-bea9-4f0d-8ab2-f0779600d064` | height | NULL | 702 | Plaže / Plaža Fiesa |
| media | `9bf0bad5-bb59-4713-9872-61829a9ba994` | width | NULL | 1400 | Plaže / Plaža Strunjan |
| media | `9bf0bad5-bb59-4713-9872-61829a9ba994` | height | NULL | 531 | Plaže / Plaža Strunjan |
| media | `1459b1f2-59ed-4702-b36a-05c5be5fac89` | width | NULL | 1400 | Kulturna dediščina / Piransko obzidje |
| media | `1459b1f2-59ed-4702-b36a-05c5be5fac89` | height | NULL | 928 | Kulturna dediščina / Piransko obzidje |
| media | `41476fd9-ec31-4809-ade6-9827f4919aaa` | width | NULL | 978 | Sladoled 24/7 / Sladoled 24/7 |
| media | `41476fd9-ec31-4809-ade6-9827f4919aaa` | height | NULL | 1708 | Sladoled 24/7 / Sladoled 24/7 |
| media | `a049f9ef-c280-4683-b170-ccca45f839d1` | width | NULL | 1400 | Kulturna dediščina / Pretorska palača, Koper |
| media | `a049f9ef-c280-4683-b170-ccca45f839d1` | height | NULL | 934 | Kulturna dediščina / Pretorska palača, Koper |
| media | `068f601c-e409-4d3b-a2a1-e76345c946b8` | width | NULL | 1348 | Kulturna dediščina / Muzej Izolana — hiša morja |
| media | `068f601c-e409-4d3b-a2a1-e76345c946b8` | height | NULL | 954 | Kulturna dediščina / Muzej Izolana — hiša morja |
| media | `3a3eb3cd-8eac-4fff-bab6-bda04eba017e` | width | NULL | 1024 | Kulturna dediščina / Tartinijev trg, Piran |
| media | `3a3eb3cd-8eac-4fff-bab6-bda04eba017e` | height | NULL | 684 | Kulturna dediščina / Tartinijev trg, Piran |
| media | `e384e497-1637-44d7-92b0-7b31a9478637` | width | NULL | 1024 | Kulturna dediščina / Cerkev sv. Jurija, Piran |
| media | `e384e497-1637-44d7-92b0-7b31a9478637` | height | NULL | 577 | Kulturna dediščina / Cerkev sv. Jurija, Piran |
| media | `3ad675ae-dfaa-4196-b8a4-3bd69e54d960` | width | NULL | 1400 | Kulturna dediščina / Grad Miramare |
| media | `3ad675ae-dfaa-4196-b8a4-3bd69e54d960` | height | NULL | 1050 | Kulturna dediščina / Grad Miramare |
| media | `e9cd9de7-6e42-4113-ba73-d2c763eee050` | width | NULL | 1400 | Kulturna dediščina / Motovun |
| media | `e9cd9de7-6e42-4113-ba73-d2c763eee050` | height | NULL | 934 | Kulturna dediščina / Motovun |
| media | `7da736bb-b122-4b6d-85c9-d5a2e2245883` | width | NULL | 1400 | Naravna dediščina / Krajinski park Sečoveljske soline |
| media | `7da736bb-b122-4b6d-85c9-d5a2e2245883` | height | NULL | 933 | Naravna dediščina / Krajinski park Sečoveljske soline |
| media | `65e44343-4bd5-4935-8bef-eec96a6d5faa` | width | NULL | 600 | Naravna dediščina / Strunjanske soline |
| media | `65e44343-4bd5-4935-8bef-eec96a6d5faa` | height | NULL | 300 | Naravna dediščina / Strunjanske soline |
| media | `8caf63a5-b832-45c9-846f-875037e3d259` | width | NULL | 600 | Naravna dediščina / Mesečev zaliv |
| media | `8caf63a5-b832-45c9-846f-875037e3d259` | height | NULL | 300 | Naravna dediščina / Mesečev zaliv |
| media | `37460fa0-542b-4809-b3cd-924f3cf76d90` | width | NULL | 1400 | Naravna dediščina / Strunjanski križ |
| media | `37460fa0-542b-4809-b3cd-924f3cf76d90` | height | NULL | 932 | Naravna dediščina / Strunjanski križ |
| media | `7ddb9155-5ffe-4bf8-aa43-75b6c71e0eeb` | width | NULL | 1400 | Izleti / Kobilarna Lipica |
| media | `7ddb9155-5ffe-4bf8-aa43-75b6c71e0eeb` | height | NULL | 931 | Izleti / Kobilarna Lipica |
| media | `85ba38f2-ce29-4d5a-82e0-0487b0f1280d` | width | NULL | 1400 | Izleti / Postojnska jama |
| media | `85ba38f2-ce29-4d5a-82e0-0487b0f1280d` | height | NULL | 788 | Izleti / Postojnska jama |
| media | `43c2315c-80e5-440c-9aa9-720470d6c8b7` | width | NULL | 1024 | Izleti / Predjamski grad |
| media | `43c2315c-80e5-440c-9aa9-720470d6c8b7` | height | NULL | 683 | Izleti / Predjamski grad |
| media | `25b465a1-8ecd-4e4f-ae46-1d22e7cac0d4` | width | NULL | 1080 | Izleti / Trst — informacijska točka |
| media | `25b465a1-8ecd-4e4f-ae46-1d22e7cac0d4` | height | NULL | 720 | Izleti / Trst — informacijska točka |
| media | `f1852f2e-5f3c-414c-b789-1d8ef875870a` | width | NULL | 1400 | Izleti / Trst — informacijska točka |
| media | `f1852f2e-5f3c-414c-b789-1d8ef875870a` | height | NULL | 788 | Izleti / Trst — informacijska točka |
| media | `fa0cd497-f5f6-48a1-a1c3-8f4e1420e1c7` | width | NULL | 1024 | Izleti / Portopiccolo Sistiana |
| media | `fa0cd497-f5f6-48a1-a1c3-8f4e1420e1c7` | height | NULL | 683 | Izleti / Portopiccolo Sistiana |
| media | `f222ec4d-e319-4278-abf3-ed73f81c83b6` | width | NULL | 1400 | Dogodki / Dogodki v Izoli |
| media | `f222ec4d-e319-4278-abf3-ed73f81c83b6` | height | NULL | 804 | Dogodki / Dogodki v Izoli |
| media | `8a0ba3b7-18e0-447d-b208-8fb9512c7bec` | width | NULL | 1400 | Dogodki / Dogodki v Portorožu |
| media | `8a0ba3b7-18e0-447d-b208-8fb9512c7bec` | height | NULL | 934 | Dogodki / Dogodki v Portorožu |
| media | `e6ffb78e-a031-47d1-8204-b719ee8d813a` | width | NULL | 1199 | Dogodki / Dogodki v Kopru |
| media | `e6ffb78e-a031-47d1-8204-b719ee8d813a` | height | NULL | 800 | Dogodki / Dogodki v Kopru |

## D. Approved media inserts — 3 complete rows

Each listed field is part of one new media record. No storage object is created; the referenced object URLs already exist.

| Table | Row ID | Field | Old production value | New development value | Category / item |
|---|---|---|---|---|---|
| media | `e06d634b-7414-472c-a0d2-3195a02a8f80` | id | ABSENT | e06d634b-7414-472c-a0d2-3195a02a8f80 | SUP deska / SUP — dnevni najem |
| media | `e06d634b-7414-472c-a0d2-3195a02a8f80` | item_id | ABSENT | 4860043d-3db3-4c26-bd6e-714ebfdbe8ce | SUP deska / SUP — dnevni najem |
| media | `e06d634b-7414-472c-a0d2-3195a02a8f80` | tenant_id | ABSENT | NULL | SUP deska / SUP — dnevni najem |
| media | `e06d634b-7414-472c-a0d2-3195a02a8f80` | url | ABSENT | /api/storage/img/meli-pu/meli-pu_sup-dnevni-najem_01-91b9.jpg | SUP deska / SUP — dnevni najem |
| media | `e06d634b-7414-472c-a0d2-3195a02a8f80` | alt | ABSENT | NULL | SUP deska / SUP — dnevni najem |
| media | `e06d634b-7414-472c-a0d2-3195a02a8f80` | position | ABSENT | 0 | SUP deska / SUP — dnevni najem |
| media | `e06d634b-7414-472c-a0d2-3195a02a8f80` | kind | ABSENT | image | SUP deska / SUP — dnevni najem |
| media | `e06d634b-7414-472c-a0d2-3195a02a8f80` | poster_url | ABSENT | NULL | SUP deska / SUP — dnevni najem |
| media | `e06d634b-7414-472c-a0d2-3195a02a8f80` | duration_sec | ABSENT | NULL | SUP deska / SUP — dnevni najem |
| media | `e06d634b-7414-472c-a0d2-3195a02a8f80` | focus_x | ABSENT | 50 | SUP deska / SUP — dnevni najem |
| media | `e06d634b-7414-472c-a0d2-3195a02a8f80` | focus_y | ABSENT | 50 | SUP deska / SUP — dnevni najem |
| media | `e06d634b-7414-472c-a0d2-3195a02a8f80` | width | ABSENT | 800 | SUP deska / SUP — dnevni najem |
| media | `e06d634b-7414-472c-a0d2-3195a02a8f80` | height | ABSENT | 800 | SUP deska / SUP — dnevni najem |
| media | `e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e` | id | ABSENT | e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e | Skuter / Skuter — najem za 3 do 4 ure |
| media | `e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e` | item_id | ABSENT | d16868d6-d2c1-4485-9380-b9ebe3c04b40 | Skuter / Skuter — najem za 3 do 4 ure |
| media | `e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e` | tenant_id | ABSENT | NULL | Skuter / Skuter — najem za 3 do 4 ure |
| media | `e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e` | url | ABSENT | /api/storage/img/meli-pu/meli-pu_skuter-najem-za-3-do-4-u_02-05e3.jpg | Skuter / Skuter — najem za 3 do 4 ure |
| media | `e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e` | alt | ABSENT | NULL | Skuter / Skuter — najem za 3 do 4 ure |
| media | `e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e` | position | ABSENT | 1 | Skuter / Skuter — najem za 3 do 4 ure |
| media | `e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e` | kind | ABSENT | image | Skuter / Skuter — najem za 3 do 4 ure |
| media | `e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e` | poster_url | ABSENT | NULL | Skuter / Skuter — najem za 3 do 4 ure |
| media | `e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e` | duration_sec | ABSENT | NULL | Skuter / Skuter — najem za 3 do 4 ure |
| media | `e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e` | focus_x | ABSENT | 50 | Skuter / Skuter — najem za 3 do 4 ure |
| media | `e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e` | focus_y | ABSENT | 50 | Skuter / Skuter — najem za 3 do 4 ure |
| media | `e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e` | width | ABSENT | 1179 | Skuter / Skuter — najem za 3 do 4 ure |
| media | `e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e` | height | ABSENT | 977 | Skuter / Skuter — najem za 3 do 4 ure |
| media | `22a308ef-dd83-443e-8f08-1c0cd453fe00` | id | ABSENT | 22a308ef-dd83-443e-8f08-1c0cd453fe00 | Bazen / Bazen je odprt 7:00 – 21:00 |
| media | `22a308ef-dd83-443e-8f08-1c0cd453fe00` | item_id | ABSENT | 30db866a-2742-40c5-bcc3-e0ec84c327b9 | Bazen / Bazen je odprt 7:00 – 21:00 |
| media | `22a308ef-dd83-443e-8f08-1c0cd453fe00` | tenant_id | ABSENT | NULL | Bazen / Bazen je odprt 7:00 – 21:00 |
| media | `22a308ef-dd83-443e-8f08-1c0cd453fe00` | url | ABSENT | /api/storage/img/meli-pu/meli-pu_bazen-je-odprt-7-00-21-0_01-bcbe.jpg | Bazen / Bazen je odprt 7:00 – 21:00 |
| media | `22a308ef-dd83-443e-8f08-1c0cd453fe00` | alt | ABSENT | NULL | Bazen / Bazen je odprt 7:00 – 21:00 |
| media | `22a308ef-dd83-443e-8f08-1c0cd453fe00` | position | ABSENT | 0 | Bazen / Bazen je odprt 7:00 – 21:00 |
| media | `22a308ef-dd83-443e-8f08-1c0cd453fe00` | kind | ABSENT | image | Bazen / Bazen je odprt 7:00 – 21:00 |
| media | `22a308ef-dd83-443e-8f08-1c0cd453fe00` | poster_url | ABSENT | NULL | Bazen / Bazen je odprt 7:00 – 21:00 |
| media | `22a308ef-dd83-443e-8f08-1c0cd453fe00` | duration_sec | ABSENT | NULL | Bazen / Bazen je odprt 7:00 – 21:00 |
| media | `22a308ef-dd83-443e-8f08-1c0cd453fe00` | focus_x | ABSENT | 50 | Bazen / Bazen je odprt 7:00 – 21:00 |
| media | `22a308ef-dd83-443e-8f08-1c0cd453fe00` | focus_y | ABSENT | 50 | Bazen / Bazen je odprt 7:00 – 21:00 |
| media | `22a308ef-dd83-443e-8f08-1c0cd453fe00` | width | ABSENT | 885 | Bazen / Bazen je odprt 7:00 – 21:00 |
| media | `22a308ef-dd83-443e-8f08-1c0cd453fe00` | height | ABSENT | 645 | Bazen / Bazen je odprt 7:00 – 21:00 |

## E. Approved media-row removals — 2 rows

These delete database links only. The underlying files are deliberately retained in storage.

| Table | Row ID | Field | Old production value | New production value | Category / item |
|---|---|---|---|---|---|
| media | `84930838-f22a-41f7-a581-e072cbd10ae5` | row | {"item_id":"4860043d-3db3-4c26-bd6e-714ebfdbe8ce","url":"/images/IMG_6218_0.jpg","position":"0","width":"NULL","height":"NULL"} | REMOVED (DB link only; storage retained) | SUP deska / SUP — dnevni najem |
| media | `2f481f3f-79da-4419-a2ee-39cbb880c10c` | row | {"item_id":"d16868d6-d2c1-4485-9380-b9ebe3c04b40","url":"/images/IMG_6219_0.jpg","position":"0","width":"NULL","height":"NULL"} | REMOVED (DB link only; storage retained) | Skuter / Skuter — najem za 3 do 4 ure |

## Stage 2 application mechanism — planned, not implemented

- The existing ordinary admin edit routes are not suitable because they also write changelog entries.
- Use one temporary, admin-authenticated, transaction-scoped sync operation with the exact IDs and old values in this ledger.
- Acquire row locks and compare the schema/content fingerprints and every old value before the first mutation; abort and roll back on any mismatch.
- The transaction may target only categories, items, and media. It must contain no statement against changelog, renewal, admin-auth, translation, plural, order, alias, or tenant tables.
- Extend the media-dimension production guard only for the 131 listed IDs and exact expected dimensions; broad missing-dimension scans remain forbidden.
- Do not use Publish's overwrite-data option and do not delete any storage object.
- Return row counts and post-write hashes; re-disable/remove the temporary sync path immediately after one successful execution.

## Other approved Stage 2 implementation work — not data-row writes

| Area | Planned change | Production effect | Rollback |
|---|---|---|---|
| Tenant schema | Add `guest_ui_mode` as NOT NULL default `legacy`, constrained to `legacy` / `living-guide` | Additive; existing tenants remain legacy | Set legacy; column may remain |
| API/client/admin | Expose the mode through the existing tenant-admin flow | No automatic tenant switch | Revert UI/API; retain legacy value |
| Guest routing | Select Living Guide only for a published tenant set to `living-guide` | Owner-controlled Meli Pu switch | Set Meli Pu to legacy |
| Indexing | Add response header `X-Robots-Tag: noindex, nofollow` | Completes all three indexing controls | Revert header code if needed |

## Required gates before any application

1. Owner explicitly approves this exact ledger.
2. Re-read production and development rows. Any changed ID, old value, URL, position, dimension, or fingerprint invalidates this ledger and requires Stage 1b revision.
3. Record T0, schema fingerprint, and all content hashes; verify a selectable production PITR restore point.
4. Owner confirms the active retention tier in Settings → Billing / Account usage. Replit documents 7 days for Core and 28 days for Pro/Team; account-plan data is not exposed to this workspace.
5. Re-check that the owner has set a real production recipient. No real-order test runs while it is missing or staging. The owner alone controls recipient and order password.
6. Apply only the allowlisted ledger in one reviewed transaction, verify exact counts/hashes, then re-lock the temporary operation.

## Explicit exclusions

- No whole-database copy and no Publish data overwrite.
- No writes to changelog, renewal history, admin credentials, sessions, enrollment/recovery records, authentication events, translations, plural forms, orders, aliases, or tenant settings.
- No copy of `meli-pu-copy` or `nova-1786785535365`.
- No object-storage deletion; IMG_6218 and IMG_6219 files remain stored.
- No recipient or order-password write by the agent.
- No cutover switch, publish, real order, legacy removal, or device-matrix execution in Stage 1b.