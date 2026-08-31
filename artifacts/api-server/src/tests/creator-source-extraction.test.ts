import assert from "node:assert/strict";
import test from "node:test";
import { extractCreatorSourceFacts } from "../lib/creatorSourceExtraction";

test("deterministic source extraction keeps structured places and removes navigation", () => {
  const html = `
    <a href="/">Domov</a>
    <a href="/znamenitosti/slap-rinka"><strong>Slap Rinka</strong></a>
    <a href="/izlet/veliki-travnik">Veliki Travnik</a>
    <a href="https://other.example/place">Foreign Place</a>`;
  const first = extractCreatorSourceFacts({
    sourceLabel: "Visit Savinjska — Solčava",
    sourceKind: "regional-tourism",
    sourceUrl: "https://example.test/solcava/",
    rawContent: html,
  });
  const second = extractCreatorSourceFacts({
    sourceLabel: "Visit Savinjska — Solčava",
    sourceKind: "regional-tourism",
    sourceUrl: "https://example.test/solcava/",
    rawContent: html,
  });
  assert.deepEqual(first, second);
  assert.deepEqual(first, [
    { placeName: "Slap Rinka", settlement: "Solčava", categoryKey: "sights" },
    { placeName: "Veliki Travnik", settlement: "Solčava", categoryKey: "hike" },
  ]);
});

test("hiking indexes only accept mountain and route links", () => {
  const facts = extractCreatorSourceFacts({
    sourceLabel: "Hribi.net — Smrekovec",
    sourceKind: "hiking-index",
    sourceUrl: "https://www.hribi.net/gora/smrekovec/3/485",
    rawContent: `
      <a href="/gora/komEN/3/487">Komen</a>
      <a href="/gora/dom-na-smrekovcu/3/484">Dom na Smrekovcu (1375m)</a>
      <a href="/gora/komEN/3/487">1684 m</a>
      <a href="/izlet/komen/3/487/1">2 h 5 min</a>
      <a href="/izlet/komen/3/487/1">lahka označena pot</a>
      <a href="/izlet/komen/3/487/1">lahka neoznačena steza</a>
      <a href="/forum">Planinski forum</a>`,
  });
  assert.deepEqual(facts, [
    { placeName: "Dom na Smrekovcu", settlement: null, categoryKey: "food" },
    { placeName: "Komen", settlement: null, categoryKey: "hike" },
  ]);
});

test("municipal extraction rejects editorial and administrative noise", () => {
  const facts = extractCreatorSourceFacts({
    sourceLabel: "Občina Nazarje",
    sourceKind: "neighbour-municipality",
    sourceUrl: "https://example.test/",
    rawContent: `
      <a href="/kultura/muzej-vrbovec">Javni zavod Muzej Vrbovec</a>
      <a href="/kultura/dogodek">NEDELJA 20. SEP. ORIENTALSKI VEČER - Dom Kulture Nazarje</a>
      <a href="/kultura/razstava">Likovna razstava v Galeriji Štekl</a>
      <a href="/kultura/orkester">Godalni orkester Emars KATEDRALA SV. MOHORJA IN FORTUNATA</a>
      <a href="/ustanove/zdravstveni-dom">Zgornjesavinjski zdravstveni dom Nazarje</a>
      <a href="/ustanove/zdravstveni-dom">Zgornjesavinjski zdravstevni dom Nazarje</a>
      <a href="/projekt">O projektu</a>`,
  });
  assert.deepEqual(facts, [
    { placeName: "Javni zavod Muzej Vrbovec", settlement: "Nazarje", categoryKey: "sights" },
  ]);
});

test("tourism extraction rejects inflected and combined-place prose", () => {
  const facts = extractCreatorSourceFacts({
    sourceLabel: "Visit Savinjska — Logarska dolina in krajinski parki",
    sourceKind: "regional-tourism",
    sourceUrl: "https://example.test/",
    rawContent: `
      <a href="/slap/rinka">slapom Rinka</a>
      <a href="/park/adrenalinski">adrenalinski park</a>
      <a href="/jama/klemenča">Klemenča jama in Strelovec</a>
      <a href="/park/golte">Krajinski park Golte in Alpski vrt</a>
      <a href="/park/logarska">Krajinska parka Logarska dolina in Robanov kot</a>
      <a href="/park/naravni">naravni parki Logarska dolina, Robanov kot</a>
      <a href="/dolina/savinjska">Savinjska dolina z okolico</a>
      <a href="/slap/rinka">Slap Rinka</a>`,
  });
  assert.deepEqual(facts, [
    { placeName: "Slap Rinka", settlement: null, categoryKey: "sights" },
  ]);
});