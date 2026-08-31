# Fresh Ljubno source-first Creator run — complete evidence report

Development-only draft: **Piknik prostor in kamp Gril**  
Address: **Ter 35, 3333 Ljubno ob Savinji**  
Municipality: **Ljubno ob Savinji**  
Origin: **46.3536005, 14.8509723**  
Published: **No**

## Totals

- Guarded approved-source snapshots: 16
- Extracted facts: 345
- Deduplicated candidates: 328
- Duplicate provenance links merged: 17
- Resolved and routed: 89
- Unresolved: 239
- Descriptions created: 0
- Translation rows created: 0
- Guest items created: 0
- Publication performed: No

### Range totals

- excursion: 89

### Unresolved reason totals

- no-results: 100
- duration-ceiling: 81
- name-mismatch: 38
- road-distance-ceiling: 11
- hard-ceiling: 4
- equally-plausible: 4
- blocked-class-or-addresstype: 1

### Measured Nominatim execution evidence

- HTTP attempts: 355
- Minimum observed interval between HTTP attempt starts: 1000 ms
- Retry attempts: 0
- HTTP statuses: 200=355
- Network/timeout errors: 0
- Stop circuit: not opened

## Why the quarantined environment extracted 651 facts

The 651-fact result was mainly extractor overreach. On identical stored Hribi.net snapshots, the old extractor accepted elevations, duration labels, route-difficulty labels, navigation/category labels, inflected prose, combined-place phrases, generic attractions, event headlines, and administrative links as places. Concrete examples included `1675 m`, `2 h 5 min`, `lahka neoznačena steza`, `Pohodništvo`, and `slapom Rinka`.

The corrected deterministic extractor rejects those demonstrated classes and strips only trailing parenthetical elevations from otherwise valid names. The final guarded run contains 345 facts. The three Hribi.net snapshots have the same hashes and sizes as the quarantined run, proving that their large reduction is extractor behavior, not page change.

The remaining increase over the isolated run's 197 facts is concentrated in the approved Kamniško-Savinjske Alpe index: isolated report 115 versus final run 298. The isolated report did not retain that page's hash or byte size, so old-page change versus an older extraction revision cannot be proven. For the six Visit Savinjska pages whose isolated hashes were preserved, every final hash differs, but their combined fact count remains 29 in both runs. Those byte-level page changes do not explain the large overall increase. The 298 current mountain-index facts are linked mountain/destination names from the 95,239-byte approved index; the owner must decide whether that regional source is too broad for Gril.

## Snapshot comparison

The isolated report recorded no byte sizes and only six source hashes. Quarantined counts use the over-broad extractor; final counts use the corrected extractor.

| Source | Isolated facts | Isolated hash | Quarantined hash / bytes / facts | Final hash / bytes / facts | Same current hash |
|---|---:|---|---|---|:---:|
| Hribi.net — izhodišče Ljubno ob Savinji | 13 | not recorded | 1f31857df7d186737626c93bd62be45ee9b23da603f45942edf0d448bf0eb02e / 46913 B / 13 | 1f31857df7d186737626c93bd62be45ee9b23da603f45942edf0d448bf0eb02e / 46913 B / 7 | yes |
| Hribi.net — Kamniško-Savinjske Alpe | 115 | not recorded | 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7 / 95239 B / 566 | 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7 / 95239 B / 298 | yes |
| Hribi.net — Smrekovec | 30 | not recorded | 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e / 53685 B / 30 | 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e / 53685 B / 16 | yes |
| Občina Gornji Grad | 3 | not recorded | ac0b024024fa4719f11f24c6c1851d9f3d6e9f8f9b4dc3d45f9f40fd5d188d41 / 217046 B / 3 | bcce4489a5c7a1572d946aab0dfcb0751123b0579d0b7c50a6ac4120b87d18eb / 216983 B / 1 | no |
| Občina Ljubno | 1 | not recorded | e019dde622c5bb479ea1ca9268a5c4c1cce9d6e8da9a0a4c4ddf6cab331f8fd9 / 420603 B / 1 | 2da0cb4b36c0a6f50e3b31f52dee97544c2f967105c1c2700e1c9a459af40c24 / 420603 B / 1 | no |
| Občina Luče | 0 | not recorded | 8f628308b24eebe6fff7107685170311d1198c64476f0ed840ad57a4a9577daf / 323324 B / 0 | f1b2a3ed7b03a0b1e35500ed0a436f6188f0f88cb0ae16763d7dd806347cd5e4 / 323324 B / 0 | no |
| Občina Mozirje | 1 | not recorded | 7bef8ab1ac57c946b389724dd5ef1e6f5191f6a5985aede751532ef4cdacf9eb / 232255 B / 2 | 8804ec3587fd0fc53cfc110eb07379c514db8158f985ddf9df0b82824e680181 / 232255 B / 0 | no |
| Občina Nazarje | 3 | not recorded | 598e36f38261766a484e3d7c07f5a1a6fb221355fae80ddcb6bffd3e4b7f87b2 / 391060 B / 3 | dcbbe368b6ab48fcbe1f968dac64ec9f7031b617097a646dc370f0daa1d448b7 / 391060 B / 1 | no |
| Občina Solčava | 1 | not recorded | e1a37295fe7529c0e0530a4b60100e404dc432a3a9f7dc713cb943bc6c78b071 / 209179 B / 1 | 9cf86176500e4c97939f2535d24d9a3e5c1c47769f6efaef39c33139fba700c4 / 206942 B / 0 | no |
| Visit Luče | 1 | not recorded | 7751e360cbe3fcaedf95718c50557a2705d50748834f85ec6a407ba43056ba70 / 160843 B / 1 | 7751e360cbe3fcaedf95718c50557a2705d50748834f85ec6a407ba43056ba70 / 160843 B / 0 | yes |
| Visit Savinjska — Ljubno | 3 | 0703afaa6871a66eecaaac4f962c8d53c964c235f53a2ea3ca77c60e0c6ddb8b | d1ef61e753f85c4b38c39f11529cdec1366b76a8128cad9d472b643085ecd693 / 229345 B / 3 | abdf343a290858af4e83a4c87b2c4c3f681df019777975eecc8b0cebc7fc6742 / 229345 B / 3 | no |
| Visit Savinjska — Logarska dolina in krajinski parki | 9 | ad21635650e848d4060e245b89f3302f64e90e2bb0f546edaf793b09b263f7b5 | d532a88c07c54aba91b3939c8376215e2a18b7190fe7334f9d116c4d7cdbabd5 / 232749 B / 9 | 6b1cbb31ee9215ec510c393938ebe0bbfb57aebfe71da1de905ba08ceb8305a2 / 232749 B / 5 | no |
| Visit Savinjska — Mozirje | 2 | 212924adb01836e61b36f962b238ce3f0c2b9f4c46b2dbdc489dda322ac9c450 | f575dd1b7468beda1f4b1e4335d81c9c6431e913e54ad221ff284bdd3794d4fd / 226160 B / 4 | 619db039af44c7332182ff3d1eac8307e7ef680b5516b927ba38cdcecd0fac89 / 226160 B / 3 | no |
| Visit Savinjska — Rečica ob Savinji | 3 | 72f903256a14b9fad8059d972758f1cef15720574619dc47f51c74b487600849 | 6b308bf69a5b77a354266b78574864d40294c6570372497d21e7c728f9257d01 / 224657 B / 3 | 5400829d6fec336430add145992961a091bd85deefc911c0719581504926838c / 224657 B / 2 | no |
| Visit Savinjska — Solčava | 4 | b16de1261b9c619a96bfbf5fed025eb66ae14043a432ad3b04d12ca51d48d9ea | e33527916ae0c8b52d523d128a23a052738c2a32725a88674666cbd6b1a38090 / 229372 B / 4 | d153a13b86668b8521413a77088c8b96b6672b9dd644f7311ffa28f8e7a18125 / 229372 B / 3 | no |
| Visit Savinjska — Zgornja Savinjska dolina | 8 | 4fd482eec07e00ecdc8f4c5bfee5a0fec38ab49a830127f8aec4db6374354acb | 8b9bb8a6163472523a72f4ca022e946797b8862ac29129f2ff5fce7dc8b2a118 / 201593 B / 8 | 32a1fb38a219eb44082336c5418137e7daf3411ec7b184f5d1eeca443c73fc25 / 201593 B / 5 | no |

## Per-source extraction evidence

### Hribi.net — izhodišče Ljubno ob Savinji

- Source: https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315
- Final URL: https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315
- Snapshot SHA-256: 1f31857df7d186737626c93bd62be45ee9b23da603f45942edf0d448bf0eb02e
- Raw response size: 46913 bytes
- Extracted text size: 1458 bytes
- Extracted facts: 7
- Up to five stored fact names, verbatim from this run:
  - `Dom na Smrekovcu` — settlement: Ljubno ob Savinji; category: food
  - `Domžalski dom na Mali planini` — settlement: Ljubno ob Savinji; category: food
  - `Ljubno ob Savinji - Koča na Travniku` — settlement: Ljubno ob Savinji; category: food
  - `Ljubno ob Savinji - Planina Mali Travnik` — settlement: Ljubno ob Savinji; category: hike
  - `Ljubno ob Savinji - Sveti Primož nad Ljubnim` — settlement: Ljubno ob Savinji; category: trips

### Hribi.net — Kamniško-Savinjske Alpe

- Source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3
- Final URL: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3
- Snapshot SHA-256: 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7
- Raw response size: 95239 bytes
- Extracted text size: 8869 bytes
- Extracted facts: 298
- Up to five stored fact names, verbatim from this run:
  - `Ambrož pod Krvavcem` — settlement: not supplied; category: hike
  - `Apnišče` — settlement: not supplied; category: hike
  - `Apno` — settlement: not supplied; category: hike
  - `Baba` — settlement: not supplied; category: hike
  - `Bašeljski vrh` — settlement: not supplied; category: hike

### Hribi.net — Smrekovec

- Source: https://www.hribi.net/gora/smrekovec/3/485
- Final URL: https://www.hribi.net/gora/smrekovec/3/485
- Snapshot SHA-256: 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e
- Raw response size: 53685 bytes
- Extracted text size: 2333 bytes
- Extracted facts: 16
- Up to five stored fact names, verbatim from this run:
  - `Andrejev dom na Slemenu - Smrekovec` — settlement: not supplied; category: food
  - `Atelsko sedlo - Smrekovec` — settlement: not supplied; category: hike
  - `Bele Vode (Rebršak) - Smrekovec` — settlement: not supplied; category: hike
  - `Dom na Peci` — settlement: not supplied; category: food
  - `Dom na Smrekovcu` — settlement: not supplied; category: food

### Občina Gornji Grad

- Source: https://www.gornji-grad.si/
- Final URL: https://www.gornji-grad.si/
- Snapshot SHA-256: bcce4489a5c7a1572d946aab0dfcb0751123b0579d0b7c50a6ac4120b87d18eb
- Raw response size: 216983 bytes
- Extracted text size: 10663 bytes
- Extracted facts: 1
- Up to five stored fact names, verbatim from this run:
  - `TIC Gornji Grad` — settlement: Gornji Grad; category: sights

### Občina Ljubno

- Source: https://www.ljubno.si/
- Final URL: https://www.ljubno.si/
- Snapshot SHA-256: 2da0cb4b36c0a6f50e3b31f52dee97544c2f967105c1c2700e1c9a459af40c24
- Raw response size: 420603 bytes
- Extracted text size: 13586 bytes
- Extracted facts: 1
- Up to five stored fact names, verbatim from this run:
  - `KULTURNI DOM IN KONGRESNI CENTER KLS` — settlement: Ljubno ob Savinji; category: food

### Občina Luče

- Source: https://www.luce.si/
- Final URL: https://www.luce.si/
- Snapshot SHA-256: f1b2a3ed7b03a0b1e35500ed0a436f6188f0f88cb0ae16763d7dd806347cd5e4
- Raw response size: 323324 bytes
- Extracted text size: 15173 bytes
- Extracted facts: 0
- Up to five stored fact names, verbatim from this run:
  - none

### Občina Mozirje

- Source: https://mozirje.si/
- Final URL: https://mozirje.si/
- Snapshot SHA-256: 8804ec3587fd0fc53cfc110eb07379c514db8158f985ddf9df0b82824e680181
- Raw response size: 232255 bytes
- Extracted text size: 3880 bytes
- Extracted facts: 0
- Up to five stored fact names, verbatim from this run:
  - none

### Občina Nazarje

- Source: https://nazarje.si/
- Final URL: https://nazarje.si/
- Snapshot SHA-256: dcbbe368b6ab48fcbe1f968dac64ec9f7031b617097a646dc370f0daa1d448b7
- Raw response size: 391060 bytes
- Extracted text size: 19779 bytes
- Extracted facts: 1
- Up to five stored fact names, verbatim from this run:
  - `Javni zavod Muzej Vrbovec, Muzej gozdarstva in lesarstva Nazarje` — settlement: Nazarje; category: sights

### Občina Solčava

- Source: https://www.solcava.si/
- Final URL: https://www.solcava.si/
- Snapshot SHA-256: 9cf86176500e4c97939f2535d24d9a3e5c1c47769f6efaef39c33139fba700c4
- Raw response size: 206942 bytes
- Extracted text size: 13804 bytes
- Extracted facts: 0
- Up to five stored fact names, verbatim from this run:
  - none

### Visit Luče

- Source: https://visitluce.si/
- Final URL: https://visitluce.si/
- Snapshot SHA-256: 7751e360cbe3fcaedf95718c50557a2705d50748834f85ec6a407ba43056ba70
- Raw response size: 160843 bytes
- Extracted text size: 4775 bytes
- Extracted facts: 0
- Up to five stored fact names, verbatim from this run:
  - none

### Visit Savinjska — Ljubno

- Source: https://visitsavinjska.com/ljubno-ob-savinji/
- Final URL: https://visitsavinjska.com/ljubno-ob-savinji/
- Snapshot SHA-256: abdf343a290858af4e83a4c87b2c4c3f681df019777975eecc8b0cebc7fc6742
- Raw response size: 229345 bytes
- Extracted text size: 5176 bytes
- Extracted facts: 3
- Up to five stored fact names, verbatim from this run:
  - `Kamp Menina` — settlement: Ljubno ob Savinji; category: food
  - `Logarska dolina` — settlement: Ljubno ob Savinji; category: sights
  - `Smrekovec` — settlement: Ljubno ob Savinji; category: hike

### Visit Savinjska — Logarska dolina in krajinski parki

- Source: https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/
- Final URL: https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/
- Snapshot SHA-256: 6b1cbb31ee9215ec510c393938ebe0bbfb57aebfe71da1de905ba08ceb8305a2
- Raw response size: 232749 bytes
- Extracted text size: 5354 bytes
- Extracted facts: 5
- Up to five stored fact names, verbatim from this run:
  - `Kamp Menina` — settlement: not supplied; category: food
  - `Krajinski park Golte` — settlement: not supplied; category: sights
  - `Krajinski park Robanov kot` — settlement: not supplied; category: sights
  - `Logarska dolina` — settlement: not supplied; category: sights
  - `slap Rinka` — settlement: not supplied; category: sights

### Visit Savinjska — Mozirje

- Source: https://visitsavinjska.com/mozirje/
- Final URL: https://visitsavinjska.com/mozirje/
- Snapshot SHA-256: 619db039af44c7332182ff3d1eac8307e7ef680b5516b927ba38cdcecd0fac89
- Raw response size: 226160 bytes
- Extracted text size: 3873 bytes
- Extracted facts: 3
- Up to five stored fact names, verbatim from this run:
  - `Bushcraft Savinjska` — settlement: Mozirje; category: trips
  - `Kamp Menina` — settlement: Mozirje; category: food
  - `Logarska dolina` — settlement: Mozirje; category: sights

### Visit Savinjska — Rečica ob Savinji

- Source: https://visitsavinjska.com/recica-ob-savinji/
- Final URL: https://visitsavinjska.com/recica-ob-savinji/
- Snapshot SHA-256: 5400829d6fec336430add145992961a091bd85deefc911c0719581504926838c
- Raw response size: 224657 bytes
- Extracted text size: 2875 bytes
- Extracted facts: 2
- Up to five stored fact names, verbatim from this run:
  - `Kamp Menina` — settlement: Rečica ob Savinji; category: food
  - `Logarska dolina` — settlement: Rečica ob Savinji; category: sights

### Visit Savinjska — Solčava

- Source: https://visitsavinjska.com/solcava/
- Final URL: https://visitsavinjska.com/solcava/
- Snapshot SHA-256: d153a13b86668b8521413a77088c8b96b6672b9dd644f7311ffa28f8e7a18125
- Raw response size: 229372 bytes
- Extracted text size: 5164 bytes
- Extracted facts: 3
- Up to five stored fact names, verbatim from this run:
  - `Kamp Menina` — settlement: Solčava; category: food
  - `Logarska dolina` — settlement: Solčava; category: sights
  - `slap Rinka` — settlement: Solčava; category: sights

### Visit Savinjska — Zgornja Savinjska dolina

- Source: https://visitsavinjska.com/savinjska-in-saleska-dolina/
- Final URL: https://visitsavinjska.com/savinjska-in-saleska-dolina/
- Snapshot SHA-256: 32a1fb38a219eb44082336c5418137e7daf3411ec7b184f5d1eeca443c73fc25
- Raw response size: 201593 bytes
- Extracted text size: 3381 bytes
- Extracted facts: 5
- Up to five stored fact names, verbatim from this run:
  - `Kamp Menina` — settlement: not supplied; category: food
  - `Krajinski park Logarska dolina` — settlement: not supplied; category: sights
  - `Logarska dolina` — settlement: not supplied; category: sights
  - `slap Rinka` — settlement: not supplied; category: sights
  - `Snežna jama` — settlement: not supplied; category: sights

## Resolved candidates grouped by range

### excursion (89)

#### Apnišče

- Settlement: not supplied
- Category: hike
- Road distance: 51.2 km
- Driving duration: 78.9 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Apno

- Settlement: not supplied
- Category: hike
- Road distance: 39.1 km
- Driving duration: 61.1 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Bazilika Marije Pomagaj na Brezjah

- Settlement: not supplied
- Category: hike
- Road distance: 78.8 km
- Driving duration: 83.7 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Bezovec

- Settlement: not supplied
- Category: hike
- Road distance: 14.1 km
- Driving duration: 49.3 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Bivak na Kalu

- Settlement: not supplied
- Category: hike
- Road distance: 20.6 km
- Driving duration: 44.9 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Boskovec

- Settlement: not supplied
- Category: hike
- Road distance: 31.3 km
- Driving duration: 67.1 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Brana

- Settlement: not supplied
- Category: hike
- Road distance: 34.2 km
- Driving duration: 51.7 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Brunški vrh

- Settlement: not supplied
- Category: hike
- Road distance: 29.1 km
- Driving duration: 45.5 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Cojzova koča na Kokrskem sedlu

- Settlement: not supplied
- Category: food
- Road distance: 43.2 km
- Driving duration: 70.8 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Črnuški dom na Mali planini

- Settlement: not supplied
- Category: food
- Road distance: 30.3 km
- Driving duration: 59.5 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Dolgi hrbet

- Settlement: not supplied
- Category: hike
- Road distance: 56.9 km
- Driving duration: 85.2 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Dom na Dobrovljah

- Settlement: not supplied
- Category: food
- Road distance: 22.6 km
- Driving duration: 43.0 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Dom na Kisovcu

- Settlement: not supplied
- Category: food
- Road distance: 31.1 km
- Driving duration: 64.4 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Dom na Menini planini

- Settlement: not supplied
- Category: food
- Road distance: 29.1 km
- Driving duration: 59.0 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Dom na Smrekovcu

- Settlement: Ljubno ob Savinji
- Category: food
- Road distance: 15.7 km
- Driving duration: 47.8 min
- Sources:
  - https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315 — SHA-256 1f31857df7d186737626c93bd62be45ee9b23da603f45942edf0d448bf0eb02e
  - https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Dom v Kamniški Bistrici

- Settlement: not supplied
- Category: food
- Road distance: 39.9 km
- Driving duration: 50.9 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Domžalski dom na Mali planini

- Settlement: Ljubno ob Savinji
- Category: food
- Road distance: 30.3 km
- Driving duration: 59.5 min
- Sources:
  - https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315 — SHA-256 1f31857df7d186737626c93bd62be45ee9b23da603f45942edf0d448bf0eb02e
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Gora Oljka

- Settlement: not supplied
- Category: hike
- Road distance: 25.2 km
- Driving duration: 45.7 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Grad Velenje

- Settlement: not supplied
- Category: hike
- Road distance: 30.0 km
- Driving duration: 43.9 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Grad Žovnek

- Settlement: not supplied
- Category: hike
- Road distance: 29.1 km
- Driving duration: 46.7 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Izletniška kmetija Bukovc (Bukovnik)

- Settlement: not supplied
- Category: hike
- Road distance: 34.1 km
- Driving duration: 79.3 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Izvir Ponikvice

- Settlement: not supplied
- Category: hike
- Road distance: 39.7 km
- Driving duration: 55.5 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Jama Pekel

- Settlement: not supplied
- Category: hike
- Road distance: 36.8 km
- Driving duration: 50.8 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Jamna peč

- Settlement: not supplied
- Category: hike
- Road distance: 52.8 km
- Driving duration: 83.1 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Jarški dom na Mali planini

- Settlement: not supplied
- Category: food
- Road distance: 29.0 km
- Driving duration: 51.0 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Kalška gora

- Settlement: not supplied
- Category: hike
- Road distance: 43.2 km
- Driving duration: 70.7 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Kamniška koča na Kamniškem sedlu

- Settlement: not supplied
- Category: food
- Road distance: 34.2 km
- Driving duration: 51.8 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Kamniški Dedec

- Settlement: not supplied
- Category: hike
- Road distance: 43.9 km
- Driving duration: 74.2 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Kapelica na Molički planini (Kocbekovo zavetišče pod Ojstrico)

- Settlement: not supplied
- Category: hike
- Road distance: 61.4 km
- Driving duration: 75.7 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Koča na Loki pod Raduho

- Settlement: not supplied
- Category: food
- Road distance: 25.6 km
- Driving duration: 59.3 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Koča na Travniku

- Settlement: not supplied
- Category: food
- Road distance: 24.6 km
- Driving duration: 88.4 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Koča na Treh plotih

- Settlement: not supplied
- Category: food
- Road distance: 18.9 km
- Driving duration: 72.7 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Komen

- Settlement: not supplied
- Category: hike
- Road distance: 13.3 km
- Driving duration: 37.0 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Korošaški slapovi

- Settlement: not supplied
- Category: hike
- Road distance: 36.3 km
- Driving duration: 55.5 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Koželj

- Settlement: not supplied
- Category: hike
- Road distance: 31.8 km
- Driving duration: 48.0 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Krajinski park Robanov kot

- Settlement: not supplied
- Category: sights
- Road distance: 20.1 km
- Driving duration: 33.6 min
- Sources:
  - https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ — SHA-256 6b1cbb31ee9215ec510c393938ebe0bbfb57aebfe71da1de905ba08ceb8305a2

#### Kranjska koča na Ledinah

- Settlement: not supplied
- Category: food
- Road distance: 57.1 km
- Driving duration: 86.7 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Kranjska Rinka

- Settlement: not supplied
- Category: hike
- Road distance: 43.2 km
- Driving duration: 71.2 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Kriška planina

- Settlement: not supplied
- Category: hike
- Road distance: 42.4 km
- Driving duration: 73.2 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Križevnik

- Settlement: not supplied
- Category: hike
- Road distance: 21.1 km
- Driving duration: 44.0 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Krnes

- Settlement: not supplied
- Category: hike
- Road distance: 18.4 km
- Driving duration: 80.5 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Krofička

- Settlement: not supplied
- Category: hike
- Road distance: 32.8 km
- Driving duration: 53.1 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Kunšperski vrh (Brezovec)

- Settlement: not supplied
- Category: hike
- Road distance: 21.9 km
- Driving duration: 48.0 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Ledinski vrh

- Settlement: not supplied
- Category: hike
- Road distance: 44.2 km
- Driving duration: 78.7 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Lepenatka

- Settlement: not supplied
- Category: hike
- Road distance: 22.7 km
- Driving duration: 51.4 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Logarska dolina

- Settlement: Ljubno ob Savinji
- Category: sights
- Road distance: 31.0 km
- Driving duration: 49.8 min
- Sources:
  - https://visitsavinjska.com/ljubno-ob-savinji/ — SHA-256 abdf343a290858af4e83a4c87b2c4c3f681df019777975eecc8b0cebc7fc6742
  - https://visitsavinjska.com/savinjska-in-saleska-dolina/ — SHA-256 32a1fb38a219eb44082336c5418137e7daf3411ec7b184f5d1eeca443c73fc25
  - https://visitsavinjska.com/solcava/ — SHA-256 d153a13b86668b8521413a77088c8b96b6672b9dd644f7311ffa28f8e7a18125
  - https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ — SHA-256 6b1cbb31ee9215ec510c393938ebe0bbfb57aebfe71da1de905ba08ceb8305a2
  - https://visitsavinjska.com/recica-ob-savinji/ — SHA-256 5400829d6fec336430add145992961a091bd85deefc911c0719581504926838c
  - https://visitsavinjska.com/mozirje/ — SHA-256 619db039af44c7332182ff3d1eac8307e7ef680b5516b927ba38cdcecd0fac89

#### Logarska peč

- Settlement: not supplied
- Category: hike
- Road distance: 30.0 km
- Driving duration: 71.6 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Lovska koča Črnevka

- Settlement: not supplied
- Category: food
- Road distance: 42.5 km
- Driving duration: 65.9 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Lučka Brana (Baba)

- Settlement: not supplied
- Category: hike
- Road distance: 33.4 km
- Driving duration: 50.2 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Mala Raduha

- Settlement: not supplied
- Category: hike
- Road distance: 26.4 km
- Driving duration: 63.3 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Mala Rinka

- Settlement: not supplied
- Category: hike
- Road distance: 34.2 km
- Driving duration: 51.6 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Malo Gradišče

- Settlement: not supplied
- Category: hike
- Road distance: 29.2 km
- Driving duration: 42.9 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Matkov kot

- Settlement: not supplied
- Category: hike
- Road distance: 30.4 km
- Driving duration: 47.3 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Matkova kopa

- Settlement: not supplied
- Category: hike
- Road distance: 33.6 km
- Driving duration: 77.4 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Mešenik

- Settlement: not supplied
- Category: hike
- Road distance: 39.4 km
- Driving duration: 50.3 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Mokrišče Blata

- Settlement: not supplied
- Category: hike
- Road distance: 77.1 km
- Driving duration: 86.3 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Mozirska koča na Golteh

- Settlement: not supplied
- Category: food
- Road distance: 30.2 km
- Driving duration: 50.8 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Mrzla gora

- Settlement: not supplied
- Category: hike
- Road distance: 33.8 km
- Driving duration: 78.8 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Najevska lipa

- Settlement: not supplied
- Category: hike
- Road distance: 24.7 km
- Driving duration: 77.7 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Ojstrica

- Settlement: not supplied
- Category: hike
- Road distance: 32.7 km
- Driving duration: 52.3 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Planinski dom Milana Šinkovca

- Settlement: not supplied
- Category: food
- Road distance: 45.1 km
- Driving duration: 61.6 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Planinski dom Šentjungert

- Settlement: not supplied
- Category: food
- Road distance: 47.0 km
- Driving duration: 64.5 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Planjava - zahodni vrh

- Settlement: not supplied
- Category: hike
- Road distance: 33.5 km
- Driving duration: 50.4 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Poljanski rob

- Settlement: not supplied
- Category: hike
- Road distance: 30.7 km
- Driving duration: 61.8 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Prevala

- Settlement: not supplied
- Category: hike
- Road distance: 27.9 km
- Driving duration: 82.3 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Prgozdnik

- Settlement: not supplied
- Category: hike
- Road distance: 48.2 km
- Driving duration: 75.2 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Račka vrata

- Settlement: not supplied
- Category: hike
- Road distance: 20.0 km
- Driving duration: 37.7 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Razgledišče Skroti

- Settlement: not supplied
- Category: hike
- Road distance: 27.8 km
- Driving duration: 42.5 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Rjavčki vrh (Planinšca)

- Settlement: not supplied
- Category: hike
- Road distance: 32.7 km
- Driving duration: 52.3 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Sevčnik

- Settlement: not supplied
- Category: hike
- Road distance: 33.6 km
- Driving duration: 56.0 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Skubrov vrh

- Settlement: not supplied
- Category: hike
- Road distance: 54.5 km
- Driving duration: 76.7 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Skuta

- Settlement: not supplied
- Category: hike
- Road distance: 43.2 km
- Driving duration: 71.2 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Slap Peračica

- Settlement: not supplied
- Category: hike
- Road distance: 79.3 km
- Driving duration: 85.3 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### slap Rinka

- Settlement: not supplied
- Category: sights
- Road distance: 34.2 km
- Driving duration: 51.6 min
- Sources:
  - https://visitsavinjska.com/savinjska-in-saleska-dolina/ — SHA-256 32a1fb38a219eb44082336c5418137e7daf3411ec7b184f5d1eeca443c73fc25
  - https://visitsavinjska.com/solcava/ — SHA-256 d153a13b86668b8521413a77088c8b96b6672b9dd644f7311ffa28f8e7a18125
  - https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ — SHA-256 6b1cbb31ee9215ec510c393938ebe0bbfb57aebfe71da1de905ba08ceb8305a2

#### Snežna jama

- Settlement: not supplied
- Category: sights
- Road distance: 27.3 km
- Driving duration: 70.0 min
- Sources:
  - https://visitsavinjska.com/savinjska-in-saleska-dolina/ — SHA-256 32a1fb38a219eb44082336c5418137e7daf3411ec7b184f5d1eeca443c73fc25

#### Storžek

- Settlement: not supplied
- Category: hike
- Road distance: 57.1 km
- Driving duration: 86.8 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Strelovec

- Settlement: not supplied
- Category: hike
- Road distance: 34.9 km
- Driving duration: 73.4 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Sveta Mati Božja na Čreti

- Settlement: not supplied
- Category: hike
- Road distance: 74.4 km
- Driving duration: 81.7 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Sveta Radegunda (Radegunda)

- Settlement: not supplied
- Category: hike
- Road distance: 25.3 km
- Driving duration: 44.3 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Sveti Miklavž na Gori

- Settlement: not supplied
- Category: hike
- Road distance: 72.3 km
- Driving duration: 80.4 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Šoštanj

- Settlement: not supplied
- Category: hike
- Road distance: 26.9 km
- Driving duration: 40.5 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Štajerska Rinka

- Settlement: not supplied
- Category: hike
- Road distance: 34.2 km
- Driving duration: 51.6 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Štefanja gora

- Settlement: not supplied
- Category: hike
- Road distance: 51.1 km
- Driving duration: 78.5 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Turska gora

- Settlement: not supplied
- Category: hike
- Road distance: 34.2 km
- Driving duration: 51.6 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Velika (Koroška) Baba

- Settlement: not supplied
- Category: hike
- Road distance: 57.2 km
- Driving duration: 87.0 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Velika Raduha

- Settlement: not supplied
- Category: hike
- Road distance: 26.5 km
- Driving duration: 63.8 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Vivodnik

- Settlement: not supplied
- Category: hike
- Road distance: 29.5 km
- Driving duration: 64.6 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Vovar

- Settlement: not supplied
- Category: hike
- Road distance: 27.5 km
- Driving duration: 41.8 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

#### Zavetišče na Biba planini

- Settlement: not supplied
- Category: hike
- Road distance: 28.4 km
- Driving duration: 70.7 min
- Sources:
  - https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

## Unresolved candidates grouped by category

### food (29)

- **Andrejev dom na Slemenu - Smrekovec** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **Češka koča na Spodnjih Ravneh** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Dom Čemšenik** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Dom na Čreti** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Dom na Gospincu (Hotel Rozka)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Dom na Kališču** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Dom na Krvavcu** — settlement: not supplied; reason: `hard-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Dom na Lovrencu (Bašelj)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Dom na Okrešlju** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Dom na Peci** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **Dom na Smrekovcu - Smrekovec** — settlement: not supplied; reason: `hard-ceiling`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **Dom planincev Farbanca** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Dom pod Storžičem** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Hotel Golte** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Hotel Krvavec** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kamp Menina** — settlement: Ljubno ob Savinji; reason: `name-mismatch`
  - source: https://visitsavinjska.com/ljubno-ob-savinji/ — SHA-256 abdf343a290858af4e83a4c87b2c4c3f681df019777975eecc8b0cebc7fc6742
  - source: https://visitsavinjska.com/savinjska-in-saleska-dolina/ — SHA-256 32a1fb38a219eb44082336c5418137e7daf3411ec7b184f5d1eeca443c73fc25
  - source: https://visitsavinjska.com/solcava/ — SHA-256 d153a13b86668b8521413a77088c8b96b6672b9dd644f7311ffa28f8e7a18125
  - source: https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ — SHA-256 6b1cbb31ee9215ec510c393938ebe0bbfb57aebfe71da1de905ba08ceb8305a2
  - source: https://visitsavinjska.com/recica-ob-savinji/ — SHA-256 5400829d6fec336430add145992961a091bd85deefc911c0719581504926838c
  - source: https://visitsavinjska.com/mozirje/ — SHA-256 619db039af44c7332182ff3d1eac8307e7ef680b5516b927ba38cdcecd0fac89

- **Kocbekov dom na Korošici** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Koča na Dobrči** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Koča na Grohatu** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Koča na Klemenči jami** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Koča na Kriški gori** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Krničarjeva koča na Planini Javornik** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **KULTURNI DOM IN KONGRESNI CENTER KLS** — settlement: Ljubno ob Savinji; reason: `no-results`
  - source: https://www.ljubno.si/ — SHA-256 2da0cb4b36c0a6f50e3b31f52dee97544c2f967105c1c2700e1c9a459af40c24

- **Ljubno ob Savinji - Koča na Travniku** — settlement: Ljubno ob Savinji; reason: `no-results`
  - source: https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315 — SHA-256 1f31857df7d186737626c93bd62be45ee9b23da603f45942edf0d448bf0eb02e

- **Ovča koča** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planinska koča Iskra na Jakobu** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planinska koča pri Franciju** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Praprotnikova koča** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sankaška koča** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

### hike (204)

- **Ambrož pod Krvavcem** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Atelsko sedlo - Smrekovec** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **Baba** — settlement: not supplied; reason: `hard-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Bašeljski vrh** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Bele Vode (Rebršak) - Smrekovec** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **Bezovec (Dobrovlje)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Bistriška planina** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Bivak pod Grintovcem** — settlement: not supplied; reason: `equally-plausible`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Bivak pod Mrzlim vrhom** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Bivak pod Skuto** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Bivak v Kočni** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Božičev slap** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Breška planina** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Brezovec** — settlement: not supplied; reason: `road-distance-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Cerkev sv. Petra nad Črno pri Kamniku** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Cirkovnica** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Cjanovca** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Čisovec** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Črno jezero (Končnikova mlakuža)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Deska (Veža)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Dleskovec** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Dobrča** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Dunajska bajta** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Goli vrh** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Goli vrh (Šavnice)** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Golte (Alpski vrt) - Smrekovec** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **Gostišče Zeleni Rob** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Grad Gutenberk (Hudi grad)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Grad Kamen** — settlement: not supplied; reason: `hard-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Gradišče (Pustinjak)** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Gradišče (Velika planina)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Grebenc** — settlement: not supplied; reason: `road-distance-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Grintovec** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Grmada (Dobrovlje)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Icmanikova planina** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Izvir Ljubije - Smrekovec (po cesti)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **Izvir Ljubije - Smrekovec (preko Leskovškove pustote)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **Izvir Ločanke** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Jama Jespa** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Jamarski bivak na Dleskovški planoti** — settlement: not supplied; reason: `road-distance-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Javorca (Golte)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Javorje (Mala Črna) - Smrekovec (čez Bukov stan)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **Javorje (Mala Črna) - Smrekovec (po cesti)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **Javornik nad Jezerskim** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Javorov vrh** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Jenkova planina** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Jezerska Kočna** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kalški greben** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kamniški vrh** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kapela Marije Snežne (Velika planina)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kašna planina** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Knezova planina** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Knezova planina (Planina Bela peč)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kogel** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kokrska Kočna** — settlement: not supplied; reason: `equally-plausible`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kompotela** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Konj** — settlement: not supplied; reason: `road-distance-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kopa (Belska Kopa)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kopa (Partizanski vrh)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Koritni vrh (Velika planina)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Koroška Rinka (Križ)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Košutna** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kozji vrh** — settlement: not supplied; reason: `road-distance-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kramarica - Smrekovec (čez Bukov stan)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **Kramarica - Smrekovec (po cesti)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **Kranjska reber** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kriva jelka** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Krvavec** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kržišče (Pokovše)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Kup (na Raduhi)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Lanež** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Lastovec** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Ledenica na Golteh** — settlement: not supplied; reason: `road-distance-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Lešanska planina** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Licjanovec** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Lipnik (pri Velenju)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Ljubenske Rastke (Kumprej) - Smrekovec** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **Ljubenske Rastke (Vrnivšek) - Smrekovec** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **Ljubno ob Savinji - Planina Mali Travnik** — settlement: Ljubno ob Savinji; reason: `no-results`
  - source: https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315 — SHA-256 1f31857df7d186737626c93bd62be45ee9b23da603f45942edf0d448bf0eb02e

- **Ljubno ob Savinji - Veliki Travnik (Turnovka)** — settlement: Ljubno ob Savinji; reason: `no-results`
  - source: https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315 — SHA-256 1f31857df7d186737626c93bd62be45ee9b23da603f45942edf0d448bf0eb02e

- **Lomek (Lom)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Lučki Dedec** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Mala Ojstrica** — settlement: not supplied; reason: `road-distance-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Mala Poljana** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Mali Grintovec** — settlement: not supplied; reason: `equally-plausible`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Mali Rogatec (Mali Rogac)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Mali Travnik** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Mali vrh nad Završnico** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Malo Apno** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Medvedjak** — settlement: not supplied; reason: `road-distance-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Mihčeva kopišča** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Mokrica** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Molička peč** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Murijeva planina** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Na Križu (Kokrska Kočna)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Najvišji rob (Zeleniške špice)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Novi grad (Pusti grad)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Ojstri vrh (nad Prevalo)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Orlovo gnezdo (Slap Rinka)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Partizanska bolnica Mrzle vode** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planica (vzletišče Gozd)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Arta** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Dol** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Dolga njiva** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Dolga njiva (Krvavec)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Dolga trata** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Javorje** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Jezerca** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Kališče** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Konjščica (Velika planina)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Koren** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Košutna** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Mali Travnik** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Marjanine njive** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Osredek** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Podvežak** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Polšak** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Ravne** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Ravni** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Rzenik** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Travnik** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Vodol** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planina Vodole** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planjava** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Planjava pri Kamniškem vrhu** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Pleče** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Plesnikova planina** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Počka (Robnikova) planina** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Pogorišče** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Potoška gora** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Povšnarjeva planina** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Požiralnik Ponikvice** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Pri Pastirjih** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Robanova planina** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Rzenik** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sebenje** — settlement: not supplied; reason: `blocked-class-or-addresstype`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Senčnica Josipine Turnograjske** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Skutman** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Slap Čedca** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Slap Orglice** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Slap Palenk** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Smokuški vrh** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Smolnik** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Smrekovec** — settlement: Ljubno ob Savinji; reason: `duration-ceiling`
  - source: https://visitsavinjska.com/ljubno-ob-savinji/ — SHA-256 abdf343a290858af4e83a4c87b2c4c3f681df019777975eecc8b0cebc7fc6742
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Spominski park v Kamniški Bistrici** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Srednji vrh** — settlement: not supplied; reason: `road-distance-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Stiška vas** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Storžič** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sv. Miklavž nad Mačami** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveta Ana (Tunjice)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveta Neža (Brezje pri Tržiču)** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Ahac (Kališe)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Florjan nad Gornjim Gradom** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Jakob (Jakec)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Janez in Pavel (Dobrovlje)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Jošt nad Vranskim** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Jurij nad Tržičem** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Križ (Kriška gora) nad Belimi Vodami** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Lenart nad Gornjim Gradom** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Lovrenc (Bašelj)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Lovrenc nad Zabreznico** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Nikolaj (Možjanca)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Peter nad Begunjami** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Primož nad Kamnikom** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Primož nad Ljubnim** — settlement: Ljubno ob Savinji; reason: `no-results`
  - source: https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315 — SHA-256 1f31857df7d186737626c93bd62be45ee9b23da603f45942edf0d448bf0eb02e
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Sveti Vid (nad Zgornjim Tuhinjem)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Šentanski vrh** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Šenturška Gora** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Škrbina (Slaparjeva gora)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Šobčev bajer** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Špic** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Štruca** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Tolsti vrh** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Tolsti vrh (Dobrovlje)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Tolsti vrh (Veža)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Tominčev slap** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Turistična kmetija Trnovc** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Turni** — settlement: not supplied; reason: `equally-plausible`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Turni (pri Kozjem vrhu)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Uršlja gora** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gora/smrekovec/3/485 — SHA-256 3b5f2a80153540d5374090d0cdc129de9a9565f98636ba492fd8457930d56b8e

- **V Boštkú** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Vaško** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Velika Poljana** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Velika Zelenica** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Veliki Rogatec (Veliki Rogac)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Veliki Travnik (Turnovka)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Veliki vrh** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Veliki vrh (Veža)** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Veliki vrh nad Matkovim kotom** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Veliki Zvoh** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Veliko Gradišče** — settlement: not supplied; reason: `road-distance-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Vežica** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Vinski vrh (Vimperk)** — settlement: not supplied; reason: `name-mismatch`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Visoki vrh nad Jezerskim** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Vodotočno jezero (Veža)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Vrata** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Vratca** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Vrh Korena** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Vrhe** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Vrholanov vrh (Ravne pri Šoštanju)** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Vršiči** — settlement: not supplied; reason: `road-distance-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Zapečnikova planina** — settlement: not supplied; reason: `no-results`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Zavetišče v Gozdu** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

- **Zavetišče v Hudičevem borštu** — settlement: not supplied; reason: `duration-ceiling`
  - source: https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 — SHA-256 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7

### sights (4)

- **Javni zavod Muzej Vrbovec, Muzej gozdarstva in lesarstva Nazarje** — settlement: Nazarje; reason: `no-results`
  - source: https://nazarje.si/ — SHA-256 dcbbe368b6ab48fcbe1f968dac64ec9f7031b617097a646dc370f0daa1d448b7

- **Krajinski park Golte** — settlement: not supplied; reason: `no-results`
  - source: https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ — SHA-256 6b1cbb31ee9215ec510c393938ebe0bbfb57aebfe71da1de905ba08ceb8305a2

- **Krajinski park Logarska dolina** — settlement: not supplied; reason: `name-mismatch`
  - source: https://visitsavinjska.com/savinjska-in-saleska-dolina/ — SHA-256 32a1fb38a219eb44082336c5418137e7daf3411ec7b184f5d1eeca443c73fc25

- **TIC Gornji Grad** — settlement: Gornji Grad; reason: `no-results`
  - source: https://www.gornji-grad.si/ — SHA-256 bcce4489a5c7a1572d946aab0dfcb0751123b0579d0b7c50a6ac4120b87d18eb

### trips (2)

- **Bushcraft Savinjska** — settlement: Mozirje; reason: `no-results`
  - source: https://visitsavinjska.com/mozirje/ — SHA-256 619db039af44c7332182ff3d1eac8307e7ef680b5516b927ba38cdcecd0fac89

- **Ljubno ob Savinji - Sveti Primož nad Ljubnim** — settlement: Ljubno ob Savinji; reason: `no-results`
  - source: https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315 — SHA-256 1f31857df7d186737626c93bd62be45ee9b23da603f45942edf0d448bf0eb02e

## Guard verification

- Exactly 16 approved sources were snapshotted; the two blocked sources were not read.
- The Gril draft remained unpublished.
- The protected production tenant was neither read nor written.
- The protected legacy development tenant and its 60 proposals were unchanged.
- No descriptions, translations, or guest items were created.
- The run persisted all 355 Nominatim attempt records and measured a minimum 1000 ms interval.
