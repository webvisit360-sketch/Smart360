import test from "node:test";
import assert from "node:assert/strict";
import { entryNamePlaceholder } from "../lib/entry-name-placeholder";

test("destination placeholders use canonical keys and known label aliases", () => {
  const expected = {
    apart: "npr. Apartma 1",
    welcome: "npr. Dobrodošli pri nas",
    check: "npr. Prijava in odjava",
    park: "npr. Parkirišče ob recepciji",
    wifi: "npr. Wi-Fi omrežje",
    house: "npr. Hišni red",
    loc: "npr. Kako do nas",
    gate: "npr. Uporaba vhodnih vrat",
    equip: "npr. Uporaba klime",
    pool: "npr. Bazen",
  };
  for (const [key, placeholder] of Object.entries(expected)) {
    assert.equal(entryNamePlaceholder({ key, label: "Napačna oznaka" }, "stay"), placeholder);
  }
  assert.equal(entryNamePlaceholder({ label: "Vaše mesto" }, "stay"), "npr. Ljubno ob Savinji");
  assert.equal(entryNamePlaceholder({ label: "Sanitarije" }, "stay"), "npr. Sanitarni objekt");
  assert.equal(entryNamePlaceholder({ label: "Parkiranje" }, "stay"), "npr. Parkirišče ob recepciji");
});

test("offer placeholders cover every canonical offer key and known offer aliases", () => {
  const expected = {
    sup: "npr. Najem SUP deske",
    scooter: "npr. Najem skuterja",
    fitness: "npr. Uporaba zunanjega fitnesa",
    grill: "npr. Najem žara",
    boat: "npr. Izlet s čolnom",
    ferry: "npr. Ladijski prevoz",
    games: "npr. Izposoja družabnih iger",
    oil: "npr. Domače oljčno olje",
    ice: "npr. Sladoled",
  };
  for (const [key, placeholder] of Object.entries(expected)) {
    assert.equal(entryNamePlaceholder({ key }, "offer"), placeholder);
  }
  assert.equal(entryNamePlaceholder({ label: "Najem opreme" }, "offer"), "npr. Najem kolesa");
  assert.equal(entryNamePlaceholder({ label: "Žar in piknik" }, "offer"), "npr. Najem žara");
  assert.equal(entryNamePlaceholder({ label: "Domači izdelki" }, "offer"), "npr. Domača marmelada");
});

test("okolica placeholders exactly match all supplied categories", () => {
  const expected = {
    breakfast: "npr. Kavarna v centru",
    culinary: "npr. Gostilna Rogovilc",
    pizza: "npr. Pizzeria Peruzza",
    night: "npr. Pub Ljubno",
    act: "npr. Rafting na Savinji",
    hike: "npr. Pohod na Raduho",
    bike: "npr. Kolesarska pot ob Savinji",
    beach: "npr. Plaža ob Savinji",
    culture: "npr. Flosarski muzej",
    nature: "npr. Slap Rinka",
    trips: "npr. Izlet na Golte",
    shops: "npr. Trgovina Ljubno",
    bakery: "npr. Pekarna Mozirje",
    gas: "npr. Bencinski servis Mozirje",
    atm: "npr. Bankomat v centru",
    pharm: "npr. Lekarna Mozirje",
    hosp: "npr. Zdravstveni dom Mozirje",
    events: "npr. Flosarski bal",
  };
  for (const [key, placeholder] of Object.entries(expected)) {
    assert.equal(entryNamePlaceholder({ key }, key === "shops" ? "services" : "explore"), placeholder);
  }
  assert.equal(entryNamePlaceholder({ label: "Bencinske črpalke" }, "services"), expected.gas);
});

test("unknown and custom categories always use the exact neutral fallback", () => {
  assert.equal(entryNamePlaceholder({ key: "host-custom-123", label: "Moje top doživetje" }, "explore"), "npr. ime vnosa");
  assert.equal(entryNamePlaceholder({ key: "host-custom-456", label: "Kulinarika" }, "explore"), "npr. ime vnosa");
  assert.equal(entryNamePlaceholder({ key: "custom-offer", label: "Picerija" }, "offer"), "npr. ime vnosa");
  assert.equal(entryNamePlaceholder({ key: "apart" }, "offer"), "npr. ime vnosa");
  assert.equal(entryNamePlaceholder(undefined, "stay"), "npr. ime vnosa");
});