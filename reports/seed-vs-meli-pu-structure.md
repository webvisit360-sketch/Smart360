# New-tenant seed vs. live Apartmaji Meli Pu

Read-only comparison of the canonical `apartmaji` seed with the production structure of tenant `meli-pu`.

## Interpretation

- **Same entry**: same structural meaning and key; notes call out icon or wording differences.
- **Renamed/split variant**: the seed has the same concept under different wording, icon, key, or as a broader umbrella.
- **Nothing**: no reasonable seed counterpart exists.
- The seed writes only the Slovenian source name. It creates no EN/DE/IT translation rows, so every seed match still lacks the three translated data names until translation work runs.
- Group/subcategory labels come from shared four-language UI strings. Groups have no icon field; icons belong to their child categories.

## Sections

| Meli key | Meli SL | EN | DE | IT | Icon | Seed comparison |
|---|---|---|---|---|---|---|
| `stay` | Vaša nastanitev | Your stay | Ihr Aufenthalt | Il vostro soggiorno | `home` | Same entry and SL/icon; seed EN/DE/IT names absent |
| `offer` | Naša ponudba | What we offer | Unser Angebot | La nostra offerta | `bag` | Same entry and SL/icon; seed EN/DE/IT names absent |
| `explore` | Odkrij okolico | Explore the area | Die Umgebung entdecken | Scopri i dintorni | `compass` | Renamed variant: seed is **Odkrijte okolico**; translations absent |
| `services` | Storitve v bližini | Nearby services | Dienste in der Nähe | Servizi nelle vicinanze | `cart` | Renamed variant: seed is **Storitve**; translations absent |

## Subcategories / groups

| Section / group | SL | EN | DE | IT | Icon | Seed comparison |
|---|---|---|---|---|---|---|
| `stay / vase_bivanje` | Vaše bivanje | Your stay | Ihr Aufenthalt | Il vostro soggiorno | — | Same group |
| `stay / prihod_dostop` | Prihod in dostop | Arrival and access | Anreise und Zugang | Arrivo e accesso | — | Same group |
| `stay / prakticno` | Praktično | Practical | Praktisches | Info pratiche | — | Same group |
| `offer / najem` | Najem | Rental | Verleih | Noleggio | — | Same group |
| `offer / izleti_prevozi` | Izleti in prevozi | Trips and transfers | Ausflüge und Transfers | Gite e trasferimenti | — | Nothing: shared UI defines it, but the seed places no category in it |
| `offer / domaci_izdelki` | Domači izdelki | Local products | Hausgemachte Produkte | Prodotti locali | — | Same group |
| `offer / pri_hisi` | Pri hiši | On site | Vor Ort | In loco | — | Same group |
| `explore / experiences` | Doživetja | Experiences | Erlebnisse | Esperienze | — | Same group |
| `explore / food_drink` | Hrana in pijača | Food and drink | Essen und Trinken | Cibo e bevande | — | Same group |
| `explore / nature_trails` | Narava in poti | Nature and trails | Natur und Wege | Natura e sentieri | — | Same group |
| `explore / sights` | Znamenitosti | Sights | Sehenswürdigkeiten | Attrazioni | — | Same group |
| `services / services` | Storitve | Services | Dienstleistungen | Servizi | — | Same stored group value; no dedicated group row/icon |

## Categories — every live Meli Pu entry

| Section / group | Meli key | Meli SL | EN | DE | IT | Icon | Seed comparison |
|---|---|---|---|---|---|---|---|
| Stay / Vaše bivanje | `welcome` | Dobrodošli | Welcome | Willkommen | Benvenuti | `welcome` | Renamed/icon variant: seed `welcome`, **Dobrodošli**, icon `sparkle` |
| Stay / Vaše bivanje | `apart` | Apartmaji | Apartments | Apartments | Appartamenti | `apart` | Renamed/icon variant: seed **Vaš apartma**, icon `bed` |
| Stay / Vaše bivanje | `pool` | Bazen | Swimming pool | Pool | Piscina | `pool` | Nothing |
| Stay / Prihod in dostop | `loc` | Lokacija | Location | Anfahrt | Come arrivare | `pin` | Nothing |
| Stay / Prihod in dostop | `park` | Parkirišče | Parking | Parkplatz | Parcheggio | `park` | Renamed/icon variant: seed **Parkiranje**, icon `car` |
| Stay / Prihod in dostop | `gate` | Navodila za ograjo | — | — | — | `gate` | Nothing; Meli itself lacks EN/DE/IT names |
| Stay / Prihod in dostop | `check` | Prijava / Odjava | Check-in / Check-out | Check-in / Check-out | Check-in / Check-out | `clock` | Renamed/icon variant: seed **Prijava in odjava**, icon `key` |
| Stay / Praktično | `equip` | Navodila za opremo | How things work | Geräte bedienen | Come funziona | `gear` | Nothing |
| Stay / Praktično | `wifi` | WiFi | WiFi | WLAN | WiFi | `wifi` | Renamed variant: seed **Wi‑Fi**, same icon |
| Stay / Praktično | `house` | Hišni red | House rules | Hausordnung | Regolamento | `doc` | Renamed/key/icon variant: seed key `rules`, icon `rules` |
| Offer / Najem | `sup` | SUP deska | SUP board | SUP-Board | Tavola SUP | `sup` | Split variant of seed umbrella `rent` / Najem opreme |
| Offer / Najem | `scooter` | Skuter | Scooter | Roller | Scooter | `scooter` | Split variant of seed umbrella `rent` / Najem opreme |
| Offer / Pri hiši | `fitness` | Zunanji fitnes | Outdoor gym | Outdoor-Gym | Palestra all'aperto | `dumb` | Split variant of seed umbrella `house` / Pri hiši |
| Offer / Pri hiši | `grill` | Žar | Barbecue | Grill | Barbecue | `grill` | Split variant of seed umbrella `house` / Pri hiši |
| Offer / Pri hiši | `games` | Družabne igre | Games | Spiele | Giochi | `dice` | Split variant of seed umbrella `house` / Pri hiši |
| Offer / Izleti in prevozi | `boat` | Čoln s skiperjem | Boat with a skipper | Boot mit Skipper | Barca con skipper | `boat` | Nothing; seed has no category in this group |
| Offer / Izleti in prevozi | `ferry` | Ladijski prevoz | Boat line | Schiffslinie | Linea marittima | `ferry` | Nothing; seed has no category in this group |
| Offer / Domači izdelki | `oil` | Oljčno olje | Olive oil | Olivenöl | Olio d'oliva | `drop` | Split variant of seed umbrella `local` / Domači izdelki |
| Offer / Domači izdelki | `ice` | Sladoled 24/7 | Ice cream 24/7 | Eis rund um die Uhr | Gelato 24/7 | `ice` | Split variant of seed umbrella `local` / Domači izdelki |
| Explore / Hrana in pijača | `breakfast` | Zajtrk | Breakfast | Frühstück | Colazione | `coffee` | Split variant of seed umbrella `food` / Hrana in pijača |
| Explore / Hrana in pijača | `culinary` | Kulinarika | Where to eat | Essen gehen | Dove mangiare | `fork` | Split/renamed variant of seed `food` |
| Explore / Hrana in pijača | `night` | Nočno življenje | Nightlife | Nachtleben | Vita notturna | `cocktail` | Split variant of seed umbrella `food` |
| Explore / Hrana in pijača | `pizza` | Picerije | Pizzerias | Pizzerien | Pizzerie | `pizza` | Split variant of seed umbrella `food` |
| Explore / Doživetja | `act` | Aktivnosti | Things to do | Aktivitäten | Attività | `star` | Same key/name concept; seed icon is `waves`, translations absent |
| Explore / Doživetja | `trips` | Izleti | Day trips | Ausflüge | Gite | `map` | Same entry and icon; seed translations absent |
| Explore / Doživetja | `events` | Dogodki | What's on | Veranstaltungen | Eventi | `party` | Nothing |
| Explore / Narava in poti | `hike` | Pohodništvo | Hiking | Wandern | Escursioni a piedi | `hike` | Renamed/narrowed variant: seed **Pohodi in kolesarjenje**, icon `pin` |
| Explore / Narava in poti | `bike` | Kolesarjenje | Cycling | Radfahren | In bicicletta | `bike` | Split variant of seed combined `hike` category |
| Explore / Narava in poti | `beach` | Plaže | Beaches | Strände | Spiagge | `beach` | Nothing |
| Explore / Znamenitosti | `culture` | Kulturna dediščina | Heritage | Kulturerbe | Patrimonio culturale | `culture` | Split variant of seed umbrella `sights` / Znamenitosti |
| Explore / Znamenitosti | `nature` | Naravna dediščina | Nature | Naturerbe | Patrimonio naturale | `nature` | Split variant of seed umbrella `sights` / Znamenitosti |
| Services / Storitve | `shops` | Trgovine | Shops | Geschäfte | Negozi | `cart` | Same entry and icon; seed translations absent |
| Services / Storitve | `bakery` | Pekarne | Bakeries | Bäckereien | Panetterie | `bread` | Nothing |
| Services / Storitve | `gas` | Bencinske črpalke | Petrol stations | Tankstellen | Distributori di carburante | `gas` | Nothing |
| Services / Storitve | `atm` | Bankomati | Cash machines | Geldautomaten | Bancomat | `atm` | Nothing |
| Services / Storitve | `pharm` | Lekarne | Pharmacies | Apotheken | Farmacie | `pharm` | Split variant of seed umbrella `health` / Zdravje |
| Services / Storitve | `hosp` | Bolnišnica | Hospital | Krankenhaus | Ospedale | `hosp` | Split variant of seed umbrella `health` / Zdravje |

## Seed entries not present as the same Meli row

| Section / group | Seed key | Seed SL | Seed EN/DE/IT | Icon | Meli relation |
|---|---|---|---|---|---|
| Stay / Praktično | `rules` | Hišni red | Not seeded | `rules` | Meli uses key `house`, icon `doc` |
| Offer / Najem | `rent` | Najem opreme | Not seeded | `bag` | Meli splits it into `sup` and `scooter` |
| Offer / Domači izdelki | `local` | Domači izdelki | Not seeded | `bread` | Meli splits it into `oil` and `ice` |
| Offer / Pri hiši | `house` | Pri hiši | Not seeded | `home` | Meli splits it into `fitness`, `grill`, and `games` |
| Explore / Hrana in pijača | `food` | Hrana in pijača | Not seeded | `bread` | Meli splits it into four categories |
| Explore / Znamenitosti | `sights` | Znamenitosti | Not seeded | `star` | Meli splits it into `culture` and `nature` |
| Services / Storitve | `health` | Zdravje | Not seeded | `cross` | Meli splits it into `pharm` and `hosp` |
| Services / Storitve | `transport` | Prevozi | Not seeded | `car` | No direct Meli category |

## Decision summary

- Section count matches: **4 vs 4**, but two section titles differ.
- Seed categories: **18**.
- Live Meli categories: **37**.
- Exact/same-key matches exist for only a subset; Meli contains several split categories and **10 clear entries with no seed counterpart**: `pool`, `loc`, `gate`, `equip`, `boat`, `ferry`, `events`, `beach`, `bakery`, `atm`, plus `gas` if it is not treated as a transport variant.
- The seed has no EN/DE/IT section/category translation rows. Meli is translated except `gate`.
- No seed change is made by this report.