export const PART5_LEDGER_SHA256 = "7121b80080a3ae2a391d169f6c48ef73edda146f87081b95969831a30df86caf" as const;
export const PART5_COMPILED_PAYLOAD_SHA256 = "81a5753e839bb59b1834354546f5253334f775d7fb86dd5251825c89616a6789" as const;

export const PART5_EXPECTED_PRE = {
  "categories": {
    "count": 37,
    "hash": "bd0cce5e43c91f734f8185918e23e4b7"
  },
  "items": {
    "count": 136,
    "hash": "54a66a2bff47cdaaeeba54f44bd94f39"
  },
  "media": {
    "count": 133,
    "hash": "87a1a47094045f81cf8c9fbe135150d0"
  }
} as const;

export const PART5_EXPECTED_POST = {
  "categories": {
    "count": 37,
    "hash": "6ec36fdc5e276e354f6a939539a711fc"
  },
  "items": {
    "count": 136,
    "hash": "dcdf0e96a1787d64fda35716a5173afa"
  },
  "media": {
    "count": 134,
    "hash": "5f576ae9b973c02dc9d8a29c69c54814"
  }
} as const;

export const PART5_CATEGORY_KEY_UPDATES = [
  {
    "id": "21cb2473-1300-47d4-9384-47a41225c9e5",
    "oldKey": null,
    "newKey": "sup",
    "label": "SUP deska"
  },
  {
    "id": "4897801f-1a9c-4cd6-a450-cada02eab542",
    "oldKey": null,
    "newKey": "welcome",
    "label": "Dobrodošli"
  },
  {
    "id": "c6be1fe2-8963-46fc-b78e-a49c89bbf28b",
    "oldKey": null,
    "newKey": "shops",
    "label": "Trgovine"
  },
  {
    "id": "f65e2b4b-8676-404a-8bb5-a325a3faea87",
    "oldKey": null,
    "newKey": "breakfast",
    "label": "Zajtrk"
  },
  {
    "id": "976dc2cc-c4a9-4076-b445-8afd89cc478f",
    "oldKey": null,
    "newKey": "culinary",
    "label": "Kulinarika"
  },
  {
    "id": "c0ede9a5-a37d-4587-a8ab-0faab9074e29",
    "oldKey": null,
    "newKey": "bakery",
    "label": "Pekarne"
  },
  {
    "id": "cf1244bb-4a02-437f-b3f4-1f41dfe15040",
    "oldKey": null,
    "newKey": "apart",
    "label": "Apartmaji"
  },
  {
    "id": "de87fe75-9953-41e7-9824-e631033388bf",
    "oldKey": null,
    "newKey": "scooter",
    "label": "Skuter"
  },
  {
    "id": "28a42bea-ebe9-44f6-a107-f4e24b495069",
    "oldKey": null,
    "newKey": "night",
    "label": "Nočno življenje"
  },
  {
    "id": "47947381-e1f2-4e15-9a45-2d0808237622",
    "oldKey": null,
    "newKey": "loc",
    "label": "Lokacija"
  },
  {
    "id": "67a74032-88bb-4fe5-9fef-bbe0a46116af",
    "oldKey": null,
    "newKey": "gas",
    "label": "Bencinske črpalke"
  },
  {
    "id": "6d19fcf0-98c6-41e5-8bc5-c46fac82a0a0",
    "oldKey": null,
    "newKey": "fitness",
    "label": "Zunanji fitnes"
  },
  {
    "id": "27ce2c01-15db-45f6-9636-9c45484e165f",
    "oldKey": null,
    "newKey": "atm",
    "label": "Bankomati"
  },
  {
    "id": "2dc2eca3-bcc9-4100-be3c-e21786ac0395",
    "oldKey": null,
    "newKey": "pizza",
    "label": "Picerije"
  },
  {
    "id": "3c6acafd-be82-4571-a012-bf96848961a8",
    "oldKey": null,
    "newKey": "grill",
    "label": "Žar"
  },
  {
    "id": "c55b5370-3c59-43c3-983a-fb0d00af2ecf",
    "oldKey": null,
    "newKey": "park",
    "label": "Parkirišče"
  },
  {
    "id": "0599e07d-169d-4071-bd27-93bb19a25d79",
    "oldKey": null,
    "newKey": "pharm",
    "label": "Lekarne"
  },
  {
    "id": "282c13fc-564e-406e-9786-b0193d06396e",
    "oldKey": null,
    "newKey": "gate",
    "label": "Navodila za ograjo"
  },
  {
    "id": "669a7449-51c6-474a-b4bd-31f806146780",
    "oldKey": null,
    "newKey": "boat",
    "label": "Čoln s skiperjem"
  },
  {
    "id": "98631274-2c83-42c8-8e75-8be310c5ce1a",
    "oldKey": null,
    "newKey": "act",
    "label": "Aktivnosti"
  },
  {
    "id": "4d525c41-4a6d-4ab1-8254-0e51b7825f44",
    "oldKey": null,
    "newKey": "equip",
    "label": "Navodila za opremo"
  },
  {
    "id": "5c319f5a-6a81-4a9a-a3ab-6aec6483b620",
    "oldKey": null,
    "newKey": "hike",
    "label": "Pohodništvo"
  },
  {
    "id": "73c86a5f-ec98-42d1-af0f-3aff8a515bea",
    "oldKey": null,
    "newKey": "ferry",
    "label": "Ladijski prevoz"
  },
  {
    "id": "7985d054-9791-44eb-9c9a-0a768e366d24",
    "oldKey": null,
    "newKey": "hosp",
    "label": "Bolnišnica"
  },
  {
    "id": "71000420-5f94-4ea4-8807-d1798fbdf786",
    "oldKey": null,
    "newKey": "games",
    "label": "Družabne igre"
  },
  {
    "id": "a585c160-a224-4fa4-8ab0-d68eeff2d0ac",
    "oldKey": null,
    "newKey": "bike",
    "label": "Kolesarjenje"
  },
  {
    "id": "c5b3b98e-2029-42a2-bbb0-1d5c1d82ae96",
    "oldKey": null,
    "newKey": "check",
    "label": "Prijava / Odjava"
  },
  {
    "id": "402e6388-1bcc-4f09-94da-7d1f5c927847",
    "oldKey": null,
    "newKey": "oil",
    "label": "Oljčno olje"
  },
  {
    "id": "67f8a2a3-3822-4639-a408-271a7d3cfe91",
    "oldKey": null,
    "newKey": "wifi",
    "label": "WiFi"
  },
  {
    "id": "f8941ef0-5321-4265-b161-c34f770154ee",
    "oldKey": null,
    "newKey": "beach",
    "label": "Plaže"
  },
  {
    "id": "0653c49c-fe0c-4ece-8f14-fc6c2e97ba20",
    "oldKey": null,
    "newKey": "house",
    "label": "Hišni red"
  },
  {
    "id": "6f4b5883-1171-41d0-b215-46285d12322c",
    "oldKey": null,
    "newKey": "culture",
    "label": "Kulturna dediščina"
  },
  {
    "id": "7945d7ae-404e-4018-8911-72e77f978eb1",
    "oldKey": null,
    "newKey": "ice",
    "label": "Sladoled 24/7"
  },
  {
    "id": "59ca6db5-ee1d-4bca-9b36-76a6f16ae117",
    "oldKey": null,
    "newKey": "pool",
    "label": "Bazen"
  },
  {
    "id": "d955e77a-ae1d-403c-9d73-da1abdc2fc5f",
    "oldKey": null,
    "newKey": "nature",
    "label": "Naravna dediščina"
  },
  {
    "id": "cfcb60a5-a705-4246-aec2-8d98b59d08a9",
    "oldKey": null,
    "newKey": "trips",
    "label": "Izleti"
  },
  {
    "id": "6a56aae7-01b0-41c5-b364-14f0a9ad9e75",
    "oldKey": null,
    "newKey": "events",
    "label": "Dogodki"
  }
] as const;

export const PART5_ORDER_FLAG_UPDATES = [
  {
    "id": "4860043d-3db3-4c26-bd6e-714ebfdbe8ce",
    "oldOrderEnabled": false,
    "newOrderEnabled": true,
    "label": "SUP deska / SUP — dnevni najem"
  },
  {
    "id": "048efd21-d9ed-45ce-a017-cda9776fd651",
    "oldOrderEnabled": false,
    "newOrderEnabled": true,
    "label": "SUP deska / Najem za 3-4 ure"
  },
  {
    "id": "d16868d6-d2c1-4485-9380-b9ebe3c04b40",
    "oldOrderEnabled": false,
    "newOrderEnabled": true,
    "label": "Skuter / Skuter — najem za 3 do 4 ure"
  },
  {
    "id": "a1b3f0a4-4d72-4698-ae00-2c975cad3d09",
    "oldOrderEnabled": false,
    "newOrderEnabled": true,
    "label": "Čoln s skiperjem / Izlet s čolnom in skiperjem — 3 ure"
  },
  {
    "id": "6617360c-fdc5-455e-9e72-5269106f9a52",
    "oldOrderEnabled": false,
    "newOrderEnabled": true,
    "label": "Čoln s skiperjem / Izlet s čolnom in skiperjem — 5 ur"
  },
  {
    "id": "6a4d3a34-8d54-49d4-bd68-8ea31f019edf",
    "oldOrderEnabled": false,
    "newOrderEnabled": true,
    "label": "Čoln s skiperjem / Izlet po dogovoru"
  },
  {
    "id": "6856f026-65cc-40c2-8b50-b76bb5d43037",
    "oldOrderEnabled": false,
    "newOrderEnabled": true,
    "label": "Ladijski prevoz / Zlatoperka: Ankaran → Koper"
  },
  {
    "id": "f007f8c0-5e32-43b0-b2c7-cdfc49115eb8",
    "oldOrderEnabled": false,
    "newOrderEnabled": true,
    "label": "Ladijski prevoz / Zlatoperka: Koper → Izola → Piran"
  },
  {
    "id": "d06aa2f4-ae23-4bd4-8beb-adc590c681a2",
    "oldOrderEnabled": false,
    "newOrderEnabled": true,
    "label": "Oljčno olje / Domače ekološko oljčno olje"
  }
] as const;

export const PART5_MEDIA_DIMENSION_UPDATES = [
  {
    "id": "140a93b2-2392-44c4-a01b-4d906937f16b",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 771,
    "label": "Zajtrk / Restavracija Kamin"
  },
  {
    "id": "4f65b35c-7ac1-493d-9d93-ff6009ef3853",
    "oldWidth": null,
    "oldHeight": null,
    "width": 700,
    "height": 379,
    "label": "Dobrodošli / Dobrodošli"
  },
  {
    "id": "77e1952b-1745-45f3-b41e-b3599b2c519c",
    "oldWidth": null,
    "oldHeight": null,
    "width": 960,
    "height": 960,
    "label": "Trgovine / Mercator"
  },
  {
    "id": "0ca0fd2b-a6d8-41d8-9f17-2bc103b7ddfe",
    "oldWidth": null,
    "oldHeight": null,
    "width": 500,
    "height": 492,
    "label": "Dobrodošli / Dobrodošli"
  },
  {
    "id": "86b285b7-d8c2-4e1e-8d55-9959dfdfc986",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 900,
    "label": "Trgovine / Hipermarket SPAR"
  },
  {
    "id": "dc4ebe8a-d932-43c1-97e9-8e9858b4492c",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1100,
    "height": 1100,
    "label": "Zajtrk / Cafinho Piran"
  },
  {
    "id": "f6d2680d-41e7-4851-a858-7f4aa65c2319",
    "oldWidth": null,
    "oldHeight": null,
    "width": 800,
    "height": 800,
    "label": "SUP deska / Najem za 3-4 ure"
  },
  {
    "id": "b03791cb-0a9a-425f-bf5b-b1d33336b520",
    "oldWidth": null,
    "oldHeight": null,
    "width": 888,
    "height": 601,
    "label": "Trgovine / HOFER"
  },
  {
    "id": "b0e7fc1e-c389-45f4-b264-1c26fb40ae7f",
    "oldWidth": null,
    "oldHeight": null,
    "width": 600,
    "height": 325,
    "label": "Trgovine / Lidl Portorož"
  },
  {
    "id": "52807332-4f48-41ae-8316-e189828830d3",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 510,
    "label": "Trgovine / Tuš supermarket Lucija"
  },
  {
    "id": "1f1cc6f5-7004-4fbd-9e37-868a53e6fb4c",
    "oldWidth": null,
    "oldHeight": null,
    "width": 600,
    "height": 225,
    "label": "Trgovine / Eurospin Izola"
  },
  {
    "id": "0ae0bf9f-8514-4c11-90fd-dcc4e2c72261",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1049,
    "label": "Trgovine / Planet Tuš Koper"
  },
  {
    "id": "46c22880-8cc9-418f-a058-c1e8ffd3c7b2",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1024,
    "height": 683,
    "label": "Trgovine / Supernova Koper"
  },
  {
    "id": "a77d3b69-b873-4efe-8c01-01b7a6d36fea",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 788,
    "label": "Trgovine / Palmanova Designer Village"
  },
  {
    "id": "599fcc7d-2019-48fc-94bd-4dc9aded51b1",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 676,
    "label": "Pekarne / Pekarna Dan in noč"
  },
  {
    "id": "fa847f9a-5586-4757-b1bc-ee0004c69b53",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1181,
    "height": 1080,
    "label": "Kulinarika / Takamaka Cocktails & Food"
  },
  {
    "id": "474df897-f37e-431a-a4fc-991c40095588",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1750,
    "label": "Apartmaji / Apartma 1"
  },
  {
    "id": "355b5bec-3e5a-4212-8a12-98e41da08327",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1050,
    "label": "Apartmaji / Apartma 1"
  },
  {
    "id": "c26fc44f-29f0-4aee-a61b-434fc6638f9b",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 1600,
    "label": "Apartmaji / Apartma 1"
  },
  {
    "id": "da0ffd73-b578-4720-8570-a59e28c42878",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1050,
    "label": "Apartmaji / Apartma 1"
  },
  {
    "id": "c33cc565-eddc-4e95-b87a-7a97f831c559",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1050,
    "label": "Apartmaji / Apartma 1"
  },
  {
    "id": "8b48d70f-5940-40f6-b843-b3e35dfb1b4e",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1050,
    "label": "Apartmaji / Apartma 1"
  },
  {
    "id": "4d75afcc-067d-4ee3-ac25-f5335432fbdf",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1024,
    "height": 683,
    "label": "Kulinarika / Restavracija Marina Portorož"
  },
  {
    "id": "f12f7065-7643-4e2e-b287-328aee14328d",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 1600,
    "label": "Apartmaji / Apartma 2"
  },
  {
    "id": "fac98b55-82a3-4e79-baee-1ff67256c7c3",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 943,
    "label": "Pekarne / Pekarna Portorož — Panificio"
  },
  {
    "id": "42cf29c7-b7ad-4788-b442-3a3ddd4b2f82",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 1600,
    "label": "Apartmaji / Apartma 2"
  },
  {
    "id": "737286ae-ea49-42fb-82c9-1827e36cb167",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 1600,
    "label": "Apartmaji / Apartma 2"
  },
  {
    "id": "5306300b-e025-4fd0-bc97-e14fe7ddc967",
    "oldWidth": null,
    "oldHeight": null,
    "width": 839,
    "height": 1600,
    "label": "Apartmaji / Apartma 2"
  },
  {
    "id": "16020523-2d25-4b78-92f9-032f44187594",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1179,
    "height": 1527,
    "label": "Apartmaji / Apartma 2"
  },
  {
    "id": "bede3f11-b5e6-40f1-ade2-89baaad4f5c3",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 1600,
    "label": "Apartmaji / Apartma 2"
  },
  {
    "id": "690007ac-e899-49e1-b7bc-b7c9661f5a0c",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1050,
    "label": "Apartmaji / Apartma 3"
  },
  {
    "id": "7b6c4aba-345b-4a17-9331-b5bf179a844d",
    "oldWidth": null,
    "oldHeight": null,
    "width": 900,
    "height": 500,
    "label": "Kulinarika / Restavracija Pavel"
  },
  {
    "id": "ce64cc7a-5204-4e68-bddb-b55c4adb3368",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 1600,
    "label": "Apartmaji / Apartma 3"
  },
  {
    "id": "0d9c0429-8906-4d98-bf31-979ab3a39bc3",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1050,
    "label": "Apartmaji / Apartma 3"
  },
  {
    "id": "32265866-e85f-4aed-bcfd-01365aa82e75",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 1600,
    "label": "Apartmaji / Apartma 4"
  },
  {
    "id": "46b7bd28-ec61-49da-b401-3c44ab20c141",
    "oldWidth": null,
    "oldHeight": null,
    "width": 900,
    "height": 500,
    "label": "Kulinarika / Restavracija Pavel 2"
  },
  {
    "id": "1db34899-9d3b-44ce-bafb-ba1bd0f3b6ea",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 1600,
    "label": "Apartmaji / Apartma 4"
  },
  {
    "id": "1e237ce9-d351-4edf-a9b5-40b7b384fb46",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 1600,
    "label": "Apartmaji / Apartma 4"
  },
  {
    "id": "72a2583b-41af-4e7a-a5dc-e026241ca69d",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1280,
    "height": 1600,
    "label": "Apartmaji / Apartma 4"
  },
  {
    "id": "f08c5a6f-b9bf-4a44-bc26-88dcb1544741",
    "oldWidth": null,
    "oldHeight": null,
    "width": 839,
    "height": 1600,
    "label": "Apartmaji / Apartma 4"
  },
  {
    "id": "53f96fdf-fe91-4b9e-9738-e458f801f4be",
    "oldWidth": null,
    "oldHeight": null,
    "width": 259,
    "height": 194,
    "label": "Kulinarika / Hiša Dual"
  },
  {
    "id": "988997bc-ed47-4af4-9342-fcf77ed43cab",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1024,
    "height": 683,
    "label": "Kulinarika / Gostilna Karjola"
  },
  {
    "id": "d5524523-9ee2-4aaf-99db-02b4467f85d3",
    "oldWidth": null,
    "oldHeight": null,
    "width": 750,
    "height": 468,
    "label": "Kulinarika / Primavera"
  },
  {
    "id": "20a3050b-29e0-42be-a8ce-e8292358851f",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1179,
    "height": 1433,
    "label": "Zunanji fitnes / Zunanji fitnes"
  },
  {
    "id": "9a85a985-960a-4253-bb17-f9d697fd7306",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1280,
    "height": 805,
    "label": "Bencinske črpalke / Petrol — Jagodje jug"
  },
  {
    "id": "f1dceb8d-27e6-4a89-8d66-9873d3b55bf8",
    "oldWidth": null,
    "oldHeight": null,
    "width": 800,
    "height": 533,
    "label": "Nočno življenje / Club Alaya"
  },
  {
    "id": "32012743-a4d2-4224-bc39-7d212f76ed59",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 1600,
    "label": "Zunanji fitnes / Zunanji fitnes"
  },
  {
    "id": "610ffffd-77bd-45e9-8a46-0d6e51faae89",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1050,
    "label": "Lokacija / Lokacija"
  },
  {
    "id": "04178975-54e7-4b6f-b2de-5c88b9cd87fd",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1050,
    "label": "Nočno življenje / Coco cafe Portorož"
  },
  {
    "id": "cddb4681-8fc4-4d6f-9595-cb6c369b3b11",
    "oldWidth": null,
    "oldHeight": null,
    "width": 960,
    "height": 720,
    "label": "Bencinske črpalke / Petrol Izola"
  },
  {
    "id": "588fa343-5050-41ed-a439-123efac9fb1a",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 987,
    "label": "Nočno življenje / Barba bar & more"
  },
  {
    "id": "9983f64d-a2e5-4fa7-b455-07ad032b3437",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 957,
    "label": "Bencinske črpalke / MOL Izola"
  },
  {
    "id": "85b2f508-38ea-43a4-8846-bfb8221dcb43",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 911,
    "label": "Nočno življenje / Snack Bar 1964"
  },
  {
    "id": "e9532467-f90d-4c52-bced-3be36a19e8e7",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 788,
    "label": "Bencinske črpalke / MOL Koper"
  },
  {
    "id": "275bd275-b194-45db-8f8b-027cabf3823e",
    "oldWidth": null,
    "oldHeight": null,
    "width": 737,
    "height": 1080,
    "label": "Nočno življenje / Wakanda Beach Bar"
  },
  {
    "id": "08cfa5c2-35c5-48af-a0c5-a2642e076b53",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1024,
    "height": 539,
    "label": "Bankomati / NLB poslovalnica Izola"
  },
  {
    "id": "8290d59f-40f0-4174-b746-31818ad7193a",
    "oldWidth": null,
    "oldHeight": null,
    "width": 492,
    "height": 226,
    "label": "Parkirišče / Parkirišče"
  },
  {
    "id": "cdbf6112-2622-4a20-879a-c2a294ff5402",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 1600,
    "label": "Žar / Žar"
  },
  {
    "id": "ef880772-577b-442c-aab9-ecfbd473fc71",
    "oldWidth": null,
    "oldHeight": null,
    "width": 900,
    "height": 500,
    "label": "Picerije / Fuoriseria — Pizza & More"
  },
  {
    "id": "34b26310-bfbd-49de-b354-9cdcd8b1604f",
    "oldWidth": null,
    "oldHeight": null,
    "width": 928,
    "height": 1101,
    "label": "Žar / Žar"
  },
  {
    "id": "ec98bd3f-c00c-45da-af4a-78aefcb3b901",
    "oldWidth": null,
    "oldHeight": null,
    "width": 492,
    "height": 201,
    "label": "Parkirišče / Parkirišče"
  },
  {
    "id": "005070a4-b36a-4075-87fa-48fe003e6f13",
    "oldWidth": null,
    "oldHeight": null,
    "width": 786,
    "height": 442,
    "label": "Bankomati / Bankomat SKB"
  },
  {
    "id": "b622133d-23cc-455c-9ae4-d185768984ec",
    "oldWidth": null,
    "oldHeight": null,
    "width": 906,
    "height": 604,
    "label": "Picerije / Picerija Vesuvio"
  },
  {
    "id": "71f1efa7-a62b-4739-b129-e9e7bf7efb80",
    "oldWidth": null,
    "oldHeight": null,
    "width": 275,
    "height": 183,
    "label": "Picerije / Casa della Pizza"
  },
  {
    "id": "a32b70ce-16cc-41d0-a917-be9f570cab5d",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 506,
    "label": "Bankomati / NLB bankomat"
  },
  {
    "id": "03c29b41-68df-48f4-8dfc-debcf7a6584d",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1069,
    "height": 960,
    "label": "Bankomati / Bankomat Intesa Sanpaolo"
  },
  {
    "id": "5801a9a6-7fca-46a1-b165-a618529c0bdf",
    "oldWidth": null,
    "oldHeight": null,
    "width": 577,
    "height": 957,
    "label": "Navodila za ograjo / <NULL>"
  },
  {
    "id": "6123ae86-4c48-45b1-b9dd-c1ac5bf1db78",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1024,
    "height": 683,
    "label": "Aktivnosti / Vinska fontana Marezige"
  },
  {
    "id": "90baa668-6ce3-4879-8492-70318b03fcf1",
    "oldWidth": null,
    "oldHeight": null,
    "width": 850,
    "height": 600,
    "label": "Lekarne / Lekarna San Simon"
  },
  {
    "id": "960b66d0-3e15-4fe1-b5ce-40ae6acfcb7d",
    "oldWidth": null,
    "oldHeight": null,
    "width": 590,
    "height": 1385,
    "label": "Čoln s skiperjem / Izlet s čolnom in skiperjem — 3 ure"
  },
  {
    "id": "0291fc20-3a59-48da-b639-0b08925b068f",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1050,
    "label": "Navodila za ograjo / <NULL>"
  },
  {
    "id": "3cdec354-5259-45e0-98bb-94c7888a91ee",
    "oldWidth": null,
    "oldHeight": null,
    "width": 590,
    "height": 1385,
    "label": "Čoln s skiperjem / Izlet s čolnom in skiperjem — 5 ur"
  },
  {
    "id": "5a993e61-4b4b-4fe9-8eea-58e08187b980",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 933,
    "label": "Aktivnosti / Krajinski park Sečoveljske soline"
  },
  {
    "id": "d3c4ea05-1832-4d81-818f-c1344ca05e7f",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1024,
    "height": 711,
    "label": "Lekarne / Obalne lekarne — Izola"
  },
  {
    "id": "b696ee7d-9235-42c1-a9ec-6d38ffd91f18",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1051,
    "label": "Aktivnosti / Krajinski park Sečoveljske soline"
  },
  {
    "id": "c112eabf-da50-4a37-a479-a37446a4ffad",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1000,
    "height": 667,
    "label": "Aktivnosti / Akvarij Piran"
  },
  {
    "id": "d81715bc-39fa-4a3e-8b68-04d638aac322",
    "oldWidth": null,
    "oldHeight": null,
    "width": 590,
    "height": 1385,
    "label": "Čoln s skiperjem / Izlet po dogovoru"
  },
  {
    "id": "e2b85551-93b6-4baf-929c-797b0607c528",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1024,
    "height": 683,
    "label": "Lekarne / Obalne lekarne — Lucija"
  },
  {
    "id": "022aab2f-b5d9-4c5d-86b8-b0410ef7d24f",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1000,
    "height": 667,
    "label": "Lekarne / Obalne lekarne — Koper"
  },
  {
    "id": "be7c6d8a-21d8-4c65-adb8-085ff39b401e",
    "oldWidth": null,
    "oldHeight": null,
    "width": 590,
    "height": 394,
    "label": "Aktivnosti / Aquapark Istralandia"
  },
  {
    "id": "5666a944-48ef-49ed-8c5e-033bbdbc918f",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1050,
    "label": "Aktivnosti / Grad Miramare, Trst"
  },
  {
    "id": "86620e7f-8a74-46f9-be72-f4931548a490",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 933,
    "label": "Aktivnosti / Grad Socerb"
  },
  {
    "id": "a9ed873c-471c-4342-a6fb-ad97e054ada3",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1024,
    "height": 683,
    "label": "Aktivnosti / Portopiccolo Sistiana"
  },
  {
    "id": "a3663383-b49f-4972-b2fc-4973ae702a33",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 934,
    "label": "Aktivnosti / Motovun"
  },
  {
    "id": "49db55b1-166d-4e40-b8d0-f0cb8fc8b2f0",
    "oldWidth": null,
    "oldHeight": null,
    "width": 492,
    "height": 355,
    "label": "Navodila za opremo / Bojler"
  },
  {
    "id": "827eea1e-2a7c-45a0-a0e0-42213b061809",
    "oldWidth": null,
    "oldHeight": null,
    "width": 780,
    "height": 470,
    "label": "Bolnišnica / Splošna bolnišnica Izola"
  },
  {
    "id": "a1a9f7b8-402f-414c-9f18-572007f6f22f",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 933,
    "label": "Ladijski prevoz / Zlatoperka: Ankaran → Koper"
  },
  {
    "id": "ea3587b6-bebf-49a0-8d20-a849b79b2f31",
    "oldWidth": null,
    "oldHeight": null,
    "width": 600,
    "height": 300,
    "label": "Pohodništvo / Pot srca, Strunjan"
  },
  {
    "id": "1e9161c3-e707-4473-af8a-0a21c750b891",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 933,
    "label": "Ladijski prevoz / Zlatoperka: Koper → Izola → Piran"
  },
  {
    "id": "e4c246e5-8629-48fa-a101-edd88c2e921b",
    "oldWidth": null,
    "oldHeight": null,
    "width": 723,
    "height": 482,
    "label": "Pohodništvo / Krajša pot navkreber"
  },
  {
    "id": "467c4b52-fb06-49fc-aaf0-feb501f42452",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 628,
    "label": "Pohodništvo / Slavnik"
  },
  {
    "id": "534353f1-c981-4b38-86d7-1828f5546299",
    "oldWidth": null,
    "oldHeight": null,
    "width": 600,
    "height": 300,
    "label": "Pohodništvo / Mesečev zaliv"
  },
  {
    "id": "58fe01cf-da6a-47fe-94b3-4fba7f770f04",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1348,
    "height": 954,
    "label": "Pohodništvo / Koper — Izola"
  },
  {
    "id": "6d6fb3fd-7d0c-49a0-96d2-2f72629909d4",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 934,
    "label": "Pohodništvo / Ušesa Istre"
  },
  {
    "id": "a4f1f086-9fe5-43e7-a24c-950284c24cb5",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 900,
    "label": "Pohodništvo / Napoleonska pot"
  },
  {
    "id": "cbf46116-c543-4f16-ac5f-7795cabc9817",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1050,
    "label": "Družabne igre / Družabne igre"
  },
  {
    "id": "fb82829f-7ad9-4d70-8d4e-6bf1e34c0748",
    "oldWidth": null,
    "oldHeight": null,
    "width": 844,
    "height": 563,
    "label": "Kolesarjenje / Parenzana: Izola — Piran"
  },
  {
    "id": "a415dece-5ec5-400a-b7bd-7a0f6495f9e4",
    "oldWidth": null,
    "oldHeight": null,
    "width": 492,
    "height": 267,
    "label": "Kolesarjenje / Parenzana — celotna trasa"
  },
  {
    "id": "60cbd1a2-ae85-4a07-8694-7e7b6eeafb1f",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 933,
    "label": "Kolesarjenje / Portorož — Izola — Strunjanske soline"
  },
  {
    "id": "c12303cc-413e-4007-9e64-a04f1f552c49",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 937,
    "label": "Kolesarjenje / Portorož — Piran"
  },
  {
    "id": "08adfd97-6b12-40f1-8161-90db196a21b6",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 933,
    "label": "Kolesarjenje / Portorož — istrsko zaledje — Padna"
  },
  {
    "id": "116d8132-5927-4def-98df-74461da557ca",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 763,
    "label": "Oljčno olje / Domače ekološko oljčno olje"
  },
  {
    "id": "e7c046a0-ed5b-46a4-8a68-c428531b22fa",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 677,
    "label": "Plaže / Plaža Svetilnik, Izola"
  },
  {
    "id": "bc2079ed-910b-444a-b10e-021d8cd18a8a",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 900,
    "label": "Plaže / Plaža San Simon"
  },
  {
    "id": "ab85221f-5255-4287-bf9e-dbaf3014e76f",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1080,
    "height": 721,
    "label": "Plaže / Plaža Mesečev zaliv"
  },
  {
    "id": "168f676b-308a-4090-87d2-dca572f8ccf7",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 933,
    "label": "Plaže / Pomol pod Belvederjem, Izola"
  },
  {
    "id": "2379a198-ba67-4299-b34e-847d88d1ec40",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 933,
    "label": "Plaže / Plaža Portorož"
  },
  {
    "id": "739350d0-c23a-48f8-986f-2d2fc58cd76a",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1200,
    "height": 628,
    "label": "Plaže / Plaža Ankaran"
  },
  {
    "id": "71fb92d5-bea9-4f0d-8ab2-f0779600d064",
    "oldWidth": null,
    "oldHeight": null,
    "width": 936,
    "height": 702,
    "label": "Plaže / Plaža Fiesa"
  },
  {
    "id": "9bf0bad5-bb59-4713-9872-61829a9ba994",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 531,
    "label": "Plaže / Plaža Strunjan"
  },
  {
    "id": "1459b1f2-59ed-4702-b36a-05c5be5fac89",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 928,
    "label": "Kulturna dediščina / Piransko obzidje"
  },
  {
    "id": "41476fd9-ec31-4809-ade6-9827f4919aaa",
    "oldWidth": null,
    "oldHeight": null,
    "width": 978,
    "height": 1708,
    "label": "Sladoled 24/7 / Sladoled 24/7"
  },
  {
    "id": "a049f9ef-c280-4683-b170-ccca45f839d1",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 934,
    "label": "Kulturna dediščina / Pretorska palača, Koper"
  },
  {
    "id": "068f601c-e409-4d3b-a2a1-e76345c946b8",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1348,
    "height": 954,
    "label": "Kulturna dediščina / Muzej Izolana — hiša morja"
  },
  {
    "id": "3a3eb3cd-8eac-4fff-bab6-bda04eba017e",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1024,
    "height": 684,
    "label": "Kulturna dediščina / Tartinijev trg, Piran"
  },
  {
    "id": "e384e497-1637-44d7-92b0-7b31a9478637",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1024,
    "height": 577,
    "label": "Kulturna dediščina / Cerkev sv. Jurija, Piran"
  },
  {
    "id": "3ad675ae-dfaa-4196-b8a4-3bd69e54d960",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 1050,
    "label": "Kulturna dediščina / Grad Miramare"
  },
  {
    "id": "e9cd9de7-6e42-4113-ba73-d2c763eee050",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 934,
    "label": "Kulturna dediščina / Motovun"
  },
  {
    "id": "7da736bb-b122-4b6d-85c9-d5a2e2245883",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 933,
    "label": "Naravna dediščina / Krajinski park Sečoveljske soline"
  },
  {
    "id": "65e44343-4bd5-4935-8bef-eec96a6d5faa",
    "oldWidth": null,
    "oldHeight": null,
    "width": 600,
    "height": 300,
    "label": "Naravna dediščina / Strunjanske soline"
  },
  {
    "id": "8caf63a5-b832-45c9-846f-875037e3d259",
    "oldWidth": null,
    "oldHeight": null,
    "width": 600,
    "height": 300,
    "label": "Naravna dediščina / Mesečev zaliv"
  },
  {
    "id": "37460fa0-542b-4809-b3cd-924f3cf76d90",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 932,
    "label": "Naravna dediščina / Strunjanski križ"
  },
  {
    "id": "7ddb9155-5ffe-4bf8-aa43-75b6c71e0eeb",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 931,
    "label": "Izleti / Kobilarna Lipica"
  },
  {
    "id": "85ba38f2-ce29-4d5a-82e0-0487b0f1280d",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 788,
    "label": "Izleti / Postojnska jama"
  },
  {
    "id": "43c2315c-80e5-440c-9aa9-720470d6c8b7",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1024,
    "height": 683,
    "label": "Izleti / Predjamski grad"
  },
  {
    "id": "25b465a1-8ecd-4e4f-ae46-1d22e7cac0d4",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1080,
    "height": 720,
    "label": "Izleti / Trst — informacijska točka"
  },
  {
    "id": "f1852f2e-5f3c-414c-b789-1d8ef875870a",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 788,
    "label": "Izleti / Trst — informacijska točka"
  },
  {
    "id": "fa0cd497-f5f6-48a1-a1c3-8f4e1420e1c7",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1024,
    "height": 683,
    "label": "Izleti / Portopiccolo Sistiana"
  },
  {
    "id": "f222ec4d-e319-4278-abf3-ed73f81c83b6",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 804,
    "label": "Dogodki / Dogodki v Izoli"
  },
  {
    "id": "8a0ba3b7-18e0-447d-b208-8fb9512c7bec",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1400,
    "height": 934,
    "label": "Dogodki / Dogodki v Portorožu"
  },
  {
    "id": "e6ffb78e-a031-47d1-8204-b719ee8d813a",
    "oldWidth": null,
    "oldHeight": null,
    "width": 1199,
    "height": 800,
    "label": "Dogodki / Dogodki v Kopru"
  }
] as const;

export const PART5_MEDIA_INSERTS = [
  {
    "label": "SUP deska / SUP — dnevni najem",
    "id": "e06d634b-7414-472c-a0d2-3195a02a8f80",
    "itemId": "4860043d-3db3-4c26-bd6e-714ebfdbe8ce",
    "tenantId": null,
    "url": "/api/storage/img/meli-pu/meli-pu_sup-dnevni-najem_01-91b9.jpg",
    "alt": null,
    "position": 0,
    "kind": "image",
    "posterUrl": null,
    "durationSec": null,
    "focusX": 50,
    "focusY": 50,
    "width": 800,
    "height": 800
  },
  {
    "label": "Skuter / Skuter — najem za 3 do 4 ure",
    "id": "e4cc6cc1-a4b6-47a1-812c-7bee2b27b44e",
    "itemId": "d16868d6-d2c1-4485-9380-b9ebe3c04b40",
    "tenantId": null,
    "url": "/api/storage/img/meli-pu/meli-pu_skuter-najem-za-3-do-4-u_02-05e3.jpg",
    "alt": null,
    "position": 1,
    "kind": "image",
    "posterUrl": null,
    "durationSec": null,
    "focusX": 50,
    "focusY": 50,
    "width": 1179,
    "height": 977
  },
  {
    "label": "Bazen / Bazen je odprt 7:00 – 21:00",
    "id": "22a308ef-dd83-443e-8f08-1c0cd453fe00",
    "itemId": "30db866a-2742-40c5-bcc3-e0ec84c327b9",
    "tenantId": null,
    "url": "/api/storage/img/meli-pu/meli-pu_bazen-je-odprt-7-00-21-0_01-bcbe.jpg",
    "alt": null,
    "position": 0,
    "kind": "image",
    "posterUrl": null,
    "durationSec": null,
    "focusX": 50,
    "focusY": 50,
    "width": 885,
    "height": 645
  }
] as const;

export const PART5_MEDIA_REMOVALS = [
  {
    "id": "84930838-f22a-41f7-a581-e072cbd10ae5",
    "itemId": "4860043d-3db3-4c26-bd6e-714ebfdbe8ce",
    "url": "/images/IMG_6218_0.jpg",
    "position": 0,
    "width": null,
    "height": null,
    "label": "SUP deska / SUP — dnevni najem"
  },
  {
    "id": "2f481f3f-79da-4419-a2ee-39cbb880c10c",
    "itemId": "d16868d6-d2c1-4485-9380-b9ebe3c04b40",
    "url": "/images/IMG_6219_0.jpg",
    "position": 0,
    "width": null,
    "height": null,
    "label": "Skuter / Skuter — najem za 3 do 4 ure"
  }
] as const;
