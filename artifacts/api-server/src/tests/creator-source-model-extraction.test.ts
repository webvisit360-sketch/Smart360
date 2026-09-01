import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCreatorSourceCompositeDocument,
  chunkCreatorSourceText,
  extractGroundedCreatorSourceFacts,
  groundCreatorSourceCandidates,
  routeGroundedCreatorSourceFactsToPages,
  sourceSupportsCanonicalPhrase,
} from "../lib/creatorSourceModelExtraction";

test("grounding accepts exact and conservative Slovenian inflection, but rejects invention", () => {
  const text = "Pot vodi mimo Slapa Rinka. V Klemenči jami je zanimiva razstava. Kraj Solčava.";
  assert.equal(sourceSupportsCanonicalPhrase("Slap Rinka", "Slapa Rinka"), true);
  assert.equal(sourceSupportsCanonicalPhrase("Klemenča jama", "V Klemenči jami"), true);
  assert.equal(sourceSupportsCanonicalPhrase("Slap Savica", "Slapa Rinka"), false);

  const result = groundCreatorSourceCandidates(text, {
    places: [
      { canonicalName: "Slap Rinka", settlement: "Solčava", categoryKey: "sights", evidence: "Slapa Rinka" },
      { canonicalName: "Klemenča jama", settlement: null, categoryKey: "sights", evidence: "Klemenči jami" },
      { canonicalName: "Slap Savica", settlement: null, categoryKey: "sights", evidence: "Slapa Rinka" },
      { canonicalName: "Muzej", settlement: null, categoryKey: "sights", evidence: "not in source" },
    ],
  });
  assert.deepEqual(result.facts.map(fact => fact.canonicalName), ["Slap Rinka", "Klemenča jama"]);
  assert.equal(result.rejectionCounts.unsupported_name, 1);
  assert.equal(result.rejectionCounts.missing_evidence, 1);
});

test("grounding rejects a canonical subset of a longer proper name", () => {
  const text = "Planinski Dom na Smrekovcu ponuja počitek. Gostilna Pri lipi streže kosila.";
  const result = groundCreatorSourceCandidates(text, {
    places: [
      {
        canonicalName: "Dom na Smrekovcu",
        settlement: null,
        categoryKey: "food",
        evidence: "Planinski Dom na Smrekovcu",
      },
      {
        canonicalName: "Gostilna Pri lipi",
        settlement: null,
        categoryKey: "sights",
        evidence: "Gostilna Pri lipi",
      },
      {
        canonicalName: "Smrekovec",
        settlement: null,
        categoryKey: "hike",
        evidence: "Dom na Smrekovcu",
      },
    ],
  });
  assert.deepEqual(result.facts, [{
    canonicalName: "Gostilna Pri lipi",
    settlement: null,
    categoryKey: "food",
    evidence: "Gostilna Pri lipi",
  }]);
  assert.equal(result.rejectionCounts.unsupported_name, 2);
});

test("grounding requires independent support for a name shortened from a longer proper name", () => {
  const longOnly = groundCreatorSourceCandidates("Krajinski park Golte ponuja razglede.", {
    places: [{ canonicalName: "Golte", settlement: null, categoryKey: "sights", evidence: "Krajinski park Golte" }],
  });
  assert.deepEqual(longOnly.facts, []);
  assert.equal(longOnly.rejectionCounts.unsupported_name, 1);

  const standalone = groundCreatorSourceCandidates(
    "Krajinski park Golte ponuja razglede. Golte so odprte vse leto.",
    { places: [{ canonicalName: "Golte", settlement: null, categoryKey: "sights", evidence: "Krajinski park Golte" }] },
  );
  assert.deepEqual(standalone.facts.map(fact => fact.canonicalName), ["Golte"]);
});

test("grounding permits inflected canonical phrases with grammatical context only", () => {
  const result = groundCreatorSourceCandidates("V Klemenči jami je zanimiva razstava.", {
    places: [{ canonicalName: "Klemenča jama", settlement: null, categoryKey: "sights", evidence: "V Klemenči jami" }],
  });
  assert.deepEqual(result.facts.map(fact => fact.canonicalName), ["Klemenča jama"]);

  const unsupported = groundCreatorSourceCandidates("V Klemenči jami je zanimiva razstava.", {
    places: [{ canonicalName: "Slap Savica", settlement: null, categoryKey: "sights", evidence: "Klemenči jami" }],
  });
  assert.equal(unsupported.rejectionCounts.unsupported_name, 1);
});

test("category override distinguishes mountain homes from hospitality named Dom", () => {
  const text = [
    "Planinski dom na Smrekovcu ima restavracijo.",
    "Hotel Dom Planica nudi prenočišča.",
  ].join(" ");
  const result = groundCreatorSourceCandidates(text, {
    places: [
      {
        canonicalName: "Planinski dom na Smrekovcu",
        settlement: null,
        categoryKey: "food",
        evidence: "Planinski dom na Smrekovcu",
      },
      {
        canonicalName: "Hotel Dom Planica",
        settlement: null,
        categoryKey: "sights",
        evidence: "Hotel Dom Planica",
      },
    ],
  });
  assert.deepEqual(result.facts.map(fact => [fact.canonicalName, fact.categoryKey]), [
    ["Planinski dom na Smrekovcu", "hike"],
    ["Hotel Dom Planica", "food"],
  ]);
});

test("chunking is deterministic and model extraction aggregates usage and rejection counts", async () => {
  const text = `${"uvod ".repeat(140)}Slap Rinka v kraju Solčava`;
  assert.deepEqual(chunkCreatorSourceText(text, 500, 50), chunkCreatorSourceText(text, 500, 50));
  const seenPrompts: string[] = [];
  const result = await extractGroundedCreatorSourceFacts({
    storedVisibleText: text,
    maxChunkCharacters: 500,
    chunkOverlapCharacters: 50,
    model: async ({ prompt, sourceText }) => {
      seenPrompts.push(`${prompt}\n${sourceText}`);
      return {
        content: sourceText.includes("Slap Rinka")
          ? { places: [{ canonicalName: "Slap Rinka", settlement: "Solčava", categoryKey: "sights", evidence: "Slap Rinka" }] }
          : { places: [] },
        inputTokens: 10,
        outputTokens: 2,
        costUsd: 0.001,
      };
    },
  });
  assert.equal(seenPrompts.length, result.chunkCount);
  assert.deepEqual(result.facts, [
    {
      canonicalName: "Slap Rinka",
      settlement: "Solčava",
      categoryKey: "sights",
      evidence: "Slap Rinka",
    },
  ]);
  assert.equal(result.inputTokens, result.chunkCount * 10);
  assert.equal(result.outputTokens, result.chunkCount * 2);
  assert.equal(result.costUsd, result.chunkCount * 0.001);
  assert.equal(result.requestCount, result.chunkCount);
});

test("attempt reservation can stop a malformed-output retry before a second request", async () => {
  let modelCalls = 0;
  let starts = 0;
  let finishes = 0;
  await assert.rejects(
    extractGroundedCreatorSourceFacts({
      storedVisibleText: "Slap Rinka",
      model: async () => {
        modelCalls += 1;
        return { content: { invalid: true }, inputTokens: 5, outputTokens: 2, costUsd: 0.001 };
      },
      onModelAttemptStart: upperBound => {
        starts += 1;
        if (starts === 2) throw new Error("request budget exhausted");
        return { upperBound };
      },
      onModelAttemptFinish: () => {
        finishes += 1;
      },
    }),
    /request budget exhausted/,
  );
  assert.equal(modelCalls, 1);
  assert.equal(starts, 2);
  assert.equal(finishes, 1);
});

test("concurrent extraction starts cannot over-reserve and every reservation releases", async () => {
  let reserved = 0;
  let starts = 0;
  let finishes = 0;
  const extract = () => extractGroundedCreatorSourceFacts({
    storedVisibleText: "Slap Rinka",
    model: async () => ({
      content: { places: [] }, inputTokens: 5, outputTokens: 2, costUsd: 0.001,
    }),
    onModelAttemptStart: upperBound => {
      if (reserved + 1 > 2) throw new Error("concurrent request budget exhausted");
      reserved += 1;
      starts += 1;
      return { upperBound, slot: starts };
    },
    onModelAttemptFinish: ({ reservation, upperBound }) => {
      assert.equal(reservation.upperBound, upperBound);
      reserved -= 1;
      finishes += 1;
    },
  });
  const results = await Promise.allSettled([extract(), extract(), extract()]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 2);
  assert.equal(results.filter(result => result.status === "rejected").length, 1);
  assert.equal(starts, 2);
  assert.equal(finishes, 2);
  assert.equal(reserved, 0);
});

test("composite routing preserves only independently grounded page provenance", () => {
  const pages = [
    { pageId: "a", storedVisibleText: "Izlet vodi do Slapa Rinka pri Solčavi." },
    { pageId: "b", storedVisibleText: "Mozirski gaj je odprt za obiskovalce." },
    { pageId: "c", storedVisibleText: "Splošne turistične informacije." },
  ];
  const facts = [
    { canonicalName: "Slap Rinka", settlement: "Solčava", categoryKey: "sights" as const, evidence: "Slapa Rinka" },
    { canonicalName: "Mozirski gaj", settlement: null, categoryKey: "sights" as const, evidence: "Mozirski gaj" },
  ];
  const composite = buildCreatorSourceCompositeDocument(pages);
  assert.match(composite, /CREATOR_SOURCE_PAGE_0001_START/);
  assert.ok(composite.indexOf("Slapa Rinka") < composite.indexOf("Mozirski gaj"));
  const routed = routeGroundedCreatorSourceFactsToPages(pages, facts);
  assert.deepEqual(routed.map(page => page.facts.map(fact => fact.canonicalName)), [
    ["Slap Rinka"],
    ["Mozirski gaj"],
    [],
  ]);
});

test("composite routing retains one supported fact on two independent pages", () => {
  const pages = [
    { pageId: "a", storedVisibleText: "Obiščite Mozirski gaj." },
    { pageId: "b", storedVisibleText: "Mozirski gaj ponuja razstave." },
  ];
  const [fact] = [{
    canonicalName: "Mozirski gaj", settlement: null,
    categoryKey: "sights" as const, evidence: "Mozirski gaj",
  }];
  const routed = routeGroundedCreatorSourceFactsToPages(pages, [fact]);
  assert.deepEqual(routed.map(page => page.facts.map(item => item.canonicalName)), [
    ["Mozirski gaj"],
    ["Mozirski gaj"],
  ]);
});

test("run abort signal reaches a hung extraction model", async () => {
  await assert.rejects(
    extractGroundedCreatorSourceFacts({
      storedVisibleText: "Slap Rinka",
      signal: AbortSignal.timeout(5),
      model: async ({ signal }) => new Promise((_, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
    }),
    /timeout|aborted/i,
  );
});

test("grounding counts malformed, noisy, unsupported settlement, category, and duplicates", () => {
  const text = "Slap Rinka pri Solčavi. Domov.";
  const result = groundCreatorSourceCandidates(text, {
    places: [
      null,
      { canonicalName: "Slap Rinka", settlement: null, categoryKey: "unknown", evidence: "Slap Rinka" },
      { canonicalName: "Domov", settlement: null, categoryKey: "trips", evidence: "Domov" },
      { canonicalName: "Slap Rinka", settlement: "Ljubljana", categoryKey: "sights", evidence: "Slap Rinka" },
      { canonicalName: "Slap Rinka", settlement: null, categoryKey: "sights", evidence: "Slap Rinka" },
      { canonicalName: "Slap Rinka", settlement: null, categoryKey: "sights", evidence: "Slap Rinka" },
    ],
  });
  assert.equal(result.rejectionCounts.invalid_shape, 1);
  assert.equal(result.rejectionCounts.invalid_category, 1);
  assert.equal(result.rejectionCounts.metadata_noise, 1);
  assert.equal(result.rejectionCounts.unsupported_settlement, 1);
  assert.equal(result.rejectionCounts.duplicate, 1);
});