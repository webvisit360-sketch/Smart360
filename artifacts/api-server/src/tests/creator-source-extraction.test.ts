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
    rawContent: `<a href="/gora/komEN/3/487">Komen</a><a href="/forum">Planinski forum</a>`,
  });
  assert.deepEqual(facts, [
    { placeName: "Komen", settlement: null, categoryKey: "hike" },
  ]);
});