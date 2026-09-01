# Fresh Ljubno depth-one grounded Creator run — evidence report

Development-only tenant: **Piknik prostor in kamp Gril**
Address: **Ter 35, 3333 Ljubno ob Savinji**
Run ID: **dc41af8e-cf46-4965-a8a0-935fcea55c5f**
Replaced run ID: **584dca56-1d0a-4049-9ad6-d6cfef535114**
Started: **2026-09-01T07:03:02.733332+00:00**
Completed: **2026-09-01T07:33:38.069+00:00**
Published: **No**

## Completion and safety invariants

- Run status: completed
- Source decisions: 15 approved, 2 rejected, 1 revoked
- Approved source details: 15
- Rejected/revoked snapshots in run: 0
- Tenant remains draft: true
- Tenant remains unpublished: true
- Run proposals ready only after reconciliation: 356
- Pending candidates after completion: 0
- Descriptions created: 0
- Translation rows created: 0
- Guest items created: 0
- Protected legacy development proposal baseline: 60
- Protected production tenant: not queried or accessed
- Publication performed: No

## Totals

| Metric | Value |
|---|---:|
| Stored page observations | 319 |
| Unique run snapshots | 319 |
| Persisted grounded facts | 685 |
| Candidate-fact links | 685 |
| Deduplicated candidates | 356 |
| Run-owned proposals | 356 |
| Resolved and routed | 74 |
| Unresolved | 282 |
| Duplicate provenance links merged | 329 |
| Route evidence rows | 134 |

## Hard budget evidence

| Resource | Used | Limit | Utilization |
|---|---:|---:|---:|
| observedPages | 319 | 915 | 34.9% |
| rawBytes | 54.65 MiB | 64.00 MiB | 85.4% |
| extractedTextBytes | 1.42 MiB | 48.00 MiB | 3.0% |
| modelChunks | 42 | 700 | 6.0% |
| modelRequests | 42 | 700 | 6.0% |
| inputTokens | 495944 | 4000000 | 12.4% |
| outputTokens | 76086 | 250000 | 30.4% |
| acceptedFacts | 685 | 4000 | 17.1% |
| modelCostUsd | $2.073035 | $10.00 | 20.7% |
| elapsedMs | 30.59 min | 60 min | 51.0% |

Budget failure: **none**

## Model usage

- Model requests: 42
- Deterministic chunks: 42
- Input tokens: 495944
- Output tokens: 76086
- Measured cost: $2.073035

## Category, range, failure, and grounding totals

### Categories

- act: 94
- food: 39
- hike: 217
- sights: 302
- trips: 33

### Ranges

- excursion: 72
- near: 2

### Unresolved reasons

- no-results: 159
- duration-ceiling: 41
- name-mismatch: 38
- road-distance-ceiling: 19
- hard-ceiling: 16
- blocked-class-or-addresstype: 6
- equally-plausible: 3

### Grounding rejections

- duplicate: 2
- invalid_category: 0
- invalid_shape: 0
- metadata_noise: 2
- missing_evidence: 15
- unsupported_name: 348
- unsupported_settlement: 2

## Eight reference places

| Requested place | Status | Matched candidate | Failure reason |
|---|---|---|---|
| Skakalni center Savina | not-extracted |  |  |
| Golte | resolved | Golte |  |
| Mozirski gaj | resolved | Mozirski gaj |  |
| Logarska dolina | resolved | Logarska dolina |  |
| slap Rinka | resolved | Slap Rinka |  |
| Snežna jama | resolved | Snežna jama |  |
| Robanov kot | resolved | Robanov kot |  |
| Muzej gozdarstva in lesarstva | resolved | MUZEJ GOZDARSTVA IN LESARSTVA |  |

## Nominatim and OSRM evidence

- Nominatim HTTP attempts: 414
- Minimum observed interval between Nominatim starts: 999 ms
- Nominatim retries: 0
- Nominatim errors/timeouts: 0
- Nominatim HTTP statuses: 200=414
- Nominatim stop circuit: not opened
- OSRM/route evidence rows: 134
- Resolved routes: 74
- Route and resolution refusal totals are listed above; every resolved row below includes road distance and travel duration.

## Per-source crawl and model summary

| Source | Seed | Stored | Skipped | Raw | Text | Facts | Model req. | Cost | Skip reasons |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Hribi.net — izhodišče Ljubno ob Savinji | https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315 | 41 | 0 | 2.65 MiB | 136.0 KiB | 140 | 5 | $0.3039 |  |
| Hribi.net — Smrekovec | https://www.hribi.net/gora/smrekovec/3/485 | 61 | 0 | 3.95 MiB | 202.7 KiB | 192 | 7 | $0.3800 |  |
| Občina Gornji Grad | https://www.gornji-grad.si/ | 20 | 75 | 3.93 MiB | 141.3 KiB | 3 | 3 | $0.1308 | non-content-path=53, source-byte-cap=22 |
| Občina Ljubno | https://www.ljubno.si/ | 10 | 80 | 3.94 MiB | 94.2 KiB | 3 | 3 | $0.0910 | non-content-path=51, network=1, source-byte-cap=28 |
| Občina Luče | https://www.luce.si/ | 15 | 106 | 3.87 MiB | 127.0 KiB | 31 | 2 | $0.1161 | non-content-path=60, source-byte-cap=46 |
| Občina Mozirje | https://mozirje.si/ | 24 | 16 | 3.86 MiB | 89.6 KiB | 5 | 3 | $0.0988 | non-content-path=4, source-byte-cap=12 |
| Občina Nazarje | https://nazarje.si/ | 13 | 141 | 3.72 MiB | 100.7 KiB | 30 | 2 | $0.1005 | non-content-path=52, source-byte-cap=48, page-cap=41 |
| Občina Solčava | https://www.solcava.si/ | 24 | 70 | 3.98 MiB | 189.2 KiB | 5 | 3 | $0.2014 | non-content-path=46, source-byte-cap=24 |
| Visit Luče | https://visitluce.si/ | 13 | 0 | 1.57 MiB | 45.2 KiB | 25 | 2 | $0.0481 |  |
| Visit Savinjska — Ljubno | https://visitsavinjska.com/ljubno-ob-savinji/ | 16 | 25 | 3.81 MiB | 55.3 KiB | 17 | 2 | $0.0760 | network=1, source-byte-cap=22, non-content-path=2 |
| Visit Savinjska — Logarska dolina in krajinski parki | https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ | 16 | 24 | 3.84 MiB | 63.3 KiB | 46 | 2 | $0.1142 | network=1, non-content-path=9, source-byte-cap=14 |
| Visit Savinjska — Mozirje | https://visitsavinjska.com/mozirje/ | 17 | 24 | 3.96 MiB | 51.9 KiB | 54 | 2 | $0.0952 | network=1, source-byte-cap=21, non-content-path=2 |
| Visit Savinjska — Rečica ob Savinji | https://visitsavinjska.com/recica-ob-savinji/ | 17 | 13 | 3.97 MiB | 47.3 KiB | 27 | 2 | $0.1026 | network=3, source-byte-cap=8, non-content-path=2 |
| Visit Savinjska — Solčava | https://visitsavinjska.com/solcava/ | 16 | 25 | 3.81 MiB | 57.4 KiB | 45 | 2 | $0.1189 | network=2, source-byte-cap=21, non-content-path=2 |
| Visit Savinjska — Zgornja Savinjska dolina | https://visitsavinjska.com/savinjska-in-saleska-dolina/ | 16 | 23 | 3.79 MiB | 54.1 KiB | 62 | 2 | $0.0954 | network=1, source-byte-cap=21, non-content-path=1 |

## Stored page provenance


### Hribi.net — izhodišče Ljubno ob Savinji

Seed: https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 1 | https://www.hribi.net/ | https://www.hribi.net/ | 2026-09-01T07:17:00.814Z | 2026-09-01T07:17:00.815Z | 563fb00eaf29c625b97eefc159c363431a5eb97f5a2fc3029141598b24761625 | 73475 | 6394 | 10 |
| 1 | https://www.hribi.net/alpske_zivali | https://www.hribi.net/alpske_zivali | 2026-09-01T07:17:01.250Z | 2026-09-01T07:17:01.253Z | e5e431795264414256ddf7edf8e1f7a7f07bb8fdf08f36bfd5d85fbf17b06706 | 97229 | 30890 | 0 |
| 1 | https://www.hribi.net/donacije.aspx | https://www.hribi.net/donacije.aspx | 2026-09-01T07:17:01.442Z | 2026-09-01T07:17:01.443Z | 0811ce2993714e1d31388b70f661a4d62ed0bf41344aff12016a746a4dba6a62 | 36562 | 1161 | 0 |
| 1 | https://www.hribi.net/geslo.asp | https://www.hribi.net/geslo.asp | 2026-09-01T07:17:01.630Z | 2026-09-01T07:17:01.631Z | 9f9bddc6e20695fe0ad2a84704ddb47b517193ce79ce1ad9940b4f0aa5073b6d | 33699 | 676 | 0 |
| 1 | https://www.hribi.net/gora/sveti_primoz_nad_ljubnim/3/617 | https://www.hribi.net/gora/sveti_primoz_nad_ljubnim/3/617 | 2026-09-01T07:17:01.829Z | 2026-09-01T07:17:01.830Z | 8606250693379e9722229c65633d93696b4f344d4ee966f419914be6500bf32f | 48933 | 1568 | 1 |
| 1 | https://www.hribi.net/gorovja | https://www.hribi.net/gorovja | 2026-09-01T07:17:02.027Z | 2026-09-01T07:17:02.028Z | 36235080ebfee852d2ec84cf3f1324272e0ff4f7163ddc0e199de0db844c1a8b | 35888 | 1115 | 0 |
| 1 | https://www.hribi.net/gorske_panorame | https://www.hribi.net/gorske_panorame | 2026-09-01T07:17:02.217Z | 2026-09-01T07:17:02.217Z | 5e548ebaec12ec0282707fc5533e9fb15b11b970b02fa6c4b6b9f8c0dbdbfeb4 | 34678 | 887 | 0 |
| 1 | https://www.hribi.net/gps.asp | https://www.hribi.net/gps.asp | 2026-09-01T07:17:02.411Z | 2026-09-01T07:17:02.412Z | b11de0b2e81e48d1ee500d7a6127a2803a322d591b766748361388268be6f1e7 | 45218 | 1748 | 1 |
| 1 | https://www.hribi.net/iskalnik_izletov | https://www.hribi.net/iskalnik_izletov | 2026-09-01T07:17:02.605Z | 2026-09-01T07:17:02.606Z | f96acd89947c322c976da670f0b3f551402e61556e51b11287f4a5c51fa6941f | 57376 | 1180 | 0 |
| 1 | https://www.hribi.net/izhodisce/ljubenske_rastke/46.38510/14.84640 | https://www.hribi.net/izhodisce/ljubenske_rastke/46.38510/14.84640 | 2026-09-01T07:17:02.810Z | 2026-09-01T07:17:02.811Z | 59aa1ad58e7728fdecf52e5486a4469e7d47c0615c5c2c0072dea5d3e47206a1 | 46862 | 1454 | 5 |
| 0 | https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315 | https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315 | 2026-09-01T07:17:00.330Z | 2026-08-31T21:56:02.005Z | 1f31857df7d186737626c93bd62be45ee9b23da603f45942edf0d448bf0eb02e | 46913 | 1458 | 3 |
| 1 | https://www.hribi.net/izhodisce/primoz_pri_ljubnem/46.36850/14.81740 | https://www.hribi.net/izhodisce/primoz_pri_ljubnem/46.36850/14.81740 | 2026-09-01T07:17:03.012Z | 2026-09-01T07:17:03.013Z | 87cf3d1bcc7c8f401c8095c8fb2fd1110975ecc7d5d60baf7c7e287fafb6d33d | 46011 | 1294 | 3 |
| 1 | https://www.hribi.net/izhodisce/raduha_struge/46.36572/14.77337 | https://www.hribi.net/izhodisce/raduha_struge/46.36572/14.77337 | 2026-09-01T07:17:03.215Z | 2026-09-01T07:17:03.217Z | 9b76a04e265c452e1ac978542516437459f9cd3e49e8d9ea9107067751540337 | 47359 | 1556 | 4 |
| 1 | https://www.hribi.net/izlet/ljubno_ob_savinji_koca_na_travniku/3/489/3391 | https://www.hribi.net/izlet/ljubno_ob_savinji_koca_na_travniku/3/489/3391 | 2026-09-01T07:17:03.427Z | 2026-09-01T07:17:03.428Z | 9fb3bccb184726f2f001f305401c2181397b9a39f6fef0dbfa110ea2fd9c0079 | 80291 | 5939 | 3 |
| 1 | https://www.hribi.net/izlet/ljubno_ob_savinji_planina_mali_travnik/3/1236/3390 | https://www.hribi.net/izlet/ljubno_ob_savinji_planina_mali_travnik/3/1236/3390 | 2026-09-01T07:17:03.632Z | 2026-09-01T07:17:03.633Z | a19e894e6dc2d32c351feb92d97ecaa545ad07cd7ae057312f717279095ccbde | 76197 | 5393 | 4 |
| 1 | https://www.hribi.net/izlet/ljubno_ob_savinji_sveti_primoz_nad_ljubnim/3/617/3389 | https://www.hribi.net/izlet/ljubno_ob_savinji_sveti_primoz_nad_ljubnim/3/617/3389 | 2026-09-01T07:17:03.829Z | 2026-09-01T07:17:03.830Z | 80567f52cb82d7aeaf23f57190e5a7378886df14827c4c66896d1b026233e077 | 61014 | 3556 | 2 |
| 1 | https://www.hribi.net/izlet/ljubno_ob_savinji_veliki_travnik_turnovka/3/488/3392 | https://www.hribi.net/izlet/ljubno_ob_savinji_veliki_travnik_turnovka/3/488/3392 | 2026-09-01T07:17:04.037Z | 2026-09-01T07:17:04.038Z | de28ecd1bd6a24362839bcf12a9bd7102e481fb5c59c9050ef36d0595e001748 | 89133 | 6536 | 3 |
| 1 | https://www.hribi.net/kviz.asp | https://www.hribi.net/kviz.asp | 2026-09-01T07:17:04.225Z | 2026-09-01T07:17:04.226Z | f504f2bbf196db9a02a7a625aeb87b787ed0212ab93c68a9dcd6563677b7978f | 33208 | 563 | 0 |
| 1 | https://www.hribi.net/mali_oglasi | https://www.hribi.net/mali_oglasi | 2026-09-01T07:17:04.424Z | 2026-09-01T07:17:04.425Z | b3722f30a1c79598d315e485e34ebab3629d14cbdf3cf2eb996d5807a824b59a | 55723 | 2067 | 1 |
| 1 | https://www.hribi.net/najslike.asp | https://www.hribi.net/najslike.asp | 2026-09-01T07:17:04.633Z | 2026-09-01T07:17:04.635Z | 1858290b75b82eb60e1e8831647be25f04d617857053f2b0ec5fd8c084d7143d | 56603 | 2782 | 2 |
| 1 | https://www.hribi.net/pogoji.asp | https://www.hribi.net/pogoji.asp | 2026-09-01T07:17:04.823Z | 2026-09-01T07:17:04.825Z | 5408983153f55b2e370444f363644847861dd87b8706ece5ebc81554d59fd294 | 36604 | 3797 | 0 |
| 1 | https://www.hribi.net/prireditve.asp | https://www.hribi.net/prireditve.asp | 2026-09-01T07:17:05.014Z | 2026-09-01T07:17:05.015Z | 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a | 54358 | 14732 | 19 |
| 1 | https://www.hribi.net/rastline | https://www.hribi.net/rastline | 2026-09-01T07:17:05.239Z | 2026-09-01T07:17:05.240Z | 1f61c8ccc10b7dc83e09869538942a3d781d48d72d9151165804680a3e77dfa1 | 78461 | 3365 | 0 |
| 1 | https://www.hribi.net/registracija.asp | https://www.hribi.net/registracija.asp | 2026-09-01T07:17:05.430Z | 2026-09-01T07:17:05.430Z | ecaf337d4759d1b97570781615b98efe414085aacc97f377a70a469f61c63553 | 32958 | 573 | 0 |
| 1 | https://www.hribi.net/spletna_kamera/crna_na_koroskem_center/5228 | https://www.hribi.net/spletna_kamera/crna_na_koroskem_center/5228 | 2026-09-01T07:17:05.819Z | 2026-09-01T07:17:05.820Z | eb8d09b4dd0df0f9ecab3464691a5154269dcbdbbb5ce2a22095a2c874353c75 | 41392 | 1322 | 5 |
| 1 | https://www.hribi.net/spletna_kamera/crna_na_koroskem_smucisce_crna/5229 | https://www.hribi.net/spletna_kamera/crna_na_koroskem_smucisce_crna/5229 | 2026-09-01T07:17:06.013Z | 2026-09-01T07:17:06.014Z | 8ae80b68b59910e886094f5fa56447fdf2e8b6a77845cdcb7ad059e126a98419 | 41194 | 1284 | 5 |
| 1 | https://www.hribi.net/spletna_kamera/crna_na_koroskem/1461 | https://www.hribi.net/spletna_kamera/crna_na_koroskem/1461 | 2026-09-01T07:17:05.622Z | 2026-09-01T07:17:05.623Z | e2f03bc5f6d3169564b6ba495330b87e4412a136607e66337013911a23743c3c | 40694 | 1266 | 5 |
| 1 | https://www.hribi.net/spletna_kamera/dom_na_smrekovcu/5279 | https://www.hribi.net/spletna_kamera/dom_na_smrekovcu/5279 | 2026-09-01T07:17:06.206Z | 2026-09-01T07:17:06.207Z | e8addc4f64ec2a82826c1eafd667976c72cb3554ef63361c906bab488f3ee133 | 40159 | 1145 | 1 |
| 1 | https://www.hribi.net/spletna_kamera/domzalski_dom_na_mali_planini/3354 | https://www.hribi.net/spletna_kamera/domzalski_dom_na_mali_planini/3354 | 2026-09-01T07:17:06.402Z | 2026-09-01T07:17:06.403Z | 8198e9f1518d8a8aa921b1804ccea08ad7113930e810ccc4b938b4e94dea286d | 43231 | 2134 | 4 |
| 1 | https://www.hribi.net/spletna_kamera/golte/34 | https://www.hribi.net/spletna_kamera/golte/34 | 2026-09-01T07:17:06.598Z | 2026-09-01T07:17:06.599Z | b684298cddd141cf304cc2de0dda5a3f9e9ffa2f7bb2e58c96a2a380d386b588 | 43141 | 1580 | 3 |
| 1 | https://www.hribi.net/spletna_kamera/mali_hrib/5024 | https://www.hribi.net/spletna_kamera/mali_hrib/5024 | 2026-09-01T07:17:06.789Z | 2026-09-01T07:17:06.790Z | e1684d0aa94c976a796044cf43d7209c7a618c48010082c153d155b6fa8860d9 | 40597 | 1258 | 1 |
| 1 | https://www.hribi.net/spletna_kamera/prelaz_crnivec/3633 | https://www.hribi.net/spletna_kamera/prelaz_crnivec/3633 | 2026-09-01T07:17:06.981Z | 2026-09-01T07:17:06.982Z | c96b34f4178a6a03b992cf8575fb39761b686713f85635431a4f96cb29202830 | 41108 | 1397 | 2 |
| 1 | https://www.hribi.net/spletna_kamera/radegunda/2167 | https://www.hribi.net/spletna_kamera/radegunda/2167 | 2026-09-01T07:17:07.172Z | 2026-09-01T07:17:07.173Z | ef461f31bfb9dd04655b8ccf26db1cdc8e15392567fda18f0dd0c5a16eb1b51d | 41036 | 1414 | 1 |
| 1 | https://www.hribi.net/spletna_kamera/solcava/5080 | https://www.hribi.net/spletna_kamera/solcava/5080 | 2026-09-01T07:17:07.363Z | 2026-09-01T07:17:07.364Z | b835a19023be1047801526556461c8d384b4f2715a184b9a7433359cb5cb995e | 40766 | 1340 | 4 |
| 1 | https://www.hribi.net/spletna_kamera/spitalic/5086 | https://www.hribi.net/spletna_kamera/spitalic/5086 | 2026-09-01T07:17:07.554Z | 2026-09-01T07:17:07.554Z | 4ec25849f8965594c693b12f18c4797418a230d5af0256d8d802555e132a3886 | 40223 | 1111 | 2 |
| 1 | https://www.hribi.net/spletne_kamere_v_gorah | https://www.hribi.net/spletne_kamere_v_gorah | 2026-09-01T07:17:08.014Z | 2026-09-01T07:17:08.015Z | 2ea18064662f9ec750ce8137ac50950cb3757711b39ddd0025c7deb5410cc253 | 264013 | 8946 | 6 |
| 1 | https://www.hribi.net/trenutnerazmere.asp?slo=1 | https://www.hribi.net/trenutnerazmere.asp?slo=1 | 2026-09-01T07:17:08.339Z | 2026-09-01T07:17:08.340Z | c8aeb7f86c20e0813cc2babd350656ac6bc89d32204e1cfd4bbaf5be30f72703 | 42763 | 2261 | 0 |
| 1 | https://www.hribi.net/video/ | https://www.hribi.net/video/ | 2026-09-01T07:17:08.554Z | 2026-09-01T07:17:08.555Z | 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 | 59463 | 2256 | 18 |
| 1 | https://www.hribi.net/vpisna_knjiga_vrhov | https://www.hribi.net/vpisna_knjiga_vrhov | 2026-09-01T07:17:08.777Z | 2026-09-01T07:17:08.778Z | 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 | 77434 | 6679 | 22 |
| 1 | https://www.hribi.net/vreme.asp | https://www.hribi.net/vreme.asp | 2026-09-01T07:17:08.968Z | 2026-09-01T07:17:08.969Z | ba5f3dfe1de4537889efc20d499a12f839cc507441249af840747522ea186a6e | 44229 | 2661 | 0 |
| 1 | https://www.hribi.net/zemljevid.asp | https://www.hribi.net/zemljevid.asp | 2026-09-01T07:17:09.553Z | 2026-09-01T07:17:09.556Z | 51e3ea34f176be5fb04a16c62de0f481b590abd019b464a05a7949077e486cfd | 531570 | 564 | 0 |

### Hribi.net — Smrekovec

Seed: https://www.hribi.net/gora/smrekovec/3/485

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 1 | https://www.hribi.net/ | https://www.hribi.net/ | 2026-09-01T07:20:03.645Z | 2026-09-01T07:20:03.646Z | 7ecb3d8645bded8b13cf9341ea9fb397b803943a787ccd94b9adc082394e4902 | 74018 | 6534 | 0 |
| 1 | https://www.hribi.net/alpske_zivali | https://www.hribi.net/alpske_zivali | 2026-09-01T07:20:04.080Z | 2026-09-01T07:20:04.082Z | e5e431795264414256ddf7edf8e1f7a7f07bb8fdf08f36bfd5d85fbf17b06706 | 97229 | 30890 | 0 |
| 1 | https://www.hribi.net/donacije.aspx | https://www.hribi.net/donacije.aspx | 2026-09-01T07:20:04.272Z | 2026-09-01T07:20:04.273Z | 0811ce2993714e1d31388b70f661a4d62ed0bf41344aff12016a746a4dba6a62 | 36562 | 1161 | 0 |
| 1 | https://www.hribi.net/geslo.asp | https://www.hribi.net/geslo.asp | 2026-09-01T07:20:04.459Z | 2026-09-01T07:20:04.461Z | 9f9bddc6e20695fe0ad2a84704ddb47b517193ce79ce1ad9940b4f0aa5073b6d | 33699 | 676 | 0 |
| 1 | https://www.hribi.net/gora_zemljevid/smrekovec/485 | https://www.hribi.net/gora_zemljevid/smrekovec/485 | 2026-09-01T07:20:05.534Z | 2026-09-01T07:20:05.538Z | 26abec96694519f24a9e35badbe7f13447f7f986c4dcd77537bad54c70548502 | 531863 | 635 | 0 |
| 1 | https://www.hribi.net/gora/dom_na_smrekovcu/3/484 | https://www.hribi.net/gora/dom_na_smrekovcu/3/484 | 2026-09-01T07:20:04.662Z | 2026-09-01T07:20:04.665Z | a0ec548937575c905a59c9645dfefb1844dc8c32f3f5a70a960f4aaea03695d7 | 57044 | 2403 | 1 |
| 0 | https://www.hribi.net/gora/smrekovec/3/485 | https://www.hribi.net/gora/smrekovec/3/485 | 2026-09-01T07:20:03.135Z | 2026-09-01T07:20:03.137Z | eb9f28c8a362f8b659e56d780457d53029d588572ee4e1059ebce99ba4e95cdc | 53681 | 2333 | 1 |
| 1 | https://www.hribi.net/gorovja | https://www.hribi.net/gorovja | 2026-09-01T07:20:05.755Z | 2026-09-01T07:20:05.756Z | 36235080ebfee852d2ec84cf3f1324272e0ff4f7163ddc0e199de0db844c1a8b | 35888 | 1115 | 0 |
| 1 | https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 | https://www.hribi.net/gorovje/kamnisko_savinjske_alpe/3 | 2026-09-01T07:20:05.961Z | 2026-09-01T07:20:05.962Z | 936c2a7ad9442a483cd5ec1bc212e235562cf7b0c3f0e4332788e1563a685fd7 | 95239 | 8869 | 0 |
| 1 | https://www.hribi.net/gorske_panorame | https://www.hribi.net/gorske_panorame | 2026-09-01T07:20:06.154Z | 2026-09-01T07:20:06.155Z | 5e548ebaec12ec0282707fc5533e9fb15b11b970b02fa6c4b6b9f8c0dbdbfeb4 | 34678 | 887 | 0 |
| 1 | https://www.hribi.net/gps.asp | https://www.hribi.net/gps.asp | 2026-09-01T07:20:06.442Z | 2026-09-01T07:20:06.443Z | b11de0b2e81e48d1ee500d7a6127a2803a322d591b766748361388268be6f1e7 | 45218 | 1748 | 5 |
| 1 | https://www.hribi.net/iskalnik_izletov | https://www.hribi.net/iskalnik_izletov | 2026-09-01T07:20:06.635Z | 2026-09-01T07:20:06.636Z | dba25534b53968f8e874c86baba71ccf517eefc11a25260af8deb9df1e0b7724 | 57420 | 1209 | 5 |
| 1 | https://www.hribi.net/izlet/andrejev_dom_na_slemenu_smrekovec/3/485/3570 | https://www.hribi.net/izlet/andrejev_dom_na_slemenu_smrekovec/3/485/3570 | 2026-09-01T07:20:06.846Z | 2026-09-01T07:20:06.847Z | ed4de0ee28924df4d3b70247ab526afc086fb76b05d1c2944e379c03aeaee816 | 64114 | 5996 | 6 |
| 1 | https://www.hribi.net/izlet/atelsko_sedlo_smrekovec/3/485/9797 | https://www.hribi.net/izlet/atelsko_sedlo_smrekovec/3/485/9797 | 2026-09-01T07:20:07.044Z | 2026-09-01T07:20:07.046Z | f080e8288899392c1f146da0fa67cc0d4a3374a9de77ed04a1830606e13cd294 | 57402 | 3325 | 3 |
| 1 | https://www.hribi.net/izlet/bele_vode_rebrsak_smrekovec/3/485/1466 | https://www.hribi.net/izlet/bele_vode_rebrsak_smrekovec/3/485/1466 | 2026-09-01T07:20:07.309Z | 2026-09-01T07:20:07.310Z | 0d429c4ce2cb265a2962e5baed42de7976e4f90fe397d22e73f5a979f7a2d400 | 84995 | 10699 | 4 |
| 1 | https://www.hribi.net/izlet/dom_na_smrekovcu_smrekovec/3/485/818 | https://www.hribi.net/izlet/dom_na_smrekovcu_smrekovec/3/485/818 | 2026-09-01T07:20:07.511Z | 2026-09-01T07:20:07.512Z | 7fb9357da7de3cd70fc3e277c652d60c380edcb7065bd77b5a076a27c5d0e6e1 | 58602 | 3517 | 2 |
| 1 | https://www.hribi.net/izlet/golte_alpski_vrt_smrekovec/3/485/9783 | https://www.hribi.net/izlet/golte_alpski_vrt_smrekovec/3/485/9783 | 2026-09-01T07:20:07.710Z | 2026-09-01T07:20:07.711Z | 357a1952a507fe1a06a0834919ab7fd070ac5ef3b17e0407926d9b98028782a5 | 73904 | 5310 | 8 |
| 1 | https://www.hribi.net/izlet/izvir_ljubije_smrekovec_po_cesti/3/485/5888 | https://www.hribi.net/izlet/izvir_ljubije_smrekovec_po_cesti/3/485/5888 | 2026-09-01T07:20:07.933Z | 2026-09-01T07:20:07.934Z | af1b212a2a1d89a6f24091ba671cb2bd3d3846ed3d25acf8aeab4e95301abe15 | 79801 | 7103 | 7 |
| 1 | https://www.hribi.net/izlet/izvir_ljubije_smrekovec_preko_leskovskove_pustote/3/485/5886 | https://www.hribi.net/izlet/izvir_ljubije_smrekovec_preko_leskovskove_pustote/3/485/5886 | 2026-09-01T07:20:08.141Z | 2026-09-01T07:20:08.143Z | c3b570320992c16a916089b7551cf35f97a5112dd63c15b08c85876b22d21d12 | 79629 | 6098 | 5 |
| 1 | https://www.hribi.net/izlet/javorje_mala_crna_smrekovec_cez_bukov_stan/3/485/10364 | https://www.hribi.net/izlet/javorje_mala_crna_smrekovec_cez_bukov_stan/3/485/10364 | 2026-09-01T07:20:08.368Z | 2026-09-01T07:20:08.369Z | cd52016affb511f1ea1c1ac14538ce09930f390a581a57d52c85386676508392 | 75322 | 5212 | 4 |
| 1 | https://www.hribi.net/izlet/javorje_mala_crna_smrekovec_po_cesti/3/485/10365 | https://www.hribi.net/izlet/javorje_mala_crna_smrekovec_po_cesti/3/485/10365 | 2026-09-01T07:20:08.570Z | 2026-09-01T07:20:08.572Z | 103841b1628c62794d1a38db2601b3b7756c2339439a265207364021b558dccf | 75741 | 5117 | 4 |
| 1 | https://www.hribi.net/izlet/kramarica_smrekovec_cez_bukov_stan/3/485/3572 | https://www.hribi.net/izlet/kramarica_smrekovec_cez_bukov_stan/3/485/3572 | 2026-09-01T07:20:08.774Z | 2026-09-01T07:20:08.775Z | 727a58ba781a647b14026fea42e7e927498a0a6141669996542c5d1e71dbd7ea | 67556 | 5825 | 3 |
| 1 | https://www.hribi.net/izlet/kramarica_smrekovec_po_cesti/3/485/3574 | https://www.hribi.net/izlet/kramarica_smrekovec_po_cesti/3/485/3574 | 2026-09-01T07:20:08.975Z | 2026-09-01T07:20:08.977Z | 6ca1d18219d061d25c2faff6f347b502590b5de5d9350bb8487e7da2f5b5abe5 | 62644 | 4323 | 3 |
| 1 | https://www.hribi.net/izlet/ljubenske_rastke_kumprej_smrekovec/3/485/6151 | https://www.hribi.net/izlet/ljubenske_rastke_kumprej_smrekovec/3/485/6151 | 2026-09-01T07:20:09.188Z | 2026-09-01T07:20:09.189Z | 2e6738a3e9575af801314ffd1a4209504fe131b7ff89ac4a36ce09cc5009592d | 77352 | 5984 | 4 |
| 1 | https://www.hribi.net/izlet/ljubenske_rastke_vrnivsek_smrekovec/3/485/6150 | https://www.hribi.net/izlet/ljubenske_rastke_vrnivsek_smrekovec/3/485/6150 | 2026-09-01T07:20:09.402Z | 2026-09-01T07:20:09.403Z | 81370fabc04c4545b9dc3f8a0487e6a0d19ecf8a89f2e94125289f2cf4c1d170 | 73241 | 5669 | 3 |
| 1 | https://www.hribi.net/kviz.asp | https://www.hribi.net/kviz.asp | 2026-09-01T07:20:09.589Z | 2026-09-01T07:20:09.590Z | f504f2bbf196db9a02a7a625aeb87b787ed0212ab93c68a9dcd6563677b7978f | 33208 | 563 | 0 |
| 1 | https://www.hribi.net/mali_oglasi | https://www.hribi.net/mali_oglasi | 2026-09-01T07:20:09.792Z | 2026-09-01T07:20:09.793Z | b3722f30a1c79598d315e485e34ebab3629d14cbdf3cf2eb996d5807a824b59a | 55723 | 2067 | 0 |
| 1 | https://www.hribi.net/najslike.asp | https://www.hribi.net/najslike.asp | 2026-09-01T07:20:10.007Z | 2026-09-01T07:20:10.009Z | 1858290b75b82eb60e1e8831647be25f04d617857053f2b0ec5fd8c084d7143d | 56603 | 2782 | 4 |
| 1 | https://www.hribi.net/panorama/360/smrekovec/485 | https://www.hribi.net/panorama/360/smrekovec/485 | 2026-09-01T07:20:10.211Z | 2026-09-01T07:20:10.212Z | fb788ad597f48120c4e67282102ea2b28aa5701f46cafa06d85ab1878f5b110c | 41977 | 1150 | 6 |
| 1 | https://www.hribi.net/pogoji.asp | https://www.hribi.net/pogoji.asp | 2026-09-01T07:20:10.397Z | 2026-09-01T07:20:10.398Z | 5408983153f55b2e370444f363644847861dd87b8706ece5ebc81554d59fd294 | 36604 | 3797 | 0 |
| 1 | https://www.hribi.net/prireditve.asp | https://www.hribi.net/prireditve.asp | 2026-09-01T07:20:10.585Z | 2026-09-01T07:20:10.586Z | 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a | 54358 | 14732 | 46 |
| 1 | https://www.hribi.net/rastline | https://www.hribi.net/rastline | 2026-09-01T07:20:10.821Z | 2026-09-01T07:20:10.822Z | 1f61c8ccc10b7dc83e09869538942a3d781d48d72d9151165804680a3e77dfa1 | 78461 | 3365 | 0 |
| 1 | https://www.hribi.net/registracija.asp | https://www.hribi.net/registracija.asp | 2026-09-01T07:20:11.018Z | 2026-09-01T07:20:11.019Z | ecaf337d4759d1b97570781615b98efe414085aacc97f377a70a469f61c63553 | 32958 | 573 | 0 |
| 1 | https://www.hribi.net/slika_gora/smrekovec/1278 | https://www.hribi.net/slika_gora/smrekovec/1278 | 2026-09-01T07:20:11.205Z | 2026-09-01T07:20:11.206Z | 28714c33f83b94f08a3ddaf84e08f16f932b86cc497a188aedb56a408d09d034 | 8665 | 204 | 0 |
| 1 | https://www.hribi.net/slika_gora/smrekovec/1279 | https://www.hribi.net/slika_gora/smrekovec/1279 | 2026-09-01T07:20:11.391Z | 2026-09-01T07:20:11.392Z | b6680e527afff9aafcfe29c283754ad41e5b26afb45eeb07edb97dc1526218f8 | 8758 | 205 | 0 |
| 1 | https://www.hribi.net/slika_gora/smrekovec/1280 | https://www.hribi.net/slika_gora/smrekovec/1280 | 2026-09-01T07:20:11.584Z | 2026-09-01T07:20:11.585Z | 9fe916964e272978b415b6d746563254307a7bcb3e7340b5bb282ca0a5e8c486 | 8757 | 204 | 0 |
| 1 | https://www.hribi.net/slika_gora/smrekovec/1283 | https://www.hribi.net/slika_gora/smrekovec/1283 | 2026-09-01T07:20:11.772Z | 2026-09-01T07:20:11.773Z | 00debe431be588a823eced703af51eaf43d5c1e0bcd50a9ab7f049c933b2ee9a | 8757 | 204 | 1 |
| 1 | https://www.hribi.net/slika_gora/smrekovec/14521 | https://www.hribi.net/slika_gora/smrekovec/14521 | 2026-09-01T07:20:11.957Z | 2026-09-01T07:20:11.958Z | f263c42847c830e209c80ac13f6d0a1b9247339b692e68e1d0e1dcf18a329158 | 8774 | 204 | 1 |
| 1 | https://www.hribi.net/slika_gora/smrekovec/14577 | https://www.hribi.net/slika_gora/smrekovec/14577 | 2026-09-01T07:20:12.144Z | 2026-09-01T07:20:12.145Z | 274f8ff68189d30f30771ddd2074704ea12e527ef9a3259ebbb13fe3d8e007e0 | 8734 | 204 | 1 |
| 1 | https://www.hribi.net/slika_gora/smrekovec/2738 | https://www.hribi.net/slika_gora/smrekovec/2738 | 2026-09-01T07:20:12.331Z | 2026-09-01T07:20:12.332Z | e1ccc80f8536b2a50094a3c4c8157781078f9eca80db559982bad8a04759aef2 | 8754 | 204 | 1 |
| 1 | https://www.hribi.net/slika_gora/smrekovec/9260 | https://www.hribi.net/slika_gora/smrekovec/9260 | 2026-09-01T07:20:12.518Z | 2026-09-01T07:20:12.518Z | 6deda96b4663109a1130d2cacd9444f910beef24c61d67e660d69577d32c4e97 | 8759 | 203 | 1 |
| 1 | https://www.hribi.net/slika_gora/smrekovec/9261 | https://www.hribi.net/slika_gora/smrekovec/9261 | 2026-09-01T07:20:12.818Z | 2026-09-01T07:20:12.818Z | cf0900cfeb33170948b2c69531cbc1e16e3e10f66b724bb6f145ffb05e734826 | 8761 | 204 | 1 |
| 1 | https://www.hribi.net/spletna_kamera/crna_na_koroskem_center/5228 | https://www.hribi.net/spletna_kamera/crna_na_koroskem_center/5228 | 2026-09-01T07:20:13.199Z | 2026-09-01T07:20:13.200Z | eb8d09b4dd0df0f9ecab3464691a5154269dcbdbbb5ce2a22095a2c874353c75 | 41392 | 1322 | 2 |
| 1 | https://www.hribi.net/spletna_kamera/crna_na_koroskem_smucisce_crna/5229 | https://www.hribi.net/spletna_kamera/crna_na_koroskem_smucisce_crna/5229 | 2026-09-01T07:20:13.390Z | 2026-09-01T07:20:13.391Z | 8ae80b68b59910e886094f5fa56447fdf2e8b6a77845cdcb7ad059e126a98419 | 41194 | 1284 | 2 |
| 1 | https://www.hribi.net/spletna_kamera/crna_na_koroskem/1461 | https://www.hribi.net/spletna_kamera/crna_na_koroskem/1461 | 2026-09-01T07:20:13.009Z | 2026-09-01T07:20:13.010Z | e2f03bc5f6d3169564b6ba495330b87e4412a136607e66337013911a23743c3c | 40694 | 1266 | 2 |
| 1 | https://www.hribi.net/spletna_kamera/dom_na_peci/2147 | https://www.hribi.net/spletna_kamera/dom_na_peci/2147 | 2026-09-01T07:20:13.584Z | 2026-09-01T07:20:13.584Z | 09d17e9b3edbb608d923ad712490a5606deebe9abd569592caedc2215387d22c | 40976 | 1436 | 1 |
| 1 | https://www.hribi.net/spletna_kamera/dom_na_smrekovcu/5279 | https://www.hribi.net/spletna_kamera/dom_na_smrekovcu/5279 | 2026-09-01T07:20:13.784Z | 2026-09-01T07:20:13.785Z | e8addc4f64ec2a82826c1eafd667976c72cb3554ef63361c906bab488f3ee133 | 40159 | 1145 | 1 |
| 1 | https://www.hribi.net/spletna_kamera/golte/34 | https://www.hribi.net/spletna_kamera/golte/34 | 2026-09-01T07:20:13.977Z | 2026-09-01T07:20:13.980Z | b684298cddd141cf304cc2de0dda5a3f9e9ffa2f7bb2e58c96a2a380d386b588 | 43141 | 1580 | 3 |
| 1 | https://www.hribi.net/spletna_kamera/peca/11 | https://www.hribi.net/spletna_kamera/peca/11 | 2026-09-01T07:20:14.176Z | 2026-09-01T07:20:14.180Z | cb89aa90a3dab8209fce0582fed8b6cd8e180327e3e6f94073ac66a0e7ea3cd1 | 43930 | 2120 | 1 |
| 1 | https://www.hribi.net/spletna_kamera/poljana/2242 | https://www.hribi.net/spletna_kamera/poljana/2242 | 2026-09-01T07:20:14.372Z | 2026-09-01T07:20:14.373Z | fc4df9e4f0b49745e4799504fcb408a30acc48ebf4b389b530ae6da50a530228 | 40357 | 1272 | 1 |
| 1 | https://www.hribi.net/spletna_kamera/radegunda/2167 | https://www.hribi.net/spletna_kamera/radegunda/2167 | 2026-09-01T07:20:14.563Z | 2026-09-01T07:20:14.564Z | ef461f31bfb9dd04655b8ccf26db1cdc8e15392567fda18f0dd0c5a16eb1b51d | 41036 | 1414 | 1 |
| 1 | https://www.hribi.net/spletna_kamera/urslja_gora/1026 | https://www.hribi.net/spletna_kamera/urslja_gora/1026 | 2026-09-01T07:20:14.755Z | 2026-09-01T07:20:14.756Z | f0fd1927062b9cede63967d7a313243a461de026bab75b89dff83f5b46c82cbd | 42610 | 1829 | 3 |
| 1 | https://www.hribi.net/spletna_kamera/zavodnje/5079 | https://www.hribi.net/spletna_kamera/zavodnje/5079 | 2026-09-01T07:20:14.988Z | 2026-09-01T07:20:14.989Z | e996d445279cbd36f0a61230a700ba446bac8323c60caf19400cd5b3429f2cac | 40225 | 1175 | 1 |
| 1 | https://www.hribi.net/spletne_kamere_v_gorah | https://www.hribi.net/spletne_kamere_v_gorah | 2026-09-01T07:20:15.479Z | 2026-09-01T07:20:15.480Z | 2ea18064662f9ec750ce8137ac50950cb3757711b39ddd0025c7deb5410cc253 | 264013 | 8946 | 0 |
| 1 | https://www.hribi.net/trenutnerazmere.asp?slo=1 | https://www.hribi.net/trenutnerazmere.asp?slo=1 | 2026-09-01T07:20:15.800Z | 2026-09-01T07:20:15.801Z | c8aeb7f86c20e0813cc2babd350656ac6bc89d32204e1cfd4bbaf5be30f72703 | 42763 | 2261 | 0 |
| 1 | https://www.hribi.net/video/ | https://www.hribi.net/video/ | 2026-09-01T07:20:16.013Z | 2026-09-01T07:20:16.014Z | 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 | 59463 | 2256 | 14 |
| 1 | https://www.hribi.net/vpisna_knjiga_vrhov | https://www.hribi.net/vpisna_knjiga_vrhov | 2026-09-01T07:20:16.231Z | 2026-09-01T07:20:16.232Z | 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 | 77434 | 6679 | 20 |
| 1 | https://www.hribi.net/vpisna_knjiga_vrhov/?id=485 | https://www.hribi.net/vpisna_knjiga_vrhov/?id=485 | 2026-09-01T07:20:16.426Z | 2026-09-01T07:20:16.427Z | 090fa959171561700f2ea413321bdccef07a28fd1077be79ebb8d91d0c17d699 | 50571 | 2535 | 1 |
| 1 | https://www.hribi.net/vreme_gora/smrekovec/3/485 | https://www.hribi.net/vreme_gora/smrekovec/3/485 | 2026-09-01T07:20:16.817Z | 2026-09-01T07:20:16.818Z | ad7db7e4797b43f023b2d6f3a440aaf0cb0d3290ba33db66df38c6bbd4aa7c8b | 60178 | 2350 | 9 |
| 1 | https://www.hribi.net/vreme.asp | https://www.hribi.net/vreme.asp | 2026-09-01T07:20:16.616Z | 2026-09-01T07:20:16.618Z | ba5f3dfe1de4537889efc20d499a12f839cc507441249af840747522ea186a6e | 44229 | 2661 | 0 |
| 1 | https://www.hribi.net/zemljevid.asp | https://www.hribi.net/zemljevid.asp | 2026-09-01T07:20:17.471Z | 2026-09-01T07:20:17.475Z | e5b2a789ecd052aeaf0940fb378d327a68293a66573f0523be76f792f3fe3280 | 531570 | 564 | 0 |

### Občina Gornji Grad

Seed: https://www.gornji-grad.si/

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 0 | https://www.gornji-grad.si/ | https://www.gornji-grad.si/ | 2026-09-01T07:13:42.099Z | 2026-09-01T07:13:42.100Z | b4e30926da1720c60f3bf5c1d6a1507a0986162e43c3e78329d7bf4f37dbf042 | 216983 | 10663 | 0 |
| 1 | https://www.gornji-grad.si/dogodki | https://www.gornji-grad.si/dogodki | 2026-09-01T07:13:43.640Z | 2026-09-01T07:13:43.642Z | f87df7af89b618c55dc2ec801defe88a706b09dcebf12c6923de58980556029d | 210414 | 5798 | 0 |
| 1 | https://www.gornji-grad.si/dogodki?region_id=4&municipality_id=0 | https://www.gornji-grad.si/dogodki?region_id=4&municipality_id=0 | 2026-09-01T07:13:43.907Z | 2026-09-01T07:13:43.909Z | 67d5ce2a80644f6b4e4e285de3c1aa47b97bf33557fad757ded44bf1f073ae47 | 210406 | 5798 | 0 |
| 1 | https://www.gornji-grad.si/gallery | https://www.gornji-grad.si/gallery | 2026-09-01T07:13:44.842Z | 2026-09-01T07:13:44.845Z | 0361a557aad18cabd090ef1355000cd8617f8e0a3ae2af1155295cd8818926e7 | 402676 | 8268 | 0 |
| 1 | https://www.gornji-grad.si/imenik | https://www.gornji-grad.si/imenik | 2026-09-01T07:13:45.309Z | 2026-09-01T07:13:45.311Z | c6941a7ea7aeb966752a232bdd5c73e0b2ef98c5ddf523e79aeca548ff8ef933 | 192897 | 5892 | 0 |
| 1 | https://www.gornji-grad.si/katalogjavnegaznacaja | https://www.gornji-grad.si/katalogjavnegaznacaja | 2026-09-01T07:13:45.856Z | 2026-09-01T07:13:45.858Z | 8add2d9dc52eb23b6b7213e6af6df4991253415479667b02206d558b3a566faf | 219555 | 13274 | 0 |
| 1 | https://www.gornji-grad.si/objava/1188985 | https://www.gornji-grad.si/objava/1188985 | 2026-09-01T07:13:46.250Z | 2026-09-01T07:13:46.252Z | 419bfd577a315a45debead967c62756f03e90101b97b206269813dae6ff63011 | 200854 | 8053 | 0 |
| 1 | https://www.gornji-grad.si/objava/1209988 | https://www.gornji-grad.si/objava/1209988 | 2026-09-01T07:13:46.636Z | 2026-09-01T07:13:46.638Z | 96e6387150d4043af75d1e3adae9a5b2ef9af240a5ec2a1f264e420df35ef428 | 198495 | 6666 | 0 |
| 1 | https://www.gornji-grad.si/objava/1282342 | https://www.gornji-grad.si/objava/1282342 | 2026-09-01T07:13:47.150Z | 2026-09-01T07:13:47.152Z | b775831abfed32bcaffbe616661eb4a21e3f98f73e2980aebe551abe244521c5 | 195382 | 6468 | 0 |
| 1 | https://www.gornji-grad.si/objava/1284258 | https://www.gornji-grad.si/objava/1284258 | 2026-09-01T07:13:47.774Z | 2026-09-01T07:13:47.776Z | 999af46323667c5b4980af937670846007958f088ccfa19cf16e927a38eb3793 | 208278 | 6358 | 0 |
| 1 | https://www.gornji-grad.si/objava/1321525 | https://www.gornji-grad.si/objava/1321525 | 2026-09-01T07:13:48.313Z | 2026-09-01T07:13:48.315Z | bb1617b282792ad5979ae9e7f74f025d6fb12af8fb356d05f4d3736b413eb6a4 | 192557 | 6126 | 0 |
| 1 | https://www.gornji-grad.si/objava/1352354 | https://www.gornji-grad.si/objava/1352354 | 2026-09-01T07:13:48.786Z | 2026-09-01T07:13:48.788Z | 2df076c000fc5bc80d6b4ef7c7b7b0b6d8ef9198b74cebed16b3e88d1cba6375 | 185245 | 5664 | 0 |
| 1 | https://www.gornji-grad.si/objava/1354582 | https://www.gornji-grad.si/objava/1354582 | 2026-09-01T07:13:49.339Z | 2026-09-01T07:13:49.341Z | ba454bcaf293db6e58907222dd0d470a5f04cae2d1668a7308331d85de4370a1 | 189017 | 6462 | 0 |
| 1 | https://www.gornji-grad.si/objava/1359279 | https://www.gornji-grad.si/objava/1359279 | 2026-09-01T07:13:49.644Z | 2026-09-01T07:13:49.647Z | 11281cb43daf479123315b1152fff1c6613bfc1810d1d573e9beb0475503b9db | 185449 | 5732 | 0 |
| 1 | https://www.gornji-grad.si/objava/1359536 | https://www.gornji-grad.si/objava/1359536 | 2026-09-01T07:13:50.308Z | 2026-09-01T07:13:50.310Z | 76ae1fdf7ea451f84c1edc3c2045da12ea1424baa3bab87ffe245d35f5a7de3d | 209544 | 6502 | 1 |
| 1 | https://www.gornji-grad.si/objava/1361315 | https://www.gornji-grad.si/objava/1361315 | 2026-09-01T07:13:50.863Z | 2026-09-01T07:13:50.864Z | 7fda1abdfa220a7f2338fe43a6253e43d22802af3ab0e76664c62f62ea925c56 | 188945 | 6343 | 0 |
| 1 | https://www.gornji-grad.si/Razpisi | https://www.gornji-grad.si/Razpisi | 2026-09-01T07:13:42.497Z | 2026-09-01T07:13:42.499Z | 8e233e32619dffd036c7f441badeaad4d0f4d9ba53862bba4e427e2c28e2325b | 187312 | 5493 | 0 |
| 1 | https://www.gornji-grad.si/Registracija | https://www.gornji-grad.si/Registracija | 2026-09-01T07:13:42.770Z | 2026-09-01T07:13:42.772Z | 2c9b4bb20e503e3ce08563ba267f9da4d87d364d8039363292b754c23f14b25d | 163932 | 5259 | 0 |
| 1 | https://www.gornji-grad.si/TermsAndConditions | https://www.gornji-grad.si/TermsAndConditions | 2026-09-01T07:13:43.082Z | 2026-09-01T07:13:43.083Z | a5fbb5c88e4fc07184b3c7a63dbf6a5dbb907a156192389e72bafde2bc39ca9f | 186509 | 13045 | 1 |
| 1 | https://www.gornji-grad.si/ViriRSS | https://www.gornji-grad.si/ViriRSS | 2026-09-01T07:13:43.360Z | 2026-09-01T07:13:43.361Z | 06ff044690ef5461decb508e06f2b22a74ed2666842830efab3dfe645f5de90e | 180551 | 6821 | 1 |

Skipped URL evidence:

| URL | Reason |
|---|---|
| https://www.gornji-grad.si/Cookies | non-content-path |
| https://www.gornji-grad.si/GDPR | non-content-path |
| https://www.gornji-grad.si/Prijava | non-content-path |
| https://www.gornji-grad.si/Sitemap | non-content-path |
| https://www.gornji-grad.si/cookies | non-content-path |
| https://www.gornji-grad.si/einforming | non-content-path |
| https://www.gornji-grad.si/gdpr | non-content-path |
| https://www.gornji-grad.si/objava/1363443 | source-byte-cap |
| https://www.gornji-grad.si/objava/1364978 | source-byte-cap |
| https://www.gornji-grad.si/objava/1365068 | source-byte-cap |
| https://www.gornji-grad.si/objava/1367123 | source-byte-cap |
| https://www.gornji-grad.si/objava/1367881 | source-byte-cap |
| https://www.gornji-grad.si/objava/206760 | source-byte-cap |
| https://www.gornji-grad.si/objava/206798 | source-byte-cap |
| https://www.gornji-grad.si/objava/206807 | source-byte-cap |
| https://www.gornji-grad.si/objava/211430 | source-byte-cap |
| https://www.gornji-grad.si/objava/215128 | source-byte-cap |
| https://www.gornji-grad.si/objava/215349 | source-byte-cap |
| https://www.gornji-grad.si/objava/215360 | source-byte-cap |
| https://www.gornji-grad.si/objava/215367 | source-byte-cap |
| https://www.gornji-grad.si/objava/229428 | source-byte-cap |
| https://www.gornji-grad.si/objava/230537 | source-byte-cap |
| https://www.gornji-grad.si/objava/506167 | source-byte-cap |
| https://www.gornji-grad.si/objava/638106 | source-byte-cap |
| https://www.gornji-grad.si/objava/700450 | source-byte-cap |
| https://www.gornji-grad.si/objava/911421 | source-byte-cap |
| https://www.gornji-grad.si/objave/ | non-content-path |
| https://www.gornji-grad.si/objave/101 | non-content-path |
| https://www.gornji-grad.si/objave/104 | non-content-path |
| https://www.gornji-grad.si/objave/107 | non-content-path |
| https://www.gornji-grad.si/objave/109 | non-content-path |
| https://www.gornji-grad.si/objave/112 | non-content-path |
| https://www.gornji-grad.si/objave/115?subcategory=143 | non-content-path |
| https://www.gornji-grad.si/objave/161 | non-content-path |
| https://www.gornji-grad.si/objave/162 | non-content-path |
| https://www.gornji-grad.si/objave/172 | non-content-path |
| https://www.gornji-grad.si/objave/175 | non-content-path |
| https://www.gornji-grad.si/objave/176 | non-content-path |
| https://www.gornji-grad.si/objave/177 | non-content-path |
| https://www.gornji-grad.si/objave/180 | non-content-path |
| https://www.gornji-grad.si/objave/183 | non-content-path |
| https://www.gornji-grad.si/objave/187 | non-content-path |
| https://www.gornji-grad.si/objave/188 | non-content-path |
| https://www.gornji-grad.si/objave/191 | non-content-path |
| https://www.gornji-grad.si/objave/200 | non-content-path |
| https://www.gornji-grad.si/objave/201 | non-content-path |
| https://www.gornji-grad.si/objave/229 | non-content-path |
| https://www.gornji-grad.si/objave/230 | non-content-path |
| https://www.gornji-grad.si/objave/255 | non-content-path |
| https://www.gornji-grad.si/objave/274 | non-content-path |
| https://www.gornji-grad.si/objave/332 | non-content-path |
| https://www.gornji-grad.si/objave/347 | non-content-path |
| https://www.gornji-grad.si/objave/364 | non-content-path |
| https://www.gornji-grad.si/objave/38 | non-content-path |
| https://www.gornji-grad.si/objave/391 | non-content-path |
| https://www.gornji-grad.si/objave/404 | non-content-path |
| https://www.gornji-grad.si/objave/43 | non-content-path |
| https://www.gornji-grad.si/objave/46 | non-content-path |
| https://www.gornji-grad.si/objave/48 | non-content-path |
| https://www.gornji-grad.si/objave/49 | non-content-path |
| https://www.gornji-grad.si/objave/51 | non-content-path |
| https://www.gornji-grad.si/objave/53 | non-content-path |
| https://www.gornji-grad.si/objave/58 | non-content-path |
| https://www.gornji-grad.si/objave/63 | non-content-path |
| https://www.gornji-grad.si/objave/64 | non-content-path |
| https://www.gornji-grad.si/objave/76 | non-content-path |
| https://www.gornji-grad.si/objave/8 | non-content-path |
| https://www.gornji-grad.si/objave/91 | non-content-path |
| https://www.gornji-grad.si/objave/95 | non-content-path |
| https://www.gornji-grad.si/prijava | non-content-path |
| https://www.gornji-grad.si/razpis/1245696 | source-byte-cap |
| https://www.gornji-grad.si/razpis/1365601 | source-byte-cap |
| https://www.gornji-grad.si/razpis/1365790 | source-byte-cap |
| https://www.gornji-grad.si/sitemap | non-content-path |
| https://www.gornji-grad.si/window.location.pathname | non-content-path |

### Občina Ljubno

Seed: https://www.ljubno.si/

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 0 | https://www.ljubno.si/ | https://www.ljubno.si/ | 2026-09-01T07:03:04.601Z | 2026-09-01T07:03:04.606Z | 1fffcbee3dabcd80b6d929bd8d637a51166a4b5f952e16d3dd9b0ec248b75462 | 420603 | 13586 | 1 |
| 1 | https://www.ljubno.si/imenik | https://www.ljubno.si/imenik | 2026-09-01T07:03:08.001Z | 2026-09-01T07:03:08.011Z | 517892660d6f4529bd2b53bd763c844514fee1a062397f4b9d968cc8dfd8e44c | 405749 | 5897 | 0 |
| 1 | https://www.ljubno.si/katalogjavnegaznacaja | https://www.ljubno.si/katalogjavnegaznacaja | 2026-09-01T07:03:08.893Z | 2026-09-01T07:03:08.896Z | 87b8326364244ce17027463de7ef9fe57ac763d5fbe23d77f7f3d041513941ab | 432447 | 13186 | 0 |
| 1 | https://www.ljubno.si/municipalregulations | https://www.ljubno.si/municipalregulations | 2026-09-01T07:03:09.422Z | 2026-09-01T07:03:09.425Z | 59882db4a3fd7c45a320e2f312c9caa410be45eb4b99c51354b9a89aa61595ec | 434460 | 18654 | 0 |
| 1 | https://www.ljubno.si/objava/134996 | https://www.ljubno.si/objava/134996 | 2026-09-01T07:03:10.019Z | 2026-09-01T07:03:10.023Z | faa8f636486b619a69b0437cc52f27c2a0c40ee1c6e1d1db67b35dd5016bc439 | 442414 | 11622 | 0 |
| 1 | https://www.ljubno.si/objava/1350895 | https://www.ljubno.si/objava/1350895 | 2026-09-01T07:03:10.743Z | 2026-09-01T07:03:10.745Z | dd0a42feb1230c50e2dd0cc63e6adce5356b565e680a1ed46fb330661fc800c5 | 399800 | 5546 | 0 |
| 1 | https://www.ljubno.si/Razpisi | https://www.ljubno.si/Razpisi | 2026-09-01T07:03:05.200Z | 2026-09-01T07:03:05.203Z | 642b948568f487514367b3432db4c950fd00a87b300b19beab671dbed267b22a | 398745 | 4709 | 0 |
| 1 | https://www.ljubno.si/Registracija | https://www.ljubno.si/Registracija | 2026-09-01T07:03:05.758Z | 2026-09-01T07:03:05.764Z | 75f28d561d0b99656b24c9b0acf1ebfa0cdddf83feb96fcba47ba2debd18dd36 | 402253 | 4963 | 0 |
| 1 | https://www.ljubno.si/TermsAndConditions | https://www.ljubno.si/TermsAndConditions | 2026-09-01T07:03:06.550Z | 2026-09-01T07:03:06.554Z | 551b830c634ffa4a42120b7389fbf8351401b6e63fc0331a9eeb725dad19546f | 397977 | 12219 | 0 |
| 1 | https://www.ljubno.si/ViriRSS | https://www.ljubno.si/ViriRSS | 2026-09-01T07:03:07.169Z | 2026-09-01T07:03:07.178Z | 8d8aded095a3c1581b67376d93d77f3d1c865f3ff87ce3c5fba77850d693066c | 392066 | 6042 | 2 |

Skipped URL evidence:

| URL | Reason |
|---|---|
| https://www.ljubno.si/Cookies | non-content-path |
| https://www.ljubno.si/CreateNew/391?relatedPostId=429616 | non-content-path |
| https://www.ljubno.si/CreateNew/391?relatedPostId=429617 | non-content-path |
| https://www.ljubno.si/CreateNew/391?relatedPostId=429618 | non-content-path |
| https://www.ljubno.si/CreateNew/391?relatedPostId=429619 | non-content-path |
| https://www.ljubno.si/GDPR | non-content-path |
| https://www.ljubno.si/Prijava | non-content-path |
| https://www.ljubno.si/Sitemap | non-content-path |
| https://www.ljubno.si/cookies | non-content-path |
| https://www.ljubno.si/eVloge | network |
| https://www.ljubno.si/einforming | non-content-path |
| https://www.ljubno.si/gdpr | non-content-path |
| https://www.ljubno.si/objava/1351577 | source-byte-cap |
| https://www.ljubno.si/objava/1351822 | source-byte-cap |
| https://www.ljubno.si/objava/1353848 | source-byte-cap |
| https://www.ljubno.si/objava/1354496 | source-byte-cap |
| https://www.ljubno.si/objava/1354510 | source-byte-cap |
| https://www.ljubno.si/objava/1355731 | source-byte-cap |
| https://www.ljubno.si/objava/1358572 | source-byte-cap |
| https://www.ljubno.si/objava/1364152 | source-byte-cap |
| https://www.ljubno.si/objava/1364343 | source-byte-cap |
| https://www.ljubno.si/objava/1366667 | source-byte-cap |
| https://www.ljubno.si/objava/1368069 | source-byte-cap |
| https://www.ljubno.si/objava/150539 | source-byte-cap |
| https://www.ljubno.si/objava/173232 | source-byte-cap |
| https://www.ljubno.si/objava/178259 | source-byte-cap |
| https://www.ljubno.si/objava/185977 | source-byte-cap |
| https://www.ljubno.si/objava/385185 | source-byte-cap |
| https://www.ljubno.si/objava/518980 | source-byte-cap |
| https://www.ljubno.si/objava/561650 | source-byte-cap |
| https://www.ljubno.si/objava/606285 | source-byte-cap |
| https://www.ljubno.si/objava/728394 | source-byte-cap |
| https://www.ljubno.si/objava/75735 | source-byte-cap |
| https://www.ljubno.si/objava/77547 | source-byte-cap |
| https://www.ljubno.si/objava/77629 | source-byte-cap |
| https://www.ljubno.si/objava/77686 | source-byte-cap |
| https://www.ljubno.si/objava/94186 | source-byte-cap |
| https://www.ljubno.si/objave/ | non-content-path |
| https://www.ljubno.si/objave/101?subcategory=16915 | non-content-path |
| https://www.ljubno.si/objave/107 | non-content-path |
| https://www.ljubno.si/objave/109 | non-content-path |
| https://www.ljubno.si/objave/112 | non-content-path |
| https://www.ljubno.si/objave/115 | non-content-path |
| https://www.ljubno.si/objave/161 | non-content-path |
| https://www.ljubno.si/objave/176 | non-content-path |
| https://www.ljubno.si/objave/185 | non-content-path |
| https://www.ljubno.si/objave/200 | non-content-path |
| https://www.ljubno.si/objave/201 | non-content-path |
| https://www.ljubno.si/objave/229 | non-content-path |
| https://www.ljubno.si/objave/230 | non-content-path |
| https://www.ljubno.si/objave/255 | non-content-path |
| https://www.ljubno.si/objave/332 | non-content-path |
| https://www.ljubno.si/objave/347 | non-content-path |
| https://www.ljubno.si/objave/364 | non-content-path |
| https://www.ljubno.si/objave/38 | non-content-path |
| https://www.ljubno.si/objave/391 | non-content-path |
| https://www.ljubno.si/objave/43 | non-content-path |
| https://www.ljubno.si/objave/46 | non-content-path |
| https://www.ljubno.si/objave/46?subcategory=138 | non-content-path |
| https://www.ljubno.si/objave/49 | non-content-path |
| https://www.ljubno.si/objave/51 | non-content-path |
| https://www.ljubno.si/objave/52 | non-content-path |
| https://www.ljubno.si/objave/53 | non-content-path |
| https://www.ljubno.si/objave/58 | non-content-path |
| https://www.ljubno.si/objave/63 | non-content-path |
| https://www.ljubno.si/objave/76 | non-content-path |
| https://www.ljubno.si/objave/8 | non-content-path |
| https://www.ljubno.si/objave/91 | non-content-path |
| https://www.ljubno.si/objave/95 | non-content-path |
| https://www.ljubno.si/objave?subcategory=103 | non-content-path |
| https://www.ljubno.si/objave?subcategory=111 | non-content-path |
| https://www.ljubno.si/objave?subcategory=115 | non-content-path |
| https://www.ljubno.si/objave?subcategory=130 | non-content-path |
| https://www.ljubno.si/post/134996 | source-byte-cap |
| https://www.ljubno.si/prijava | non-content-path |
| https://www.ljubno.si/qanda | non-content-path |
| https://www.ljubno.si/razpis/1231702 | source-byte-cap |
| https://www.ljubno.si/razpis/1287049 | source-byte-cap |
| https://www.ljubno.si/sitemap | non-content-path |
| https://www.ljubno.si/window.location.pathname | non-content-path |

### Občina Luče

Seed: https://www.luce.si/

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 0 | https://www.luce.si/ | https://www.luce.si/ | 2026-09-01T07:08:15.130Z | 2026-09-01T07:08:15.132Z | b9f7b14bd28ca68e19fdd0f4b2803ea50e71033abd54ffd463555d52ae41e176 | 323324 | 15173 | 3 |
| 1 | https://www.luce.si/Datoteke/UpravljalecDatotek/83/VirtualnaPanorama/Obcina_Luce-MiT360VP.html | https://www.luce.si/Datoteke/UpravljalecDatotek/83/VirtualnaPanorama/Obcina_Luce-MiT360VP.html | 2026-09-01T07:08:15.623Z | 2026-09-01T06:52:20.772Z | 409786c57c9536c67add127d6b6f50e0fba3dbc78ecc5b909fc31c8961a70bc9 | 8959 | 50 | 0 |
| 1 | https://www.luce.si/dogodki | https://www.luce.si/dogodki | 2026-09-01T07:08:18.292Z | 2026-09-01T07:08:18.294Z | bfc62bda9f523f8037ce031f093d28ff1b479c2cdf28baaef5d6e420aa0fae4c | 300276 | 6493 | 2 |
| 1 | https://www.luce.si/gallery | https://www.luce.si/gallery | 2026-09-01T07:08:19.158Z | 2026-09-01T07:08:19.160Z | 0958cf1c59c429b7f2478c9112e559fd8585ecd2d81e748f68d31295573bce60 | 299593 | 6261 | 2 |
| 1 | https://www.luce.si/imenik | https://www.luce.si/imenik | 2026-09-01T07:08:19.778Z | 2026-09-01T07:08:19.779Z | ba765d48f0efce613916e1ffffc0b3e44d9a60a6ba3805f3dba1b73e7f4b5494 | 281648 | 6468 | 2 |
| 1 | https://www.luce.si/katalogjavnegaznacaja | https://www.luce.si/katalogjavnegaznacaja | 2026-09-01T07:08:20.523Z | 2026-09-01T07:08:20.525Z | 2b8207e535b2a67f2d6bbe7cd41d449438e7f281e7d0ff7a31b8fb9518c31e06 | 309848 | 15404 | 2 |
| 1 | https://www.luce.si/objava/1037877 | https://www.luce.si/objava/1037877 | 2026-09-01T07:08:21.048Z | 2026-09-01T07:08:21.050Z | 328fe866da1ae93fb25f5c2eeb5d959d9c46b9c529ed4eac1ee64feaae588f81 | 293106 | 9309 | 2 |
| 1 | https://www.luce.si/objava/104110 | https://www.luce.si/objava/104110 | 2026-09-01T07:08:21.539Z | 2026-09-01T07:08:21.541Z | 555eb41a4d465e496da2a83c911857abba0bfa419e0e7f865304cc2d5c88cda4 | 291563 | 12425 | 2 |
| 1 | https://www.luce.si/objava/1113309 | https://www.luce.si/objava/1113309 | 2026-09-01T07:08:22.116Z | 2026-09-01T07:08:22.119Z | f4620f2fac5cfa806634bf7a730d931a2383985d6196a05ec05c0f08e2743db8 | 283086 | 8696 | 2 |
| 1 | https://www.luce.si/objava/1162910 | https://www.luce.si/objava/1162910 | 2026-09-01T07:08:22.675Z | 2026-09-01T07:08:22.677Z | 978dd1be2bf5895d63bf80f454082ffc6a78e92b929953f619b30aeeb00bf6d1 | 292196 | 8596 | 4 |
| 1 | https://www.luce.si/objava/1189648 | https://www.luce.si/objava/1189648 | 2026-09-01T07:08:23.350Z | 2026-09-01T07:08:23.352Z | 7d0e5a78bce35e7aa0aca71359d79cc790f3d8e386c8a3b1886f93c92e48d0c3 | 291272 | 8766 | 2 |
| 1 | https://www.luce.si/Razpisi | https://www.luce.si/Razpisi | 2026-09-01T07:08:16.054Z | 2026-09-01T07:08:16.056Z | 86498f68e6dc6e673f684118298b407fb47b7248321ead9dea296ae3bf5241cc | 277603 | 6360 | 2 |
| 1 | https://www.luce.si/Registracija | https://www.luce.si/Registracija | 2026-09-01T07:08:16.481Z | 2026-09-01T07:08:16.483Z | 80e5a0fd5d8cc79282f203c964a42ade85baae9b1e677d47886ebd105152eb62 | 263129 | 4800 | 2 |
| 1 | https://www.luce.si/TermsAndConditions | https://www.luce.si/TermsAndConditions | 2026-09-01T07:08:17.048Z | 2026-09-01T07:08:17.050Z | caa115f44bdba709d4ca411ccd752c69406c54ac68ad5e0383b1984b3a3aed29 | 276429 | 13689 | 2 |
| 1 | https://www.luce.si/ViriRSS | https://www.luce.si/ViriRSS | 2026-09-01T07:08:17.496Z | 2026-09-01T07:08:17.497Z | 8f58c9a6d168137aadbd241d4221dd6baf9da495f0428ea9585f8eea5e927691 | 270522 | 7522 | 2 |

Skipped URL evidence:

| URL | Reason |
|---|---|
| https://www.luce.si/Cookies | non-content-path |
| https://www.luce.si/CreateNew/391?relatedPostId=429620 | non-content-path |
| https://www.luce.si/CreateNew/391?relatedPostId=429621 | non-content-path |
| https://www.luce.si/CreateNew/391?relatedPostId=429622 | non-content-path |
| https://www.luce.si/CreateNew/391?relatedPostId=429623 | non-content-path |
| https://www.luce.si/GDPR | non-content-path |
| https://www.luce.si/Prijava | non-content-path |
| https://www.luce.si/Sitemap | non-content-path |
| https://www.luce.si/cookies | non-content-path |
| https://www.luce.si/einforming | non-content-path |
| https://www.luce.si/gdpr | non-content-path |
| https://www.luce.si/objava/1212615 | source-byte-cap |
| https://www.luce.si/objava/1233337 | source-byte-cap |
| https://www.luce.si/objava/1240660 | source-byte-cap |
| https://www.luce.si/objava/1332541 | source-byte-cap |
| https://www.luce.si/objava/1337559 | source-byte-cap |
| https://www.luce.si/objava/1348802 | source-byte-cap |
| https://www.luce.si/objava/1351073 | source-byte-cap |
| https://www.luce.si/objava/1354077 | source-byte-cap |
| https://www.luce.si/objava/1355678 | source-byte-cap |
| https://www.luce.si/objava/1355899 | source-byte-cap |
| https://www.luce.si/objava/1359610 | source-byte-cap |
| https://www.luce.si/objava/1363231 | source-byte-cap |
| https://www.luce.si/objava/1364529 | source-byte-cap |
| https://www.luce.si/objava/1364530 | source-byte-cap |
| https://www.luce.si/objava/222105 | source-byte-cap |
| https://www.luce.si/objava/295129 | source-byte-cap |
| https://www.luce.si/objava/350933 | source-byte-cap |
| https://www.luce.si/objava/383146 | source-byte-cap |
| https://www.luce.si/objava/399594 | source-byte-cap |
| https://www.luce.si/objava/399597 | source-byte-cap |
| https://www.luce.si/objava/399598 | source-byte-cap |
| https://www.luce.si/objava/399600 | source-byte-cap |
| https://www.luce.si/objava/399601 | source-byte-cap |
| https://www.luce.si/objava/399603 | source-byte-cap |
| https://www.luce.si/objava/399604 | source-byte-cap |
| https://www.luce.si/objava/399605 | source-byte-cap |
| https://www.luce.si/objava/399606 | source-byte-cap |
| https://www.luce.si/objava/399608 | source-byte-cap |
| https://www.luce.si/objava/399609 | source-byte-cap |
| https://www.luce.si/objava/399611 | source-byte-cap |
| https://www.luce.si/objava/399612 | source-byte-cap |
| https://www.luce.si/objava/399614 | source-byte-cap |
| https://www.luce.si/objava/558100 | source-byte-cap |
| https://www.luce.si/objava/570213 | source-byte-cap |
| https://www.luce.si/objava/75151 | source-byte-cap |
| https://www.luce.si/objava/75334 | source-byte-cap |
| https://www.luce.si/objava/75451 | source-byte-cap |
| https://www.luce.si/objava/75455 | source-byte-cap |
| https://www.luce.si/objava/75591 | source-byte-cap |
| https://www.luce.si/objava/75765 | source-byte-cap |
| https://www.luce.si/objava/80809 | source-byte-cap |
| https://www.luce.si/objava/80812 | source-byte-cap |
| https://www.luce.si/objava/80813 | source-byte-cap |
| https://www.luce.si/objava/81038 | source-byte-cap |
| https://www.luce.si/objava/873762 | source-byte-cap |
| https://www.luce.si/objave/ | non-content-path |
| https://www.luce.si/objave/101 | non-content-path |
| https://www.luce.si/objave/104 | non-content-path |
| https://www.luce.si/objave/107 | non-content-path |
| https://www.luce.si/objave/109 | non-content-path |
| https://www.luce.si/objave/112?subcategory=115 | non-content-path |
| https://www.luce.si/objave/112?subcategory=130 | non-content-path |
| https://www.luce.si/objave/115 | non-content-path |
| https://www.luce.si/objave/161 | non-content-path |
| https://www.luce.si/objave/176 | non-content-path |
| https://www.luce.si/objave/183 | non-content-path |
| https://www.luce.si/objave/185 | non-content-path |
| https://www.luce.si/objave/187 | non-content-path |
| https://www.luce.si/objave/188 | non-content-path |
| https://www.luce.si/objave/191 | non-content-path |
| https://www.luce.si/objave/200 | non-content-path |
| https://www.luce.si/objave/201 | non-content-path |
| https://www.luce.si/objave/213 | non-content-path |
| https://www.luce.si/objave/229 | non-content-path |
| https://www.luce.si/objave/230 | non-content-path |
| https://www.luce.si/objave/255 | non-content-path |
| https://www.luce.si/objave/274 | non-content-path |
| https://www.luce.si/objave/294 | non-content-path |
| https://www.luce.si/objave/31 | non-content-path |
| https://www.luce.si/objave/332 | non-content-path |
| https://www.luce.si/objave/347 | non-content-path |
| https://www.luce.si/objave/364 | non-content-path |
| https://www.luce.si/objave/391 | non-content-path |
| https://www.luce.si/objave/404 | non-content-path |
| https://www.luce.si/objave/419 | non-content-path |
| https://www.luce.si/objave/43 | non-content-path |
| https://www.luce.si/objave/46 | non-content-path |
| https://www.luce.si/objave/48 | non-content-path |
| https://www.luce.si/objave/49 | non-content-path |
| https://www.luce.si/objave/51 | non-content-path |
| https://www.luce.si/objave/52 | non-content-path |
| https://www.luce.si/objave/53 | non-content-path |
| https://www.luce.si/objave/58 | non-content-path |
| https://www.luce.si/objave/63 | non-content-path |
| https://www.luce.si/objave/65 | non-content-path |
| https://www.luce.si/objave/76 | non-content-path |
| https://www.luce.si/objave/8 | non-content-path |
| https://www.luce.si/objave/91 | non-content-path |
| https://www.luce.si/objave/95 | non-content-path |
| https://www.luce.si/prijava | non-content-path |
| https://www.luce.si/qanda | non-content-path |
| https://www.luce.si/razpis/1354077 | source-byte-cap |
| https://www.luce.si/sitemap | non-content-path |
| https://www.luce.si/window.location.pathname | non-content-path |
| https://www.luce.si/window.location.pathname+ | non-content-path |

### Občina Mozirje

Seed: https://mozirje.si/

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 0 | https://mozirje.si/ | https://mozirje.si/ | 2026-09-01T07:23:17.834Z | 2026-09-01T07:23:17.837Z | f3544528d5d6056fc7ef3b4b6f622615e8743b9d1d6269577e3233c7033b13de | 232255 | 3880 | 0 |
| 1 | https://mozirje.si/aktualno/ | https://mozirje.si/aktualno/ | 2026-09-01T07:23:19.659Z | 2026-09-01T07:23:19.661Z | c763e15a3166f60562e2143c57fee2f7ed5abf97102fe472f3655ab893baa59a | 162859 | 2147 | 0 |
| 1 | https://mozirje.si/author/roman/ | https://mozirje.si/ | 2026-09-01T07:23:23.486Z | 2026-09-01T07:23:23.488Z | 0445e9f9bbcf387de420d0550884386b699875f9acd881b6e88205ab0d360e82 | 232255 | 3880 | 0 |
| 1 | https://mozirje.si/delna-zapora-ceste-mozirje-brdo-precna-zaradi-rekonstrukcije-vozisca/ | https://mozirje.si/delna-zapora-ceste-mozirje-brdo-precna-zaradi-rekonstrukcije-vozisca/ | 2026-09-01T07:23:25.244Z | 2026-09-01T07:23:25.247Z | 5086034195b227cde80cf6caef7514b06e282aa4abdb0937fef98af36ad3be4f | 166090 | 3331 | 0 |
| 1 | https://mozirje.si/gradnja-gozdne-ceste-kecej-dobrovec-dokoncana/ | https://mozirje.si/gradnja-gozdne-ceste-kecej-dobrovec-dokoncana/ | 2026-09-01T07:23:26.990Z | 2026-09-01T07:23:26.992Z | 1382d6f41d03010af5c307d6f5488a2c8b95a0f49da3daf1b842228feca97806 | 164093 | 2714 | 0 |
| 1 | https://mozirje.si/izgradnja-tic-mozirje/ | https://mozirje.si/izgradnja-tic-mozirje/ | 2026-09-01T07:23:28.887Z | 2026-09-01T07:23:28.888Z | e3d94219ec64a97fb8562a3e511191f60cf2927c0fb47af7e054fdd123cd4f6a | 173721 | 8840 | 0 |
| 1 | https://mozirje.si/izjava-o-skladnosti-zdsma/ | https://mozirje.si/izjava-o-skladnosti-zdsma/ | 2026-09-01T07:23:30.642Z | 2026-09-01T07:23:30.643Z | 052ed0316fb811bf1f6e8807adb270b3f6a2605fe26aebe01881779c1e474d67 | 162034 | 4576 | 0 |
| 1 | https://mozirje.si/kontakt/ | https://mozirje.si/kontakt/ | 2026-09-01T07:23:32.572Z | 2026-09-01T07:23:32.574Z | da092a2c384e399d4f87ca40ce3f643c5e4f79069235611dac51795ceb40288d | 168478 | 2742 | 0 |
| 1 | https://mozirje.si/kratkotrajne-zapore-cest-v-soboto-5-septembra-2026/ | https://mozirje.si/kratkotrajne-zapore-cest-v-soboto-5-septembra-2026/ | 2026-09-01T07:23:34.229Z | 2026-09-01T07:23:34.231Z | 517286d31effe62298d2797b0c18aa9829897d3b924703a54065418dfdc00315 | 164373 | 3135 | 0 |
| 1 | https://mozirje.si/kulturni-dom-srce-skupnosti/ | https://mozirje.si/kulturni-dom-srce-skupnosti/ | 2026-09-01T07:23:36.262Z | 2026-09-01T07:23:36.264Z | 83f97b13751ab9d0d9ad1c3a8c1828ae87d24e41ccd45a877baceac0aef36bb2 | 160466 | 2915 | 1 |
| 1 | https://mozirje.si/obcinska-celostna-prometna-strategija-ocps-mozirje/ | https://mozirje.si/obcinska-celostna-prometna-strategija-ocps-mozirje/ | 2026-09-01T07:23:38.192Z | 2026-09-01T07:23:38.193Z | 515117c44b2f32aba3c610e89fb3bf4311344ffee6eb8513c481870dc30479c6 | 170304 | 3553 | 0 |
| 1 | https://mozirje.si/obvestilo-o-popolni-zapori-ceste-smihel-golte/ | https://mozirje.si/obvestilo-o-popolni-zapori-ceste-smihel-golte/ | 2026-09-01T07:23:40.144Z | 2026-09-01T07:23:40.146Z | b5204cb639cbe2d880755c9290c680ac8ff05a067b0ef15ccc7711ed10d1ba3c | 164602 | 3057 | 0 |
| 1 | https://mozirje.si/porecje-savinje/ | https://mozirje.si/porecje-savinje/ | 2026-09-01T07:23:42.567Z | 2026-09-01T07:23:42.568Z | 59b966a7df4b9ed309caa8aa74c531d7cb4442278a8deb0fe11d701174694c0e | 85059 | 4586 | 0 |
| 1 | https://mozirje.si/povezujmo-se-skrbimo-za-naravo-kulturo-in-naso-infrastrukturo/ | https://mozirje.si/povezujmo-se/ | 2026-09-01T07:23:46.421Z | 2026-09-01T07:23:46.422Z | bdf4c478cfb7b345a9a81481d2b26d34ac23a75279d9f26b58e56bf372dd3c2d | 172051 | 4066 | 0 |
| 1 | https://mozirje.si/predlagajte-predstavnika-uporabnikov-v-svet-zavoda-knjiznica-mozirje-2026/ | https://mozirje.si/predlagajte-predstavnika-uporabnikov-v-svet-zavoda-knjiznica-mozirje-2026/ | 2026-09-01T07:23:48.379Z | 2026-09-01T07:23:48.380Z | 861baf868fb2b0eef5165ccffc93fbc1367acc651191a59e98edeb23ab9f5df0 | 170775 | 3469 | 1 |
| 1 | https://mozirje.si/razpis-za-imenovanje-direktorja-osrednje-knjiznice-mozirje/ | https://mozirje.si/razpis-za-imenovanje-direktorja-osrednje-knjiznice-mozirje/ | 2026-09-01T07:23:50.360Z | 2026-09-01T07:23:50.362Z | c4572a91f493e460ff49d8f4622d21361d448d96e2c25d43add75933c903eb41 | 163251 | 3024 | 1 |
| 1 | https://mozirje.si/sanacijska-dela-v-strugah-pritokov-savinje-avgust-2026/ | https://mozirje.si/sanacijska-dela-v-strugah-pritokov-savinje-avgust-2026/ | 2026-09-01T07:23:52.342Z | 2026-09-01T07:23:52.343Z | 3360820a08b064b54dab7a465418785a61205bb01d025ca2e9ad5d71bc1b687d | 165477 | 2627 | 0 |
| 1 | https://mozirje.si/sticisce-treh-generacij/ | https://mozirje.si/sticisce-treh-generacij/ | 2026-09-01T07:23:54.251Z | 2026-09-01T07:23:54.252Z | 8dcadbf9e801b0b2cc55e174e1db1f0dc62408c955946ced5d405cef8f104f9b | 174199 | 5634 | 2 |
| 1 | https://mozirje.si/varovanje-osebnih-podatkov/ | https://mozirje.si/varovanje-osebnih-podatkov/ | 2026-09-01T07:23:56.091Z | 2026-09-01T07:23:56.093Z | 829fbfd3b0aa78747312916b20cb2f39127cb96075867f47e4b13778c72f847e | 166819 | 10901 | 0 |
| 1 | https://mozirje.si/za-obcane/ | https://mozirje.si/za-obcane/ | 2026-09-01T07:23:57.867Z | 2026-09-01T07:23:57.868Z | 590b6fbccf21a2663c6e5b4f58457bb7b960dd5ba1b731f8398011ac4246f332 | 161912 | 2330 | 0 |
| 1 | https://mozirje.si/za-obcane/dokumenti/ | https://mozirje.si/za-obcane/dokumenti/ | 2026-09-01T07:23:59.750Z | 2026-09-01T07:23:59.752Z | 6db245c68dafa2262b49f2b895b406e4de170d88fb30976f4430a693317df2c5 | 165326 | 2199 | 0 |
| 1 | https://mozirje.si/za-obcane/dokumenti/ceniki/ | https://mozirje.si/za-obcane/dokumenti/ceniki/ | 2026-09-01T07:24:01.691Z | 2026-09-01T07:24:01.692Z | 96f45774d509bee84ef382b621eddb26ee30d0da798b0928955d179d84083923 | 158703 | 2205 | 0 |
| 1 | https://mozirje.si/za-obcane/dokumenti/obrazci-in-vloge/ | https://mozirje.si/za-obcane/dokumenti/obrazci-in-vloge/ | 2026-09-01T07:24:03.663Z | 2026-09-01T07:24:03.665Z | 103aed61402075a05ed1e41134548cf5b0336f90e3f4cf31deacbfca7b83248c | 172260 | 3744 | 0 |
| 1 | https://mozirje.si/za-obcane/obcina/ | https://mozirje.si/za-obcane/obcina/ | 2026-09-01T07:24:05.432Z | 2026-09-01T07:24:05.433Z | 4f486d93bde745d40433e1b6eb36bb4244a70fe15f4f469c80340f05d3e9f403 | 165298 | 2185 | 0 |

Skipped URL evidence:

| URL | Reason |
|---|---|
| https://mozirje.si/category/javne-objave/ | non-content-path |
| https://mozirje.si/category/javne-obravnave/ | non-content-path |
| https://mozirje.si/category/javne-razgrnitve/ | non-content-path |
| https://mozirje.si/category/javni-razpisi/ | non-content-path |
| https://mozirje.si/za-obcane/obcina/obcinska-uprava/ | source-byte-cap |
| https://mozirje.si/za-obcane/obcina/obcinski-nagrajenci/ | source-byte-cap |
| https://mozirje.si/za-obcane/obcina/obcinski-svet/ | source-byte-cap |
| https://mozirje.si/za-obcane/obcina/obcinski-svet/nadzorni-odbor/ | source-byte-cap |
| https://mozirje.si/za-obcane/obcina/obcinski-svet/seje-obcinskega-sveta/ | source-byte-cap |
| https://mozirje.si/za-obcane/obcina/zupan/ | source-byte-cap |
| https://mozirje.si/za-obcane/obcinsko-glasilo/ | source-byte-cap |
| https://mozirje.si/za-obcane/organizacije/ | source-byte-cap |
| https://mozirje.si/za-obcane/organizacije/drustva-in-druge-nevladne-organizacije/ | source-byte-cap |
| https://mozirje.si/za-obcane/organizacije/javni-zavodi/ | source-byte-cap |
| https://mozirje.si/za-obcane/organizacije/politicne-stranke/ | source-byte-cap |
| https://mozirje.si/za-obcane/organizacije/pomembni-kontakti/ | source-byte-cap |

### Občina Nazarje

Seed: https://nazarje.si/

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 0 | https://nazarje.si/ | https://nazarje.si/ | 2026-09-01T07:14:13.295Z | 2026-09-01T07:14:13.298Z | 6d2ebde154f34632bba36d84c186ad927c6a803bb61718326234a5d99dc5fc2f | 391060 | 19779 | 9 |
| 1 | https://nazarje.si/acts | https://nazarje.si/acts | 2026-09-01T07:14:16.132Z | 2026-09-01T07:14:16.134Z | ed5c1160a476d95acc0369d0ff437ca53d9d5bad21d90a6f43fed710761702e5 | 322107 | 7016 | 3 |
| 1 | https://nazarje.si/Datoteke/UpravljalecDatotek/96/VirtualnaPanorama/Obcina_Nazarje-MiT360VP.html | https://nazarje.si/Datoteke/UpravljalecDatotek/96/VirtualnaPanorama/Obcina_Nazarje-MiT360VP.html | 2026-09-01T07:14:13.495Z | 2026-09-01T07:14:13.495Z | 2dfa1a227809e7b0f3cf1464e9e7ef35a3889b9cb86827b6f6a74093dcfe8dcd | 8984 | 36 | 0 |
| 1 | https://nazarje.si/dogodki | https://nazarje.si/dogodki | 2026-09-01T07:14:16.586Z | 2026-09-01T07:14:16.588Z | bef2f115b058866bdb41205e64b7b6de1ba4e68833d5abba9d28547eb50157f6 | 331166 | 7244 | 3 |
| 1 | https://nazarje.si/gallery | https://nazarje.si/gallery | 2026-09-01T07:14:17.328Z | 2026-09-01T07:14:17.330Z | 3fff598347fc34ff5cceb506cb40f9c6ea84609ac651b7375a5ee5b51ceadba5 | 369134 | 7055 | 3 |
| 1 | https://nazarje.si/gallery/7644 | https://nazarje.si/gallery/7644 | 2026-09-01T07:14:17.777Z | 2026-09-01T07:14:17.779Z | f2a18f0506666c7987f89ab3a29bee79c3ecd7ff083c78b94c085a6bde4f6610 | 324057 | 6909 | 3 |
| 1 | https://nazarje.si/gallery/7648 | https://nazarje.si/gallery/7648 | 2026-09-01T07:14:18.211Z | 2026-09-01T07:14:18.213Z | cf72160bd238397fbe7bfa0e97eb25535ac8cb99a29ab4cf818f1d77ef9f7764 | 327895 | 6902 | 3 |
| 1 | https://nazarje.si/gallery/7652 | https://nazarje.si/gallery/7652 | 2026-09-01T07:14:18.689Z | 2026-09-01T07:14:18.691Z | 5320c1128c9b8ee6c694f1a74e0d98c1564bac3a7d172feeb15cd28632059a1f | 309126 | 6897 | 3 |
| 1 | https://nazarje.si/gallery/7653 | https://nazarje.si/gallery/7653 | 2026-09-01T07:14:19.153Z | 2026-09-01T07:14:19.155Z | bac96a42c09822015eaf14664ef34c14b69f8f23c50000bc9491eb736e42b897 | 310555 | 6909 | 3 |
| 1 | https://nazarje.si/Razpisi | https://nazarje.si/Razpisi | 2026-09-01T07:14:13.932Z | 2026-09-01T07:14:13.935Z | 2d076ca560c59341deba019244b9b2eb2a8b61ffce8ba0acac39bd320e5f65bc | 308130 | 6967 | 0 |
| 1 | https://nazarje.si/Registracija | https://nazarje.si/Registracija | 2026-09-01T07:14:14.377Z | 2026-09-01T07:14:14.380Z | e3d99eddd93a4c060946049196ebdc2db8b870f82c12dc25181f60f293fe8794 | 288372 | 4664 | 0 |
| 1 | https://nazarje.si/TermsAndConditions | https://nazarje.si/TermsAndConditions | 2026-09-01T07:14:14.921Z | 2026-09-01T07:14:14.923Z | 10585cfdc6d899b6da61c867084250bbf38336da65bc5316d061ccf5f4ef7e6a | 307299 | 14464 | 0 |
| 1 | https://nazarje.si/ViriRSS | https://nazarje.si/ViriRSS | 2026-09-01T07:14:15.397Z | 2026-09-01T07:14:15.399Z | 51b8a01402007dcd55fada1355d032de4dcb5be86a7903a446e1216ff4977b81 | 301372 | 8271 | 0 |

Skipped URL evidence:

| URL | Reason |
|---|---|
| https://nazarje.si/Cookies | non-content-path |
| https://nazarje.si/CreateNew/391?relatedPostId=429653 | non-content-path |
| https://nazarje.si/CreateNew/391?relatedPostId=429654 | non-content-path |
| https://nazarje.si/CreateNew/391?relatedPostId=429655 | non-content-path |
| https://nazarje.si/CreateNew/391?relatedPostId=429656 | non-content-path |
| https://nazarje.si/GDPR | non-content-path |
| https://nazarje.si/Prijava | non-content-path |
| https://nazarje.si/Sitemap | non-content-path |
| https://nazarje.si/cookies | non-content-path |
| https://nazarje.si/einforming | non-content-path |
| https://nazarje.si/gallery/91120 | source-byte-cap |
| https://nazarje.si/gdpr | non-content-path |
| https://nazarje.si/imenik | source-byte-cap |
| https://nazarje.si/katalogjavnegaznacaja | source-byte-cap |
| https://nazarje.si/manage | source-byte-cap |
| https://nazarje.si/novica/112429 | source-byte-cap |
| https://nazarje.si/obcinskevsebine/1986 | source-byte-cap |
| https://nazarje.si/obcinskevsebine/1987 | source-byte-cap |
| https://nazarje.si/obcinskevsebine/1991 | source-byte-cap |
| https://nazarje.si/obcinskevsebine/1993 | source-byte-cap |
| https://nazarje.si/obcinskevsebine/2054 | source-byte-cap |
| https://nazarje.si/objava/1016289 | source-byte-cap |
| https://nazarje.si/objava/111494 | source-byte-cap |
| https://nazarje.si/objava/111495 | source-byte-cap |
| https://nazarje.si/objava/111496 | source-byte-cap |
| https://nazarje.si/objava/1167123 | source-byte-cap |
| https://nazarje.si/objava/1186467 | source-byte-cap |
| https://nazarje.si/objava/1198550 | source-byte-cap |
| https://nazarje.si/objava/1210220 | source-byte-cap |
| https://nazarje.si/objava/1348610 | source-byte-cap |
| https://nazarje.si/objava/1349289 | source-byte-cap |
| https://nazarje.si/objava/1349458 | source-byte-cap |
| https://nazarje.si/objava/1350757 | source-byte-cap |
| https://nazarje.si/objava/1353297 | source-byte-cap |
| https://nazarje.si/objava/1358058 | source-byte-cap |
| https://nazarje.si/objava/1359649 | source-byte-cap |
| https://nazarje.si/objava/1360472 | source-byte-cap |
| https://nazarje.si/objava/1363929 | source-byte-cap |
| https://nazarje.si/objava/1364003 | source-byte-cap |
| https://nazarje.si/objava/1366021 | source-byte-cap |
| https://nazarje.si/objava/159227 | source-byte-cap |
| https://nazarje.si/objava/173275 | source-byte-cap |
| https://nazarje.si/objava/399930 | source-byte-cap |
| https://nazarje.si/objava/399931 | source-byte-cap |
| https://nazarje.si/objava/399933 | source-byte-cap |
| https://nazarje.si/objava/399934 | source-byte-cap |
| https://nazarje.si/objava/399935 | source-byte-cap |
| https://nazarje.si/objava/399936 | source-byte-cap |
| https://nazarje.si/objava/399937 | source-byte-cap |
| https://nazarje.si/objava/399938 | source-byte-cap |
| https://nazarje.si/objava/399939 | source-byte-cap |
| https://nazarje.si/objava/399940 | source-byte-cap |
| https://nazarje.si/objava/399941 | source-byte-cap |
| https://nazarje.si/objava/399942 | source-byte-cap |
| https://nazarje.si/objava/399944 | source-byte-cap |
| https://nazarje.si/objava/399945 | source-byte-cap |
| https://nazarje.si/objava/399946 | source-byte-cap |
| https://nazarje.si/objava/399947 | source-byte-cap |
| https://nazarje.si/objava/399948 | source-byte-cap |
| https://nazarje.si/objava/399951 | page-cap |
| https://nazarje.si/objava/399952 | page-cap |
| https://nazarje.si/objava/399953 | page-cap |
| https://nazarje.si/objava/399954 | page-cap |
| https://nazarje.si/objava/399956 | page-cap |
| https://nazarje.si/objava/399957 | page-cap |
| https://nazarje.si/objava/54127 | page-cap |
| https://nazarje.si/objava/54342 | page-cap |
| https://nazarje.si/objava/55121 | page-cap |
| https://nazarje.si/objava/55122 | page-cap |
| https://nazarje.si/objava/55123 | page-cap |
| https://nazarje.si/objava/55124 | page-cap |
| https://nazarje.si/objava/55125 | page-cap |
| https://nazarje.si/objava/55126 | page-cap |
| https://nazarje.si/objava/55127 | page-cap |
| https://nazarje.si/objava/55128 | page-cap |
| https://nazarje.si/objava/55129 | page-cap |
| https://nazarje.si/objava/55130 | page-cap |
| https://nazarje.si/objava/55131 | page-cap |
| https://nazarje.si/objava/55132 | page-cap |
| https://nazarje.si/objava/55133 | page-cap |
| https://nazarje.si/objava/55146 | page-cap |
| https://nazarje.si/objava/55147 | page-cap |
| https://nazarje.si/objava/55148 | page-cap |
| https://nazarje.si/objava/55149 | page-cap |
| https://nazarje.si/objava/55150 | page-cap |
| https://nazarje.si/objava/55151 | page-cap |
| https://nazarje.si/objava/55152 | page-cap |
| https://nazarje.si/objava/57327 | page-cap |
| https://nazarje.si/objava/57328 | page-cap |
| https://nazarje.si/objava/57329 | page-cap |
| https://nazarje.si/objava/57342 | page-cap |
| https://nazarje.si/objava/839709 | page-cap |
| https://nazarje.si/objava/96063 | page-cap |
| https://nazarje.si/objave | non-content-path |
| https://nazarje.si/objave/101?subcategory=290 | non-content-path |
| https://nazarje.si/objave/107 | non-content-path |
| https://nazarje.si/objave/112 | non-content-path |
| https://nazarje.si/objave/115?subcategory=143 | non-content-path |
| https://nazarje.si/objave/158 | non-content-path |
| https://nazarje.si/objave/175 | non-content-path |
| https://nazarje.si/objave/176 | non-content-path |
| https://nazarje.si/objave/177 | non-content-path |
| https://nazarje.si/objave/187 | non-content-path |
| https://nazarje.si/objave/188 | non-content-path |
| https://nazarje.si/objave/200 | non-content-path |
| https://nazarje.si/objave/229 | non-content-path |
| https://nazarje.si/objave/230 | non-content-path |
| https://nazarje.si/objave/255 | non-content-path |
| https://nazarje.si/objave/274 | non-content-path |
| https://nazarje.si/objave/294 | non-content-path |
| https://nazarje.si/objave/332 | non-content-path |
| https://nazarje.si/objave/347 | non-content-path |
| https://nazarje.si/objave/364 | non-content-path |
| https://nazarje.si/objave/391 | non-content-path |
| https://nazarje.si/objave/404 | non-content-path |
| https://nazarje.si/objave/43 | non-content-path |
| https://nazarje.si/objave/440 | non-content-path |
| https://nazarje.si/objave/46 | non-content-path |
| https://nazarje.si/objave/46?subcategory=442 | non-content-path |
| https://nazarje.si/objave/48 | non-content-path |
| https://nazarje.si/objave/49 | non-content-path |
| https://nazarje.si/objave/53 | non-content-path |
| https://nazarje.si/objave/53?subcategory=11 | non-content-path |
| https://nazarje.si/objave/53?subcategory=13 | non-content-path |
| https://nazarje.si/objave/53?subcategory=5 | non-content-path |
| https://nazarje.si/objave/56 | non-content-path |
| https://nazarje.si/objave/58 | non-content-path |
| https://nazarje.si/objave/63 | non-content-path |
| https://nazarje.si/objave/76 | non-content-path |
| https://nazarje.si/objave/8 | non-content-path |
| https://nazarje.si/objave/91 | non-content-path |
| https://nazarje.si/prijava | non-content-path |
| https://nazarje.si/razpis/1193273 | page-cap |
| https://nazarje.si/razpis/1193604 | page-cap |
| https://nazarje.si/razpis/1235471 | page-cap |
| https://nazarje.si/razpis/1314399 | page-cap |
| https://nazarje.si/razpis/1339052 | page-cap |
| https://nazarje.si/razpis/1360020 | page-cap |
| https://nazarje.si/razpis/1360024 | page-cap |
| https://nazarje.si/sitemap | non-content-path |
| https://nazarje.si/window.location.pathname | non-content-path |

### Občina Solčava

Seed: https://www.solcava.si/

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 0 | https://www.solcava.si/ | https://www.solcava.si/ | 2026-09-01T07:12:41.461Z | 2026-09-01T07:12:41.462Z | d87d66f1345531f39ee95413850f008f2366dfecf8e34a0e63c7e6e2db959b51 | 206942 | 13804 | 0 |
| 1 | https://www.solcava.si/acts | https://www.solcava.si/acts | 2026-09-01T07:12:43.446Z | 2026-09-01T07:12:43.447Z | dc33ff3a743fc2c830e3ff814bb2913139be101f7c8058b2799bca5467c87183 | 168960 | 5493 | 0 |
| 1 | https://www.solcava.si/dogodki | https://www.solcava.si/dogodki | 2026-09-01T07:12:43.958Z | 2026-09-01T07:12:43.959Z | 8a9192744e66f715bcf63ffa6be1c49cb8c6ca24251a1e5178b79df106ae8b8d | 180389 | 5760 | 0 |
| 1 | https://www.solcava.si/gallery | https://www.solcava.si/gallery | 2026-09-01T07:12:44.547Z | 2026-09-01T07:12:44.549Z | 3472eca4b0950c5f5aa6faad3de882ce903ac6b014ddbd623a64aff94afc9706 | 236287 | 8879 | 0 |
| 1 | https://www.solcava.si/imenik | https://www.solcava.si/imenik | 2026-09-01T07:12:45.023Z | 2026-09-01T07:12:45.025Z | 3e35810e342bae3bfea82377374e1c96aad9e37188f31f8e93c7e590e273c5b6 | 162435 | 5739 | 0 |
| 1 | https://www.solcava.si/katalogjavnegaznacaja | https://www.solcava.si/katalogjavnegaznacaja | 2026-09-01T07:12:46.093Z | 2026-09-01T07:12:46.094Z | af2a811d335f8d7698b5a1643d01ec54100461d2043f24834a7dc5f7ab807d10 | 197230 | 17252 | 0 |
| 1 | https://www.solcava.si/objava/1002877 | https://www.solcava.si/objava/1002877 | 2026-09-01T07:12:46.426Z | 2026-09-01T07:12:46.428Z | ab298450fad786376ae997d4dc051e24384f929a7cf9ec2c2349a0d066a9d9f9 | 161096 | 6875 | 1 |
| 1 | https://www.solcava.si/objava/106391 | https://www.solcava.si/objava/106391 | 2026-09-01T07:12:47.505Z | 2026-09-01T07:12:47.506Z | a16fcdbd56865ec33764a583d34c50bd1901c75df3abb16f9d076cbcb13a5494 | 166071 | 6665 | 1 |
| 1 | https://www.solcava.si/objava/1095953 | https://www.solcava.si/objava/1095953 | 2026-09-01T07:12:47.856Z | 2026-09-01T07:12:47.858Z | f25f9439adccb52c9059b6337238775b0925101294becaeff409a9a23d5faaf9 | 172372 | 7741 | 0 |
| 1 | https://www.solcava.si/objava/1106552 | https://www.solcava.si/objava/1106552 | 2026-09-01T07:12:48.233Z | 2026-09-01T07:12:48.236Z | c11b3865814a5218a34754a52ac407a20dc5cf1e47332c290197c28cccb679c6 | 174665 | 7697 | 0 |
| 1 | https://www.solcava.si/objava/1106600 | https://www.solcava.si/objava/1106600 | 2026-09-01T07:12:48.629Z | 2026-09-01T07:12:48.631Z | d0e255ffbabddbafdd852ca7d16fac6eacb9aca8de5745eb2511bb8412680413 | 177603 | 8199 | 0 |
| 1 | https://www.solcava.si/objava/1107049 | https://www.solcava.si/objava/1107049 | 2026-09-01T07:12:48.972Z | 2026-09-01T07:12:48.973Z | 0c96b71368f65bc84e4dabe45c496479c3f811cb3a8b99a335b050b9affb5b93 | 173426 | 7661 | 1 |
| 1 | https://www.solcava.si/objava/1172727 | https://www.solcava.si/objava/1172727 | 2026-09-01T07:12:49.309Z | 2026-09-01T07:12:49.310Z | 176406365eea0485387d9beaa5abf6260b39b3ac8bccf46474844963ee4e5ffe | 179430 | 7787 | 0 |
| 1 | https://www.solcava.si/objava/1181231 | https://www.solcava.si/objava/1181231 | 2026-09-01T07:12:49.680Z | 2026-09-01T07:12:49.681Z | 3cf64e5a8a0876acf8c0a8bf57cb30f35d533596309ea6a5aeb21b7576da9fbe | 161530 | 8482 | 1 |
| 1 | https://www.solcava.si/objava/1199989 | https://www.solcava.si/objava/1199989 | 2026-09-01T07:12:50.031Z | 2026-09-01T07:12:50.032Z | 4ad289db16daab666936a102b5b2a03d65bbbd4055b2f888a26e8420aec642c5 | 173871 | 8947 | 0 |
| 1 | https://www.solcava.si/objava/1243339 | https://www.solcava.si/objava/1243339 | 2026-09-01T07:12:50.522Z | 2026-09-01T07:12:50.523Z | 6de1f41652a2c2fa794605b487c85c082d71301a4b0e2cf466b450ba7d84e306 | 181789 | 6581 | 0 |
| 1 | https://www.solcava.si/objava/1243660 | https://www.solcava.si/objava/1243660 | 2026-09-01T07:12:50.900Z | 2026-09-01T07:12:50.901Z | e8745abe6fe8dc63e577bf8e163d308d6489daca58a79f24adf64930a3909906 | 170357 | 7756 | 0 |
| 1 | https://www.solcava.si/objava/1243672 | https://www.solcava.si/objava/1243672 | 2026-09-01T07:12:51.294Z | 2026-09-01T07:12:51.295Z | c27836480b01f52eaed5f3b15c6f9d3131065df58229cbacab4e848b1800a9e7 | 169380 | 6387 | 0 |
| 1 | https://www.solcava.si/objava/1243684 | https://www.solcava.si/objava/1243684 | 2026-09-01T07:12:51.690Z | 2026-09-01T07:12:51.692Z | 212cf67b049d79a73056561e5571a90452c41921bab1721e278ae4db233daa10 | 170101 | 7128 | 1 |
| 1 | https://www.solcava.si/objava/1287086 | https://www.solcava.si/objava/1287086 | 2026-09-01T07:12:52.047Z | 2026-09-01T07:12:52.048Z | ba19265a91c66f9104f7705c0b5e3a733374071cd6b00d11db25e23d059173c1 | 172792 | 8172 | 0 |
| 1 | https://www.solcava.si/Razpisi | https://www.solcava.si/Razpisi | 2026-09-01T07:12:42.227Z | 2026-09-01T07:12:42.228Z | ff2ccce5efe73a132366a99a3290a162e4cc528de3a80e822f6b2da641a7072f | 157302 | 5461 | 0 |
| 1 | https://www.solcava.si/Registracija | https://www.solcava.si/Registracija | 2026-09-01T07:12:42.490Z | 2026-09-01T07:12:42.491Z | f753280ac460adc15cc32287d6aa66ce476b050fb407b53e626f5a57ef00f5d1 | 155393 | 5499 | 0 |
| 1 | https://www.solcava.si/TermsAndConditions | https://www.solcava.si/TermsAndConditions | 2026-09-01T07:12:42.734Z | 2026-09-01T07:12:42.736Z | 8277e494caf39556c7b26d1e81b6f0e0e2a493f48453539564ce827466d8c3a3 | 156520 | 12985 | 0 |
| 1 | https://www.solcava.si/ViriRSS | https://www.solcava.si/ViriRSS | 2026-09-01T07:12:43.001Z | 2026-09-01T07:12:43.003Z | 366ce395b92fd977286c887faea4afc482c7f2f66108123e1e6184b85c9961ba | 150588 | 6786 | 0 |

Skipped URL evidence:

| URL | Reason |
|---|---|
| https://www.solcava.si/Cookies | non-content-path |
| https://www.solcava.si/GDPR | non-content-path |
| https://www.solcava.si/Prijava | non-content-path |
| https://www.solcava.si/Sitemap | non-content-path |
| https://www.solcava.si/cookies | non-content-path |
| https://www.solcava.si/einforming | non-content-path |
| https://www.solcava.si/gdpr | non-content-path |
| https://www.solcava.si/objava/1312139 | source-byte-cap |
| https://www.solcava.si/objava/1334893 | source-byte-cap |
| https://www.solcava.si/objava/1354156 | source-byte-cap |
| https://www.solcava.si/objava/1356315 | source-byte-cap |
| https://www.solcava.si/objava/1363045 | source-byte-cap |
| https://www.solcava.si/objava/1363270 | source-byte-cap |
| https://www.solcava.si/objava/1365970 | source-byte-cap |
| https://www.solcava.si/objava/169190 | source-byte-cap |
| https://www.solcava.si/objava/260995 | source-byte-cap |
| https://www.solcava.si/objava/260997 | source-byte-cap |
| https://www.solcava.si/objava/260998 | source-byte-cap |
| https://www.solcava.si/objava/260999 | source-byte-cap |
| https://www.solcava.si/objava/261003 | source-byte-cap |
| https://www.solcava.si/objava/261004 | source-byte-cap |
| https://www.solcava.si/objava/261005 | source-byte-cap |
| https://www.solcava.si/objava/261011 | source-byte-cap |
| https://www.solcava.si/objava/309229 | source-byte-cap |
| https://www.solcava.si/objava/57440 | source-byte-cap |
| https://www.solcava.si/objava/57445 | source-byte-cap |
| https://www.solcava.si/objava/59817 | source-byte-cap |
| https://www.solcava.si/objava/95731 | source-byte-cap |
| https://www.solcava.si/objava/95757 | source-byte-cap |
| https://www.solcava.si/objava/96039 | source-byte-cap |
| https://www.solcava.si/objave | non-content-path |
| https://www.solcava.si/objave/ | non-content-path |
| https://www.solcava.si/objave/101 | non-content-path |
| https://www.solcava.si/objave/107 | non-content-path |
| https://www.solcava.si/objave/115?subcategory=143 | non-content-path |
| https://www.solcava.si/objave/158 | non-content-path |
| https://www.solcava.si/objave/161 | non-content-path |
| https://www.solcava.si/objave/175 | non-content-path |
| https://www.solcava.si/objave/176 | non-content-path |
| https://www.solcava.si/objave/177 | non-content-path |
| https://www.solcava.si/objave/187 | non-content-path |
| https://www.solcava.si/objave/188 | non-content-path |
| https://www.solcava.si/objave/229 | non-content-path |
| https://www.solcava.si/objave/230 | non-content-path |
| https://www.solcava.si/objave/255 | non-content-path |
| https://www.solcava.si/objave/274 | non-content-path |
| https://www.solcava.si/objave/294 | non-content-path |
| https://www.solcava.si/objave/332 | non-content-path |
| https://www.solcava.si/objave/347 | non-content-path |
| https://www.solcava.si/objave/364 | non-content-path |
| https://www.solcava.si/objave/391 | non-content-path |
| https://www.solcava.si/objave/404 | non-content-path |
| https://www.solcava.si/objave/43 | non-content-path |
| https://www.solcava.si/objave/46 | non-content-path |
| https://www.solcava.si/objave/46?subcategory=137 | non-content-path |
| https://www.solcava.si/objave/46?subcategory=138 | non-content-path |
| https://www.solcava.si/objave/49 | non-content-path |
| https://www.solcava.si/objave/51 | non-content-path |
| https://www.solcava.si/objave/53 | non-content-path |
| https://www.solcava.si/objave/58 | non-content-path |
| https://www.solcava.si/objave/63 | non-content-path |
| https://www.solcava.si/objave/65 | non-content-path |
| https://www.solcava.si/objave/76 | non-content-path |
| https://www.solcava.si/objave/8 | non-content-path |
| https://www.solcava.si/objave/91 | non-content-path |
| https://www.solcava.si/objave?subcategory=88 | non-content-path |
| https://www.solcava.si/prijava | non-content-path |
| https://www.solcava.si/razpis/1271439 | source-byte-cap |
| https://www.solcava.si/sitemap | non-content-path |
| https://www.solcava.si/window.location.pathname | non-content-path |

### Visit Luče

Seed: https://visitluce.si/

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 0 | https://visitluce.si/ | https://visitluce.si/ | 2026-09-01T07:07:24.996Z | 2026-08-31T21:55:44.592Z | 7751e360cbe3fcaedf95718c50557a2705d50748834f85ec6a407ba43056ba70 | 160843 | 4775 | 1 |
| 1 | https://visitluce.si/author/itmelona/ | https://visitluce.si/author/itmelona/ | 2026-09-01T07:07:25.190Z | 2026-09-01T06:51:39.984Z | 7820036ff2059d3e7a2191ceba1965faf56c5f7c320ba939b2430243bb38879d | 89975 | 1304 | 0 |
| 1 | https://visitluce.si/kaj-poceti/ | https://visitluce.si/kaj-poceti/ | 2026-09-01T07:07:25.384Z | 2026-09-01T06:51:40.193Z | a3ba5c9a3ba5bae1a053f6f18f5c30d670f927680c17cdfa00fbc915dbcf0804 | 125470 | 3756 | 0 |
| 1 | https://visitluce.si/kulinarika/ | https://visitluce.si/kulinarika/ | 2026-09-01T07:07:25.578Z | 2026-09-01T06:51:40.398Z | 628fc8a376b22581f3efda4b732156e6bad9014c8571cf65a7627a4e54fd55a1 | 116893 | 2655 | 0 |
| 1 | https://visitluce.si/lokalno/ | https://visitluce.si/lokalno/ | 2026-09-01T07:07:25.772Z | 2026-09-01T06:51:40.601Z | 92750eaa8251f353d19e5e25d6e433151dbd6667125f832667c5b2c897fd89ff | 119871 | 2719 | 1 |
| 1 | https://visitluce.si/nastanitve/ | https://visitluce.si/nastanitve/ | 2026-09-01T07:07:25.966Z | 2026-09-01T06:51:40.808Z | 33d63e594b4b56c2cc231fc12c34790b816a10e117b668fe84d0dfa944b49931 | 150133 | 3963 | 4 |
| 1 | https://visitluce.si/o-lucah/ | https://visitluce.si/o-lucah/ | 2026-09-01T07:07:26.164Z | 2026-09-01T06:51:41.014Z | 5a8b210d45cd57dc247f4e2d39af418868332f1474f56f0449ecf372e29afa59 | 150640 | 4291 | 0 |
| 1 | https://visitluce.si/o-lucah/kako-do-nas/ | https://visitluce.si/o-lucah/kako-do-nas/ | 2026-09-01T07:07:26.359Z | 2026-09-01T06:51:41.215Z | 65a09101be69a39fcc2d1c5a8c4dd54f4883b1a67abd475f42b70c7bb5972cb4 | 97259 | 3201 | 0 |
| 1 | https://visitluce.si/o-lucah/predstavitev-kraja/ | https://visitluce.si/o-lucah/predstavitev-kraja/ | 2026-09-01T07:07:26.548Z | 2026-09-01T06:51:41.415Z | d9111b21d80e463fd8678ec6f8846657af6e6378f1ee823d24937fe529d1e7e3 | 122784 | 3219 | 0 |
| 1 | https://visitluce.si/o-lucah/turisticne-informacije/ | https://visitluce.si/o-lucah/turisticne-informacije/ | 2026-09-01T07:07:26.737Z | 2026-09-01T06:51:41.618Z | 5a2623927a21303df578a2b9299ec33235f89cc9ae408d00f98b78a5aa2b0234 | 107148 | 1921 | 0 |
| 1 | https://visitluce.si/o-lucah/zgodovina/ | https://visitluce.si/o-lucah/zgodovina/ | 2026-09-01T07:07:26.931Z | 2026-09-01T06:51:41.817Z | ac6e57373123434bdbf385fb3136fc69429c8812d72b6c5d11cc5d73de14c9ce | 113086 | 3468 | 0 |
| 1 | https://visitluce.si/vredno-ogleda/ | https://visitluce.si/vredno-ogleda/ | 2026-09-01T07:07:27.137Z | 2026-09-01T06:51:42.023Z | 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c | 192011 | 6937 | 19 |
| 1 | https://visitluce.si/zeleni-napotki/ | https://visitluce.si/zeleni-napotki/ | 2026-09-01T07:07:27.334Z | 2026-09-01T06:51:42.220Z | e135c95b3fb03252439d64881799d760a35b4dc2dfcc05d5efae88a7146f3f80 | 105349 | 4050 | 0 |

### Visit Savinjska — Ljubno

Seed: https://visitsavinjska.com/ljubno-ob-savinji/

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 1 | https://visitsavinjska.com/ | https://visitsavinjska.com/ | 2026-09-01T07:03:38.004Z | 2026-09-01T07:03:38.007Z | 9d810c3fcaa63b6d50b935dbf4b44dc01d09efb3e8e09248d64fe8fed2438a1a | 237846 | 2170 | 0 |
| 1 | https://visitsavinjska.com/bivaj/ | https://visitsavinjska.com/bivaj/ | 2026-09-01T07:03:41.911Z | 2026-09-01T07:03:41.913Z | d54b5de5249b326afef6d8c4faa8488cfd04a149ae97ab51f8cd2886bb7e44c7 | 253980 | 1589 | 0 |
| 1 | https://visitsavinjska.com/cvetna-nedelja/ | https://visitsavinjska.com/koledar-mec/cvetna-nedelja-in-ljubenske-potice/ | 2026-09-01T07:03:45.654Z | 2026-09-01T07:03:45.656Z | 460512467142af947b2f0e0021d66b1c5d47656e75532d621c2634da70328a4a | 216599 | 4686 | 0 |
| 1 | https://visitsavinjska.com/de/ljubno-ob-savinji-3/ | https://visitsavinjska.com/de/ljubno-ob-savinji-3/ | 2026-09-01T07:03:48.422Z | 2026-09-01T07:03:48.423Z | 93abecd54571e9942d9c1436d0f8307f9e3f92053c28e8b0973359c92987a76a | 219734 | 5369 | 0 |
| 1 | https://visitsavinjska.com/dogodki | https://visitsavinjska.com/dogodki/ | 2026-09-01T07:03:52.437Z | 2026-09-01T07:03:52.439Z | b8223bb368797ef72c01653fc39ae9befd8fc00ffce8fa9afbd783fd4282c3db | 368432 | 3763 | 1 |
| 1 | https://visitsavinjska.com/dogodki/ | https://visitsavinjska.com/dogodki/ | 2026-09-01T07:03:55.132Z | 2026-09-01T07:03:55.134Z | 863376bee1ac29346d858d68240bcfe4dffceaddf2e7f21c73bfa571802bb442 | 368432 | 3763 | 1 |
| 1 | https://visitsavinjska.com/dozivi/ | https://visitsavinjska.com/dozivi/ | 2026-09-01T07:03:59.247Z | 2026-09-01T07:03:59.250Z | 5785f95e1d0a9a94a15f3e5ece44ab10da4529735cba2449f3c9a945a757f180 | 341727 | 2237 | 0 |
| 1 | https://visitsavinjska.com/eko-kamp-naturplac/ | https://visitsavinjska.com/de/eko-kamp-naturplac-2/ | 2026-09-01T07:04:05.171Z | 2026-09-01T07:04:05.173Z | 72197fcef0f938687e87239fa30887e925540d53dc983cd6d717b3ff728a7686 | 203220 | 2370 | 0 |
| 1 | https://visitsavinjska.com/en/ljubno-ob-savinji-2/ | https://visitsavinjska.com/en/ljubno-ob-savinji-2/ | 2026-09-01T07:04:08.429Z | 2026-09-01T07:04:08.432Z | 36eee4145dfbf1f046ed3737ef52b63da7ab75fce74666fd8228cf33bed1da14 | 223586 | 4559 | 1 |
| 1 | https://visitsavinjska.com/fis-podprl-izgradnjo-nove-skakalnice-na-ljubnem/ | https://visitsavinjska.com/fis-podprl-izgradnjo-nove-skakalnice-na-ljubnem/ | 2026-09-01T07:04:11.223Z | 2026-09-01T07:04:11.225Z | df7a68dcab8572e1f1644263867306a03849677b6740757c41943b5edd5f7a84 | 222143 | 2931 | 0 |
| 1 | https://visitsavinjska.com/fis-svetovni-pokal-v-smucarskih-skokih-za-zenske-ljubno/ | https://visitsavinjska.com/koledar-mec/fis-svetovni-pokal-v-smucarskih-skokih-za-zenske-ljubno/ | 2026-09-01T07:04:14.181Z | 2026-09-01T07:04:14.183Z | 4afa2b43e54a373ee7f29498d67374042832c103214e84caeb1c848959367d73 | 213859 | 3449 | 0 |
| 1 | https://visitsavinjska.com/flosarska-zbirka-ljubno/ | https://visitsavinjska.com/flosarska-zbirka-ljubno/ | 2026-09-01T07:04:17.288Z | 2026-09-01T07:04:17.289Z | a404a3347e98567677fedb0d8d12d6127214cd0901c8e5d29994f81188aad640 | 228168 | 5475 | 1 |
| 1 | https://visitsavinjska.com/flosarski-bal-ljubno/ | https://visitsavinjska.com/koledar-mec/flosarski-bal-ljubno/ | 2026-09-01T07:04:20.914Z | 2026-09-01T07:04:20.915Z | b3d0332750eda25b15504c78a7ce73188b77de4e762aa0ca85a497dfafe4985e | 213758 | 3709 | 1 |
| 1 | https://visitsavinjska.com/glamping-savinja/ | https://visitsavinjska.com/glamping-savinja/ | 2026-09-01T07:04:23.537Z | 2026-09-01T07:04:23.539Z | 318bbc6076fb2a51c564b13e8b5472d52b3661b92f672c865a7707dc71ad2a19 | 232863 | 2268 | 1 |
| 1 | https://visitsavinjska.com/gornji-grad/ | https://visitsavinjska.com/gornji-grad/ | 2026-09-01T07:04:26.173Z | 2026-09-01T07:04:26.174Z | 2a263b1c2bedaff0b2dab85da0fedc92dd5f62638e9911f32a5c8c393e4f6527 | 224967 | 3160 | 6 |
| 0 | https://visitsavinjska.com/ljubno-ob-savinji/ | https://visitsavinjska.com/ljubno-ob-savinji/ | 2026-09-01T07:03:35.031Z | 2026-09-01T07:03:35.033Z | ff3057aefda8a190ce852d9240f0c406c27967516fc2b957b969870e5382bfd3 | 229345 | 5176 | 5 |

Skipped URL evidence:

| URL | Reason |
|---|---|
| https://visitsavinjska.com/cdn-cgi/l/email-protection | network |
| https://visitsavinjska.com/hiska-ob-gozdu-lukez-plac/ | source-byte-cap |
| https://visitsavinjska.com/hotel-planinka/ | source-byte-cap |
| https://visitsavinjska.com/ijp-d-o-o/ | source-byte-cap |
| https://visitsavinjska.com/informacije-savinjska/ | source-byte-cap |
| https://visitsavinjska.com/kamnisko-savinjske-alpe/ | source-byte-cap |
| https://visitsavinjska.com/kolofon/ | source-byte-cap |
| https://visitsavinjska.com/novice-globalno/ | source-byte-cap |
| https://visitsavinjska.com/okusi/ | source-byte-cap |
| https://visitsavinjska.com/politika-zasebnosti/ | non-content-path |
| https://visitsavinjska.com/radmirska-zakladnica/ | source-byte-cap |
| https://visitsavinjska.com/rafting-kajak-in-soteskanje/ | source-byte-cap |
| https://visitsavinjska.com/razisci-kat/ | source-byte-cap |
| https://visitsavinjska.com/razisci-kat/kraji/ | source-byte-cap |
| https://visitsavinjska.com/razisci/ | source-byte-cap |
| https://visitsavinjska.com/recica-ob-savinji/ | source-byte-cap |
| https://visitsavinjska.com/reka-savinja/ | source-byte-cap |
| https://visitsavinjska.com/ribolov-v-savinjski-dolini-in-okolici/ | source-byte-cap |
| https://visitsavinjska.com/tag/ljubno/ | non-content-path |
| https://visitsavinjska.com/vista-larix-chalet/ | source-byte-cap |
| https://visitsavinjska.com/vulkan-smrekovec/ | source-byte-cap |
| https://visitsavinjska.com/za-domacine/ | source-byte-cap |
| https://visitsavinjska.com/za-ponudnike/ | source-byte-cap |
| https://visitsavinjska.com/zemljevid/ | source-byte-cap |
| https://visitsavinjska.com/zgornjesavinjske-jedi-in-dobrote/ | source-byte-cap |

### Visit Savinjska — Logarska dolina in krajinski parki

Seed: https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 1 | https://visitsavinjska.com/ | https://visitsavinjska.com/ | 2026-09-01T07:10:58.939Z | 2026-09-01T07:10:58.941Z | acb3821de1c647d2fea39b631819168e7a721e2130a8fd861eb31d4d92dd24b5 | 237846 | 2170 | 0 |
| 1 | https://visitsavinjska.com/37-pikin-festival/ | https://visitsavinjska.com/37-pikin-festival/ | 2026-09-01T07:11:02.984Z | 2026-09-01T07:11:02.986Z | 1a9eddd8f8afaac2a1ee80062c6f6e2d4a8ab99ed3260d2c6203418b17248395 | 224658 | 3462 | 4 |
| 1 | https://visitsavinjska.com/bivaj/ | https://visitsavinjska.com/bivaj/ | 2026-09-01T07:11:07.155Z | 2026-09-01T07:11:07.158Z | 3963c0d21b81838e2596186ba218838897586a826d2de1f1062732fb544c32fe | 253980 | 1589 | 0 |
| 1 | https://visitsavinjska.com/de/logarska-dolina-und-landschaftsparks/ | https://visitsavinjska.com/de/logarska-dolina-und-landschaftsparks/ | 2026-09-01T07:11:10.058Z | 2026-09-01T07:11:10.059Z | ad7795d7104e412fe4fdc13832c3fd7b1941dc019446a4c4cf7404a5c678990a | 221197 | 4389 | 4 |
| 1 | https://visitsavinjska.com/dogodki | https://visitsavinjska.com/dogodki/ | 2026-09-01T07:11:13.763Z | 2026-09-01T07:11:13.765Z | b4759ee5232f4d65db41b6d64d80ed4afa0166ce9be910d0cd9c3187fd096f79 | 368432 | 3763 | 1 |
| 1 | https://visitsavinjska.com/dogodki/ | https://visitsavinjska.com/dogodki/ | 2026-09-01T07:11:16.831Z | 2026-09-01T07:11:16.834Z | b7ed708fd86b071aca0704016dc05a857f86713b610d28746a7bddc18cd2136f | 368432 | 3763 | 1 |
| 1 | https://visitsavinjska.com/dozivi/ | https://visitsavinjska.com/dozivi/ | 2026-09-01T07:11:20.432Z | 2026-09-01T07:11:20.435Z | 297f976fbe7101ba0f7ad7fbcac957fff1391c236437af97179fc5634d2b7602 | 341727 | 2237 | 0 |
| 1 | https://visitsavinjska.com/en/logarska-valley-and-regional-parks/ | https://visitsavinjska.com/en/logarska-valley-and-regional-parks/ | 2026-09-01T07:11:23.743Z | 2026-09-01T07:11:23.747Z | 80c9f610c131ae5f48898320007eab355827f8aca57854f98072d9a715a1a72c | 224705 | 4254 | 1 |
| 1 | https://visitsavinjska.com/informacije-savinjska/ | https://visitsavinjska.com/informacije-savinjska/ | 2026-09-01T07:11:26.449Z | 2026-09-01T07:11:26.452Z | 9f4f0b373a4d3dd23e6d417b3e90672ef4c05f7c3db614b8e6ad57fe12ce98af | 208243 | 1452 | 0 |
| 1 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ | https://visitsavinjska.com/kamnisko-savinjske-alpe/ | 2026-09-01T07:11:29.289Z | 2026-09-01T07:11:29.293Z | cd99abdaa7002269e78de4ec8cabef29cd4da46eab74b7163983fd1cf0f3ee10 | 227439 | 4829 | 7 |
| 1 | https://visitsavinjska.com/klemenca-jama-in-strelovec/ | https://visitsavinjska.com/klemenca-jama-in-strelovec/ | 2026-09-01T07:11:32.301Z | 2026-09-01T07:11:32.306Z | dc65d72503f31645b3313d95128b258e5e32a033b06839c257136b09579a7ed3 | 228035 | 5215 | 2 |
| 1 | https://visitsavinjska.com/kolofon/ | https://visitsavinjska.com/kolofon/ | 2026-09-01T07:11:34.561Z | 2026-09-01T07:11:34.563Z | fc93036611556243344f6418c9377e125624da5497a2b0a4db302876e671b6db | 179759 | 3347 | 0 |
| 1 | https://visitsavinjska.com/kongresi-seminarji-in-konference/ | https://visitsavinjska.com/kongresi-seminarji-in-konference/ | 2026-09-01T07:11:37.435Z | 2026-09-01T07:11:37.437Z | 93984aad28735d93355788317e15ac317f0e8b9508f0e1efca00b797af2eb579 | 241436 | 6384 | 9 |
| 1 | https://visitsavinjska.com/krajinski-park-golte/ | https://visitsavinjska.com/krajinski-park-golte/ | 2026-09-01T07:11:40.696Z | 2026-09-01T07:11:40.698Z | d62a4f8e197a760206a7f780568414251d3e1319579aaa37b1a2d74e06ddabd6 | 241887 | 9056 | 6 |
| 1 | https://visitsavinjska.com/krajinski-park-robanov-kot/ | https://visitsavinjska.com/krajinski-park-robanov-kot/ | 2026-09-01T07:11:43.253Z | 2026-09-01T07:11:43.257Z | 35f86f0bb6d0b966c9fffc3e748e6357fdbe42ee5f8fb79c95f542f1ab8cc29f | 224455 | 3597 | 4 |
| 0 | https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ | https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ | 2026-09-01T07:10:56.223Z | 2026-09-01T07:10:56.227Z | 28417c0b68f5966be4d7f52001cecb71a817cf4ffdbc349ec57bc4b9c1e2bf81 | 232749 | 5354 | 7 |

Skipped URL evidence:

| URL | Reason |
|---|---|
| https://visitsavinjska.com/cdn-cgi/l/email-protection | network |
| https://visitsavinjska.com/kategorija/poroke/ | non-content-path |
| https://visitsavinjska.com/matkov-kot-divja-alpska-dolina/ | source-byte-cap |
| https://visitsavinjska.com/novice-globalno/ | source-byte-cap |
| https://visitsavinjska.com/okusi/ | source-byte-cap |
| https://visitsavinjska.com/pocitniska-dozivetja-savinjske/ | source-byte-cap |
| https://visitsavinjska.com/politika-zasebnosti/ | non-content-path |
| https://visitsavinjska.com/pot-po-logarski/ | source-byte-cap |
| https://visitsavinjska.com/razisci-kat/ | source-byte-cap |
| https://visitsavinjska.com/razisci-kat/znamenitosti/ | source-byte-cap |
| https://visitsavinjska.com/razisci/ | source-byte-cap |
| https://visitsavinjska.com/savinjska-in-saleska-dolina/ | source-byte-cap |
| https://visitsavinjska.com/slap-rinka/ | source-byte-cap |
| https://visitsavinjska.com/spoznajte-zgodbe-nasih-prednikov-v-ateljeju-majnik/ | source-byte-cap |
| https://visitsavinjska.com/tag/naravne-znamenitosti/ | non-content-path |
| https://visitsavinjska.com/tag/pohodnistvo/ | non-content-path |
| https://visitsavinjska.com/tag/solcava/ | non-content-path |
| https://visitsavinjska.com/tag/za-druzine/ | non-content-path |
| https://visitsavinjska.com/tag/za-pare/ | non-content-path |
| https://visitsavinjska.com/tag/za-skupine/ | non-content-path |
| https://visitsavinjska.com/tag/zelena-ponudba/ | non-content-path |
| https://visitsavinjska.com/za-domacine/ | source-byte-cap |
| https://visitsavinjska.com/za-ponudnike/ | source-byte-cap |
| https://visitsavinjska.com/zemljevid/ | source-byte-cap |

### Visit Savinjska — Mozirje

Seed: https://visitsavinjska.com/mozirje/

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 1 | https://visitsavinjska.com/ | https://visitsavinjska.com/ | 2026-09-01T07:24:46.212Z | 2026-09-01T07:24:46.214Z | 784ec6f8435799fb71b3f3cfa65fcde162d5bfb265d290104882e627f04659a9 | 237846 | 2170 | 0 |
| 1 | https://visitsavinjska.com/360-stopinjski-posnetek-muzejske-zbirke-v-mozirju/ | https://visitsavinjska.com/360-stopinjski-posnetek-muzejske-zbirke-v-mozirju/ | 2026-09-01T07:24:48.652Z | 2026-09-01T07:24:48.654Z | a90a949b9cd9ee2f324bd041e9a4acf7d204ec38cde0a2da4c7d3913fffc128e | 183483 | 3238 | 3 |
| 1 | https://visitsavinjska.com/aktivnosti-prezivetje-v-naravi-bushcraft/ | https://visitsavinjska.com/aktivnosti-prezivetje-v-naravi-bushcraft/ | 2026-09-01T07:24:51.370Z | 2026-09-01T07:24:51.372Z | b870cdf845864dbec7acaf6ed0e1ab39423f104eaead7128b25600a95cf17f0d | 227794 | 3481 | 3 |
| 1 | https://visitsavinjska.com/apartma-angelika/ | https://visitsavinjska.com/apartma-angelika/ | 2026-09-01T07:24:54.025Z | 2026-09-01T07:24:54.028Z | 0395f24864a31c83785b60ab0abd6fba62e7ec30e4212fe923489c942cd18270 | 234408 | 2081 | 0 |
| 1 | https://visitsavinjska.com/bivaj/ | https://visitsavinjska.com/bivaj/ | 2026-09-01T07:24:58.349Z | 2026-09-01T07:24:58.351Z | edd8125247317c4d2e1a5b75256e8be0710aff3aa7398a71b557e1206e24ebc4 | 253980 | 1589 | 0 |
| 1 | https://visitsavinjska.com/bozicna-bajka-slovenije/ | https://visitsavinjska.com/koledar-mec/bozicna-bajka-slovenije/ | 2026-09-01T07:25:04.015Z | 2026-09-01T07:25:04.017Z | b6d7a770ee88b83d9f5174ed6383c65f8cdef03e7fe92d8b5ebdc9f8a4d264b5 | 212838 | 3334 | 0 |
| 1 | https://visitsavinjska.com/de/mozirje-3/ | https://visitsavinjska.com/de/mozirje-3/ | 2026-09-01T07:25:08.531Z | 2026-09-01T07:25:08.532Z | d7f974f9fc0d668c200cad25fd83e5d6202e34f6396f3def3c66c218e3bf6bf1 | 217943 | 4157 | 0 |
| 1 | https://visitsavinjska.com/dogodki | https://visitsavinjska.com/dogodki/ | 2026-09-01T07:25:14.259Z | 2026-09-01T07:25:14.261Z | b3dfae00649f88339c16c5d1f962664e956eceb2cf0822b901f4d44d714e54ab | 368432 | 3763 | 1 |
| 1 | https://visitsavinjska.com/dogodki/ | https://visitsavinjska.com/dogodki/ | 2026-09-01T07:25:17.733Z | 2026-09-01T07:25:17.735Z | cbd50dde412e13a8df6bc8d41c6c87eb6e95734289d7f2829deb0cf317b317fd | 368432 | 3763 | 1 |
| 1 | https://visitsavinjska.com/dozivi/ | https://visitsavinjska.com/dozivi/ | 2026-09-01T07:25:21.977Z | 2026-09-01T07:25:21.979Z | 547231ad9ee76b205837c7cd2a807cbabd12464773b0e5f30a18027937b34269 | 341727 | 2237 | 2 |
| 1 | https://visitsavinjska.com/dozivite-cvetoce-mozirje/ | https://visitsavinjska.com/dozivite-cvetoce-mozirje/ | 2026-09-01T07:25:24.602Z | 2026-09-01T07:25:24.605Z | b8786d29a773f543aa78306d22ac3614fd1093f3dd5da4fbc0fd6c041924672c | 224114 | 3840 | 4 |
| 1 | https://visitsavinjska.com/en/mozirje-2/ | https://visitsavinjska.com/en/mozirje-2/ | 2026-09-01T07:25:27.171Z | 2026-09-01T07:25:27.172Z | 7cd226ce23fbde0706dd011eb89abd3f0c963195aa663828f852f1e4b425a301 | 218625 | 3247 | 2 |
| 1 | https://visitsavinjska.com/gozdna-terapija/ | https://visitsavinjska.com/gozdna-terapija/ | 2026-09-01T07:25:29.875Z | 2026-09-01T07:25:29.877Z | 0667f7f0fad9883b906a5c8fb6c2c6e075b40efc2be788221bf5dc8800fed7c5 | 222265 | 2841 | 3 |
| 1 | https://visitsavinjska.com/informacije-savinjska/ | https://visitsavinjska.com/informacije-savinjska/ | 2026-09-01T07:25:32.529Z | 2026-09-01T07:25:32.531Z | 3f02bfac6805ab9342d77cec8aac25f063af308b3c334a1c5ce7d1e56ba38a7f | 208243 | 1452 | 2 |
| 1 | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ | 2026-09-01T07:25:35.174Z | 2026-09-01T07:25:35.176Z | d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 | 226435 | 4720 | 19 |
| 1 | https://visitsavinjska.com/kolofon/ | https://visitsavinjska.com/kolofon/ | 2026-09-01T07:25:37.496Z | 2026-09-01T07:25:37.498Z | d0aeaf1d27b4a64de0517979bea144b4f9656502e282f94e24dadf547e1ae140 | 179759 | 3347 | 2 |
| 0 | https://visitsavinjska.com/mozirje/ | https://visitsavinjska.com/mozirje/ | 2026-09-01T07:24:43.576Z | 2026-09-01T07:24:43.578Z | 8346111718967f78ebeb6f3ff0ba1ace2a9c61cd977ec55f78c8cf6dd8ec0a24 | 226160 | 3873 | 12 |

Skipped URL evidence:

| URL | Reason |
|---|---|
| https://visitsavinjska.com/cdn-cgi/l/email-protection | network |
| https://visitsavinjska.com/krajinski-park-golte/ | source-byte-cap |
| https://visitsavinjska.com/maraton-savinja/ | source-byte-cap |
| https://visitsavinjska.com/mozirski-gaj-park-cvetja/ | source-byte-cap |
| https://visitsavinjska.com/nazarje/ | source-byte-cap |
| https://visitsavinjska.com/novice-globalno/ | source-byte-cap |
| https://visitsavinjska.com/okusi/ | source-byte-cap |
| https://visitsavinjska.com/politika-zasebnosti/ | non-content-path |
| https://visitsavinjska.com/pot-po-golteh/%20%E2%80%8E | source-byte-cap |
| https://visitsavinjska.com/pust-mozirski/ | source-byte-cap |
| https://visitsavinjska.com/razisci-kat/ | source-byte-cap |
| https://visitsavinjska.com/razisci-kat/kraji/ | source-byte-cap |
| https://visitsavinjska.com/razisci/ | source-byte-cap |
| https://visitsavinjska.com/reka-savinja/ | source-byte-cap |
| https://visitsavinjska.com/ribolov-v-savinjski-dolini-in-okolici/ | source-byte-cap |
| https://visitsavinjska.com/smartno-ob-paki/ | source-byte-cap |
| https://visitsavinjska.com/smucanje-in-deskanje/ | source-byte-cap |
| https://visitsavinjska.com/smucisce-golte/ | source-byte-cap |
| https://visitsavinjska.com/tag/mozirje/ | non-content-path |
| https://visitsavinjska.com/v-mozirju-kino/ | source-byte-cap |
| https://visitsavinjska.com/wellness-in-masaze/ | source-byte-cap |
| https://visitsavinjska.com/za-domacine/ | source-byte-cap |
| https://visitsavinjska.com/za-ponudnike/ | source-byte-cap |
| https://visitsavinjska.com/zemljevid/ | source-byte-cap |

### Visit Savinjska — Rečica ob Savinji

Seed: https://visitsavinjska.com/recica-ob-savinji/

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 1 | https://visitsavinjska.com/ | https://visitsavinjska.com/ | 2026-09-01T07:14:49.463Z | 2026-09-01T07:14:49.464Z | 4a9f8cd242d348e99b2601e4cc7c76bab4ea9bd9288068916891347af2542e88 | 237846 | 2170 | 0 |
| 1 | https://visitsavinjska.com/apartma-skala/ | https://visitsavinjska.com/apartma-skala/ | 2026-09-01T07:14:52.433Z | 2026-09-01T07:14:52.434Z | 1a72464ddbad6d569009f38421702b12d9545885f949e63ee66bbdc55c02546e | 236300 | 2988 | 4 |
| 1 | https://visitsavinjska.com/bivaj/ | https://visitsavinjska.com/bivaj/ | 2026-09-01T07:14:57.035Z | 2026-09-01T07:14:57.037Z | b05f168d1fa706dd9166d87967c3757f5a7c029d8c8c067d5a02c2c74a1361c3 | 253980 | 1589 | 0 |
| 1 | https://visitsavinjska.com/de/recica-ob-savinji-3/ | https://visitsavinjska.com/de/recica-ob-savinji-3/ | 2026-09-01T07:14:59.904Z | 2026-09-01T07:14:59.906Z | ef02da483054e0321b4fba76c389ba29b63a06061e0300213733515535698ae3 | 214966 | 2541 | 2 |
| 1 | https://visitsavinjska.com/dogodki | https://visitsavinjska.com/dogodki/ | 2026-09-01T07:15:08.534Z | 2026-09-01T07:15:08.536Z | 5453140355d7f5983bb9e0d200687e0eb0342501a12e1bf5beef563066da1db8 | 368432 | 3763 | 1 |
| 1 | https://visitsavinjska.com/dogodki/ | https://visitsavinjska.com/dogodki/ | 2026-09-01T07:15:12.478Z | 2026-09-01T07:15:12.480Z | 66956d6a220731db5ef6770370b78b4c326dbef87457800a8c1f96dddf44c7c6 | 368432 | 3763 | 1 |
| 1 | https://visitsavinjska.com/dozivi/ | https://visitsavinjska.com/dozivi/ | 2026-09-01T07:15:17.493Z | 2026-09-01T07:15:17.496Z | 203ba5c80c34d677d0c98325f9ab5ab8f42c55d69a7de051325b097e44bb4eb2 | 341727 | 2237 | 0 |
| 1 | https://visitsavinjska.com/en/recica-ob-savinji-2/ | https://visitsavinjska.com/en/recica-ob-savinji-2/ | 2026-09-01T07:15:20.744Z | 2026-09-01T07:15:20.746Z | 818b7072d82939902f63fe67e1398b9b3af4dd040fda4af26646e7f5ff7287f9 | 217004 | 2327 | 0 |
| 1 | https://visitsavinjska.com/evropski-teden-mobilnosti-v-savinjski/ | https://visitsavinjska.com/evropski-teden-mobilnosti-v-savinjski/ | 2026-09-01T07:15:23.803Z | 2026-09-01T07:15:23.805Z | 1d65838ba3922f2c5ae500c38b00673263913844aa138a7aa254240ae8c0c80e | 224880 | 4475 | 3 |
| 1 | https://visitsavinjska.com/funpark-menina/ | https://visitsavinjska.com/funpark-menina/ | 2026-09-01T07:15:26.067Z | 2026-09-01T07:15:26.068Z | 68e1a9130e85dbcdc087fadd9c66662c19e6c1727c746053aeebe23afdcf1482 | 197229 | 1876 | 1 |
| 1 | https://visitsavinjska.com/gostilna-kamp-menina/ | https://visitsavinjska.com/gostilna-kamp-menina/ | 2026-09-01T07:15:28.809Z | 2026-09-01T07:15:28.810Z | 6e724c2e1594771507b9724de825b988f663798291df161e1172ac4522f8fe2c | 238846 | 2586 | 1 |
| 1 | https://visitsavinjska.com/informacije-savinjska/ | https://visitsavinjska.com/informacije-savinjska/ | 2026-09-01T07:15:31.606Z | 2026-09-01T07:15:31.608Z | 781fa7a84d82711a8a5f4f65c60020bac158fb880add46bb89d84e087a6cd735 | 208243 | 1452 | 0 |
| 1 | https://visitsavinjska.com/kolofon/ | https://visitsavinjska.com/kolofon/ | 2026-09-01T07:15:34.109Z | 2026-09-01T07:15:34.111Z | f04f9c4b49724076ee3b680e5b2c955094c561cfe09565f0a3ebcc7cb249c031 | 179759 | 3347 | 1 |
| 1 | https://visitsavinjska.com/ljubno-ob-savinji/ | https://visitsavinjska.com/ljubno-ob-savinji/ | 2026-09-01T07:15:41.070Z | 2026-09-01T07:15:41.072Z | a02471554d97f64d16ca16260b4fc3caa7426c0ac04cd1b017731f932964aac6 | 229345 | 5176 | 8 |
| 1 | https://visitsavinjska.com/nazarje/ | https://visitsavinjska.com/nazarje/ | 2026-09-01T07:15:43.987Z | 2026-09-01T07:15:43.989Z | 178c9829d6feaf19a1bc772c6c1e5532612fdf35fe38ad546c922efdf4e3227e | 224785 | 3578 | 4 |
| 1 | https://visitsavinjska.com/novice-globalno/ | https://visitsavinjska.com/novice-globalno/ | 2026-09-01T07:15:46.517Z | 2026-09-01T07:15:46.519Z | 6cd44d0d24acf0c6ea2b3677762f3a64a604f3eb7887497d7d839e5b57ccd291 | 199201 | 1736 | 1 |
| 0 | https://visitsavinjska.com/recica-ob-savinji/ | https://visitsavinjska.com/recica-ob-savinji/ | 2026-09-01T07:14:46.553Z | 2026-09-01T07:14:46.554Z | 66931bb085ade186dc85ffc6cf5f53279a7c1e4a82b7b46076ee0f7d9d5fad36 | 224657 | 2875 | 0 |

Skipped URL evidence:

| URL | Reason |
|---|---|
| https://visitsavinjska.com/cdn-cgi/l/email-protection | network |
| https://visitsavinjska.com/lenartov-sejem-recica/ | network |
| https://visitsavinjska.com/od-lipe-do-prangerja-recica/ | network |
| https://visitsavinjska.com/okusi/ | source-byte-cap |
| https://visitsavinjska.com/politika-zasebnosti/ | non-content-path |
| https://visitsavinjska.com/pranger-sramotilni-steber/ | source-byte-cap |
| https://visitsavinjska.com/razisci-kat/ | source-byte-cap |
| https://visitsavinjska.com/razisci-kat/kraji/ | source-byte-cap |
| https://visitsavinjska.com/razisci/ | source-byte-cap |
| https://visitsavinjska.com/tag/recica-ob-savinji/ | non-content-path |
| https://visitsavinjska.com/za-domacine/ | source-byte-cap |
| https://visitsavinjska.com/za-ponudnike/ | source-byte-cap |
| https://visitsavinjska.com/zemljevid/ | source-byte-cap |

### Visit Savinjska — Solčava

Seed: https://visitsavinjska.com/solcava/

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 1 | https://visitsavinjska.com/ | https://visitsavinjska.com/ | 2026-09-01T07:08:45.728Z | 2026-09-01T07:08:45.730Z | 4323f333a2e2152ceea674365558aab8d23209c14332f3d187006f8a62e0bd07 | 237846 | 2170 | 0 |
| 1 | https://visitsavinjska.com/bivaj/ | https://visitsavinjska.com/bivaj/ | 2026-09-01T07:08:51.546Z | 2026-09-01T07:08:51.548Z | 91e34953093fbe9608176899d28f4f382510d32649665d2e8d311099d4f20a60 | 253980 | 1589 | 0 |
| 1 | https://visitsavinjska.com/de/solcava-3/ | https://visitsavinjska.com/de/solcava-3/ | 2026-09-01T07:08:54.375Z | 2026-09-01T07:08:54.377Z | 6848ecac4f1ae7c30089d5522e1968d058f74cda4310a665ab72397e21568be6 | 220097 | 5273 | 2 |
| 1 | https://visitsavinjska.com/dogodki | https://visitsavinjska.com/dogodki/ | 2026-09-01T07:08:58.556Z | 2026-09-01T07:08:58.559Z | ac92a46e8837930b2403727a1458c30cc4368ac65e35eb959558ae1019eb35c6 | 368432 | 3763 | 1 |
| 1 | https://visitsavinjska.com/dogodki/ | https://visitsavinjska.com/dogodki/ | 2026-09-01T07:09:01.678Z | 2026-09-01T07:09:01.680Z | 702d2ee2bdfe3bcec522fe27172b52f58c34b1bffe9e08fce20ffe75278c4c15 | 368432 | 3763 | 1 |
| 1 | https://visitsavinjska.com/dozivi/ | https://visitsavinjska.com/dozivi/ | 2026-09-01T07:09:06.563Z | 2026-09-01T07:09:06.566Z | d5cb22b6633053c560030ed719deb40ac8d44664d2904f20068aa54a53b54a2f | 341727 | 2237 | 0 |
| 1 | https://visitsavinjska.com/en/solcava-2/ | https://visitsavinjska.com/en/solcava-2/ | 2026-09-01T07:09:09.512Z | 2026-09-01T07:09:09.513Z | 20ce060eb6e07f8f713b0e6a221317058ef57c4c45bd5f6fd94d138e95921155 | 225497 | 5080 | 2 |
| 1 | https://visitsavinjska.com/green-destinations-logarska-solcavsko/ | https://visitsavinjska.com/green-destinations-logarska-solcavsko/ | 2026-09-01T07:09:15.411Z | 2026-09-01T07:09:15.413Z | 6eb3a03f65675b42b1d25cfe187dce17ded91b4d0ed47fb8c797ec6ae450e63c | 223432 | 3624 | 2 |
| 1 | https://visitsavinjska.com/informacije-savinjska/ | https://visitsavinjska.com/informacije-savinjska/ | 2026-09-01T07:09:18.441Z | 2026-09-01T07:09:18.443Z | 01d77786900cf681b682c3929146afcdfe7d90df007be0e227c7075e8e0ec42b | 208243 | 1452 | 8 |
| 1 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ | https://visitsavinjska.com/kamnisko-savinjske-alpe/ | 2026-09-01T07:09:21.206Z | 2026-09-01T07:09:21.208Z | bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088 | 227439 | 4829 | 15 |
| 1 | https://visitsavinjska.com/kolofon/ | https://visitsavinjska.com/kolofon/ | 2026-09-01T07:09:23.577Z | 2026-09-01T07:09:23.579Z | c763d30e970615a298b8a7d0592891f8f277e578cd919502b7ed8612d16780b2 | 179759 | 3347 | 0 |
| 1 | https://visitsavinjska.com/krajinski-park-robanov-kot/ | https://visitsavinjska.com/krajinski-park-robanov-kot/ | 2026-09-01T07:09:26.407Z | 2026-09-01T07:09:26.408Z | 040842d7f9e76af10328bffe1ed4690482b8c862c814d85feea795cbae367e53 | 224455 | 3597 | 3 |
| 1 | https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ | https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ | 2026-09-01T07:09:29.338Z | 2026-09-01T07:09:29.340Z | 5ffb825fe50f99b7c25d8309d073529fac3d78a5703933c180bddd43d0db78bb | 232749 | 5354 | 4 |
| 1 | https://visitsavinjska.com/lokostrelstvo/ | https://visitsavinjska.com/lokostrelstvo/ | 2026-09-01T07:09:32.283Z | 2026-09-01T07:09:32.285Z | aaad8d4e96c86f3213b850b260fd4eaacd3b74bdf436c1613acb99c942b0382d | 221931 | 2414 | 1 |
| 1 | https://visitsavinjska.com/luce/ | https://visitsavinjska.com/luce/ | 2026-09-01T07:09:35.365Z | 2026-09-01T07:09:35.367Z | 6ecc92268fa3230f16f19757c35d6f4f04be2a4f38364555026e2b154deb0dbb | 229284 | 5169 | 4 |
| 0 | https://visitsavinjska.com/solcava/ | https://visitsavinjska.com/solcava/ | 2026-09-01T07:08:42.880Z | 2026-09-01T07:08:42.882Z | cba869c8dec0b28db145d85ff51c1b37c039a782f7f1cfda642a73a06d3ef683 | 229372 | 5164 | 2 |

Skipped URL evidence:

| URL | Reason |
|---|---|
| https://visitsavinjska.com/cdn-cgi/l/email-protection | network |
| https://visitsavinjska.com/festival-bicka/ | network |
| https://visitsavinjska.com/motorkarska-gavda/ | source-byte-cap |
| https://visitsavinjska.com/novice-globalno/ | source-byte-cap |
| https://visitsavinjska.com/okusi/ | source-byte-cap |
| https://visitsavinjska.com/pastirske-poti-novo-dozivetje-v-hotelu-plesnik/ | source-byte-cap |
| https://visitsavinjska.com/politika-zasebnosti/ | non-content-path |
| https://visitsavinjska.com/potocka-zijavka/ | source-byte-cap |
| https://visitsavinjska.com/pravljicne-poti-in-ljudske-zgodbe/ | source-byte-cap |
| https://visitsavinjska.com/razisci-kat/ | source-byte-cap |
| https://visitsavinjska.com/razisci-kat/kraji/ | source-byte-cap |
| https://visitsavinjska.com/razisci/ | source-byte-cap |
| https://visitsavinjska.com/sankanje-otroske-radosti-v-pravljicnem-ambientu/ | source-byte-cap |
| https://visitsavinjska.com/slap-rinka/ | source-byte-cap |
| https://visitsavinjska.com/solcavska-panoramska-cesta/ | source-byte-cap |
| https://visitsavinjska.com/solcavska-tisa/ | source-byte-cap |
| https://visitsavinjska.com/solcavski-dnevi/ | source-byte-cap |
| https://visitsavinjska.com/spoznajte-zgodbe-nasih-prednikov-v-ateljeju-majnik/ | source-byte-cap |
| https://visitsavinjska.com/tag/solcava/ | non-content-path |
| https://visitsavinjska.com/tek-na-smuceh-v-idilicni-naravi/ | source-byte-cap |
| https://visitsavinjska.com/tic-solcava-center-rinka/ | source-byte-cap |
| https://visitsavinjska.com/za-domacine/ | source-byte-cap |
| https://visitsavinjska.com/za-ponudnike/ | source-byte-cap |
| https://visitsavinjska.com/zemljevid/ | source-byte-cap |
| https://visitsavinjska.com/zgornjesavinjski-zelodec/ | source-byte-cap |

### Visit Savinjska — Zgornja Savinjska dolina

Seed: https://visitsavinjska.com/savinjska-in-saleska-dolina/

| Depth | Requested URL | Final URL | Observed | Snapshot retrieved | SHA-256 | Raw | Text | Facts |
|---:|---|---|---|---|---|---:|---:|---:|
| 1 | https://visitsavinjska.com/ | https://visitsavinjska.com/ | 2026-09-01T07:05:30.874Z | 2026-09-01T07:05:30.877Z | 561de4a6365e8bed5069a3459d50b26bec3ec9c223602bb46807aa8d95ef4273 | 237846 | 2170 | 0 |
| 1 | https://visitsavinjska.com/bivaj/ | https://visitsavinjska.com/bivaj/ | 2026-09-01T07:05:34.814Z | 2026-09-01T07:05:34.817Z | c839cc64011496eead4dff198be078cae8eb752a39a219cb5e2153fa3cd9226c | 253980 | 1589 | 0 |
| 1 | https://visitsavinjska.com/de/das-obere-savinja-tal-zgornja-savinjska-dolina/ | https://visitsavinjska.com/de/das-obere-savinja-tal-zgornja-savinjska-dolina/ | 2026-09-01T07:05:37.704Z | 2026-09-01T07:05:37.706Z | a1fc275386931a8345f6d4b4e15556bce4511910abd0dcc8f23f7a5eb277a230 | 227645 | 4568 | 2 |
| 1 | https://visitsavinjska.com/dogodki | https://visitsavinjska.com/dogodki/ | 2026-09-01T07:05:41.675Z | 2026-09-01T07:05:41.677Z | c728fd483dd6bd0b2ee562694b49d3f548d7072ff0f643f3dd60ef8904a5a1fd | 368432 | 3763 | 1 |
| 1 | https://visitsavinjska.com/dogodki/ | https://visitsavinjska.com/dogodki/ | 2026-09-01T07:05:44.452Z | 2026-09-01T07:05:44.455Z | 74e747806fd546b8791af9484daff3d5e67792ef157b39c00423b5d96a09eb63 | 368432 | 3763 | 1 |
| 1 | https://visitsavinjska.com/dozivi/ | https://visitsavinjska.com/dozivi/ | 2026-09-01T07:05:48.512Z | 2026-09-01T07:05:48.515Z | ed1236349c39d712557c1962f4fb9592f2523846097698f7d5646490de019fdf | 341727 | 2237 | 0 |
| 1 | https://visitsavinjska.com/druzinske-pocitnice-na-kmetiji/ | https://visitsavinjska.com/druzinske-pocitnice-na-kmetiji/ | 2026-09-01T07:05:51.265Z | 2026-09-01T07:05:51.267Z | 8ca0007b91527dc648f54ec401b573e9e6935a5119e86b14a14ce5ffb29156d0 | 224847 | 3118 | 0 |
| 1 | https://visitsavinjska.com/en/golte-ski-resort-and-regional-park/ | https://visitsavinjska.com/en/golte-ski-resort-and-regional-park/ | 2026-09-01T07:05:53.869Z | 2026-09-01T07:05:53.870Z | 0faf416177d140213dbed19528dca2c43a375551964618832dfb59f22258fc2a | 224195 | 3449 | 1 |
| 1 | https://visitsavinjska.com/en/upper-savinja-valley/ | https://visitsavinjska.com/en/upper-savinja-valley/ | 2026-09-01T07:05:56.653Z | 2026-09-01T07:05:56.655Z | 225f559637145d035c01c10e0f532b6f2a2f3f628a3c8a7b2fe06e1474e89ce8 | 223223 | 3774 | 2 |
| 1 | https://visitsavinjska.com/franciskanski-samostan/ | https://visitsavinjska.com/franciskanski-samostan/ | 2026-09-01T07:05:59.287Z | 2026-09-01T07:05:59.290Z | 17e0409726bb7f1b070052530876939f1fcd9a9365ab5201d1f5c774dbdc6ace | 223820 | 2807 | 6 |
| 1 | https://visitsavinjska.com/gornjegrajska-katedrala/ | https://visitsavinjska.com/gornjegrajska-katedrala/ | 2026-09-01T07:06:02.755Z | 2026-09-01T07:06:02.757Z | 7e64a6dc9ce2087e501b8c8cfae8ad1e9d15e02464bdc265462d60697dc4d8a4 | 223056 | 2808 | 6 |
| 1 | https://visitsavinjska.com/informacije-savinjska/ | https://visitsavinjska.com/informacije-savinjska/ | 2026-09-01T07:06:05.467Z | 2026-09-01T07:06:05.468Z | f3189deaba1116289e00a8b6a011181ee52ff56a7dbfff0f497c134b414c1fc1 | 208243 | 1452 | 0 |
| 1 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ | https://visitsavinjska.com/kamnisko-savinjske-alpe/ | 2026-09-01T07:06:08.594Z | 2026-09-01T07:06:08.596Z | e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e | 227439 | 4829 | 20 |
| 1 | https://visitsavinjska.com/kolesarjenje/ | https://visitsavinjska.com/kolesarjenje/ | 2026-09-01T07:06:11.887Z | 2026-09-01T07:06:11.889Z | dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade | 241677 | 8384 | 20 |
| 1 | https://visitsavinjska.com/kolofon/ | https://visitsavinjska.com/kolofon/ | 2026-09-01T07:06:14.356Z | 2026-09-01T07:06:14.358Z | d3fc1fc450bba88b3c744892333c669bb6f0f149b1c24ecb49a8fdcda9ab0ead | 179759 | 3347 | 0 |
| 0 | https://visitsavinjska.com/savinjska-in-saleska-dolina/ | https://visitsavinjska.com/savinjska-in-saleska-dolina/ | 2026-09-01T07:05:28.144Z | 2026-09-01T07:05:28.147Z | 35456bd3e4390a5142628750fb7ceb33299a5574408995429796153d4a71e880 | 201593 | 3381 | 3 |

Skipped URL evidence:

| URL | Reason |
|---|---|
| https://visitsavinjska.com/cdn-cgi/l/email-protection | network |
| https://visitsavinjska.com/krajinski-park-golte/ | source-byte-cap |
| https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ | source-byte-cap |
| https://visitsavinjska.com/matkov-kot-divja-alpska-dolina/ | source-byte-cap |
| https://visitsavinjska.com/menina-planina/ | source-byte-cap |
| https://visitsavinjska.com/mozirski-gaj-park-cvetja/ | source-byte-cap |
| https://visitsavinjska.com/novice-globalno/ | source-byte-cap |
| https://visitsavinjska.com/okusi/ | source-byte-cap |
| https://visitsavinjska.com/politika-zasebnosti/ | non-content-path |
| https://visitsavinjska.com/potocka-zijavka/ | source-byte-cap |
| https://visitsavinjska.com/rafting-kajak-in-soteskanje/ | source-byte-cap |
| https://visitsavinjska.com/razisci/ | source-byte-cap |
| https://visitsavinjska.com/ribolov-v-savinjski-dolini-in-okolici/ | source-byte-cap |
| https://visitsavinjska.com/savinjska-dolina-z-okolico/ | source-byte-cap |
| https://visitsavinjska.com/slap-rinka/ | source-byte-cap |
| https://visitsavinjska.com/smucanje-in-deskanje/ | source-byte-cap |
| https://visitsavinjska.com/snezna-jama/ | source-byte-cap |
| https://visitsavinjska.com/solcavska-panoramska-cesta/ | source-byte-cap |
| https://visitsavinjska.com/tek-na-smuceh-v-idilicni-naravi/ | source-byte-cap |
| https://visitsavinjska.com/za-domacine/ | source-byte-cap |
| https://visitsavinjska.com/za-ponudnike/ | source-byte-cap |
| https://visitsavinjska.com/zemljevid/ | source-byte-cap |
| https://visitsavinjska.com/zgornjesavinjski-zelodec/ | source-byte-cap |

## Resolved candidates

| Name | Settlement | Category | Range | Road distance (m) | Travel time (s) | Provenance |
|---|---|---|---|---:|---:|---|
| Alpski vrt | Mozirje | sights | excursion | 29874.3 | 2974 | https://visitsavinjska.com/mozirje/ @ 8346111718967f78ebeb6f3ff0ba1ace2a9c61cd977ec55f78c8cf6dd8ec0a24 |
| Andrejev dom na Slemenu |  | hike | excursion | 43667.4 | 3677 | https://www.hribi.net/izlet/andrejev_dom_na_slemenu_smrekovec/3/485/3570 @ ed4de0ee28924df4d3b70247ab526afc086fb76b05d1c2944e379c03aeaee816 |
| Anski vrh |  | hike | excursion | 49110.5 | 3591 | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Atelsko sedlo |  | sights | excursion | 14330.6 | 2362 | https://www.hribi.net/izlet/atelsko_sedlo_smrekovec/3/485/9797 @ f080e8288899392c1f146da0fa67cc0d4a3374a9de77ed04a1830606e13cd294; https://www.hribi.net/izlet/ljubenske_rastke_kumprej_smrekovec/3/485/6151 @ 2e6738a3e9575af801314ffd1a4209504fe131b7ff89ac4a36ce09cc5009592d |
| Bezovec |  | hike | excursion | 14101.1 | 2956 | https://www.hribi.net/izhodisce/ljubenske_rastke/46.38510/14.84640 @ 59aa1ad58e7728fdecf52e5486a4469e7d47c0615c5c2c0072dea5d3e47206a1 |
| Brana |  | sights | excursion | 34192.2 | 3103 | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Center Rinka | Solčava | sights | excursion | 22639.4 | 2156 | https://visitsavinjska.com/en/solcava-2/ @ 20ce060eb6e07f8f713b0e6a221317058ef57c4c45bd5f6fd94d138e95921155; https://visitsavinjska.com/kongresi-seminarji-in-konference/ @ 93984aad28735d93355788317e15ac317f0e8b9508f0e1efca00b797af2eb579 |
| Cerkev sv. Antona Puščavnika |  | sights | excursion | 77512.7 | 5128 | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| Cerkev sv. Lovrenca |  | sights | excursion | 68610.8 | 4669 | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| Dom na Menini planini |  | hike | excursion | 29060 | 3540 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088 |
| Dom na Smrekovcu |  | hike | excursion | 15745.8 | 2868 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088; https://www.hribi.net/izhodisce/ljubenske_rastke/46.38510/14.84640 @ 59aa1ad58e7728fdecf52e5486a4469e7d47c0615c5c2c0072dea5d3e47206a1; https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315 @ 1f31857df7d186737626c93bd62be45ee9b23da603f45942edf0d448bf0eb02e; https://www.hribi.net/izhodisce/primoz_pri_ljubnem/46.36850/14.81740 @ 87cf3d1bcc7c8f401c8095c8fb2fd1110975ecc7d5d60baf7c7e287fafb6d33d; https://www.hribi.net/izhodisce/raduha_struge/46.36572/14.77337 @ 9b76a04e265c452e1ac978542516437459f9cd3e49e8d9ea9107067751540337; https://www.hribi.net/spletna_kamera/crna_na_koroskem_center/5228 @ eb8d09b4dd0df0f9ecab3464691a5154269dcbdbbb5ce2a22095a2c874353c75; https://www.hribi.net/spletna_kamera/crna_na_koroskem_smucisce_crna/5229 @ 8ae80b68b59910e886094f5fa56447fdf2e8b6a77845cdcb7ad059e126a98419; https://www.hribi.net/spletna_kamera/crna_na_koroskem/1461 @ e2f03bc5f6d3169564b6ba495330b87e4412a136607e66337013911a23743c3c; https://www.hribi.net/gora/dom_na_smrekovcu/3/484 @ a0ec548937575c905a59c9645dfefb1844dc8c32f3f5a70a960f4aaea03695d7; https://www.hribi.net/izlet/andrejev_dom_na_slemenu_smrekovec/3/485/3570 @ ed4de0ee28924df4d3b70247ab526afc086fb76b05d1c2944e379c03aeaee816; https://www.hribi.net/izlet/atelsko_sedlo_smrekovec/3/485/9797 @ f080e8288899392c1f146da0fa67cc0d4a3374a9de77ed04a1830606e13cd294; https://www.hribi.net/izlet/bele_vode_rebrsak_smrekovec/3/485/1466 @ 0d429c4ce2cb265a2962e5baed42de7976e4f90fe397d22e73f5a979f7a2d400; https://www.hribi.net/izlet/golte_alpski_vrt_smrekovec/3/485/9783 @ 357a1952a507fe1a06a0834919ab7fd070ac5ef3b17e0407926d9b98028782a5; https://www.hribi.net/izlet/izvir_ljubije_smrekovec_po_cesti/3/485/5888 @ af1b212a2a1d89a6f24091ba671cb2bd3d3846ed3d25acf8aeab4e95301abe15; https://www.hribi.net/izlet/izvir_ljubije_smrekovec_preko_leskovskove_pustote/3/485/5886 @ c3b570320992c16a916089b7551cf35f97a5112dd63c15b08c85876b22d21d12; https://www.hribi.net/izlet/javorje_mala_crna_smrekovec_cez_bukov_stan/3/485/10364 @ cd52016affb511f1ea1c1ac14538ce09930f390a581a57d52c85386676508392; https://www.hribi.net/izlet/javorje_mala_crna_smrekovec_po_cesti/3/485/10365 @ 103841b1628c62794d1a38db2601b3b7756c2339439a265207364021b558dccf; https://www.hribi.net/izlet/kramarica_smrekovec_cez_bukov_stan/3/485/3572 @ 727a58ba781a647b14026fea42e7e927498a0a6141669996542c5d1e71dbd7ea; https://www.hribi.net/izlet/kramarica_smrekovec_po_cesti/3/485/3574 @ 6ca1d18219d061d25c2faff6f347b502590b5de5d9350bb8487e7da2f5b5abe5; https://www.hribi.net/izlet/ljubenske_rastke_kumprej_smrekovec/3/485/6151 @ 2e6738a3e9575af801314ffd1a4209504fe131b7ff89ac4a36ce09cc5009592d; https://www.hribi.net/izlet/ljubenske_rastke_vrnivsek_smrekovec/3/485/6150 @ 81370fabc04c4545b9dc3f8a0487e6a0d19ecf8a89f2e94125289f2cf4c1d170; https://www.hribi.net/panorama/360/smrekovec/485 @ fb788ad597f48120c4e67282102ea2b28aa5701f46cafa06d85ab1878f5b110c; https://www.hribi.net/spletna_kamera/crna_na_koroskem_center/5228 @ eb8d09b4dd0df0f9ecab3464691a5154269dcbdbbb5ce2a22095a2c874353c75; https://www.hribi.net/spletna_kamera/crna_na_koroskem_smucisce_crna/5229 @ 8ae80b68b59910e886094f5fa56447fdf2e8b6a77845cdcb7ad059e126a98419; https://www.hribi.net/spletna_kamera/crna_na_koroskem/1461 @ e2f03bc5f6d3169564b6ba495330b87e4412a136607e66337013911a23743c3c; https://www.hribi.net/spletna_kamera/dom_na_smrekovcu/5279 @ e8addc4f64ec2a82826c1eafd667976c72cb3554ef63361c906bab488f3ee133; https://www.hribi.net/vreme_gora/smrekovec/3/485 @ ad7db7e4797b43f023b2d6f3a440aaf0cb0d3290ba33db66df38c6bbd4aa7c8b |
| Dom planincev na Farbanci |  | hike | excursion | 16736 | 2700 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088 |
| Dom planincev v Logarski dolini |  | hike | excursion | 31391.8 | 2842 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088 |
| Domžalski dom na Mali planini |  | hike | excursion | 30277.4 | 3567 | https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315 @ 1f31857df7d186737626c93bd62be45ee9b23da603f45942edf0d448bf0eb02e; https://www.hribi.net/izhodisce/raduha_struge/46.36572/14.77337 @ 9b76a04e265c452e1ac978542516437459f9cd3e49e8d9ea9107067751540337; https://www.hribi.net/spletna_kamera/domzalski_dom_na_mali_planini/3354 @ 8198e9f1518d8a8aa921b1804ccea08ad7113930e810ccc4b938b4e94dea286d |
| Eko hiša Na razpotju |  | food | excursion | 30373.8 | 2761 | https://visitsavinjska.com/klemenca-jama-in-strelovec/ @ dc65d72503f31645b3313d95128b258e5e32a033b06839c257136b09579a7ed3 |
| Frischaufov dom na Okrešlju |  | hike | excursion | 34163.6 | 3096 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088 |
| Glamping Savinja | Rečica ob Savinji | food | near | 3523.7 | 749 | https://visitsavinjska.com/glamping-savinja/ @ 318bbc6076fb2a51c564b13e8b5472d52b3661b92f672c865a7707dc71ad2a19; https://visitsavinjska.com/ljubno-ob-savinji/ @ a02471554d97f64d16ca16260b4fc3caa7426c0ac04cd1b017731f932964aac6 |
| Golte |  | act | excursion | 30114.8 | 3011 | https://visitsavinjska.com/en/golte-ski-resort-and-regional-park/ @ 0faf416177d140213dbed19528dca2c43a375551964618832dfb59f22258fc2a; https://visitsavinjska.com/en/logarska-valley-and-regional-parks/ @ 80c9f610c131ae5f48898320007eab355827f8aca57854f98072d9a715a1a72c; https://visitsavinjska.com/apartma-skala/ @ 1a72464ddbad6d569009f38421702b12d9545885f949e63ee66bbdc55c02546e; https://www.hribi.net/gora/sveti_primoz_nad_ljubnim/3/617 @ 8606250693379e9722229c65633d93696b4f344d4ee966f419914be6500bf32f; https://www.hribi.net/spletna_kamera/golte/34 @ b684298cddd141cf304cc2de0dda5a3f9e9ffa2f7bb2e58c96a2a380d386b588; https://www.hribi.net/spletna_kamera/golte/34 @ b684298cddd141cf304cc2de0dda5a3f9e9ffa2f7bb2e58c96a2a380d386b588; https://www.hribi.net/vreme_gora/smrekovec/3/485 @ ad7db7e4797b43f023b2d6f3a440aaf0cb0d3290ba33db66df38c6bbd4aa7c8b |
| Govca (Olševa) |  | hike | excursion | 31390.4 | 4231 | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Gozdarska koča Kašna planina |  | hike | excursion | 29820.6 | 3582 | https://visitluce.si/nastanitve/ @ 33d63e594b4b56c2cc231fc12c34790b816a10e117b668fe84d0dfa944b49931 |
| Hotel Paka | Velenje | food | excursion | 29886.9 | 2600 | https://visitsavinjska.com/kongresi-seminarji-in-konference/ @ 93984aad28735d93355788317e15ac317f0e8b9508f0e1efca00b797af2eb579 |
| Igla |  | sights | excursion | 16738.6 | 1750 | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| izvir Kisle vode |  | sights | excursion | 35491.9 | 3634 | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Kamniško sedlo |  | trips | excursion | 34206.8 | 3106 | https://www.hribi.net/spletna_kamera/domzalski_dom_na_mali_planini/3354 @ 8198e9f1518d8a8aa921b1804ccea08ad7113930e810ccc4b938b4e94dea286d; https://www.hribi.net/spletna_kamera/prelaz_crnivec/3633 @ c96b34f4178a6a03b992cf8575fb39761b686713f85635431a4f96cb29202830; https://www.hribi.net/spletna_kamera/solcava/5080 @ b835a19023be1047801526556461c8d384b4f2715a184b9a7433359cb5cb995e; https://www.hribi.net/spletne_kamere_v_gorah @ 2ea18064662f9ec750ce8137ac50950cb3757711b39ddd0025c7deb5410cc253 |
| Kamniško-Savinjske Alpe |  | hike | excursion | 33393.9 | 3015 | https://visitsavinjska.com/de/das-obere-savinja-tal-zgornja-savinjska-dolina/ @ a1fc275386931a8345f6d4b4e15556bce4511910abd0dcc8f23f7a5eb277a230; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade; https://visitsavinjska.com/savinjska-in-saleska-dolina/ @ 35456bd3e4390a5142628750fb7ceb33299a5574408995429796153d4a71e880; https://visitsavinjska.com/de/solcava-3/ @ 6848ecac4f1ae7c30089d5522e1968d058f74cda4310a665ab72397e21568be6; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088; https://visitsavinjska.com/de/logarska-dolina-und-landschaftsparks/ @ ad7795d7104e412fe4fdc13832c3fd7b1941dc019446a4c4cf7404a5c678990a; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ cd99abdaa7002269e78de4ec8cabef29cd4da46eab74b7163983fd1cf0f3ee10 |
| Kmečka hiša Ojstrica |  | food | excursion | 29926.8 | 2821 | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Koča na Klemenči jami pod Ojstrico |  | hike | excursion | 31917.8 | 3193 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088 |
| Koča na Loki pod Raduho |  | hike | excursion | 25610.7 | 3558 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitluce.si/nastanitve/ @ 33d63e594b4b56c2cc231fc12c34790b816a10e117b668fe84d0dfa944b49931; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088 |
| Koča na Travniku |  | hike | excursion | 24649 | 5306 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088; https://www.hribi.net/izlet/ljubno_ob_savinji_koca_na_travniku/3/489/3391 @ 9fb3bccb184726f2f001f305401c2181397b9a39f6fef0dbfa110ea2fd9c0079 |
| Kokrsko sedlo |  | trips | excursion | 43209.1 | 4251 | https://www.hribi.net/spletna_kamera/domzalski_dom_na_mali_planini/3354 @ 8198e9f1518d8a8aa921b1804ccea08ad7113930e810ccc4b938b4e94dea286d; https://www.hribi.net/spletna_kamera/solcava/5080 @ b835a19023be1047801526556461c8d384b4f2715a184b9a7433359cb5cb995e; https://www.hribi.net/spletne_kamere_v_gorah @ 2ea18064662f9ec750ce8137ac50950cb3757711b39ddd0025c7deb5410cc253 |
| Komen |  | sights | excursion | 13287.5 | 2220 | https://www.hribi.net/izlet/andrejev_dom_na_slemenu_smrekovec/3/485/3570 @ ed4de0ee28924df4d3b70247ab526afc086fb76b05d1c2944e379c03aeaee816; https://www.hribi.net/izlet/bele_vode_rebrsak_smrekovec/3/485/1466 @ 0d429c4ce2cb265a2962e5baed42de7976e4f90fe397d22e73f5a979f7a2d400; https://www.hribi.net/izlet/izvir_ljubije_smrekovec_po_cesti/3/485/5888 @ af1b212a2a1d89a6f24091ba671cb2bd3d3846ed3d25acf8aeab4e95301abe15; https://www.hribi.net/izlet/izvir_ljubije_smrekovec_preko_leskovskove_pustote/3/485/5886 @ c3b570320992c16a916089b7551cf35f97a5112dd63c15b08c85876b22d21d12; https://www.hribi.net/izlet/kramarica_smrekovec_cez_bukov_stan/3/485/3572 @ 727a58ba781a647b14026fea42e7e927498a0a6141669996542c5d1e71dbd7ea; https://www.hribi.net/izlet/kramarica_smrekovec_po_cesti/3/485/3574 @ 6ca1d18219d061d25c2faff6f347b502590b5de5d9350bb8487e7da2f5b5abe5; https://www.hribi.net/izlet/ljubenske_rastke_kumprej_smrekovec/3/485/6151 @ 2e6738a3e9575af801314ffd1a4209504fe131b7ff89ac4a36ce09cc5009592d; https://www.hribi.net/izlet/ljubenske_rastke_vrnivsek_smrekovec/3/485/6150 @ 81370fabc04c4545b9dc3f8a0487e6a0d19ecf8a89f2e94125289f2cf4c1d170 |
| Krajinski park Robanov kot | Solčava | sights | excursion | 20083.4 | 2019 | https://visitsavinjska.com/krajinski-park-robanov-kot/ @ 040842d7f9e76af10328bffe1ed4690482b8c862c814d85feea795cbae367e53; https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ @ 5ffb825fe50f99b7c25d8309d073529fac3d78a5703933c180bddd43d0db78bb; https://visitsavinjska.com/krajinski-park-robanov-kot/ @ 35f86f0bb6d0b966c9fffc3e748e6357fdbe42ee5f8fb79c95f542f1ab8cc29f; https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ @ 28417c0b68f5966be4d7f52001cecb71a817cf4ffdbc349ec57bc4b9c1e2bf81 |
| Krnes |  | sights | excursion | 18418.2 | 4827 | https://www.hribi.net/izlet/dom_na_smrekovcu_smrekovec/3/485/818 @ 7fb9357da7de3cd70fc3e277c652d60c380edcb7065bd77b5a076a27c5d0e6e1 |
| Ledinski vrh |  | hike | excursion | 44238.8 | 4720 | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Ljubična gora |  | hike | excursion | 77727.1 | 4967 | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Logarjeva lipa |  | sights | excursion | 27340.7 | 2471 | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Logarska dolina |  | sights | excursion | 30979.5 | 2988 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ @ 5ffb825fe50f99b7c25d8309d073529fac3d78a5703933c180bddd43d0db78bb; https://visitsavinjska.com/de/logarska-dolina-und-landschaftsparks/ @ ad7795d7104e412fe4fdc13832c3fd7b1941dc019446a4c4cf7404a5c678990a; https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ @ 28417c0b68f5966be4d7f52001cecb71a817cf4ffdbc349ec57bc4b9c1e2bf81; https://www.solcava.si/objava/106391 @ a16fcdbd56865ec33764a583d34c50bd1901c75df3abb16f9d076cbcb13a5494; https://www.solcava.si/objava/1107049 @ 0c96b71368f65bc84e4dabe45c496479c3f811cb3a8b99a335b050b9affb5b93; https://visitsavinjska.com/dozivi/ @ 547231ad9ee76b205837c7cd2a807cbabd12464773b0e5f30a18027937b34269; https://visitsavinjska.com/dozivite-cvetoce-mozirje/ @ b8786d29a773f543aa78306d22ac3614fd1093f3dd5da4fbc0fd6c041924672c; https://visitsavinjska.com/en/mozirje-2/ @ 7cd226ce23fbde0706dd011eb89abd3f0c963195aa663828f852f1e4b425a301; https://visitsavinjska.com/gozdna-terapija/ @ 0667f7f0fad9883b906a5c8fb6c2c6e075b40efc2be788221bf5dc8800fed7c5; https://visitsavinjska.com/informacije-savinjska/ @ 3f02bfac6805ab9342d77cec8aac25f063af308b3c334a1c5ce7d1e56ba38a7f; https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385; https://visitsavinjska.com/kolofon/ @ d0aeaf1d27b4a64de0517979bea144b4f9656502e282f94e24dadf547e1ae140; https://visitsavinjska.com/mozirje/ @ 8346111718967f78ebeb6f3ff0ba1ace2a9c61cd977ec55f78c8cf6dd8ec0a24 |
| LONČARSKA POT |  | act | excursion | 12538.2 | 1507 | https://visitsavinjska.com/franciskanski-samostan/ @ 17e0409726bb7f1b070052530876939f1fcd9a9365ab5201d1f5c774dbdc6ace |
| Malič |  | hike | excursion | 53094.6 | 5097 | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Matkov kot | Solčava | sights | excursion | 30405.4 | 2836 | https://visitsavinjska.com/de/logarska-dolina-und-landschaftsparks/ @ ad7795d7104e412fe4fdc13832c3fd7b1941dc019446a4c4cf7404a5c678990a; https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ @ 28417c0b68f5966be4d7f52001cecb71a817cf4ffdbc349ec57bc4b9c1e2bf81 |
| Mozirska koča na Golteh |  | hike | excursion | 30190 | 3049 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ cd99abdaa7002269e78de4ec8cabef29cd4da46eab74b7163983fd1cf0f3ee10; https://www.hribi.net/izhodisce/ljubenske_rastke/46.38510/14.84640 @ 59aa1ad58e7728fdecf52e5486a4469e7d47c0615c5c2c0072dea5d3e47206a1; https://www.hribi.net/izlet/golte_alpski_vrt_smrekovec/3/485/9783 @ 357a1952a507fe1a06a0834919ab7fd070ac5ef3b17e0407926d9b98028782a5 |
| Mozirski gaj | Mozirje | sights | excursion | 15083.2 | 1531 | https://visitsavinjska.com/dogodki @ b8223bb368797ef72c01653fc39ae9befd8fc00ffce8fa9afbd783fd4282c3db; https://visitsavinjska.com/dogodki/ @ 863376bee1ac29346d858d68240bcfe4dffceaddf2e7f21c73bfa571802bb442; https://visitsavinjska.com/dogodki @ c728fd483dd6bd0b2ee562694b49d3f548d7072ff0f643f3dd60ef8904a5a1fd; https://visitsavinjska.com/dogodki/ @ 74e747806fd546b8791af9484daff3d5e67792ef157b39c00423b5d96a09eb63; https://visitsavinjska.com/dogodki @ ac92a46e8837930b2403727a1458c30cc4368ac65e35eb959558ae1019eb35c6; https://visitsavinjska.com/dogodki/ @ 702d2ee2bdfe3bcec522fe27172b52f58c34b1bffe9e08fce20ffe75278c4c15; https://visitsavinjska.com/dogodki @ b4759ee5232f4d65db41b6d64d80ed4afa0166ce9be910d0cd9c3187fd096f79; https://visitsavinjska.com/dogodki/ @ b7ed708fd86b071aca0704016dc05a857f86713b610d28746a7bddc18cd2136f; https://visitsavinjska.com/dogodki @ 5453140355d7f5983bb9e0d200687e0eb0342501a12e1bf5beef563066da1db8; https://visitsavinjska.com/dogodki/ @ 66956d6a220731db5ef6770370b78b4c326dbef87457800a8c1f96dddf44c7c6; https://visitsavinjska.com/dogodki @ b3dfae00649f88339c16c5d1f962664e956eceb2cf0822b901f4d44d714e54ab; https://visitsavinjska.com/dogodki/ @ cbd50dde412e13a8df6bc8d41c6c87eb6e95734289d7f2829deb0cf317b317fd; https://visitsavinjska.com/mozirje/ @ 8346111718967f78ebeb6f3ff0ba1ace2a9c61cd977ec55f78c8cf6dd8ec0a24 |
| MUZEJ GOZDARSTVA IN LESARSTVA |  | sights | excursion | 12457.6 | 1311 | https://visitsavinjska.com/franciskanski-samostan/ @ 17e0409726bb7f1b070052530876939f1fcd9a9365ab5201d1f5c774dbdc6ace; https://visitsavinjska.com/kolofon/ @ f04f9c4b49724076ee3b680e5b2c955094c561cfe09565f0a3ebcc7cb249c031; https://visitsavinjska.com/nazarje/ @ 178c9829d6feaf19a1bc772c6c1e5532612fdf35fe38ad546c922efdf4e3227e |
| Muzej premogovništva Slovenije | Velenje | sights | excursion | 29431.9 | 2624 | https://visitsavinjska.com/kongresi-seminarji-in-konference/ @ 93984aad28735d93355788317e15ac317f0e8b9508f0e1efca00b797af2eb579 |
| Ojstrica |  | hike | excursion | 32707.8 | 3137 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ cd99abdaa7002269e78de4ec8cabef29cd4da46eab74b7163983fd1cf0f3ee10; https://www.hribi.net/ @ 563fb00eaf29c625b97eefc159c363431a5eb97f5a2fc3029141598b24761625; https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Osrednja knjižnica Mozirje | Mozirje | sights | excursion | 14549.8 | 1477 | https://mozirje.si/razpis-za-imenovanje-direktorja-osrednje-knjiznice-mozirje/ @ c4572a91f493e460ff49d8f4622d21361d448d96e2c25d43add75933c903eb41 |
| Planšarija Logarski kot |  | food | excursion | 32707.6 | 2965 | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Podvežak |  | hike | excursion | 27626.6 | 5353 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e |
| Potočka zijalka |  | sights | excursion | 29523.1 | 3903 | https://visitsavinjska.com/de/das-obere-savinja-tal-zgornja-savinjska-dolina/ @ a1fc275386931a8345f6d4b4e15556bce4511910abd0dcc8f23f7a5eb277a230; https://visitsavinjska.com/en/upper-savinja-valley/ @ 225f559637145d035c01c10e0f532b6f2a2f3f628a3c8a7b2fe06e1474e89ce8; https://visitsavinjska.com/de/solcava-3/ @ 6848ecac4f1ae7c30089d5522e1968d058f74cda4310a665ab72397e21568be6; https://visitsavinjska.com/en/solcava-2/ @ 20ce060eb6e07f8f713b0e6a221317058ef57c4c45bd5f6fd94d138e95921155; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Pravljični Šumberk |  | trips | excursion | 48315.8 | 3749 | https://www.hribi.net/gps.asp @ b11de0b2e81e48d1ee500d7a6127a2803a322d591b766748361388268be6f1e7; https://www.hribi.net/gps.asp @ b11de0b2e81e48d1ee500d7a6127a2803a322d591b766748361388268be6f1e7 |
| Presihajoči studenec |  | sights | excursion | 16931.6 | 1763 | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| Raduha |  | hike | excursion | 26466.1 | 3829 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ cd99abdaa7002269e78de4ec8cabef29cd4da46eab74b7163983fd1cf0f3ee10; https://www.hribi.net/ @ 563fb00eaf29c625b97eefc159c363431a5eb97f5a2fc3029141598b24761625; https://www.hribi.net/izlet/javorje_mala_crna_smrekovec_cez_bukov_stan/3/485/10364 @ cd52016affb511f1ea1c1ac14538ce09930f390a581a57d52c85386676508392; https://www.hribi.net/izlet/javorje_mala_crna_smrekovec_po_cesti/3/485/10365 @ 103841b1628c62794d1a38db2601b3b7756c2339439a265207364021b558dccf |
| Raven |  | sights | excursion | 58863.8 | 4329 | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Rdeča dvorana | Velenje | sights | excursion | 30125.9 | 2634 | https://visitsavinjska.com/37-pikin-festival/ @ 1a9eddd8f8afaac2a1ee80062c6f6e2d4a8ab99ed3260d2c6203418b17248395 |
| Repov slap |  | sights | excursion | 21770.6 | 2300 | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c; https://visitsavinjska.com/luce/ @ 6ecc92268fa3230f16f19757c35d6f4f04be2a4f38364555026e2b154deb0dbb |
| Robanov kot | Solčava | sights | excursion | 29160.5 | 3968 | https://visitsavinjska.com/de/logarska-dolina-und-landschaftsparks/ @ ad7795d7104e412fe4fdc13832c3fd7b1941dc019446a4c4cf7404a5c678990a; https://visitsavinjska.com/krajinski-park-robanov-kot/ @ 35f86f0bb6d0b966c9fffc3e748e6357fdbe42ee5f8fb79c95f542f1ab8cc29f |
| Savinja |  | act | excursion | 13298.3 | 1427 | https://www.ljubno.si/ @ 1fffcbee3dabcd80b6d929bd8d637a51166a4b5f952e16d3dd9b0ec248b75462; https://visitluce.si/ @ 7751e360cbe3fcaedf95718c50557a2705d50748834f85ec6a407ba43056ba70; https://www.luce.si/objava/1162910 @ 978dd1be2bf5895d63bf80f454082ffc6a78e92b929953f619b30aeeb00bf6d1; https://visitsavinjska.com/de/recica-ob-savinji-3/ @ ef02da483054e0321b4fba76c389ba29b63a06061e0300213733515535698ae3 |
| Skuta |  | hike | excursion | 43233.9 | 4269 | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Slap Cuc |  | sights | excursion | 25053.2 | 2772 | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| Slap Rinka | Solčava | sights | excursion | 34159.1 | 3095 | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088; https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ @ 28417c0b68f5966be4d7f52001cecb71a817cf4ffdbc349ec57bc4b9c1e2bf81 |
| Smučišče Luče | Luče | act | excursion | 14893.5 | 1672 | https://visitsavinjska.com/luce/ @ 6ecc92268fa3230f16f19757c35d6f4f04be2a4f38364555026e2b154deb0dbb; https://visitsavinjska.com/37-pikin-festival/ @ 1a9eddd8f8afaac2a1ee80062c6f6e2d4a8ab99ed3260d2c6203418b17248395; https://visitsavinjska.com/aktivnosti-prezivetje-v-naravi-bushcraft/ @ b870cdf845864dbec7acaf6ed0e1ab39423f104eaead7128b25600a95cf17f0d |
| Snežna jama |  | sights | excursion | 27334.7 | 4201 | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| Solčavska panoramska cesta |  | act | excursion | 34114.5 | 2918 | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade; https://visitsavinjska.com/savinjska-in-saleska-dolina/ @ 35456bd3e4390a5142628750fb7ceb33299a5574408995429796153d4a71e880; https://visitsavinjska.com/solcava/ @ cba869c8dec0b28db145d85ff51c1b37c039a782f7f1cfda642a73a06d3ef683 |
| Spodnje Sleme |  | sights | excursion | 32933.2 | 3913 | https://www.hribi.net/izlet/andrejev_dom_na_slemenu_smrekovec/3/485/3570 @ ed4de0ee28924df4d3b70247ab526afc086fb76b05d1c2944e379c03aeaee816 |
| Šmarjetna gora |  | hike | excursion | 67764.1 | 4978 | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Šport Center Prodnik |  | food | near | 4244.4 | 765 | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Terme Topolšica |  | act | excursion | 29257 | 2796 | https://visitsavinjska.com/en/upper-savinja-valley/ @ 225f559637145d035c01c10e0f532b6f2a2f3f628a3c8a7b2fe06e1474e89ce8 |
| TIC Rečica ob Savinji | Rečica ob Savinji | sights | excursion | 10635.3 | 1223 | https://visitsavinjska.com/informacije-savinjska/ @ 01d77786900cf681b682c3929146afcdfe7d90df007be0e227c7075e8e0ec42b |
| Turistična kmetija Govc Vršnik |  | food | excursion | 20449.5 | 2065 | https://visitsavinjska.com/krajinski-park-robanov-kot/ @ 040842d7f9e76af10328bffe1ed4690482b8c862c814d85feea795cbae367e53 |
| Turistična kmetija Gradišnik | Solčava | food | excursion | 29775.6 | 2752 | https://visitsavinjska.com/lokostrelstvo/ @ aaad8d4e96c86f3213b850b260fd4eaacd3b74bdf436c1613acb99c942b0382d |
| Velenjski grad | Velenje | sights | excursion | 29605.8 | 2567 | https://visitsavinjska.com/kongresi-seminarji-in-konference/ @ 93984aad28735d93355788317e15ac317f0e8b9508f0e1efca00b797af2eb579 |
| Velenjsko jezero | Velenje | sights | excursion | 28722.3 | 2590 | https://visitsavinjska.com/kongresi-seminarji-in-konference/ @ 93984aad28735d93355788317e15ac317f0e8b9508f0e1efca00b797af2eb579 |
| Zelenjak |  | hike | excursion | 13258.5 | 2298 | https://www.hribi.net/izlet/ljubno_ob_savinji_koca_na_travniku/3/489/3391 @ 9fb3bccb184726f2f001f305401c2181397b9a39f6fef0dbfa110ea2fd9c0079; https://www.hribi.net/izlet/ljubno_ob_savinji_planina_mali_travnik/3/1236/3390 @ a19e894e6dc2d32c351feb92d97ecaa545ad07cd7ae057312f717279095ccbde; https://www.hribi.net/izlet/ljubno_ob_savinji_veliki_travnik_turnovka/3/488/3392 @ de28ecd1bd6a24362839bcf12a9bd7102e481fb5c59c9050ef36d0595e001748 |
| Žagerski mlin | Podvolovljek | sights | excursion | 20260.8 | 2130 | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |

## Unresolved candidates

| Name | Settlement | Category | Reason | Provenance |
|---|---|---|---|---|
| Ajdna |  | hike | duration-ceiling | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Alpski vinograd | Šmartno ob Paki | sights | no-results | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Alpski vrt na Golteh | Mozirje | sights | no-results | https://visitsavinjska.com/krajinski-park-golte/ @ d62a4f8e197a760206a7f780568414251d3e1319579aaa37b1a2d74e06ddabd6 |
| Andaluzija |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Apartma Skala | Rečica ob Savinji | food | name-mismatch | https://visitsavinjska.com/apartma-skala/ @ 1a72464ddbad6d569009f38421702b12d9545885f949e63ee66bbdc55c02546e |
| Atelje Majnik | Solčava | sights | no-results | https://visitsavinjska.com/franciskanski-samostan/ @ 17e0409726bb7f1b070052530876939f1fcd9a9365ab5201d1f5c774dbdc6ace; https://visitsavinjska.com/gornjegrajska-katedrala/ @ 7e64a6dc9ce2087e501b8c8cfae8ad1e9d15e02464bdc265462d60697dc4d8a4; https://visitsavinjska.com/green-destinations-logarska-solcavsko/ @ 6eb3a03f65675b42b1d25cfe187dce17ded91b4d0ed47fb8c797ec6ae450e63c; https://visitsavinjska.com/evropski-teden-mobilnosti-v-savinjski/ @ 1d65838ba3922f2c5ae500c38b00673263913844aa138a7aa254240ae8c0c80e; https://visitsavinjska.com/novice-globalno/ @ 6cd44d0d24acf0c6ea2b3677762f3a64a604f3eb7887497d7d839e5b57ccd291 |
| Bavšica |  | sights | road-distance-ceiling | https://www.hribi.net/ @ 563fb00eaf29c625b97eefc159c363431a5eb97f5a2fc3029141598b24761625 |
| Bavški Grintavec |  | hike | road-distance-ceiling | https://www.hribi.net/ @ 563fb00eaf29c625b97eefc159c363431a5eb97f5a2fc3029141598b24761625 |
| Bele Vode (Rebršak) |  | sights | no-results | https://www.hribi.net/izlet/bele_vode_rebrsak_smrekovec/3/485/1466 @ 0d429c4ce2cb265a2962e5baed42de7976e4f90fe397d22e73f5a979f7a2d400 |
| Bivacco Alberto Busettini |  | hike | road-distance-ceiling | https://www.hribi.net/gps.asp @ b11de0b2e81e48d1ee500d7a6127a2803a322d591b766748361388268be6f1e7 |
| bivak Suringar |  | hike | no-results | https://www.hribi.net/najslike.asp @ 1858290b75b82eb60e1e8831647be25f04d617857053f2b0ec5fd8c084d7143d |
| BOHAČEV TOPLAR |  | sights | no-results | https://visitsavinjska.com/franciskanski-samostan/ @ 17e0409726bb7f1b070052530876939f1fcd9a9365ab5201d1f5c774dbdc6ace |
| Bohinjsko Bistrico |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Borseka |  | trips | no-results | https://visitsavinjska.com/apartma-skala/ @ 1a72464ddbad6d569009f38421702b12d9545885f949e63ee66bbdc55c02546e |
| Brano |  | hike | name-mismatch | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Brezovici |  | sights | name-mismatch | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Bushcraft Savinjska | Mozirje | act | no-results | https://visitsavinjska.com/krajinski-park-golte/ @ d62a4f8e197a760206a7f780568414251d3e1319579aaa37b1a2d74e06ddabd6; https://visitsavinjska.com/aktivnosti-prezivetje-v-naravi-bushcraft/ @ b870cdf845864dbec7acaf6ed0e1ab39423f104eaead7128b25600a95cf17f0d; https://visitsavinjska.com/mozirje/ @ 8346111718967f78ebeb6f3ff0ba1ace2a9c61cd977ec55f78c8cf6dd8ec0a24 |
| cerkev Marije Kraljice Miru |  | sights | road-distance-ceiling | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Cerkev Marije Snežne | Solčava | sights | duration-ceiling | https://visitsavinjska.com/solcava/ @ cba869c8dec0b28db145d85ff51c1b37c039a782f7f1cfda642a73a06d3ef683 |
| cerkev Sv. Jakoba | Okonina | sights | duration-ceiling | https://visitsavinjska.com/ljubno-ob-savinji/ @ ff3057aefda8a190ce852d9240f0c406c27967516fc2b957b969870e5382bfd3; https://visitsavinjska.com/ljubno-ob-savinji/ @ a02471554d97f64d16ca16260b4fc3caa7426c0ac04cd1b017731f932964aac6 |
| cerkev sv. Mohorja in Fortunata | Gornji Grad | sights | duration-ceiling | https://visitsavinjska.com/gornji-grad/ @ 2a263b1c2bedaff0b2dab85da0fedc92dd5f62638e9911f32a5c8c393e4f6527; https://visitsavinjska.com/gornjegrajska-katedrala/ @ 7e64a6dc9ce2087e501b8c8cfae8ad1e9d15e02464bdc265462d60697dc4d8a4 |
| Cerkev sv. Uršule na Uršlji gori |  | sights | duration-ceiling | https://www.hribi.net/spletna_kamera/urslja_gora/1026 @ f0fd1927062b9cede63967d7a313243a461de026bab75b89dff83f5b46c82cbd |
| Cinque Terre |  | sights | hard-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a; https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Cinque Torri |  | hike | hard-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Črna na Koroškem |  | sights | name-mismatch | https://www.hribi.net/panorama/360/smrekovec/485 @ fb788ad597f48120c4e67282102ea2b28aa5701f46cafa06d85ab1878f5b110c; https://www.hribi.net/vreme_gora/smrekovec/3/485 @ ad7db7e4797b43f023b2d6f3a440aaf0cb0d3290ba33db66df38c6bbd4aa7c8b |
| Črna na Koroškem (Center) | Črna na Koroškem | act | name-mismatch | https://www.hribi.net/spletna_kamera/crna_na_koroskem_center/5228 @ eb8d09b4dd0df0f9ecab3464691a5154269dcbdbbb5ce2a22095a2c874353c75; https://www.hribi.net/spletna_kamera/crna_na_koroskem_smucisce_crna/5229 @ 8ae80b68b59910e886094f5fa56447fdf2e8b6a77845cdcb7ad059e126a98419; https://www.hribi.net/spletna_kamera/crna_na_koroskem/1461 @ e2f03bc5f6d3169564b6ba495330b87e4412a136607e66337013911a23743c3c |
| Črna na Koroškem (smučišče Črna) | Črna na Koroškem | act | no-results | https://www.hribi.net/spletna_kamera/crna_na_koroskem_center/5228 @ eb8d09b4dd0df0f9ecab3464691a5154269dcbdbbb5ce2a22095a2c874353c75; https://www.hribi.net/spletna_kamera/crna_na_koroskem_smucisce_crna/5229 @ 8ae80b68b59910e886094f5fa56447fdf2e8b6a77845cdcb7ad059e126a98419; https://www.hribi.net/spletna_kamera/crna_na_koroskem/1461 @ e2f03bc5f6d3169564b6ba495330b87e4412a136607e66337013911a23743c3c |
| Črna prst |  | sights | duration-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Črno prst |  | hike | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Debeli Kuk |  | hike | hard-ceiling | https://www.hribi.net/ @ 563fb00eaf29c625b97eefc159c363431a5eb97f5a2fc3029141598b24761625 |
| dolina Drage |  | sights | name-mismatch | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Dolina Lučke Bele |  | sights | no-results | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| Dom Kulture Nazarje | Nazarje | act | no-results | https://nazarje.si/ @ 6d2ebde154f34632bba36d84c186ad927c6a803bb61718326234a5d99dc5fc2f |
| Dom na Okrešlju |  | hike | name-mismatch | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Dom na Peci |  | hike | name-mismatch | https://www.hribi.net/izhodisce/ljubenske_rastke/46.38510/14.84640 @ 59aa1ad58e7728fdecf52e5486a4469e7d47c0615c5c2c0072dea5d3e47206a1; https://www.hribi.net/izhodisce/primoz_pri_ljubnem/46.36850/14.81740 @ 87cf3d1bcc7c8f401c8095c8fb2fd1110975ecc7d5d60baf7c7e287fafb6d33d; https://www.hribi.net/izhodisce/raduha_struge/46.36572/14.77337 @ 9b76a04e265c452e1ac978542516437459f9cd3e49e8d9ea9107067751540337; https://www.hribi.net/spletna_kamera/crna_na_koroskem_center/5228 @ eb8d09b4dd0df0f9ecab3464691a5154269dcbdbbb5ce2a22095a2c874353c75; https://www.hribi.net/spletna_kamera/crna_na_koroskem_smucisce_crna/5229 @ 8ae80b68b59910e886094f5fa56447fdf2e8b6a77845cdcb7ad059e126a98419; https://www.hribi.net/spletna_kamera/crna_na_koroskem/1461 @ e2f03bc5f6d3169564b6ba495330b87e4412a136607e66337013911a23743c3c; https://www.hribi.net/spletna_kamera/dom_na_smrekovcu/5279 @ e8addc4f64ec2a82826c1eafd667976c72cb3554ef63361c906bab488f3ee133; https://www.hribi.net/spletna_kamera/solcava/5080 @ b835a19023be1047801526556461c8d384b4f2715a184b9a7433359cb5cb995e; https://www.hribi.net/spletne_kamere_v_gorah @ 2ea18064662f9ec750ce8137ac50950cb3757711b39ddd0025c7deb5410cc253; https://www.hribi.net/panorama/360/smrekovec/485 @ fb788ad597f48120c4e67282102ea2b28aa5701f46cafa06d85ab1878f5b110c; https://www.hribi.net/spletna_kamera/crna_na_koroskem_center/5228 @ eb8d09b4dd0df0f9ecab3464691a5154269dcbdbbb5ce2a22095a2c874353c75; https://www.hribi.net/spletna_kamera/crna_na_koroskem_smucisce_crna/5229 @ 8ae80b68b59910e886094f5fa56447fdf2e8b6a77845cdcb7ad059e126a98419; https://www.hribi.net/spletna_kamera/crna_na_koroskem/1461 @ e2f03bc5f6d3169564b6ba495330b87e4412a136607e66337013911a23743c3c; https://www.hribi.net/spletna_kamera/dom_na_peci/2147 @ 09d17e9b3edbb608d923ad712490a5606deebe9abd569592caedc2215387d22c; https://www.hribi.net/vreme_gora/smrekovec/3/485 @ ad7db7e4797b43f023b2d6f3a440aaf0cb0d3290ba33db66df38c6bbd4aa7c8b |
| Dom na Šmohorju |  | hike | name-mismatch | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Dom na Uršlji gori |  | hike | duration-ceiling | https://www.hribi.net/spletna_kamera/urslja_gora/1026 @ f0fd1927062b9cede63967d7a313243a461de026bab75b89dff83f5b46c82cbd |
| Dom na Zelenici |  | hike | name-mismatch | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Dom pod Storžičem |  | hike | duration-ceiling | https://www.hribi.net/spletne_kamere_v_gorah @ 2ea18064662f9ec750ce8137ac50950cb3757711b39ddd0025c7deb5410cc253 |
| Dom Zorka Jelinčiča na Črni prsti |  | hike | duration-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Domačija Koklej |  | sights | no-results | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| domu Zorka Jelinčiča na Črni prsti |  | hike | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Dovje |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Dovžanova soteska |  | sights | duration-ceiling | https://www.hribi.net/ @ 563fb00eaf29c625b97eefc159c363431a5eb97f5a2fc3029141598b24761625 |
| Doživite cvetoče Mozirje | Mozirje | act | no-results | https://visitsavinjska.com/dozivite-cvetoce-mozirje/ @ b8786d29a773f543aa78306d22ac3614fd1093f3dd5da4fbc0fd6c041924672c; https://visitsavinjska.com/mozirje/ @ 8346111718967f78ebeb6f3ff0ba1ace2a9c61cd977ec55f78c8cf6dd8ec0a24 |
| Dvorana Nazarje |  | act | no-results | https://nazarje.si/ @ 6d2ebde154f34632bba36d84c186ad927c6a803bb61718326234a5d99dc5fc2f |
| Erjavčeva jama |  | sights | no-results | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c; https://visitsavinjska.com/luce/ @ 6ecc92268fa3230f16f19757c35d6f4f04be2a4f38364555026e2b154deb0dbb |
| Etnološka zbirka Vas starih poklicev |  | sights | no-results | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| etnološki muzej Štekl | Gornji Grad | sights | no-results | https://visitsavinjska.com/gornji-grad/ @ 2a263b1c2bedaff0b2dab85da0fedc92dd5f62638e9911f32a5c8c393e4f6527 |
| Fitnes Luče |  | act | no-results | https://www.luce.si/ @ b9f7b14bd28ca68e19fdd0f4b2803ea50e71033abd54ffd463555d52ae41e176; https://www.luce.si/dogodki @ bfc62bda9f523f8037ce031f093d28ff1b479c2cdf28baaef5d6e420aa0fae4c; https://www.luce.si/gallery @ 0958cf1c59c429b7f2478c9112e559fd8585ecd2d81e748f68d31295573bce60; https://www.luce.si/imenik @ ba765d48f0efce613916e1ffffc0b3e44d9a60a6ba3805f3dba1b73e7f4b5494; https://www.luce.si/katalogjavnegaznacaja @ 2b8207e535b2a67f2d6bbe7cd41d449438e7f281e7d0ff7a31b8fb9518c31e06; https://www.luce.si/objava/1037877 @ 328fe866da1ae93fb25f5c2eeb5d959d9c46b9c529ed4eac1ee64feaae588f81; https://www.luce.si/objava/104110 @ 555eb41a4d465e496da2a83c911857abba0bfa419e0e7f865304cc2d5c88cda4; https://www.luce.si/objava/1113309 @ f4620f2fac5cfa806634bf7a730d931a2383985d6196a05ec05c0f08e2743db8; https://www.luce.si/objava/1162910 @ 978dd1be2bf5895d63bf80f454082ffc6a78e92b929953f619b30aeeb00bf6d1; https://www.luce.si/objava/1189648 @ 7d0e5a78bce35e7aa0aca71359d79cc790f3d8e386c8a3b1886f93c92e48d0c3; https://www.luce.si/Razpisi @ 86498f68e6dc6e673f684118298b407fb47b7248321ead9dea296ae3bf5241cc; https://www.luce.si/Registracija @ 80e5a0fd5d8cc79282f203c964a42ade85baae9b1e677d47886ebd105152eb62; https://www.luce.si/TermsAndConditions @ caa115f44bdba709d4ca411ccd752c69406c54ac68ad5e0383b1984b3a3aed29; https://www.luce.si/ViriRSS @ 8f58c9a6d168137aadbd241d4221dd6baf9da495f0428ea9585f8eea5e927691 |
| Flosarska zbirka Ljubno |  | sights | no-results | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Flosarski bal | Ljubno ob Savinji | act | no-results | https://visitsavinjska.com/flosarski-bal-ljubno/ @ b3d0332750eda25b15504c78a7ce73188b77de4e762aa0ca85a497dfafe4985e |
| Fly Golte |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Frančiškanski samostan | Nazarje | sights | name-mismatch | https://visitsavinjska.com/franciskanski-samostan/ @ 17e0409726bb7f1b070052530876939f1fcd9a9365ab5201d1f5c774dbdc6ace; https://visitsavinjska.com/nazarje/ @ 178c9829d6feaf19a1bc772c6c1e5532612fdf35fe38ad546c922efdf4e3227e |
| Frančiškanski samostan Nazarje |  | sights | no-results | https://nazarje.si/ @ 6d2ebde154f34632bba36d84c186ad927c6a803bb61718326234a5d99dc5fc2f |
| Funpark Menina | Rečica ob Savinji | act | no-results | https://visitsavinjska.com/funpark-menina/ @ 68e1a9130e85dbcdc087fadd9c66662c19e6c1727c746053aeebe23afdcf1482 |
| Galerija Nazarje |  | sights | no-results | https://nazarje.si/ @ 6d2ebde154f34632bba36d84c186ad927c6a803bb61718326234a5d99dc5fc2f; https://nazarje.si/acts @ ed5c1160a476d95acc0369d0ff437ca53d9d5bad21d90a6f43fed710761702e5; https://nazarje.si/dogodki @ bef2f115b058866bdb41205e64b7b6de1ba4e68833d5abba9d28547eb50157f6; https://nazarje.si/gallery @ 3fff598347fc34ff5cceb506cb40f9c6ea84609ac651b7375a5ee5b51ceadba5; https://nazarje.si/gallery/7644 @ f2a18f0506666c7987f89ab3a29bee79c3ecd7ff083c78b94c085a6bde4f6610; https://nazarje.si/gallery/7648 @ cf72160bd238397fbe7bfa0e97eb25535ac8cb99a29ab4cf818f1d77ef9f7764; https://nazarje.si/gallery/7652 @ 5320c1128c9b8ee6c694f1a74e0d98c1564bac3a7d172feeb15cd28632059a1f; https://nazarje.si/gallery/7653 @ bac96a42c09822015eaf14664ef34c14b69f8f23c50000bc9491eb736e42b897 |
| Galerija Štekl | Gornji Grad | sights | no-results | https://www.gornji-grad.si/objava/1359536 @ 76ae1fdf7ea451f84c1edc3c2045da12ea1424baa3bab87ffe245d35f5a7de3d |
| Gašperjevega hriba |  | sights | no-results | https://www.hribi.net/gps.asp @ b11de0b2e81e48d1ee500d7a6127a2803a322d591b766748361388268be6f1e7 |
| Glaziji |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Golte (Alpski vrt) |  | sights | no-results | https://www.hribi.net/izlet/golte_alpski_vrt_smrekovec/3/485/9783 @ 357a1952a507fe1a06a0834919ab7fd070ac5ef3b17e0407926d9b98028782a5 |
| Gornjegrajska katedrala | Gornji Grad | sights | no-results | https://visitsavinjska.com/gornjegrajska-katedrala/ @ 7e64a6dc9ce2087e501b8c8cfae8ad1e9d15e02464bdc265462d60697dc4d8a4 |
| gornjegrajske gavge | Gornji Grad | sights | no-results | https://visitsavinjska.com/gornji-grad/ @ 2a263b1c2bedaff0b2dab85da0fedc92dd5f62638e9911f32a5c8c393e4f6527 |
| Gornji Grad |  | trips | hard-ceiling | https://visitsavinjska.com/gornji-grad/ @ 2a263b1c2bedaff0b2dab85da0fedc92dd5f62638e9911f32a5c8c393e4f6527 |
| Gostilna Kamp Menina | Rečica ob Savinji | food | no-results | https://visitsavinjska.com/gostilna-kamp-menina/ @ 6e724c2e1594771507b9724de825b988f663798291df161e1172ac4522f8fe2c |
| Gozdarska koča Podvežak |  | hike | duration-ceiling | https://visitluce.si/nastanitve/ @ 33d63e594b4b56c2cc231fc12c34790b816a10e117b668fe84d0dfa944b49931 |
| Gozdna terapija | Mozirje | act | no-results | https://visitsavinjska.com/dozivite-cvetoce-mozirje/ @ b8786d29a773f543aa78306d22ac3614fd1093f3dd5da4fbc0fd6c041924672c; https://visitsavinjska.com/gozdna-terapija/ @ 0667f7f0fad9883b906a5c8fb6c2c6e075b40efc2be788221bf5dc8800fed7c5; https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385; https://visitsavinjska.com/mozirje/ @ 8346111718967f78ebeb6f3ff0ba1ace2a9c61cd977ec55f78c8cf6dd8ec0a24 |
| grad Kostel |  | sights | road-distance-ceiling | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65; https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Grad Vrbovec | Nazarje | sights | hard-ceiling | https://nazarje.si/ @ 6d2ebde154f34632bba36d84c186ad927c6a803bb61718326234a5d99dc5fc2f; https://visitsavinjska.com/nazarje/ @ 178c9829d6feaf19a1bc772c6c1e5532612fdf35fe38ad546c922efdf4e3227e |
| Gradišče (Velika planina) |  | trips | name-mismatch | https://www.hribi.net/spletna_kamera/domzalski_dom_na_mali_planini/3354 @ 8198e9f1518d8a8aa921b1804ccea08ad7113930e810ccc4b938b4e94dea286d |
| Grintovec |  | hike | duration-ceiling | https://www.hribi.net/najslike.asp @ 1858290b75b82eb60e1e8831647be25f04d617857053f2b0ec5fd8c084d7143d; https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| GruttenHutte |  | hike | hard-ceiling | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Gubnom |  | hike | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Hanzova pot na Mojstrovko |  | hike | road-distance-ceiling | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65; https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Herbal glamping Ljubno | Ljubno | food | name-mismatch | https://visitsavinjska.com/ljubno-ob-savinji/ @ ff3057aefda8a190ce852d9240f0c406c27967516fc2b957b969870e5382bfd3; https://visitsavinjska.com/ljubno-ob-savinji/ @ a02471554d97f64d16ca16260b4fc3caa7426c0ac04cd1b017731f932964aac6 |
| Hiška ob gozdu Lukez plac |  | food | no-results | https://visitsavinjska.com/ljubno-ob-savinji/ @ a02471554d97f64d16ca16260b4fc3caa7426c0ac04cd1b017731f932964aac6 |
| Hiška v Čatežu |  | sights | no-results | https://www.gornji-grad.si/TermsAndConditions @ a5fbb5c88e4fc07184b3c7a63dbf6a5dbb907a156192389e72bafde2bc39ca9f; https://www.gornji-grad.si/ViriRSS @ 06ff044690ef5461decb508e06f2b22a74ed2666842830efab3dfe645f5de90e |
| Hleviška planina |  | sights | road-distance-ceiling | https://www.hribi.net/izlet/golte_alpski_vrt_smrekovec/3/485/9783 @ 357a1952a507fe1a06a0834919ab7fd070ac5ef3b17e0407926d9b98028782a5 |
| Hotel Golte |  | food | name-mismatch | https://www.hribi.net/spletna_kamera/golte/34 @ b684298cddd141cf304cc2de0dda5a3f9e9ffa2f7bb2e58c96a2a380d386b588; https://www.hribi.net/spletna_kamera/golte/34 @ b684298cddd141cf304cc2de0dda5a3f9e9ffa2f7bb2e58c96a2a380d386b588 |
| Hotel Logarjevih sester |  | food | no-results | https://www.solcava.si/objava/1181231 @ 3cf64e5a8a0876acf8c0a8bf57cb30f35d533596309ea6a5aeb21b7576da9fbe |
| hotel Montis Golte |  | food | no-results | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Hotel Montis**** | Mozirje | food | hard-ceiling | https://visitsavinjska.com/mozirje/ @ 8346111718967f78ebeb6f3ff0ba1ace2a9c61cd977ec55f78c8cf6dd8ec0a24 |
| Hotel Plesnik |  | food | name-mismatch | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade; https://visitsavinjska.com/green-destinations-logarska-solcavsko/ @ 6eb3a03f65675b42b1d25cfe187dce17ded91b4d0ed47fb8c797ec6ae450e63c; https://visitsavinjska.com/kongresi-seminarji-in-konference/ @ 93984aad28735d93355788317e15ac317f0e8b9508f0e1efca00b797af2eb579; https://visitsavinjska.com/evropski-teden-mobilnosti-v-savinjski/ @ 1d65838ba3922f2c5ae500c38b00673263913844aa138a7aa254240ae8c0c80e |
| Hude police |  | hike | name-mismatch | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65; https://www.hribi.net/najslike.asp @ 1858290b75b82eb60e1e8831647be25f04d617857053f2b0ec5fd8c084d7143d; https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Hvar |  | sights | blocked-class-or-addresstype | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Hvaru |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Impulse paragliding |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Interaktivna flosarska zbirka | Ljubno | sights | no-results | https://visitsavinjska.com/kongresi-seminarji-in-konference/ @ 93984aad28735d93355788317e15ac317f0e8b9508f0e1efca00b797af2eb579; https://visitsavinjska.com/ljubno-ob-savinji/ @ a02471554d97f64d16ca16260b4fc3caa7426c0ac04cd1b017731f932964aac6 |
| Interaktivna flosarska zbirka in Zbirka Ljubenskih cvetnonedeljskih butaric | Ljubno | sights | no-results | https://visitsavinjska.com/flosarska-zbirka-ljubno/ @ a404a3347e98567677fedb0d8d12d6127214cd0901c8e5d29994f81188aad640 |
| Isteje |  | sights | no-results | https://www.hribi.net/izlet/golte_alpski_vrt_smrekovec/3/485/9783 @ 357a1952a507fe1a06a0834919ab7fd070ac5ef3b17e0407926d9b98028782a5 |
| izvir Črne |  | sights | name-mismatch | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Izvir Ljubije |  | sights | no-results | https://www.hribi.net/izlet/izvir_ljubije_smrekovec_po_cesti/3/485/5888 @ af1b212a2a1d89a6f24091ba671cb2bd3d3846ed3d25acf8aeab4e95301abe15; https://www.hribi.net/izlet/izvir_ljubije_smrekovec_preko_leskovskove_pustote/3/485/5886 @ c3b570320992c16a916089b7551cf35f97a5112dd63c15b08c85876b22d21d12 |
| Jadralno padalstvo |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Jezero |  | sights | road-distance-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| jezero na Golteh |  | sights | road-distance-ceiling | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade; https://visitsavinjska.com/krajinski-park-golte/ @ d62a4f8e197a760206a7f780568414251d3e1319579aaa37b1a2d74e06ddabd6 |
| Jezerskega vrha |  | sights | no-results | https://www.hribi.net/iskalnik_izletov @ dba25534b53968f8e874c86baba71ccf517eefc11a25260af8deb9df1e0b7724 |
| Juvanova hiša |  | sights | no-results | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c; https://visitsavinjska.com/luce/ @ 6ecc92268fa3230f16f19757c35d6f4f04be2a4f38364555026e2b154deb0dbb |
| Kal |  | sights | road-distance-ceiling | https://www.hribi.net/izlet/golte_alpski_vrt_smrekovec/3/485/9783 @ 357a1952a507fe1a06a0834919ab7fd070ac5ef3b17e0407926d9b98028782a5 |
| Kamp Menina |  | food | name-mismatch | https://visitsavinjska.com/dozivi/ @ 547231ad9ee76b205837c7cd2a807cbabd12464773b0e5f30a18027937b34269; https://visitsavinjska.com/dozivite-cvetoce-mozirje/ @ b8786d29a773f543aa78306d22ac3614fd1093f3dd5da4fbc0fd6c041924672c; https://visitsavinjska.com/en/mozirje-2/ @ 7cd226ce23fbde0706dd011eb89abd3f0c963195aa663828f852f1e4b425a301; https://visitsavinjska.com/gozdna-terapija/ @ 0667f7f0fad9883b906a5c8fb6c2c6e075b40efc2be788221bf5dc8800fed7c5; https://visitsavinjska.com/informacije-savinjska/ @ 3f02bfac6805ab9342d77cec8aac25f063af308b3c334a1c5ce7d1e56ba38a7f; https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385; https://visitsavinjska.com/kolofon/ @ d0aeaf1d27b4a64de0517979bea144b4f9656502e282f94e24dadf547e1ae140; https://visitsavinjska.com/mozirje/ @ 8346111718967f78ebeb6f3ff0ba1ace2a9c61cd977ec55f78c8cf6dd8ec0a24 |
| Kapela Jezusa Dobrega Pastirja |  | sights | name-mismatch | https://www.hribi.net/izlet/golte_alpski_vrt_smrekovec/3/485/9783 @ 357a1952a507fe1a06a0834919ab7fd070ac5ef3b17e0407926d9b98028782a5 |
| Kapela na Molički planini |  | sights | name-mismatch | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| Katschberg |  | sights | hard-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Kilimanjaro |  | sights | hard-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a; https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Kladivo |  | sights | duration-ceiling | https://www.hribi.net/najslike.asp @ 1858290b75b82eb60e1e8831647be25f04d617857053f2b0ec5fd8c084d7143d |
| Klemenča jama |  | hike | no-results | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088 |
| Klemenča jama in Strelovec | Solčava | hike | no-results | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ cd99abdaa7002269e78de4ec8cabef29cd4da46eab74b7163983fd1cf0f3ee10; https://visitsavinjska.com/klemenca-jama-in-strelovec/ @ dc65d72503f31645b3313d95128b258e5e32a033b06839c257136b09579a7ed3; https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ @ 28417c0b68f5966be4d7f52001cecb71a817cf4ffdbc349ec57bc4b9c1e2bf81 |
| Knjižnica Mozirje | Mozirje | sights | name-mismatch | https://mozirje.si/predlagajte-predstavnika-uporabnikov-v-svet-zavoda-knjiznica-mozirje-2026/ @ 861baf868fb2b0eef5165ccffc93fbc1367acc651191a59e98edeb23ab9f5df0 |
| Kocbekov dom na Korošici |  | hike | name-mismatch | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitluce.si/nastanitve/ @ 33d63e594b4b56c2cc231fc12c34790b816a10e117b668fe84d0dfa944b49931; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ cd99abdaa7002269e78de4ec8cabef29cd4da46eab74b7163983fd1cf0f3ee10 |
| Koča na Dobrči |  | hike | duration-ceiling | https://www.hribi.net/spletne_kamere_v_gorah @ 2ea18064662f9ec750ce8137ac50950cb3757711b39ddd0025c7deb5410cc253 |
| Koča na Grohotu |  | hike | duration-ceiling | https://www.solcava.si/objava/1002877 @ ab298450fad786376ae997d4dc051e24384f929a7cf9ec2c2349a0d066a9d9f9 |
| Koča na Loki |  | hike | name-mismatch | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e |
| Koča na planini Preval-a |  | hike | duration-ceiling | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Koča v Grohotu pod Raduho |  | hike | no-results | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ bacbe437b9d9db6da84c73878122249cace2d7b7e63df4121e54c7f13bd6d088 |
| Kofce-gora |  | hike | duration-ceiling | https://www.hribi.net/najslike.asp @ 1858290b75b82eb60e1e8831647be25f04d617857053f2b0ec5fd8c084d7143d |
| KOKARSKI KLOBUK |  | sights | no-results | https://visitsavinjska.com/franciskanski-samostan/ @ 17e0409726bb7f1b070052530876939f1fcd9a9365ab5201d1f5c774dbdc6ace |
| Kolesarski center Beli zajec |  | act | no-results | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Kolesarski vzpon na Golte |  | act | no-results | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Konečko planino |  | sights | no-results | https://www.hribi.net/izlet/izvir_ljubije_smrekovec_po_cesti/3/485/5888 @ af1b212a2a1d89a6f24091ba671cb2bd3d3846ed3d25acf8aeab4e95301abe15 |
| Kongresni center KLS Kulturno-poslovni center Ljubno (KPC Ljubno) | Ljubno | sights | no-results | https://visitsavinjska.com/kongresi-seminarji-in-konference/ @ 93984aad28735d93355788317e15ac317f0e8b9508f0e1efca00b797af2eb579 |
| Korenskega sedla |  | sights | no-results | https://www.hribi.net/iskalnik_izletov @ dba25534b53968f8e874c86baba71ccf517eefc11a25260af8deb9df1e0b7724 |
| Korošica |  | hike | duration-ceiling | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e; https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ cd99abdaa7002269e78de4ec8cabef29cd4da46eab74b7163983fd1cf0f3ee10; https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Košutnikov turn |  | hike | duration-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Kotli |  | sights | equally-plausible | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a; https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Krajevna knjižnica Nazarje |  | act | no-results | https://nazarje.si/ @ 6d2ebde154f34632bba36d84c186ad927c6a803bb61718326234a5d99dc5fc2f; https://nazarje.si/acts @ ed5c1160a476d95acc0369d0ff437ca53d9d5bad21d90a6f43fed710761702e5; https://nazarje.si/dogodki @ bef2f115b058866bdb41205e64b7b6de1ba4e68833d5abba9d28547eb50157f6; https://nazarje.si/gallery @ 3fff598347fc34ff5cceb506cb40f9c6ea84609ac651b7375a5ee5b51ceadba5; https://nazarje.si/gallery/7644 @ f2a18f0506666c7987f89ab3a29bee79c3ecd7ff083c78b94c085a6bde4f6610; https://nazarje.si/gallery/7648 @ cf72160bd238397fbe7bfa0e97eb25535ac8cb99a29ab4cf818f1d77ef9f7764; https://nazarje.si/gallery/7652 @ 5320c1128c9b8ee6c694f1a74e0d98c1564bac3a7d172feeb15cd28632059a1f; https://nazarje.si/gallery/7653 @ bac96a42c09822015eaf14664ef34c14b69f8f23c50000bc9491eb736e42b897 |
| Krajinski park Golte |  | sights | no-results | https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ @ 5ffb825fe50f99b7c25d8309d073529fac3d78a5703933c180bddd43d0db78bb; https://visitsavinjska.com/aktivnosti-prezivetje-v-naravi-bushcraft/ @ b870cdf845864dbec7acaf6ed0e1ab39423f104eaead7128b25600a95cf17f0d; https://visitsavinjska.com/mozirje/ @ 8346111718967f78ebeb6f3ff0ba1ace2a9c61cd977ec55f78c8cf6dd8ec0a24 |
| Krajinski park Logarska dolina |  | sights | name-mismatch | https://visitsavinjska.com/savinjska-in-saleska-dolina/ @ 35456bd3e4390a5142628750fb7ceb33299a5574408995429796153d4a71e880; https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ @ 28417c0b68f5966be4d7f52001cecb71a817cf4ffdbc349ec57bc4b9c1e2bf81; https://visitsavinjska.com/evropski-teden-mobilnosti-v-savinjski/ @ 1d65838ba3922f2c5ae500c38b00673263913844aa138a7aa254240ae8c0c80e |
| Kramarica |  | sights | duration-ceiling | https://www.hribi.net/izlet/andrejev_dom_na_slemenu_smrekovec/3/485/3570 @ ed4de0ee28924df4d3b70247ab526afc086fb76b05d1c2944e379c03aeaee816 |
| KRETA |  | sights | blocked-class-or-addresstype | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Krim |  | sights | duration-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a; https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Kriška gora |  | trips | duration-ceiling | https://www.hribi.net/spletne_kamere_v_gorah @ 2ea18064662f9ec750ce8137ac50950cb3757711b39ddd0025c7deb5410cc253 |
| Kronplatz |  | hike | hard-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Kulturni dom | Nazarje | sights | equally-plausible | https://mozirje.si/kulturni-dom-srce-skupnosti/ @ 83f97b13751ab9d0d9ad1c3a8c1828ae87d24e41ccd45a877baceac0aef36bb2 |
| KULTURNI DOM IN KONGRESNI CENTER KLS |  | sights | no-results | https://www.ljubno.si/ViriRSS @ 8d8aded095a3c1581b67376d93d77f3d1c865f3ff87ce3c5fba77850d693066c |
| Kup |  | sights | duration-ceiling | https://www.hribi.net/gps.asp @ b11de0b2e81e48d1ee500d7a6127a2803a322d591b766748361388268be6f1e7 |
| Kurjeke |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a; https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Lanež |  | hike | duration-ceiling | https://www.hribi.net/ @ 563fb00eaf29c625b97eefc159c363431a5eb97f5a2fc3029141598b24761625 |
| Leskovškova pustota |  | hike | no-results | https://www.hribi.net/izlet/izvir_ljubije_smrekovec_preko_leskovskove_pustote/3/485/5886 @ c3b570320992c16a916089b7551cf35f97a5112dd63c15b08c85876b22d21d12 |
| Linasi resort Slovenija *** |  | food | no-results | https://visitsavinjska.com/apartma-skala/ @ 1a72464ddbad6d569009f38421702b12d9545885f949e63ee66bbdc55c02546e; https://visitsavinjska.com/nazarje/ @ 178c9829d6feaf19a1bc772c6c1e5532612fdf35fe38ad546c922efdf4e3227e |
| Lipovec |  | trips | road-distance-ceiling | https://www.hribi.net/spletna_kamera/spitalic/5086 @ 4ec25849f8965594c693b12f18c4797418a230d5af0256d8d802555e132a3886 |
| Lisca |  | hike | duration-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Ljubelja |  | sights | no-results | https://www.hribi.net/iskalnik_izletov @ dba25534b53968f8e874c86baba71ccf517eefc11a25260af8deb9df1e0b7724 |
| Ljubenske Rastke |  | trips | no-results | https://www.hribi.net/izhodisce/ljubenske_rastke/46.38510/14.84640 @ 59aa1ad58e7728fdecf52e5486a4469e7d47c0615c5c2c0072dea5d3e47206a1 |
| Ljubijski graben |  | sights | no-results | https://www.hribi.net/izlet/izvir_ljubije_smrekovec_po_cesti/3/485/5888 @ af1b212a2a1d89a6f24091ba671cb2bd3d3846ed3d25acf8aeab4e95301abe15 |
| Ljubljanskim barjem |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Ljubno | Ljubno ob Savinji | trips | name-mismatch | https://visitsavinjska.com/ljubno-ob-savinji/ @ ff3057aefda8a190ce852d9240f0c406c27967516fc2b957b969870e5382bfd3 |
| Ljubno ob Savinji |  | trips | blocked-class-or-addresstype | https://www.hribi.net/izhodisce/ljubno_ob_savinji/46.3477/14.8315 @ 1f31857df7d186737626c93bd62be45ee9b23da603f45942edf0d448bf0eb02e; https://www.hribi.net/izlet/ljubno_ob_savinji_koca_na_travniku/3/489/3391 @ 9fb3bccb184726f2f001f305401c2181397b9a39f6fef0dbfa110ea2fd9c0079; https://www.hribi.net/izlet/ljubno_ob_savinji_planina_mali_travnik/3/1236/3390 @ a19e894e6dc2d32c351feb92d97ecaa545ad07cd7ae057312f717279095ccbde; https://www.hribi.net/izlet/ljubno_ob_savinji_sveti_primoz_nad_ljubnim/3/617/3389 @ 80567f52cb82d7aeaf23f57190e5a7378886df14827c4c66896d1b026233e077; https://www.hribi.net/izlet/ljubno_ob_savinji_veliki_travnik_turnovka/3/488/3392 @ de28ecd1bd6a24362839bcf12a9bd7102e481fb5c59c9050ef36d0595e001748 |
| Lovrenška jezera |  | sights | duration-ceiling | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Lovska koča nad Gorenjo Brezovico |  | hike | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a; https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Mali Hrib |  | sights | road-distance-ceiling | https://www.hribi.net/spletna_kamera/mali_hrib/5024 @ e1684d0aa94c976a796044cf43d7209c7a618c48010082c153d155b6fa8860d9 |
| Mali Travnik |  | hike | duration-ceiling | https://www.hribi.net/izlet/ljubno_ob_savinji_planina_mali_travnik/3/1236/3390 @ a19e894e6dc2d32c351feb92d97ecaa545ad07cd7ae057312f717279095ccbde |
| Mallnitz |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Martuljška slapova |  | sights | no-results | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Mašin žaga |  | hike | no-results | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Medvedjak |  | trips | road-distance-ceiling | https://www.hribi.net/spletna_kamera/golte/34 @ b684298cddd141cf304cc2de0dda5a3f9e9ffa2f7bb2e58c96a2a380d386b588; https://www.hribi.net/spletna_kamera/golte/34 @ b684298cddd141cf304cc2de0dda5a3f9e9ffa2f7bb2e58c96a2a380d386b588 |
| Menina planina | Gornji Grad | hike | no-results | https://visitsavinjska.com/gornji-grad/ @ 2a263b1c2bedaff0b2dab85da0fedc92dd5f62638e9911f32a5c8c393e4f6527; https://visitsavinjska.com/gornjegrajska-katedrala/ @ 7e64a6dc9ce2087e501b8c8cfae8ad1e9d15e02464bdc265462d60697dc4d8a4 |
| Mlinščica |  | sights | equally-plausible | https://www.luce.si/objava/1162910 @ 978dd1be2bf5895d63bf80f454082ffc6a78e92b929953f619b30aeeb00bf6d1 |
| Mojstrovko |  | hike | name-mismatch | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Molička planina |  | hike | no-results | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65; https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Most CENK | Solčava | sights | no-results | https://www.solcava.si/objava/1243684 @ 212cf67b049d79a73056561e5571a90452c41921bab1721e278ae4db233daa10 |
| Mozirje |  | trips | no-results | https://visitsavinjska.com/360-stopinjski-posnetek-muzejske-zbirke-v-mozirju/ @ a90a949b9cd9ee2f324bd041e9a4acf7d204ec38cde0a2da4c7d3913fffc128e |
| Mozirje in Mozirjani, mozirska muzejska zbirka | Mozirje | sights | no-results | https://visitsavinjska.com/mozirje/ @ 8346111718967f78ebeb6f3ff0ba1ace2a9c61cd977ec55f78c8cf6dd8ec0a24 |
| Muzej gozdarstva in lesarstva Nazarje |  | sights | name-mismatch | https://nazarje.si/ @ 6d2ebde154f34632bba36d84c186ad927c6a803bb61718326234a5d99dc5fc2f; https://nazarje.si/acts @ ed5c1160a476d95acc0369d0ff437ca53d9d5bad21d90a6f43fed710761702e5; https://nazarje.si/dogodki @ bef2f115b058866bdb41205e64b7b6de1ba4e68833d5abba9d28547eb50157f6; https://nazarje.si/gallery @ 3fff598347fc34ff5cceb506cb40f9c6ea84609ac651b7375a5ee5b51ceadba5; https://nazarje.si/gallery/7644 @ f2a18f0506666c7987f89ab3a29bee79c3ecd7ff083c78b94c085a6bde4f6610; https://nazarje.si/gallery/7648 @ cf72160bd238397fbe7bfa0e97eb25535ac8cb99a29ab4cf818f1d77ef9f7764; https://nazarje.si/gallery/7652 @ 5320c1128c9b8ee6c694f1a74e0d98c1564bac3a7d172feeb15cd28632059a1f; https://nazarje.si/gallery/7653 @ bac96a42c09822015eaf14664ef34c14b69f8f23c50000bc9491eb736e42b897 |
| Muzej novejše zgodovine Celje | Celje | sights | no-results | https://mozirje.si/sticisce-treh-generacij/ @ 8dcadbf9e801b0b2cc55e174e1db1f0dc62408c955946ced5d405cef8f104f9b |
| Muzej Štekl |  | sights | no-results | https://visitsavinjska.com/gornjegrajska-katedrala/ @ 7e64a6dc9ce2087e501b8c8cfae8ad1e9d15e02464bdc265462d60697dc4d8a4 |
| Muzejska zbirka Mozirje in Mozirjani | Mozirje | sights | no-results | https://mozirje.si/sticisce-treh-generacij/ @ 8dcadbf9e801b0b2cc55e174e1db1f0dc62408c955946ced5d405cef8f104f9b; https://visitsavinjska.com/360-stopinjski-posnetek-muzejske-zbirke-v-mozirju/ @ a90a949b9cd9ee2f324bd041e9a4acf7d204ec38cde0a2da4c7d3913fffc128e |
| MUZEJSKE ZBIRKE LJUBNO |  | sights | no-results | https://www.ljubno.si/ViriRSS @ 8d8aded095a3c1581b67376d93d77f3d1c865f3ff87ce3c5fba77850d693066c |
| Naravoslovna pot Tičjak | Gornji Grad | hike | no-results | https://visitsavinjska.com/gornji-grad/ @ 2a263b1c2bedaff0b2dab85da0fedc92dd5f62638e9911f32a5c8c393e4f6527; https://visitsavinjska.com/gornjegrajska-katedrala/ @ 7e64a6dc9ce2087e501b8c8cfae8ad1e9d15e02464bdc265462d60697dc4d8a4 |
| Naturplac Na skali | Ljubno | food | no-results | https://visitsavinjska.com/ljubno-ob-savinji/ @ a02471554d97f64d16ca16260b4fc3caa7426c0ac04cd1b017731f932964aac6 |
| Nove vasi |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Ojstrice |  | hike | no-results | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Okrepčevalnica pod Smrekco | Konjski Vrh | food | no-results | https://www.luce.si/ @ b9f7b14bd28ca68e19fdd0f4b2803ea50e71033abd54ffd463555d52ae41e176 |
| Orožnove koče na planini za Liscem |  | hike | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Osp |  | sights | hard-ceiling | https://www.hribi.net/mali_oglasi @ b3722f30a1c79598d315e485e34ebab3629d14cbdf3cf2eb996d5807a824b59a |
| Pakleni otoki |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Peca |  | hike | duration-ceiling | https://www.hribi.net/ @ 563fb00eaf29c625b97eefc159c363431a5eb97f5a2fc3029141598b24761625; https://www.hribi.net/spletna_kamera/crna_na_koroskem_center/5228 @ eb8d09b4dd0df0f9ecab3464691a5154269dcbdbbb5ce2a22095a2c874353c75; https://www.hribi.net/spletna_kamera/crna_na_koroskem_smucisce_crna/5229 @ 8ae80b68b59910e886094f5fa56447fdf2e8b6a77845cdcb7ad059e126a98419; https://www.hribi.net/spletna_kamera/crna_na_koroskem/1461 @ e2f03bc5f6d3169564b6ba495330b87e4412a136607e66337013911a23743c3c; https://www.hribi.net/panorama/360/smrekovec/485 @ fb788ad597f48120c4e67282102ea2b28aa5701f46cafa06d85ab1878f5b110c; https://www.hribi.net/spletna_kamera/peca/11 @ cb89aa90a3dab8209fce0582fed8b6cd8e180327e3e6f94073ac66a0e7ea3cd1; https://www.hribi.net/vreme_gora/smrekovec/3/485 @ ad7db7e4797b43f023b2d6f3a440aaf0cb0d3290ba33db66df38c6bbd4aa7c8b |
| Penzion Na razpotju |  | food | name-mismatch | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Pikino otroško igrišče | Velenje | act | no-results | https://visitsavinjska.com/37-pikin-festival/ @ 1a9eddd8f8afaac2a1ee80062c6f6e2d4a8ab99ed3260d2c6203418b17248395 |
| planina Jasenje |  | hike | no-results | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Planina Mali Travnik |  | hike | no-results | https://www.hribi.net/izlet/ljubno_ob_savinji_planina_mali_travnik/3/1236/3390 @ a19e894e6dc2d32c351feb92d97ecaa545ad07cd7ae057312f717279095ccbde |
| Planina Zgornja Dolga njiva |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Planino Zgornja Dolga njiva |  | hike | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Planinska koča Mrzl'k |  | hike | duration-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a; https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Planinski dom Smrekovec |  | hike | no-results | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Podbrdo |  | sights | duration-ceiling | https://www.hribi.net/gps.asp @ b11de0b2e81e48d1ee500d7a6127a2803a322d591b766748361388268be6f1e7 |
| Podpeči |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Polhograjska Grmada |  | hike | duration-ceiling | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Poljana | Poljana | sights | duration-ceiling | https://www.hribi.net/spletna_kamera/poljana/2242 @ fc4df9e4f0b49745e4799504fcb408a30acc48ebf4b389b530ae6da50a530228; https://www.hribi.net/vreme_gora/smrekovec/3/485 @ ad7db7e4797b43f023b2d6f3a440aaf0cb0d3290ba33db66df38c6bbd4aa7c8b |
| Pot Karla in Žige Zoisa |  | hike | no-results | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65; https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Pot po Golteh | Mozirje | hike | no-results | https://visitsavinjska.com/mozirje/ @ 8346111718967f78ebeb6f3ff0ba1ace2a9c61cd977ec55f78c8cf6dd8ec0a24 |
| Pot po Golteh (Zajček, krožna pot) | Mozirje | hike | no-results | https://visitsavinjska.com/krajinski-park-golte/ @ d62a4f8e197a760206a7f780568414251d3e1319579aaa37b1a2d74e06ddabd6 |
| Pot sedmih slapov |  | trips | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a; https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Pravljični gozd | Solčava | sights | name-mismatch | https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ @ 5ffb825fe50f99b7c25d8309d073529fac3d78a5703933c180bddd43d0db78bb |
| pravljični gozd pri penzionu Na razpotju | Solčava | act | no-results | https://visitsavinjska.com/logarska-dolina-in-krajinski-parki/ @ 28417c0b68f5966be4d7f52001cecb71a817cf4ffdbc349ec57bc4b9c1e2bf81 |
| Prelaz Črnivec |  | trips | no-results | https://www.hribi.net/spletna_kamera/prelaz_crnivec/3633 @ c96b34f4178a6a03b992cf8575fb39761b686713f85635431a4f96cb29202830 |
| Prelaz Vršič |  | hike | road-distance-ceiling | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| prelaza Črnivec |  | sights | no-results | https://www.hribi.net/iskalnik_izletov @ dba25534b53968f8e874c86baba71ccf517eefc11a25260af8deb9df1e0b7724 |
| Preserje |  | sights | duration-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Primož pri Ljubnem |  | trips | road-distance-ceiling | https://www.hribi.net/izhodisce/primoz_pri_ljubnem/46.36850/14.81740 @ 87cf3d1bcc7c8f401c8095c8fb2fd1110975ecc7d5d60baf7c7e287fafb6d33d |
| Pristajališče Braslovče |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Pristajališče Log pod Mangartom |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Pristajališče Radegunda |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Pristajališče Radmirje |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Pristajališče Žekovec |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Pustolovski park Golte | Mozirje | act | no-results | https://visitsavinjska.com/krajinski-park-golte/ @ d62a4f8e197a760206a7f780568414251d3e1319579aaa37b1a2d74e06ddabd6 |
| Rab |  | sights | hard-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Radegunda |  | sights | no-results | https://www.hribi.net/spletna_kamera/radegunda/2167 @ ef461f31bfb9dd04655b8ccf26db1cdc8e15392567fda18f0dd0c5a16eb1b51d; https://www.hribi.net/spletna_kamera/radegunda/2167 @ ef461f31bfb9dd04655b8ccf26db1cdc8e15392567fda18f0dd0c5a16eb1b51d; https://www.hribi.net/vreme_gora/smrekovec/3/485 @ ad7db7e4797b43f023b2d6f3a440aaf0cb0d3290ba33db66df38c6bbd4aa7c8b |
| Radmirska zakladnica |  | sights | no-results | https://visitsavinjska.com/ljubno-ob-savinji/ @ ff3057aefda8a190ce852d9240f0c406c27967516fc2b957b969870e5382bfd3; https://visitsavinjska.com/ljubno-ob-savinji/ @ a02471554d97f64d16ca16260b4fc3caa7426c0ac04cd1b017731f932964aac6 |
| Raduha (Struge) |  | trips | blocked-class-or-addresstype | https://www.hribi.net/izhodisce/raduha_struge/46.36572/14.77337 @ 9b76a04e265c452e1ac978542516437459f9cd3e49e8d9ea9107067751540337 |
| Rečica ob Savinji |  | trips | name-mismatch | https://visitsavinjska.com/de/recica-ob-savinji-3/ @ ef02da483054e0321b4fba76c389ba29b63a06061e0300213733515535698ae3 |
| reka Kolpa |  | sights | name-mismatch | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65; https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Reka Savinja |  | sights | name-mismatch | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| restavracija Hotela Montis Golte |  | food | no-results | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Robanova planšarija |  | hike | no-results | https://visitsavinjska.com/krajinski-park-robanov-kot/ @ 040842d7f9e76af10328bffe1ed4690482b8c862c814d85feea795cbae367e53; https://visitsavinjska.com/krajinski-park-robanov-kot/ @ 35f86f0bb6d0b966c9fffc3e748e6357fdbe42ee5f8fb79c95f542f1ab8cc29f |
| Roblekov dom na Begunjščici |  | hike | duration-ceiling | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Rojstna hiša Blaža Arniča |  | sights | no-results | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| Rollercoaster zipline | Mozirje | act | no-results | https://visitsavinjska.com/krajinski-park-golte/ @ d62a4f8e197a760206a7f780568414251d3e1319579aaa37b1a2d74e06ddabd6 |
| Saharo |  | sights | blocked-class-or-addresstype | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Samostan Nazarje |  | sights | no-results | https://nazarje.si/ @ 6d2ebde154f34632bba36d84c186ad927c6a803bb61718326234a5d99dc5fc2f |
| Seceda |  | sights | hard-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a; https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Skala |  | hike | road-distance-ceiling | https://www.hribi.net/ @ 563fb00eaf29c625b97eefc159c363431a5eb97f5a2fc3029141598b24761625 |
| slap Palenk |  | sights | name-mismatch | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| slap Rinke |  | sights | no-results | https://visitsavinjska.com/kamnisko-savinjske-alpe/ @ e122400ab80396c543ddd7eb5786cd184fbf3dce7ffd37dca129014c679b716e |
| Slovenskih Konjic |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Smrekovec | Ljubno ob Savinji | hike | duration-ceiling | https://visitsavinjska.com/en/ljubno-ob-savinji-2/ @ 36eee4145dfbf1f046ed3737ef52b63da7ab75fce74666fd8228cf33bed1da14; https://visitsavinjska.com/ljubno-ob-savinji/ @ ff3057aefda8a190ce852d9240f0c406c27967516fc2b957b969870e5382bfd3; https://visitsavinjska.com/ljubno-ob-savinji/ @ a02471554d97f64d16ca16260b4fc3caa7426c0ac04cd1b017731f932964aac6; https://www.hribi.net/gora/smrekovec/3/485 @ eb9f28c8a362f8b659e56d780457d53029d588572ee4e1059ebce99ba4e95cdc; https://www.hribi.net/izlet/andrejev_dom_na_slemenu_smrekovec/3/485/3570 @ ed4de0ee28924df4d3b70247ab526afc086fb76b05d1c2944e379c03aeaee816; https://www.hribi.net/izlet/atelsko_sedlo_smrekovec/3/485/9797 @ f080e8288899392c1f146da0fa67cc0d4a3374a9de77ed04a1830606e13cd294; https://www.hribi.net/izlet/bele_vode_rebrsak_smrekovec/3/485/1466 @ 0d429c4ce2cb265a2962e5baed42de7976e4f90fe397d22e73f5a979f7a2d400; https://www.hribi.net/izlet/dom_na_smrekovcu_smrekovec/3/485/818 @ 7fb9357da7de3cd70fc3e277c652d60c380edcb7065bd77b5a076a27c5d0e6e1; https://www.hribi.net/izlet/golte_alpski_vrt_smrekovec/3/485/9783 @ 357a1952a507fe1a06a0834919ab7fd070ac5ef3b17e0407926d9b98028782a5; https://www.hribi.net/izlet/izvir_ljubije_smrekovec_po_cesti/3/485/5888 @ af1b212a2a1d89a6f24091ba671cb2bd3d3846ed3d25acf8aeab4e95301abe15; https://www.hribi.net/izlet/izvir_ljubije_smrekovec_preko_leskovskove_pustote/3/485/5886 @ c3b570320992c16a916089b7551cf35f97a5112dd63c15b08c85876b22d21d12; https://www.hribi.net/izlet/javorje_mala_crna_smrekovec_cez_bukov_stan/3/485/10364 @ cd52016affb511f1ea1c1ac14538ce09930f390a581a57d52c85386676508392; https://www.hribi.net/izlet/javorje_mala_crna_smrekovec_po_cesti/3/485/10365 @ 103841b1628c62794d1a38db2601b3b7756c2339439a265207364021b558dccf; https://www.hribi.net/izlet/kramarica_smrekovec_cez_bukov_stan/3/485/3572 @ 727a58ba781a647b14026fea42e7e927498a0a6141669996542c5d1e71dbd7ea; https://www.hribi.net/izlet/kramarica_smrekovec_po_cesti/3/485/3574 @ 6ca1d18219d061d25c2faff6f347b502590b5de5d9350bb8487e7da2f5b5abe5; https://www.hribi.net/izlet/ljubenske_rastke_kumprej_smrekovec/3/485/6151 @ 2e6738a3e9575af801314ffd1a4209504fe131b7ff89ac4a36ce09cc5009592d; https://www.hribi.net/izlet/ljubenske_rastke_vrnivsek_smrekovec/3/485/6150 @ 81370fabc04c4545b9dc3f8a0487e6a0d19ecf8a89f2e94125289f2cf4c1d170; https://www.hribi.net/panorama/360/smrekovec/485 @ fb788ad597f48120c4e67282102ea2b28aa5701f46cafa06d85ab1878f5b110c; https://www.hribi.net/slika_gora/smrekovec/1283 @ 00debe431be588a823eced703af51eaf43d5c1e0bcd50a9ab7f049c933b2ee9a; https://www.hribi.net/slika_gora/smrekovec/14521 @ f263c42847c830e209c80ac13f6d0a1b9247339b692e68e1d0e1dcf18a329158; https://www.hribi.net/slika_gora/smrekovec/14577 @ 274f8ff68189d30f30771ddd2074704ea12e527ef9a3259ebbb13fe3d8e007e0; https://www.hribi.net/slika_gora/smrekovec/2738 @ e1ccc80f8536b2a50094a3c4c8157781078f9eca80db559982bad8a04759aef2; https://www.hribi.net/slika_gora/smrekovec/9260 @ 6deda96b4663109a1130d2cacd9444f910beef24c61d67e660d69577d32c4e97; https://www.hribi.net/slika_gora/smrekovec/9261 @ cf0900cfeb33170948b2c69531cbc1e16e3e10f66b724bb6f145ffb05e734826; https://www.hribi.net/vpisna_knjiga_vrhov/?id=485 @ 090fa959171561700f2ea413321bdccef07a28fd1077be79ebb8d91d0c17d699 |
| Smučišče Golte | Mozirje | act | no-results | https://visitsavinjska.com/mozirje/ @ 8346111718967f78ebeb6f3ff0ba1ace2a9c61cd977ec55f78c8cf6dd8ec0a24 |
| Solčava |  | sights | no-results | https://www.hribi.net/spletna_kamera/solcava/5080 @ b835a19023be1047801526556461c8d384b4f2715a184b9a7433359cb5cb995e |
| Soteska Brložnice | Podvolovljek | sights | no-results | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| soteska Samaria |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Spodnja Dolga njiva |  | hike | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Spodnje Hudinje |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Spomeniki, grobišča in spominska obeležja NOB |  | sights | no-results | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| Stegovnik |  | hike | duration-ceiling | https://www.hribi.net/ @ 563fb00eaf29c625b97eefc159c363431a5eb97f5a2fc3029141598b24761625 |
| Sveti Križ (Križna Gora) |  | hike | no-results | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Sveti nadangel Gabrijel (Planica) |  | hike | no-results | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Sveti Primož nad Ljubnim |  | hike | no-results | https://www.hribi.net/izlet/ljubno_ob_savinji_sveti_primoz_nad_ljubnim/3/617/3389 @ 80567f52cb82d7aeaf23f57190e5a7378886df14827c4c66896d1b026233e077 |
| Sveto Ano |  | hike | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Škofje vasi |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Škol nad Ajdovščino | Ajdovščina | hike | no-results | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Špik |  | hike | road-distance-ceiling | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65; https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Špiku |  | hike | name-mismatch | https://www.hribi.net/najslike.asp @ 1858290b75b82eb60e1e8831647be25f04d617857053f2b0ec5fd8c084d7143d |
| Špitalič |  | sights | no-results | https://www.hribi.net/spletna_kamera/spitalic/5086 @ 4ec25849f8965594c693b12f18c4797418a230d5af0256d8d802555e132a3886 |
| Športni center Luče |  | act | name-mismatch | https://www.luce.si/ @ b9f7b14bd28ca68e19fdd0f4b2803ea50e71033abd54ffd463555d52ae41e176; https://www.luce.si/dogodki @ bfc62bda9f523f8037ce031f093d28ff1b479c2cdf28baaef5d6e420aa0fae4c; https://www.luce.si/gallery @ 0958cf1c59c429b7f2478c9112e559fd8585ecd2d81e748f68d31295573bce60; https://www.luce.si/imenik @ ba765d48f0efce613916e1ffffc0b3e44d9a60a6ba3805f3dba1b73e7f4b5494; https://www.luce.si/katalogjavnegaznacaja @ 2b8207e535b2a67f2d6bbe7cd41d449438e7f281e7d0ff7a31b8fb9518c31e06; https://www.luce.si/objava/1037877 @ 328fe866da1ae93fb25f5c2eeb5d959d9c46b9c529ed4eac1ee64feaae588f81; https://www.luce.si/objava/104110 @ 555eb41a4d465e496da2a83c911857abba0bfa419e0e7f865304cc2d5c88cda4; https://www.luce.si/objava/1113309 @ f4620f2fac5cfa806634bf7a730d931a2383985d6196a05ec05c0f08e2743db8; https://www.luce.si/objava/1162910 @ 978dd1be2bf5895d63bf80f454082ffc6a78e92b929953f619b30aeeb00bf6d1; https://www.luce.si/objava/1189648 @ 7d0e5a78bce35e7aa0aca71359d79cc790f3d8e386c8a3b1886f93c92e48d0c3; https://www.luce.si/Razpisi @ 86498f68e6dc6e673f684118298b407fb47b7248321ead9dea296ae3bf5241cc; https://www.luce.si/Registracija @ 80e5a0fd5d8cc79282f203c964a42ade85baae9b1e677d47886ebd105152eb62; https://www.luce.si/TermsAndConditions @ caa115f44bdba709d4ca411ccd752c69406c54ac68ad5e0383b1984b3a3aed29; https://www.luce.si/ViriRSS @ 8f58c9a6d168137aadbd241d4221dd6baf9da495f0428ea9585f8eea5e927691 |
| TIC Gornji Grad | Gornji Grad | sights | no-results | https://visitsavinjska.com/informacije-savinjska/ @ 01d77786900cf681b682c3929146afcdfe7d90df007be0e227c7075e8e0ec42b |
| TIC Ljubno ob Savinji | Ljubno ob Savinji | sights | no-results | https://visitsavinjska.com/informacije-savinjska/ @ 01d77786900cf681b682c3929146afcdfe7d90df007be0e227c7075e8e0ec42b |
| TIC Luče | Luče | sights | no-results | https://visitsavinjska.com/informacije-savinjska/ @ 01d77786900cf681b682c3929146afcdfe7d90df007be0e227c7075e8e0ec42b |
| TIC Mozirje | Mozirje | sights | no-results | https://visitsavinjska.com/informacije-savinjska/ @ 01d77786900cf681b682c3929146afcdfe7d90df007be0e227c7075e8e0ec42b |
| TIC Nazarje | Nazarje | sights | no-results | https://visitsavinjska.com/informacije-savinjska/ @ 01d77786900cf681b682c3929146afcdfe7d90df007be0e227c7075e8e0ec42b |
| TIC Šmartno ob Paki | Šmartno ob Paki | sights | no-results | https://visitsavinjska.com/informacije-savinjska/ @ 01d77786900cf681b682c3929146afcdfe7d90df007be0e227c7075e8e0ec42b |
| TIC Velenje (Šaleška dolina) | Velenje | sights | no-results | https://visitsavinjska.com/informacije-savinjska/ @ 01d77786900cf681b682c3929146afcdfe7d90df007be0e227c7075e8e0ec42b |
| Titov trg | Velenje | sights | blocked-class-or-addresstype | https://visitsavinjska.com/37-pikin-festival/ @ 1a9eddd8f8afaac2a1ee80062c6f6e2d4a8ab99ed3260d2c6203418b17248395 |
| Toubkal |  | sights | hard-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a; https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Travnik |  | hike | road-distance-ceiling | https://www.hribi.net/izlet/javorje_mala_crna_smrekovec_cez_bukov_stan/3/485/10364 @ cd52016affb511f1ea1c1ac14538ce09930f390a581a57d52c85386676508392; https://www.hribi.net/izlet/javorje_mala_crna_smrekovec_po_cesti/3/485/10365 @ 103841b1628c62794d1a38db2601b3b7756c2339439a265207364021b558dccf |
| Trbiška zijavka |  | sights | no-results | https://visitluce.si/vredno-ogleda/ @ 8228bdfb171ff82308286b2f4a6054347661d85e4689c05e5642e8869e752d6c |
| Trdinov vrh |  | hike | road-distance-ceiling | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Tre Cime |  | sights | hard-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a; https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Triglav |  | hike | duration-ceiling | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65; https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Tromostovju |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Tržiču |  | sights | name-mismatch | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Turistična kmetija Visočnik |  | food | no-results | https://visitsavinjska.com/kolesarjenje/ @ dedc315361c6f4282860b089e1dee550fe22c406d3ea47cb5c79edf37c77bade |
| Turistični kmetiji Govc Vršnik |  | food | no-results | https://visitsavinjska.com/krajinski-park-robanov-kot/ @ 35f86f0bb6d0b966c9fffc3e748e6357fdbe42ee5f8fb79c95f542f1ab8cc29f |
| Uršlja gora |  | hike | duration-ceiling | https://www.hribi.net/panorama/360/smrekovec/485 @ fb788ad597f48120c4e67282102ea2b28aa5701f46cafa06d85ab1878f5b110c; https://www.hribi.net/spletna_kamera/urslja_gora/1026 @ f0fd1927062b9cede63967d7a313243a461de026bab75b89dff83f5b46c82cbd; https://www.hribi.net/vreme_gora/smrekovec/3/485 @ ad7db7e4797b43f023b2d6f3a440aaf0cb0d3290ba33db66df38c6bbd4aa7c8b |
| Valvasorjev dom pod Stolom |  | hike | duration-ceiling | https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7; https://www.hribi.net/vpisna_knjiga_vrhov @ 8c79d8c611ffcaec0fc57c2dd2663a0edfabe42a21564832c88879208c8009c7 |
| Veliki dvojni kozolec toplar |  | sights | no-results | https://nazarje.si/ @ 6d2ebde154f34632bba36d84c186ad927c6a803bb61718326234a5d99dc5fc2f |
| Veliki Rogatec |  | hike | duration-ceiling | https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65; https://www.hribi.net/video/ @ 86c6e77279027668232a48c69ee562218fa0e28b8a43bc6c4d854f2173e3bb65 |
| Veliki Travnik (Turnovka) |  | hike | name-mismatch | https://www.hribi.net/izlet/ljubno_ob_savinji_veliki_travnik_turnovka/3/488/3392 @ de28ecd1bd6a24362839bcf12a9bd7102e481fb5c59c9050ef36d0595e001748 |
| Vnanjih Goricah |  | sights | no-results | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Volneni in filcani izdelki MF |  | sights | no-results | https://visitluce.si/lokalno/ @ 92750eaa8251f353d19e5e25d6e433151dbd6667125f832667c5b2c897fd89ff |
| Vršiča |  | sights | duration-ceiling | https://www.hribi.net/iskalnik_izletov @ dba25534b53968f8e874c86baba71ccf517eefc11a25260af8deb9df1e0b7724 |
| Vzletišče Dobrovlje |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Vzletišče Golte – Boskovec |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Vzletišče Golte – Jugovi travniki |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Vzletišče Golte – Medvedjak |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Vzletišče Golte – Planica |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Vzletišče Golte – Stari Stani |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Vzletišče Velika Planina – Gradišče |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Vzletišče Vinska Gora |  | act | no-results | https://visitsavinjska.com/jadralno-padalstvo-v-savinjski-in-saleski-dolini/ @ d5bb5283f8f2508872e4ee0b88677e70b035ccd966277a8fc5ffee039dd1e385 |
| Zavodnje | Zavodnje | sights | no-results | https://www.hribi.net/spletna_kamera/zavodnje/5079 @ e996d445279cbd36f0a61230a700ba446bac8323c60caf19400cd5b3429f2cac; https://www.hribi.net/vreme_gora/smrekovec/3/485 @ ad7db7e4797b43f023b2d6f3a440aaf0cb0d3290ba33db66df38c6bbd4aa7c8b |
| Zbirka Aleksandra Videčnika |  | sights | no-results | https://visitsavinjska.com/360-stopinjski-posnetek-muzejske-zbirke-v-mozirju/ @ a90a949b9cd9ee2f324bd041e9a4acf7d204ec38cde0a2da4c7d3913fffc128e |
| Zbirka cvetnonedeljskih butaric | Ljubno | sights | no-results | https://visitsavinjska.com/kongresi-seminarji-in-konference/ @ 93984aad28735d93355788317e15ac317f0e8b9508f0e1efca00b797af2eb579 |
| Zugspitze |  | sights | hard-ceiling | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a; https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Žalcu |  | sights | name-mismatch | https://www.hribi.net/prireditve.asp @ 15fec2cca007aadb5854b00615bdc9fe573beeda042d4ee4c84818434bf6e29a |
| Žrebetovi drči |  | sights | no-results | https://www.hribi.net/izlet/izvir_ljubije_smrekovec_po_cesti/3/485/5888 @ af1b212a2a1d89a6f24091ba671cb2bd3d3846ed3d25acf8aeab4e95301abe15 |

## Nominatim attempt log

| Start | Complete | Attempt | HTTP | Error | Backoff (ms) |
|---|---|---:|---:|---|---:|
| 2026-09-01T07:26:39.928Z | 2026-09-01T07:26:40.163Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:40.929Z | 2026-09-01T07:26:41.020Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:41.930Z | 2026-09-01T07:26:42.086Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:42.930Z | 2026-09-01T07:26:43.090Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:43.931Z | 2026-09-01T07:26:44.420Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:44.932Z | 2026-09-01T07:26:45.444Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:45.932Z | 2026-09-01T07:26:46.006Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:46.932Z | 2026-09-01T07:26:47.406Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:47.933Z | 2026-09-01T07:26:48.384Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:48.933Z | 2026-09-01T07:26:49.150Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:49.934Z | 2026-09-01T07:26:50.197Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:50.934Z | 2026-09-01T07:26:51.070Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:51.935Z | 2026-09-01T07:26:52.469Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:52.934Z | 2026-09-01T07:26:53.087Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:53.936Z | 2026-09-01T07:26:54.366Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:54.936Z | 2026-09-01T07:26:55.111Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:55.936Z | 2026-09-01T07:26:56.071Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:56.936Z | 2026-09-01T07:26:57.429Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:57.935Z | 2026-09-01T07:26:58.131Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:58.935Z | 2026-09-01T07:26:59.425Z | 1 | 200 |  | 0 |
| 2026-09-01T07:26:59.935Z | 2026-09-01T07:27:00.048Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:00.935Z | 2026-09-01T07:27:01.405Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:01.936Z | 2026-09-01T07:27:02.469Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:02.937Z | 2026-09-01T07:27:03.430Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:03.964Z | 2026-09-01T07:27:04.227Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:04.965Z | 2026-09-01T07:27:05.494Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:05.965Z | 2026-09-01T07:27:06.166Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:06.965Z | 2026-09-01T07:27:07.479Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:07.965Z | 2026-09-01T07:27:08.503Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:08.966Z | 2026-09-01T07:27:09.038Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:09.966Z | 2026-09-01T07:27:10.190Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:10.966Z | 2026-09-01T07:27:11.441Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:11.969Z | 2026-09-01T07:27:12.441Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:12.969Z | 2026-09-01T07:27:13.147Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:13.970Z | 2026-09-01T07:27:14.042Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:14.971Z | 2026-09-01T07:27:15.442Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:15.971Z | 2026-09-01T07:27:16.424Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:16.972Z | 2026-09-01T07:27:17.423Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:17.973Z | 2026-09-01T07:27:18.195Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:18.975Z | 2026-09-01T07:27:19.067Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:19.975Z | 2026-09-01T07:27:20.447Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:20.976Z | 2026-09-01T07:27:21.212Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:21.977Z | 2026-09-01T07:27:22.447Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:22.976Z | 2026-09-01T07:27:23.447Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:23.976Z | 2026-09-01T07:27:24.449Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:24.976Z | 2026-09-01T07:27:25.070Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:25.976Z | 2026-09-01T07:27:26.463Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:26.976Z | 2026-09-01T07:27:27.067Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:27.977Z | 2026-09-01T07:27:28.469Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:28.978Z | 2026-09-01T07:27:29.477Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:29.978Z | 2026-09-01T07:27:30.446Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:30.978Z | 2026-09-01T07:27:31.430Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:31.978Z | 2026-09-01T07:27:32.450Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:32.977Z | 2026-09-01T07:27:33.452Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:33.977Z | 2026-09-01T07:27:34.113Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:34.979Z | 2026-09-01T07:27:35.455Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:35.979Z | 2026-09-01T07:27:36.137Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:36.980Z | 2026-09-01T07:27:37.493Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:37.980Z | 2026-09-01T07:27:38.071Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:38.981Z | 2026-09-01T07:27:39.202Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:39.982Z | 2026-09-01T07:27:40.093Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:40.984Z | 2026-09-01T07:27:41.620Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:41.984Z | 2026-09-01T07:27:42.619Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:43.139Z | 2026-09-01T07:27:43.313Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:44.140Z | 2026-09-01T07:27:44.318Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:45.141Z | 2026-09-01T07:27:45.628Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:46.141Z | 2026-09-01T07:27:46.629Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:47.142Z | 2026-09-01T07:27:47.317Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:48.142Z | 2026-09-01T07:27:48.612Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:49.143Z | 2026-09-01T07:27:49.656Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:50.142Z | 2026-09-01T07:27:50.319Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:51.143Z | 2026-09-01T07:27:51.633Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:52.143Z | 2026-09-01T07:27:52.382Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:53.143Z | 2026-09-01T07:27:53.238Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:54.143Z | 2026-09-01T07:27:54.636Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:55.143Z | 2026-09-01T07:27:55.632Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:56.142Z | 2026-09-01T07:27:56.237Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:57.142Z | 2026-09-01T07:27:57.359Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:58.143Z | 2026-09-01T07:27:58.654Z | 1 | 200 |  | 0 |
| 2026-09-01T07:27:59.144Z | 2026-09-01T07:27:59.777Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:00.145Z | 2026-09-01T07:28:00.654Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:01.146Z | 2026-09-01T07:28:01.321Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:02.146Z | 2026-09-01T07:28:02.223Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:03.146Z | 2026-09-01T07:28:03.238Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:04.147Z | 2026-09-01T07:28:04.218Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:05.147Z | 2026-09-01T07:28:05.690Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:06.148Z | 2026-09-01T07:28:06.623Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:07.149Z | 2026-09-01T07:28:07.646Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:08.149Z | 2026-09-01T07:28:08.240Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:09.149Z | 2026-09-01T07:28:09.618Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:10.149Z | 2026-09-01T07:28:10.634Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:11.149Z | 2026-09-01T07:28:11.368Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:12.150Z | 2026-09-01T07:28:12.786Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:13.150Z | 2026-09-01T07:28:13.412Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:14.150Z | 2026-09-01T07:28:14.326Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:15.152Z | 2026-09-01T07:28:15.683Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:16.152Z | 2026-09-01T07:28:16.888Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:17.410Z | 2026-09-01T07:28:17.943Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:18.411Z | 2026-09-01T07:28:18.629Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:19.411Z | 2026-09-01T07:28:19.504Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:20.411Z | 2026-09-01T07:28:20.609Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:21.413Z | 2026-09-01T07:28:22.043Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:22.413Z | 2026-09-01T07:28:22.511Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:23.414Z | 2026-09-01T07:28:23.928Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:24.414Z | 2026-09-01T07:28:24.589Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:25.416Z | 2026-09-01T07:28:26.458Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:26.500Z | 2026-09-01T07:28:27.440Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:28.291Z | 2026-09-01T07:28:28.405Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:29.291Z | 2026-09-01T07:28:29.782Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:30.291Z | 2026-09-01T07:28:30.510Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:31.293Z | 2026-09-01T07:28:31.366Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:32.293Z | 2026-09-01T07:28:32.805Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:33.293Z | 2026-09-01T07:28:33.468Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:34.295Z | 2026-09-01T07:28:34.767Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:35.295Z | 2026-09-01T07:28:35.768Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:36.295Z | 2026-09-01T07:28:36.448Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:37.296Z | 2026-09-01T07:28:37.807Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:38.300Z | 2026-09-01T07:28:38.413Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:39.300Z | 2026-09-01T07:28:39.819Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:40.300Z | 2026-09-01T07:28:40.461Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:41.300Z | 2026-09-01T07:28:41.393Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:42.300Z | 2026-09-01T07:28:42.418Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:43.301Z | 2026-09-01T07:28:43.774Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:44.300Z | 2026-09-01T07:28:44.836Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:45.353Z | 2026-09-01T07:28:45.887Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:46.352Z | 2026-09-01T07:28:46.804Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:47.352Z | 2026-09-01T07:28:47.867Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:48.352Z | 2026-09-01T07:28:48.822Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:49.353Z | 2026-09-01T07:28:49.824Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:50.353Z | 2026-09-01T07:28:50.823Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:51.353Z | 2026-09-01T07:28:51.526Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:52.355Z | 2026-09-01T07:28:52.485Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:53.355Z | 2026-09-01T07:28:53.822Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:54.356Z | 2026-09-01T07:28:54.554Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:55.356Z | 2026-09-01T07:28:55.845Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:56.356Z | 2026-09-01T07:28:56.470Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:57.356Z | 2026-09-01T07:28:57.474Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:58.357Z | 2026-09-01T07:28:58.865Z | 1 | 200 |  | 0 |
| 2026-09-01T07:28:59.358Z | 2026-09-01T07:28:59.474Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:00.358Z | 2026-09-01T07:29:00.553Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:01.358Z | 2026-09-01T07:29:01.809Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:02.359Z | 2026-09-01T07:29:02.578Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:03.360Z | 2026-09-01T07:29:04.607Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:04.647Z | 2026-09-01T07:29:05.109Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:05.647Z | 2026-09-01T07:29:06.180Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:06.647Z | 2026-09-01T07:29:06.873Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:07.647Z | 2026-09-01T07:29:07.720Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:08.648Z | 2026-09-01T07:29:09.097Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:09.648Z | 2026-09-01T07:29:09.759Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:10.648Z | 2026-09-01T07:29:10.698Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:11.648Z | 2026-09-01T07:29:12.094Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:12.648Z | 2026-09-01T07:29:12.721Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:13.648Z | 2026-09-01T07:29:14.137Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:14.648Z | 2026-09-01T07:29:14.847Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:15.650Z | 2026-09-01T07:29:16.278Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:16.650Z | 2026-09-01T07:29:17.140Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:17.650Z | 2026-09-01T07:29:17.846Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:18.650Z | 2026-09-01T07:29:18.766Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:19.651Z | 2026-09-01T07:29:20.283Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:20.652Z | 2026-09-01T07:29:21.129Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:21.652Z | 2026-09-01T07:29:22.138Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:22.652Z | 2026-09-01T07:29:23.186Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:23.652Z | 2026-09-01T07:29:23.787Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:24.652Z | 2026-09-01T07:29:25.289Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:25.653Z | 2026-09-01T07:29:25.768Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:26.653Z | 2026-09-01T07:29:27.164Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:27.653Z | 2026-09-01T07:29:28.167Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:28.653Z | 2026-09-01T07:29:29.081Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:29.653Z | 2026-09-01T07:29:30.291Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:30.818Z | 2026-09-01T07:29:30.868Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:31.819Z | 2026-09-01T07:29:32.351Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:32.819Z | 2026-09-01T07:29:32.933Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:33.820Z | 2026-09-01T07:29:33.953Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:34.820Z | 2026-09-01T07:29:35.333Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:35.819Z | 2026-09-01T07:29:36.454Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:36.819Z | 2026-09-01T07:29:37.448Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:37.819Z | 2026-09-01T07:29:38.040Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:38.819Z | 2026-09-01T07:29:38.976Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:39.819Z | 2026-09-01T07:29:40.315Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:40.819Z | 2026-09-01T07:29:40.908Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:41.819Z | 2026-09-01T07:29:42.041Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:42.821Z | 2026-09-01T07:29:43.272Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:43.822Z | 2026-09-01T07:29:44.020Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:44.822Z | 2026-09-01T07:29:45.291Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:45.822Z | 2026-09-01T07:29:45.935Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:46.824Z | 2026-09-01T07:29:48.061Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:48.105Z | 2026-09-01T07:29:48.550Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:49.105Z | 2026-09-01T07:29:49.556Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:50.105Z | 2026-09-01T07:29:50.600Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:51.106Z | 2026-09-01T07:29:51.567Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:52.106Z | 2026-09-01T07:29:52.342Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:53.106Z | 2026-09-01T07:29:53.646Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:54.106Z | 2026-09-01T07:29:54.410Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:55.106Z | 2026-09-01T07:29:55.616Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:56.105Z | 2026-09-01T07:29:56.640Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:57.105Z | 2026-09-01T07:29:57.553Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:58.105Z | 2026-09-01T07:29:58.555Z | 1 | 200 |  | 0 |
| 2026-09-01T07:29:59.105Z | 2026-09-01T07:29:59.217Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:00.105Z | 2026-09-01T07:30:00.639Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:01.106Z | 2026-09-01T07:30:01.593Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:02.106Z | 2026-09-01T07:30:02.845Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:03.106Z | 2026-09-01T07:30:03.598Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:04.106Z | 2026-09-01T07:30:04.304Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:05.106Z | 2026-09-01T07:30:05.303Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:06.106Z | 2026-09-01T07:30:06.579Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:07.106Z | 2026-09-01T07:30:07.206Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:08.107Z | 2026-09-01T07:30:08.201Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:09.107Z | 2026-09-01T07:30:09.328Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:10.108Z | 2026-09-01T07:30:10.580Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:11.108Z | 2026-09-01T07:30:11.180Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:12.110Z | 2026-09-01T07:30:12.243Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:13.111Z | 2026-09-01T07:30:13.602Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:14.110Z | 2026-09-01T07:30:14.575Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:15.110Z | 2026-09-01T07:30:15.326Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:16.110Z | 2026-09-01T07:30:16.267Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:17.110Z | 2026-09-01T07:30:17.289Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:18.110Z | 2026-09-01T07:30:18.290Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:19.110Z | 2026-09-01T07:30:19.647Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:20.111Z | 2026-09-01T07:30:20.336Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:21.111Z | 2026-09-01T07:30:21.186Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:22.111Z | 2026-09-01T07:30:22.582Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:23.112Z | 2026-09-01T07:30:23.223Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:24.112Z | 2026-09-01T07:30:24.210Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:25.114Z | 2026-09-01T07:30:25.580Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:26.115Z | 2026-09-01T07:30:26.271Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:27.115Z | 2026-09-01T07:30:27.208Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:28.115Z | 2026-09-01T07:30:28.613Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:29.115Z | 2026-09-01T07:30:29.187Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:30.115Z | 2026-09-01T07:30:30.549Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:31.115Z | 2026-09-01T07:30:31.228Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:32.116Z | 2026-09-01T07:30:32.590Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:33.116Z | 2026-09-01T07:30:33.751Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:34.116Z | 2026-09-01T07:30:34.257Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:35.117Z | 2026-09-01T07:30:35.652Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:36.116Z | 2026-09-01T07:30:36.258Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:37.117Z | 2026-09-01T07:30:37.591Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:38.118Z | 2026-09-01T07:30:38.233Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:39.118Z | 2026-09-01T07:30:39.233Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:40.120Z | 2026-09-01T07:30:40.613Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:41.121Z | 2026-09-01T07:30:41.240Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:42.121Z | 2026-09-01T07:30:42.320Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:43.122Z | 2026-09-01T07:30:43.755Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:44.122Z | 2026-09-01T07:30:44.360Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:45.122Z | 2026-09-01T07:30:45.276Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:46.122Z | 2026-09-01T07:30:46.595Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:47.124Z | 2026-09-01T07:30:47.597Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:48.124Z | 2026-09-01T07:30:48.755Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:49.124Z | 2026-09-01T07:30:49.593Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:50.123Z | 2026-09-01T07:30:50.641Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:51.123Z | 2026-09-01T07:30:51.214Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:52.125Z | 2026-09-01T07:30:52.198Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:53.125Z | 2026-09-01T07:30:53.597Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:54.126Z | 2026-09-01T07:30:54.575Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:55.126Z | 2026-09-01T07:30:55.641Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:56.163Z | 2026-09-01T07:30:56.634Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:57.164Z | 2026-09-01T07:30:57.647Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:58.164Z | 2026-09-01T07:30:58.384Z | 1 | 200 |  | 0 |
| 2026-09-01T07:30:59.164Z | 2026-09-01T07:30:59.615Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:00.164Z | 2026-09-01T07:31:00.637Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:01.165Z | 2026-09-01T07:31:01.700Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:02.166Z | 2026-09-01T07:31:02.326Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:03.168Z | 2026-09-01T07:31:03.264Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:04.170Z | 2026-09-01T07:31:04.263Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:05.170Z | 2026-09-01T07:31:05.646Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:06.170Z | 2026-09-01T07:31:06.348Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:07.170Z | 2026-09-01T07:31:07.347Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:08.170Z | 2026-09-01T07:31:08.284Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:09.172Z | 2026-09-01T07:31:09.270Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:10.172Z | 2026-09-01T07:31:10.682Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:11.172Z | 2026-09-01T07:31:11.808Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:12.173Z | 2026-09-01T07:31:12.304Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:13.174Z | 2026-09-01T07:31:13.650Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:14.175Z | 2026-09-01T07:31:14.650Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:15.175Z | 2026-09-01T07:31:15.349Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:16.176Z | 2026-09-01T07:31:16.667Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:17.177Z | 2026-09-01T07:31:17.692Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:18.177Z | 2026-09-01T07:31:19.420Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:19.420Z | 2026-09-01T07:31:20.061Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:20.419Z | 2026-09-01T07:31:20.489Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:21.419Z | 2026-09-01T07:31:21.637Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:22.420Z | 2026-09-01T07:31:22.959Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:23.421Z | 2026-09-01T07:31:23.536Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:24.422Z | 2026-09-01T07:31:24.620Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:25.422Z | 2026-09-01T07:31:25.493Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:26.423Z | 2026-09-01T07:31:26.495Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:27.423Z | 2026-09-01T07:31:27.645Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:28.423Z | 2026-09-01T07:31:28.626Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:29.423Z | 2026-09-01T07:31:29.896Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:30.422Z | 2026-09-01T07:31:30.896Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:31.421Z | 2026-09-01T07:31:31.558Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:32.423Z | 2026-09-01T07:31:32.914Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:33.423Z | 2026-09-01T07:31:33.916Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:34.423Z | 2026-09-01T07:31:34.914Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:35.423Z | 2026-09-01T07:31:35.601Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:36.425Z | 2026-09-01T07:31:36.520Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:37.426Z | 2026-09-01T07:31:37.750Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:38.426Z | 2026-09-01T07:31:38.436Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:39.427Z | 2026-09-01T07:31:39.872Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:40.427Z | 2026-09-01T07:31:41.363Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:41.610Z | 2026-09-01T07:31:41.834Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:42.611Z | 2026-09-01T07:31:43.126Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:43.611Z | 2026-09-01T07:31:43.685Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:44.611Z | 2026-09-01T07:31:45.146Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:45.611Z | 2026-09-01T07:31:46.064Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:46.611Z | 2026-09-01T07:31:47.058Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:47.611Z | 2026-09-01T07:31:48.061Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:48.610Z | 2026-09-01T07:31:49.058Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:49.610Z | 2026-09-01T07:31:50.058Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:50.610Z | 2026-09-01T07:31:50.704Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:51.611Z | 2026-09-01T07:31:52.101Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:52.612Z | 2026-09-01T07:31:53.078Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:53.612Z | 2026-09-01T07:31:54.095Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:54.612Z | 2026-09-01T07:31:54.678Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:55.612Z | 2026-09-01T07:31:56.062Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:56.613Z | 2026-09-01T07:31:57.061Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:57.613Z | 2026-09-01T07:31:58.254Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:58.614Z | 2026-09-01T07:31:58.836Z | 1 | 200 |  | 0 |
| 2026-09-01T07:31:59.614Z | 2026-09-01T07:32:00.077Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:00.614Z | 2026-09-01T07:32:01.090Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:01.614Z | 2026-09-01T07:32:02.249Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:02.614Z | 2026-09-01T07:32:02.665Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:03.615Z | 2026-09-01T07:32:04.128Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:04.614Z | 2026-09-01T07:32:04.837Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:05.614Z | 2026-09-01T07:32:05.686Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:06.614Z | 2026-09-01T07:32:07.151Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:07.614Z | 2026-09-01T07:32:08.123Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:08.654Z | 2026-09-01T07:32:09.123Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:09.654Z | 2026-09-01T07:32:10.167Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:10.654Z | 2026-09-01T07:32:11.127Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:11.654Z | 2026-09-01T07:32:12.146Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:12.653Z | 2026-09-01T07:32:12.850Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:13.654Z | 2026-09-01T07:32:14.131Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:14.653Z | 2026-09-01T07:32:14.731Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:15.653Z | 2026-09-01T07:32:16.145Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:16.654Z | 2026-09-01T07:32:17.121Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:17.653Z | 2026-09-01T07:32:18.102Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:18.653Z | 2026-09-01T07:32:19.124Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:19.654Z | 2026-09-01T07:32:19.729Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:20.655Z | 2026-09-01T07:32:20.923Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:21.655Z | 2026-09-01T07:32:22.125Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:22.655Z | 2026-09-01T07:32:22.769Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:23.655Z | 2026-09-01T07:32:24.187Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:24.656Z | 2026-09-01T07:32:24.908Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:25.656Z | 2026-09-01T07:32:26.004Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:26.656Z | 2026-09-01T07:32:27.108Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:27.655Z | 2026-09-01T07:32:27.748Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:28.655Z | 2026-09-01T07:32:28.768Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:29.656Z | 2026-09-01T07:32:30.146Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:30.656Z | 2026-09-01T07:32:31.499Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:31.656Z | 2026-09-01T07:32:32.188Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:32.657Z | 2026-09-01T07:32:33.129Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:33.657Z | 2026-09-01T07:32:33.713Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:34.659Z | 2026-09-01T07:32:34.754Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:35.659Z | 2026-09-01T07:32:36.139Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:36.659Z | 2026-09-01T07:32:37.111Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:38.396Z | 2026-09-01T07:32:38.856Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:39.396Z | 2026-09-01T07:32:39.845Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:40.396Z | 2026-09-01T07:32:40.933Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:41.549Z | 2026-09-01T07:32:42.022Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:42.549Z | 2026-09-01T07:32:43.056Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:43.550Z | 2026-09-01T07:32:44.059Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:44.551Z | 2026-09-01T07:32:44.690Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:45.551Z | 2026-09-01T07:32:46.183Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:46.551Z | 2026-09-01T07:32:46.707Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:47.551Z | 2026-09-01T07:32:48.026Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:48.552Z | 2026-09-01T07:32:48.730Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:49.553Z | 2026-09-01T07:32:49.669Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:50.553Z | 2026-09-01T07:32:51.069Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:51.615Z | 2026-09-01T07:32:52.091Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:52.615Z | 2026-09-01T07:32:52.772Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:53.615Z | 2026-09-01T07:32:54.096Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:54.615Z | 2026-09-01T07:32:55.062Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:55.616Z | 2026-09-01T07:32:56.130Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:56.617Z | 2026-09-01T07:32:56.800Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:57.619Z | 2026-09-01T07:32:58.255Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:58.619Z | 2026-09-01T07:32:59.140Z | 1 | 200 |  | 0 |
| 2026-09-01T07:32:59.621Z | 2026-09-01T07:33:00.112Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:00.621Z | 2026-09-01T07:33:00.712Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:01.621Z | 2026-09-01T07:33:02.092Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:02.621Z | 2026-09-01T07:33:03.133Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:03.622Z | 2026-09-01T07:33:03.757Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:04.622Z | 2026-09-01T07:33:04.841Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:05.623Z | 2026-09-01T07:33:06.099Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:06.623Z | 2026-09-01T07:33:07.071Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:07.623Z | 2026-09-01T07:33:07.759Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:08.623Z | 2026-09-01T07:33:09.070Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:09.623Z | 2026-09-01T07:33:09.820Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:10.623Z | 2026-09-01T07:33:10.758Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:11.623Z | 2026-09-01T07:33:11.694Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:12.631Z | 2026-09-01T07:33:13.124Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:13.631Z | 2026-09-01T07:33:14.119Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:14.630Z | 2026-09-01T07:33:15.127Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:15.631Z | 2026-09-01T07:33:16.102Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:16.631Z | 2026-09-01T07:33:16.761Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:17.631Z | 2026-09-01T07:33:18.095Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:18.631Z | 2026-09-01T07:33:18.748Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:19.631Z | 2026-09-01T07:33:19.766Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:20.631Z | 2026-09-01T07:33:21.100Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:21.632Z | 2026-09-01T07:33:22.144Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:22.631Z | 2026-09-01T07:33:22.763Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:23.633Z | 2026-09-01T07:33:24.102Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:24.633Z | 2026-09-01T07:33:24.853Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:25.633Z | 2026-09-01T07:33:26.101Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:26.633Z | 2026-09-01T07:33:27.165Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:27.634Z | 2026-09-01T07:33:27.853Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:28.634Z | 2026-09-01T07:33:30.075Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:30.127Z | 2026-09-01T07:33:30.198Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:31.127Z | 2026-09-01T07:33:31.658Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:32.128Z | 2026-09-01T07:33:32.600Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:33.128Z | 2026-09-01T07:33:33.633Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:34.128Z | 2026-09-01T07:33:34.261Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:35.128Z | 2026-09-01T07:33:35.287Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:36.129Z | 2026-09-01T07:33:36.346Z | 1 | 200 |  | 0 |
| 2026-09-01T07:33:37.130Z | 2026-09-01T07:33:37.605Z | 1 | 200 |  | 0 |

## Owner review boundary

- No descriptions or translations were generated.
- No guest items were created.
- Nothing was published.
- The 356 proposals are development review material only; approval/rejection remains a human decision.
- Skakalni center Savina was not extracted from the bounded approved-source corpus; the other seven requested reference places resolved.
