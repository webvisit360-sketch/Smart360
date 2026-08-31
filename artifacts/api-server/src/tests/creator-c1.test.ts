import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { and, eq, like } from "drizzle-orm";
import { creatorPlaceProposalsTable, creatorRunsTable, db, tenantsTable } from "@workspace/db";
import { StartCreatorRunResponse } from "@workspace/api-zod";
import {
  assignCreatorC1Range,
  calculateCreatorC1Cost,
  CREATOR_C1_BATCH_SIZE,
  CREATOR_C1_PRICING,
  generateCreatorC1Batch,
  promptFor,
  serializeCreatorC1Report,
  validateCreatorC1Batch,
  validateCreatorC1LocalQuota,
  validateCreatorC1ModelOutput,
  withCreatorC1DescriptionPolicy,
  runCreatorC1,
  type CreatorC1Report,
} from "../lib/creatorC1";
import { runCreatorSieve } from "../lib/creatorSieve";
import { computeRoadRoute } from "../lib/distanceEngine";
import type { CreatorDependencyAttempt } from "../lib/creatorDependencyTelemetry";
import {
  CREATOR_NEAR_RING_ENVELOPE_KM,
  CREATOR_SETTLEMENT_FEATURE_RADIUS_KM,
  clearCreatorNearRingCacheForTests,
  deriveCreatorSettlementFeatureCounts,
  deriveNearestSurroundingSettlementNames,
  enumerateCreatorNearRing,
  getCachedCreatorNearRing,
  matchUniqueCreatorNearRingCandidate,
  type CreatorNearRingAttempt,
} from "../lib/creatorNearRing";
import {
  claimCreatorRunOnce,
  isPreservedMeninaEvidenceTenant,
  MENINA_AUTHORIZED_RUN_COUNT,
} from "../lib/creatorMeninaProductionRun";
import { upsertPendingCreatorProposal } from "../lib/creatorProposalLedger";
import { creatorRunResponse } from "../routes/adminCreator";

function place(index: number, existingCategoryId: string | null = "category"): unknown {
  return {
    proposedName: `Place ${index}`,
    existingCategoryId,
    targetSettlement: null,
    languages: ["sl", "en", "de", "it"].map((language) => ({
      language, name: `Name ${index}`, description: "Description",
    })),
    geocodingLookupHint: `Place ${index}, Slovenia`,
    inclusionReason: "It belongs in the guide.",
  };
}

test("C1 rejects forbidden machine facts and permits a null existing category", () => {
  assert.equal(validateCreatorC1ModelOutput([place(1, null)])[0]?.existingCategoryId, null);
  assert.throws(() => validateCreatorC1ModelOutput([{ ...place(1) as object, latitude: 46.3 }]), /forbidden field/);
});

test("C1 batch requires exactly fifteen rows and retries malformed output once", async () => {
  assert.throws(() => validateCreatorC1Batch({ places: [place(1)] }), /exactly 15/);
  let calls = 0;
  const generated = await generateCreatorC1Batch(async () => {
    calls++;
    return {
      content: {
        places: calls === 1
          ? [place(1)]
          : Array.from({ length: CREATOR_C1_BATCH_SIZE }, (_, index) => place(index)),
      },
      inputTokens: 10, outputTokens: 5, costUsd: 0.02,
    };
  }, "server prompt");
  assert.equal(calls, 2);
  assert.equal(generated.places.length, 15);
  assert.equal(generated.inputTokens, 20);
  assert.equal(generated.outputTokens, 10);
  assert.equal(generated.costUsd, 0.04);
});

test("C1 model retries retain one dependency attempt per provider call", async () => {
  const dependencies: CreatorDependencyAttempt[] = [];
  let calls = 0;
  const generated = await generateCreatorC1Batch(async ({ onDependencyAttempt }) => {
    calls++;
    onDependencyAttempt?.({
      dependency: "openai",
      operation: "completion",
      attempt: 1,
      ok: true,
      httpStatus: 200,
      durationMs: 12,
      rawElementCount: 1,
      filteredElementCount: 1,
      query: null,
      error: null,
    });
    return {
      content: {
        places: calls === 1
          ? [place(1)]
          : Array.from({ length: CREATOR_C1_BATCH_SIZE }, (_, index) => place(index)),
      },
      inputTokens: 10,
      outputTokens: 5,
      costUsd: 0.01,
    };
  }, "server prompt", undefined, (attempt) => dependencies.push(attempt));
  assert.equal(generated.places.length, CREATOR_C1_BATCH_SIZE);
  assert.deepEqual(dependencies.map((attempt) => attempt.attempt), [1, 2]);
});

test("C1 local quota rejects unknown settlements and fewer than eight local rows", () => {
  const eightLocal = Array.from({ length: CREATOR_C1_BATCH_SIZE }, (_, index) => {
    const candidate = validateCreatorC1ModelOutput([place(index)])[0]!;
    candidate.targetSettlement = index < 8 ? "Mozirje" : null;
    return candidate;
  });
  assert.doesNotThrow(() => validateCreatorC1LocalQuota(eightLocal, [
    { name: "Mozirje", featureCount: 8 },
    { name: "Nazarje", featureCount: 1 },
  ]));
  assert.throws(
    () => validateCreatorC1LocalQuota(eightLocal.map((candidate, index) => ({
      ...candidate,
      targetSettlement: index < 7 ? "Mozirje" : null,
    })), [{ name: "Mozirje", featureCount: 8 }]),
    /at least 8/,
  );
  assert.throws(
    () => validateCreatorC1LocalQuota(eightLocal.map((candidate, index) => ({
      ...candidate,
      targetSettlement: index === 0 ? "Invented town" : candidate.targetSettlement,
    })), [{ name: "Mozirje", featureCount: 8 }]),
    /unknown settlement/,
  );
  assert.throws(
    () => validateCreatorC1LocalQuota(eightLocal, [{ name: "Mozirje", featureCount: 7 }]),
    /exceeded.*7 catalogue features/,
  );
  assert.throws(
    () => validateCreatorC1LocalQuota(eightLocal, [{ name: "Mozirje", featureCount: 0 }]),
    /without catalogue features/,
  );
});

test("C1 retries a batch that repeats an earlier normalized name", async () => {
  let calls = 0;
  const generated = await generateCreatorC1Batch(async () => {
    calls++;
    return {
      content: {
        places: Array.from({ length: CREATOR_C1_BATCH_SIZE }, (_, index) => {
          const candidate = place(index) as Record<string, unknown>;
          if (calls === 1 && index === 0) candidate.proposedName = "Mozirski gaj";
          return candidate;
        }),
      },
      inputTokens: 10, outputTokens: 5, costUsd: 0.02,
    };
  }, "server prompt", (places) => {
    if (places.some((candidate) => candidate.proposedName === "Mozirski gaj")) {
      throw new Error("C1 batch repeated a proposed name");
    }
  });
  assert.equal(calls, 2);
  assert.equal(generated.places.length, CREATOR_C1_BATCH_SIZE);
});

test("C1 geocoding uses the plain name first and lookup hint only after no results", async () => {
  const queries: string[] = [];
  const dependencies: CreatorDependencyAttempt[] = [];
  const result = await runCreatorSieve("Slap Rinka", { latitude: 46.31, longitude: 14.91 }, {
    fallbackQuery: "Slap Rinka, Logarska dolina, Solčava, Slovenia",
    fetchFn: async (url) => {
      queries.push(new URL(String(url)).searchParams.get("q") ?? "");
      return new Response(JSON.stringify(queries.length === 1 ? [] : [{
        osm_type: "node",
        osm_id: 123456789,
        category: "natural",
        type: "waterfall",
        addresstype: "natural",
        name: "Rinka",
        display_name: "Slap Rinka, Logarska dolina, Slovenija",
        lat: "46.3694",
        lon: "14.5953",
        namedetails: { name: "Rinka" },
        address: { municipality: "Solčava" },
        importance: 0.5,
      }]), { status: 200, headers: { "content-type": "application/json" } });
    },
    onDependencyAttempt: (attempt) => dependencies.push(attempt),
  });
  assert.deepEqual(queries, [
    "Slap Rinka",
    "Slap Rinka, Logarska dolina, Solčava, Slovenia",
  ]);
  assert.equal(result.attempts.length, 2);
  assert.equal(result.originalQuery, "Slap Rinka");
  assert.equal(result.confirmedQuery, queries[1]);
  assert.equal(result.verdict, "resolved");
  assert.deepEqual(dependencies.map((attempt) => ({
    status: attempt.httpStatus,
    count: attempt.rawElementCount,
    filtered: attempt.filteredElementCount,
    query: attempt.query,
  })), [
    { status: 200, count: 0, filtered: 0, query: "Slap Rinka" },
    { status: 200, count: 1, filtered: 1, query: "Slap Rinka, Logarska dolina, Solčava, Slovenia" },
  ]);
});

test("OSRM reports invalid-route telemetry without throwing", async () => {
  const dependencies: CreatorDependencyAttempt[] = [];
  const route = await computeRoadRoute(
    { latitude: 46.31, longitude: 14.91 },
    { latitude: 46.32, longitude: 14.92 },
    async () => new Response(JSON.stringify({ routes: [] }), { status: 200 }),
    (attempt) => dependencies.push(attempt),
  );
  assert.equal(route, null);
  assert.equal(dependencies.length, 1);
  assert.equal(dependencies[0]?.dependency, "osrm");
  assert.equal(dependencies[0]?.httpStatus, 200);
  assert.match(dependencies[0]?.error ?? "", /invalid route/);
});

test("C1 strips a corroborated multi-word generic type phrase", async () => {
  const result = await runCreatorSieve(
    "Krajinski park Golte",
    { latitude: 46.31, longitude: 14.91 },
    {
      fetchFn: async () => new Response(JSON.stringify([{
        osm_type: "relation",
        osm_id: 987654321,
        category: "leisure",
        type: "protected_area",
        addresstype: "protected_area",
        name: "Golte",
        display_name: "Golte, Mozirje, Slovenija",
        lat: "46.3700",
        lon: "14.9000",
        namedetails: { name: "Golte" },
        address: { municipality: "Mozirje" },
        importance: 0.5,
      }]), { status: 200, headers: { "content-type": "application/json" } }),
    },
  );

  assert.equal(result.verdict, "resolved");
  if (result.verdict === "resolved") {
    assert.equal(result.confirmationMethod, "generic_type");
    assert.equal(result.candidate.returnedName, "Golte");
  }
});

test("C1 does not strip a multi-word generic phrase without OSM type corroboration", async () => {
  const result = await runCreatorSieve(
    "Krajinski park Golte",
    { latitude: 46.31, longitude: 14.91 },
    {
      fetchFn: async () => new Response(JSON.stringify([{
        osm_type: "node",
        osm_id: 987654322,
        category: "tourism",
        type: "viewpoint",
        addresstype: "tourism",
        name: "Golte",
        display_name: "Golte, Mozirje, Slovenija",
        lat: "46.3700",
        lon: "14.9000",
        namedetails: { name: "Golte" },
        address: { municipality: "Mozirje" },
        importance: 0.5,
      }]), { status: 200, headers: { "content-type": "application/json" } }),
    },
  );

  assert.equal(result.verdict, "refused");
  if (result.verdict === "refused") assert.equal(result.rule, "name-mismatch");
});

test("near-ring matching is bounded, tolerant, type-corroborated and unique", () => {
  assert.equal(CREATOR_NEAR_RING_ENVELOPE_KM, 35);
  const candidate = {
    osmType: "relation", osmId: 44, className: "historic", type: "archaeological_site",
    addresstype: "historic", returnedName: "Rimska nekropola",
    displayName: "Rimska nekropola", latitude: 46.25, longitude: 15.1,
    distanceKm: 22, aliases: [], isSettlement: false,
  };
  assert.equal(
    matchUniqueCreatorNearRingCandidate("Rimska nekropola v Šempetru", [candidate])?.osmId,
    44,
  );
  assert.equal(
    matchUniqueCreatorNearRingCandidate("Rimska nekropola v Šempetru", [
      candidate,
      { ...candidate, osmType: "way", osmId: 45, latitude: 46.2502, longitude: 15.1002 },
    ])?.osmId,
    44,
  );
  assert.equal(
    matchUniqueCreatorNearRingCandidate("Rimska nekropola v Šempetru", [
      candidate,
      { ...candidate, osmType: "way", osmId: 45, latitude: 46.27, longitude: 15.12 },
    ]),
    null,
  );
  assert.equal(
    matchUniqueCreatorNearRingCandidate("Rimska nekropola v Šempetru", [
      candidate,
      { ...candidate, osmType: "way", osmId: 45, latitude: 46.253, longitude: 15.1 },
      { ...candidate, osmType: "relation", osmId: 46, latitude: 46.256, longitude: 15.1 },
    ]),
    null,
  );
  assert.equal(
    matchUniqueCreatorNearRingCandidate("Vas Solčava", [
      {
        ...candidate,
        osmId: 47,
        className: "place",
        type: "village",
        addresstype: "place",
        returnedName: "Solčava",
        displayName: "Solčava",
        isSettlement: true,
      },
      {
        ...candidate,
        osmId: 48,
        className: "tourism",
        type: "attraction",
        addresstype: "tourism",
        returnedName: "Solčava",
        displayName: "Solčava",
        isSettlement: false,
      },
    ]),
    null,
  );
  const church = {
    ...candidate,
    className: "amenity",
    type: "place_of_worship",
    returnedName: "Župnijska cerkev svete Elizabete Ogrske",
    displayName: "Župnijska cerkev svete Elizabete Ogrske",
  };
  assert.equal(
    matchUniqueCreatorNearRingCandidate("Cerkev sv. Elizabete", [
      church,
      {
        ...church,
        osmId: 47,
        returnedName: "Cerkev sv. Jakoba",
        displayName: "Cerkev sv. Jakoba",
      },
    ])?.osmId,
    44,
  );
  assert.equal(
    matchUniqueCreatorNearRingCandidate("Cerkev sv. Elizabete", [{
      ...church,
      returnedName: "Cerkev sv. Jakoba",
      displayName: "Cerkev sv. Jakoba",
    }]),
    null,
  );
  const genericLeaderCases = [
    { proposal: "Muzej Velenje", good: "Velenje", wrong: "Celje", type: "museum" },
    { proposal: "Slap Rinka", good: "Rinka", wrong: "Palenk", type: "waterfall" },
    { proposal: "Grad Žovnek", good: "Žovnek", wrong: "Vrbovec", type: "castle" },
    { proposal: "Dolina Matkov kot", good: "Matkov kot", wrong: "Logarska", type: "valley" },
    { proposal: "Planina Grohot", good: "Grohot", wrong: "Raduha", type: "alpine_pasture" },
    { proposal: "Koča Grohot", good: "Grohot", wrong: "Klemenča jama", type: "alpine_hut" },
  ];
  for (const [index, entry] of genericLeaderCases.entries()) {
    const good = {
      ...candidate,
      osmId: 100 + index * 2,
      type: entry.type,
      returnedName: entry.good,
      displayName: entry.good,
    };
    const wrong = {
      ...good,
      osmId: good.osmId + 1,
      returnedName: entry.wrong,
      displayName: entry.wrong,
    };
    assert.equal(
      matchUniqueCreatorNearRingCandidate(entry.proposal, [good, wrong])?.osmId,
      good.osmId,
    );
    assert.equal(matchUniqueCreatorNearRingCandidate(entry.proposal, [wrong]), null);
  }
  assert.equal(
    matchUniqueCreatorNearRingCandidate("Dolina Matkov kot", [{
      ...candidate,
      osmId: 150,
      className: "tourism",
      type: "attraction",
      addresstype: "tourism",
      returnedName: "Matkov kot",
      displayName: "Matkov kot",
    }]),
    null,
  );
  assert.equal(
    matchUniqueCreatorNearRingCandidate("Krajinski park Golte", [{
      ...candidate, osmId: 46, type: "viewpoint", returnedName: "Golte",
    }]),
    null,
  );
});

test("near-ring enumeration uses split bounding-box whitelists, circle filtering and deduplication", async () => {
  const requested: string[] = [];
  const attempts: CreatorNearRingAttempt[] = [];
  const candidates = await enumerateCreatorNearRing({ latitude: 46.3, longitude: 14.9 }, async (_url, init) => {
    requested.push(new URLSearchParams(String(init?.body)).get("data") ?? "");
    return new Response(JSON.stringify({ elements: [
      { type: "way", id: 1, center: { lat: 46.31, lon: 14.91 }, tags: { highway: "primary", name: "Road" } },
      { type: "relation", id: 2, center: { lat: 46.32, lon: 14.92 }, tags: { boundary: "administrative", name: "Noise" } },
      { type: "node", id: 3, lat: 46.33, lon: 14.93, tags: { tourism: "museum", name: "Muzej", "name:en": "Museum" } },
      { type: "node", id: 4, lat: 46.31, lon: 14.91, tags: { amenity: "restaurant", name: "Restaurant noise" } },
      { type: "node", id: 5, lat: 46.7, lon: 14.9, tags: { natural: "peak", name: "Outside circle" } },
      { type: "way", id: 6, center: { lat: 46.31, lon: 14.91 }, tags: { leisure: "sports_centre", sport: "ski_jumping", name: "Savina Ski Jumping Center" } },
      { type: "node", id: 7, lat: 46.31, lon: 14.91, tags: { tourism: "alpine_hut", name: "Mountain hut" } },
      { type: "way", id: 8, center: { lat: 46.31, lon: 14.91 }, tags: { waterway: "river", name: "Named river" } },
      { type: "way", id: 9, center: { lat: 46.31, lon: 14.91 }, tags: { highway: "secondary", bridge: "yes", name: "Named bridge" } },
      { type: "node", id: 10, lat: 46.31, lon: 14.91, tags: { man_made: "observation_tower", name: "Observation tower" } },
    ] }), { status: 200 });
  }, (attempt) => attempts.push(attempt));
  assert.equal(requested.length, 6);
  const overpass = requested.join("\n");
  assert.match(overpass, /\[tourism~"\^\(attraction\|artwork\|viewpoint\|museum/);
  assert.match(overpass, /\[amenity~"\^\(place_of_worship\|monastery\|museum\|theatre\|arts_centre\)\$"\]/);
  assert.match(overpass, /\[leisure~"\^\(park\|nature_reserve\|garden\)\$"\]/);
  assert.match(overpass, /\[leisure~"\^\(sports_centre\|pitch\|stadium\|track\|swimming_area\)\$"\]/);
  assert.match(overpass, /\[sport\]\[name\]/);
  assert.match(overpass, /alpine_hut\|wilderness_hut\|picnic_site/);
  assert.match(overpass, /\[natural~"\^\(peak\|waterfall\|cave_entrance\|spring\|water\|cliff\|valley\)\$"\]/);
  assert.match(overpass, /\[man_made~"\^\(tower\|lighthouse\|observation_tower\)\$"\]/);
  assert.match(overpass, /\[waterway~"\^\(river\|stream\|waterfall\)\$"\]/);
  assert.match(overpass, /\[bridge\]\[name\]/);
  assert.match(overpass, /\[landuse~"\^\(winter_sports\)\$"\]/);
  assert.match(overpass, /\[historic\]\[name\]/);
  assert.match(overpass, /boundary=protected_area/);
  assert.match(overpass, /type=route/);
  assert.match(overpass, /\[place~/);
  assert.doesNotMatch(overpass, /around:/);
  assert.match(overpass, /nwr\(45\.\d+,14\.\d+,46\.\d+,15\.\d+\)/);
  assert.deepEqual(candidates.map((candidate) => candidate.osmId), [3, 6, 7, 8, 9, 10]);
  assert.deepEqual(candidates[0]?.aliases, ["Museum"]);
  assert.equal(attempts.length, 6);
  assert.equal(attempts.every((attempt) =>
    attempt.attempt === 1 && attempt.status === 200 &&
    attempt.rawCount === 10 && attempt.filteredCount === 6 && attempt.error === null), true);
});

test("near-ring retries one transient failure and caches only the merged catalogue", async () => {
  clearCreatorNearRingCacheForTests();
  let calls = 0;
  const attempts: CreatorNearRingAttempt[] = [];
  const fetchFn = async () => {
    calls++;
    if (calls === 1) return new Response("", { status: 503 });
    return new Response(JSON.stringify({ elements: [] }), { status: 200 });
  };
  await getCachedCreatorNearRing(
    "tenant-cache-test", { latitude: 46.3, longitude: 14.9 }, fetchFn,
    (attempt) => attempts.push(attempt),
  );
  await getCachedCreatorNearRing(
    "tenant-cache-test", { latitude: 46.3, longitude: 14.9 }, fetchFn,
    (attempt) => attempts.push(attempt),
  );
  assert.equal(calls, 7);
  assert.deepEqual(attempts.slice(0, 2).map(({ attempt, status }) => ({ attempt, status })), [
    { attempt: 1, status: 503 },
    { attempt: 2, status: 200 },
  ]);
  await getCachedCreatorNearRing("tenant-cache-test", { latitude: 46.31, longitude: 14.9 }, fetchFn);
  assert.equal(calls, 13);
});

test("near-ring merges successful groups but rejects an all-failed catalogue", async () => {
  let calls = 0;
  const partialAttempts: CreatorNearRingAttempt[] = [];
  const partial = await enumerateCreatorNearRing(
    { latitude: 46.3, longitude: 14.9 },
    async () => {
      calls++;
      if (calls === 1) return new Response("", { status: 400 });
      return new Response(JSON.stringify({ elements: [{
        type: "node",
        id: 901,
        lat: 46.31,
        lon: 14.91,
        tags: { tourism: "attraction", name: "Partial success" },
      }] }), { status: 200 });
    },
    (attempt) => partialAttempts.push(attempt),
  );
  assert.equal(partial.length, 1);
  assert.equal(partialAttempts.length, 6);
  assert.equal(partialAttempts[0]?.error, "Overpass 400");

  const failedAttempts: CreatorNearRingAttempt[] = [];
  await assert.rejects(
    enumerateCreatorNearRing(
      { latitude: 46.3, longitude: 14.9 },
      async () => new Response("", { status: 400 }),
      (attempt) => failedAttempts.push(attempt),
    ),
    /All Overpass catalogue requests failed/,
  );
  assert.equal(failedAttempts.length, 6);
  assert.equal(failedAttempts.every((attempt) => attempt.error === "Overpass 400"), true);
});

test("a partial near-ring catalogue is never cached", async () => {
  clearCreatorNearRingCacheForTests();
  let calls = 0;
  const fetchFn = async () => {
    calls++;
    if (calls === 1) return new Response("", { status: 400 });
    return new Response(JSON.stringify({ elements: [] }), { status: 200 });
  };
  await getCachedCreatorNearRing("partial-cache-test", { latitude: 46.3, longitude: 14.9 }, fetchFn);
  assert.equal(calls, 6);
  await getCachedCreatorNearRing("partial-cache-test", { latitude: 46.3, longitude: 14.9 }, fetchFn);
  assert.equal(calls, 12);
});

test("settlements require an explicit settlement proposal and never fuzzy-match arbitrary places", () => {
  const settlement = {
    osmType: "node", osmId: 91, className: "settlement", type: "village",
    addresstype: "settlement", returnedName: "Solčava", displayName: "Solčava",
    latitude: 46.42, longitude: 14.69, distanceKm: 4, aliases: [], isSettlement: true,
  };
  assert.equal(matchUniqueCreatorNearRingCandidate("Solčava", [settlement]), null);
  assert.equal(matchUniqueCreatorNearRingCandidate("Vas Solčava", [settlement])?.osmId, 91);
});

test("surrounding settlement names are nearest-first, deterministic and normalized-unique", () => {
  const settlement = {
    osmType: "node", osmId: 91, className: "settlement", type: "village",
    addresstype: "settlement", returnedName: "Solčava", displayName: "Solčava",
    latitude: 46.42, longitude: 14.69, distanceKm: 4, aliases: [], isSettlement: true,
  };
  const names = deriveNearestSurroundingSettlementNames([
    { ...settlement, osmId: 94, returnedName: "Mozirje", displayName: "Mozirje", distanceKm: 8 },
    { ...settlement, osmId: 93, returnedName: "SOLCAVA", displayName: "SOLCAVA", distanceKm: 6 },
    { ...settlement, osmId: 92, returnedName: "Luče", displayName: "Luče", distanceKm: 4 },
    settlement,
    { ...settlement, osmId: 95, returnedName: "Not a settlement", isSettlement: false, distanceKm: 1 },
  ]);
  assert.deepEqual([...names], ["Luče", "Solčava", "Mozirje"]);
});

test("quota settlements exclude zero-feature places and count each nearby OSM feature once", () => {
  assert.equal(CREATOR_SETTLEMENT_FEATURE_RADIUS_KM, 5);
  const settlement = {
    osmType: "node", osmId: 91, className: "settlement", type: "village",
    addresstype: "settlement", returnedName: "Solčava", displayName: "Solčava",
    latitude: 46.42, longitude: 14.69, distanceKm: 4, aliases: [], isSettlement: true,
  };
  const feature = {
    osmType: "way", osmId: 101, className: "tourism", type: "attraction",
    addresstype: "tourism", returnedName: "Real attraction", displayName: "Real attraction",
    latitude: 46.421, longitude: 14.691, distanceKm: 4.1, aliases: [], isSettlement: false,
  };
  const counts = deriveCreatorSettlementFeatureCounts([
    settlement,
    { ...settlement, osmId: 92, returnedName: "Empty hamlet", displayName: "Empty hamlet", longitude: 14.8 },
    feature,
    { ...feature },
  ]);
  assert.deepEqual(counts, [{ name: "Solčava", featureCount: 1 }]);
});

test("Nominatim infrastructure failures stay unresolved rather than rejected editorially", async () => {
  const result = await runCreatorSieve("Resnični kraj", { latitude: 46, longitude: 15 }, {
    fetchFn: async () => { throw new Error("network unavailable"); },
  });
  assert.equal(result.verdict, "refused");
  if (result.verdict === "refused") assert.equal(result.rule, "nominatim-unavailable");
});

test("later C1 batches receive prior names and practical places are forbidden", () => {
  const prompt = promptFor({
    origin: { latitude: 46.31, longitude: 14.91 },
    region: "Savinjska",
    tenantType: "kamp",
    categories: [],
    rejectedNames: ["Human rejected place"],
    priorProposedNames: ["Mozirski gaj", "Golte"],
    alreadyConfirmedNames: ["Logarska dolina"],
    surroundingSettlements: [
      { name: "Rečica ob Savinji", featureCount: 12 },
      { name: "Mozirje", featureCount: 9 },
    ],
  });
  assert.match(prompt, /Never propose any durable rejection: \["Human rejected place"\]/);
  assert.match(prompt, /already in the guide.*\["Logarska dolina"\]/);
  assert.doesNotMatch(prompt, /previously could not be confirmed|unconfirmed names|discouraged/i);
  assert.match(prompt, /Do not repeat any name already proposed by an earlier batch/);
  assert.match(prompt, /\["Mozirski gaj","Golte"\]/);
  assert.match(prompt, /Never propose proximity-selected practical services/);
  assert.match(prompt, /roughly half of the 15 proposals/);
  assert.match(prompt, /within about 20 minutes' drive/);
  assert.match(prompt, /within 90 minutes' drive/);
  assert.match(prompt, /Do not propose any place expected to require more than 90 minutes/);
  assert.match(prompt, /at least 8 of the 15 proposals/);
  assert.match(prompt, /"name":"Rečica ob Savinji","featureCount":12/);
  assert.match(prompt, /zero-feature settlements were removed/);
  assert.match(prompt, /Never target more proposals.*featureCount/);
});

test("C1 ranges use OSRM minute boundaries and practical descriptions are blank", () => {
  assert.equal(assignCreatorC1Range({ isNearestPractical: false, durationMinutes: 20 }), "near");
  assert.equal(assignCreatorC1Range({ isNearestPractical: false, durationMinutes: 20.01 }), "excursion");
  assert.equal(assignCreatorC1Range({ isNearestPractical: true, durationMinutes: 200 }), "practical");
  const languages = validateCreatorC1ModelOutput([place(1)])[0]!.languages;
  assert.deepEqual(withCreatorC1DescriptionPolicy({ key: "restaurant", label: "Hospitality" }, languages).map((t) => t.description), ["", "", "", ""]);
  assert.deepEqual(withCreatorC1DescriptionPolicy({ key: "pharmacy", label: "Pharmacy" }, languages).map((t) => t.description), ["", "", "", ""]);
});

test("C1 cost uses the pinned public Terra rates and cached-token discount", () => {
  assert.equal(calculateCreatorC1Cost({
    inputTokens: 100_000,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 100_000,
  }), 1.4);
  assert.equal(calculateCreatorC1Cost({
    inputTokens: 100_000,
    cachedInputTokens: 100_000,
    cacheWriteTokens: 0,
    outputTokens: 0,
  }), 0.02);
});

test("C1 report serialization retains durable metrics, outcomes and sanitized failure", () => {
  const serialized = serializeCreatorC1Report({
    status: "failed", proposed: 15, confirmed: 8, unconfirmed: 4, duplicatesMerged: 3,
    outsidePractical: 1, outsideNear: 2, outsideExcursion: 1,
    routeFailures: 1,
    inputTokens: 100, outputTokens: 50, costUsd: 0.12, wallClockMs: 321,
    nominatimThrottleWaitMs: 123, error: "safe failure",
    nearEnvelopeKm: 35, nearEnvelopeEdgeBandCount: 1,
    dependencyAttempts: [],
    nearCatalogue: {
      status: "success",
      requestCount: 4,
      httpStatuses: [200, 200, 200, 200],
      durationMs: 500,
      rawElementCount: 100,
      filteredElementCount: 80,
      error: null,
      queries: ["query"],
    },
    surroundingSettlements: ["Rečica ob Savinji"],
    surroundingSettlementFeatureCounts: [{ name: "Rečica ob Savinji", featureCount: 12 }],
    minimumLocalProposalsPerBatch: 8,
    localProposalCount: 8,
    quotaTargetedProposalCount: 8,
    quotaTargetedUnconfirmedCount: 3,
    nearRingResolvedAfterGlobalSieveFailedCount: 2,
    pricing: CREATOR_C1_PRICING,
    outcomes: [{
      proposedName: "Missing place",
      targetSettlement: "Rečica ob Savinji",
      categoryLabel: "Izleti",
      inclusionReason: "A useful local landmark.",
      outcome: "unconfirmed",
      refusalRule: "no-results",
      roadDistanceM: null,
      travelDurationS: null,
      nearestAlternatives: [],
    }],
    unconfirmedByCategory: [{
      categoryLabel: "Izleti",
      proposals: [{
        proposedName: "Missing place",
        targetSettlement: "Rečica ob Savinji",
        inclusionReason: "A useful local landmark.",
        refusalRule: "no-results",
        roadDistanceM: null,
        travelDurationS: null,
      }],
    }],
  });
  const report = JSON.parse(serialized);
  assert.equal(report.nominatimThrottleWaitMs, 123);
  assert.equal(report.outcomes[0].refusalRule, "no-results");
  assert.equal(report.outcomes[0].targetSettlement, "Rečica ob Savinji");
  assert.equal(report.quotaTargetedUnconfirmedCount, 3);
  assert.equal(report.nearRingResolvedAfterGlobalSieveFailedCount, 2);
  assert.equal(report.status, "failed");
});

test("API run evidence remains identical after its proposal row changes", async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `c1-immutable-report-${suffix}`,
    name: `C1 immutable report ${suffix}`,
  }).returning({ id: tenantsTable.id });
  assert.ok(tenant);
  const immutableReport: CreatorC1Report = {
    status: "completed",
    proposed: 1,
    confirmed: 0,
    unconfirmed: 1,
    duplicatesMerged: 0,
    outsidePractical: 0,
    outsideNear: 0,
    outsideExcursion: 0,
    routeFailures: 0,
    inputTokens: 10,
    outputTokens: 5,
    costUsd: 0.01,
    wallClockMs: 100,
    nominatimThrottleWaitMs: 0,
    nearEnvelopeKm: 35,
    nearEnvelopeEdgeBandCount: 0,
    dependencyAttempts: [],
    nearCatalogue: {
      status: "success",
      requestCount: 4,
      httpStatuses: [200, 200, 200, 200],
      durationMs: 40,
      rawElementCount: 5,
      filteredElementCount: 4,
      error: null,
      queries: ["q"],
    },
    surroundingSettlements: ["Varpolje"],
    surroundingSettlementFeatureCounts: [{ name: "Varpolje", featureCount: 4 }],
    minimumLocalProposalsPerBatch: 8,
    localProposalCount: 1,
    quotaTargetedProposalCount: 1,
    quotaTargetedUnconfirmedCount: 1,
    nearRingResolvedAfterGlobalSieveFailedCount: 0,
    pricing: CREATOR_C1_PRICING,
    outcomes: [{
      proposedName: "Immutable place",
      targetSettlement: "Varpolje",
      categoryLabel: null,
      inclusionReason: "Stored reason",
      outcome: "unconfirmed",
      refusalRule: "no-results",
      roadDistanceM: null,
      travelDurationS: null,
      nearestAlternatives: [],
    }],
    unconfirmedByCategory: [{
      categoryLabel: null,
      proposals: [{
        proposedName: "Immutable place",
        targetSettlement: "Varpolje",
        inclusionReason: "Stored reason",
        refusalRule: "no-results",
        roadDistanceM: null,
        travelDurationS: null,
      }],
    }],
  };
  const [run] = await db.insert(creatorRunsTable).values({
    tenantId: tenant.id,
    originLatitude: 46.31,
    originLongitude: 14.91,
    status: "completed",
    completedAt: new Date(),
    reportJson: serializeCreatorC1Report(immutableReport),
  }).returning();
  assert.ok(run);
  const before = await creatorRunResponse(run);
  const parsed = StartCreatorRunResponse.parse(JSON.parse(JSON.stringify(before)));
  assert.equal(parsed.outcomes[0]?.targetSettlement, "Varpolje");
  assert.equal(
    parsed.unconfirmedByCategory[0]?.proposals[0]?.targetSettlement,
    "Varpolje",
  );
  const pending = await upsertPendingCreatorProposal({
    tenantId: tenant.id,
    runId: run.id,
    proposedName: "Immutable place",
    originalQuery: "Immutable place",
    contentReady: true,
  });
  await db.update(creatorPlaceProposalsTable).set({
    inclusionReason: "Later mutable reason",
    refusalReason: "operator-changed",
    roadDistanceM: 1234,
    travelDurationS: 567,
  }).where(eq(creatorPlaceProposalsTable.id, pending.proposal.id));
  const after = await creatorRunResponse(run);
  assert.deepEqual(after.outcomes, before.outcomes);
  assert.deepEqual(after.unconfirmedByCategory, before.unconfirmedByCategory);
  assert.equal(after.outcomes[0]?.inclusionReason, "Stored reason");
  assert.equal(after.outcomes[0]?.targetSettlement, "Varpolje");
  assert.equal(after.quotaTargetedProposalCount, 1);
  assert.equal(after.quotaTargetedUnconfirmedCount, 1);
  assert.deepEqual(after.surroundingSettlementFeatureCounts, [{ name: "Varpolje", featureCount: 4 }]);
  await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
});

test("only the exact Camping MENINA evidence tenant receives the authorized run ceiling", () => {
  assert.equal(MENINA_AUTHORIZED_RUN_COUNT, 5);
  assert.equal(isPreservedMeninaEvidenceTenant({
    name: "Camping MENINA",
    latitude: 46.311456,
    longitude: 14.9093051,
  }), true);
  assert.equal(isPreservedMeninaEvidenceTenant({
    name: "Camping MENINA",
    latitude: 46.312,
    longitude: 14.9093051,
  }), false);
  assert.equal(isPreservedMeninaEvidenceTenant({
    name: "Another camp",
    latitude: 46.311456,
    longitude: 14.9093051,
  }), false);
});

test("the authorized ceiling permits a fifth durable claim and blocks a sixth", async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `c1-five-run-limit-${suffix}`,
    name: `C1 five-run limit ${suffix}`,
  }).returning({ id: tenantsTable.id });
  assert.ok(tenant);
  const origin = { latitude: 46.311456, longitude: 14.9093051 };
  for (let index = 0; index < 4; index++) {
    const [run] = await db.insert(creatorRunsTable).values({
      tenantId: tenant.id,
      originLatitude: origin.latitude,
      originLongitude: origin.longitude,
      status: "completed",
      completedAt: new Date(),
    }).returning({ id: creatorRunsTable.id });
    assert.ok(run);
  }
  const fifth = await claimCreatorRunOnce(tenant.id, origin, MENINA_AUTHORIZED_RUN_COUNT);
  assert.ok(fifth.claimedRunId);
  await db.update(creatorRunsTable).set({
    status: "completed",
    completedAt: new Date(),
  }).where(eq(creatorRunsTable.id, fifth.claimedRunId!));
  const sixth = await claimCreatorRunOnce(tenant.id, origin, MENINA_AUTHORIZED_RUN_COUNT);
  assert.equal(sixth.claimedRunId, null);
  assert.ok(sixth.existingRun);
  await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
});

test("C1 routes only the winning global identity or an additive post-refusal near fallback", async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const prefix = `c1-precedence-${suffix}`;
  const [tenant] = await db.insert(tenantsTable).values({
    slug: prefix,
    name: `C1 precedence ${suffix}`,
  }).returning({ id: tenantsTable.id });
  assert.ok(tenant);
  const proposalNames = Array.from(
    { length: 15 },
    (_, index) => `Landmark${String.fromCharCode(65 + index)} ${suffix}`,
  );
  const content = Array.from({ length: 15 }, (_, index) => {
    const candidate = place(index, null) as Record<string, unknown>;
    candidate.proposedName = proposalNames[index];
    candidate.geocodingLookupHint = proposalNames[index];
    candidate.targetSettlement = index < 8 ? "Testville" : null;
    return candidate;
  });
  const routedDestinations: Array<{ latitude: number; longitude: number }> = [];
  const { report } = await runCreatorC1({
    tenantId: tenant.id,
    origin: { latitude: 46.31, longitude: 14.91 },
    region: "test",
    tenantType: "camp",
    batches: 1,
    model: async () => ({
      content: { places: content },
      inputTokens: 12,
      outputTokens: 34,
      costUsd: 0.01,
    }),
    fetchFn: async (url) => {
      if (String(url).includes("overpass-api.de")) {
        return new Response(JSON.stringify({ elements: [
          {
            type: "node",
            id: 7_100_000_001,
            lat: 46.31,
            lon: 14.91,
            tags: { place: "village", name: "Testville" },
          },
          ...Array.from({ length: 8 }, (_, index) => ({
            type: "node",
            id: 7_100_000_100 + index,
            lat: 46.311 + index * 0.0001,
            lon: 14.911,
            tags: { tourism: "attraction", name: proposalNames[index] },
          })),
        ] }), { status: 200 });
      }
      const query = new URL(String(url)).searchParams.get("q") ?? "";
      const index = proposalNames.indexOf(query);
      return new Response(JSON.stringify(index < 4 ? [{
        osm_type: "way",
        osm_id: 7_200_000_000 + index,
        category: "tourism",
        type: "attraction",
        addresstype: "tourism",
        name: query,
        display_name: `${query}, global`,
        lat: String(46.35 + index * 0.001),
        lon: "14.95",
        namedetails: { name: query },
        address: { municipality: "Global town" },
        importance: 0.5,
      }] : []), { status: 200, headers: { "content-type": "application/json" } });
    },
    osrm: async (_origin, destination) => {
      routedDestinations.push(destination);
      const nearDurationsS = [1201, 1200, 5400, 5401];
      const nearIndex = Math.round((destination.latitude - 46.3114) / 0.0001);
      return {
        distanceMeters: 1_000,
        durationMinutes: destination.latitude < 46.32
          ? nearDurationsS[nearIndex]! / 60
          : 10,
      };
    },
  });
  assert.equal(report.confirmed, 7);
  assert.equal(report.unconfirmed, 8);
  assert.equal(report.quotaTargetedProposalCount, 8);
  assert.equal(report.quotaTargetedUnconfirmedCount, 1);
  assert.equal(report.nearRingResolvedAfterGlobalSieveFailedCount, 4);
  assert.equal(report.outsideNear, 2);
  assert.equal(report.outsideExcursion, 1);
  assert.equal(report.outcomes[4]?.travelDurationS, 1201);
  assert.equal(report.outcomes[5]?.travelDurationS, 1200);
  assert.equal(report.outcomes[6]?.travelDurationS, 5400);
  assert.equal(report.outcomes[7]?.travelDurationS, 5401);
  assert.equal(report.outcomes[7]?.refusalRule, "duration-ceiling");
  assert.deepEqual(
    report.outcomes.slice(0, 8).map((outcome) => outcome.targetSettlement),
    Array.from({ length: 8 }, () => "Testville"),
  );
  assert.deepEqual(
    report.outcomes.slice(8).map((outcome) => outcome.targetSettlement),
    Array.from({ length: 7 }, () => null),
  );
  assert.equal(routedDestinations.length, 8);
  assert.deepEqual(
    routedDestinations.slice(0, 4).map((destination) => Number(destination.latitude.toFixed(4))),
    [46.35, 46.351, 46.352, 46.353],
  );
  assert.deepEqual(
    routedDestinations.slice(4).map((destination) => Number(destination.latitude.toFixed(4))),
    [46.3114, 46.3115, 46.3116, 46.3117],
  );
  const persistedRanges = await db.select({
    proposedName: creatorPlaceProposalsTable.proposedName,
    range: creatorPlaceProposalsTable.range,
    travelDurationS: creatorPlaceProposalsTable.travelDurationS,
    status: creatorPlaceProposalsTable.status,
  }).from(creatorPlaceProposalsTable)
    .where(eq(creatorPlaceProposalsTable.tenantId, tenant.id));
  const persistedByName = new Map(persistedRanges.map((row) => [row.proposedName, row]));
  assert.equal(persistedByName.get(proposalNames[4]!)?.range, "excursion");
  assert.equal(persistedByName.get(proposalNames[5]!)?.range, "near");
  assert.equal(persistedByName.get(proposalNames[6]!)?.range, "excursion");
  assert.equal(persistedByName.get(proposalNames[7]!)?.status, "unresolved");
  await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
});

test("infrastructure-failed C1 rows remain unresolved and run history blocks concurrent execution", async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `c1-failure-${suffix}`,
    name: `C1 failure ${suffix}`,
  }).returning({ id: tenantsTable.id });
  assert.ok(tenant);
  const prefix = `c1-failure-place-${suffix}`;
  const content = Array.from({ length: 15 }, (_, index) => {
    const candidate = place(index, null) as Record<string, unknown>;
    candidate.proposedName = `${prefix}-${index}`;
    candidate.geocodingLookupHint = `${prefix}-${index}`;
    candidate.targetSettlement = index < 8 ? "Testville" : null;
    return candidate;
  });
  let geocodes = 0;
  const [claimed] = await db.insert(creatorRunsTable).values({
    tenantId: tenant.id, originLatitude: 46.31, originLongitude: 14.91,
  }).returning({ id: creatorRunsTable.id });
  assert.ok(claimed);
  await runCreatorC1({
    tenantId: tenant.id,
    claimedRunId: claimed.id,
    origin: { latitude: 46.31, longitude: 14.91 },
    region: "test", tenantType: "camp", batches: 1,
    model: async () => ({ content: { places: content }, inputTokens: 12, outputTokens: 34, costUsd: 0.01 }),
    fetchFn: async (url) => {
      if (String(url).includes("overpass-api.de")) {
        return new Response(JSON.stringify({ elements: [
          {
            type: "node",
            id: 7_000_000_001,
            lat: 46.31,
            lon: 14.91,
            tags: { place: "village", name: "Testville" },
          },
          ...Array.from({ length: 8 }, (_, index) => ({
            type: "node",
            id: 7_000_000_100 + index,
            lat: 46.311 + index * 0.0001,
            lon: 14.911,
            tags: { tourism: "attraction", name: `Test feature ${index}` },
          })),
        ] }), { status: 200 });
      }
      geocodes++;
      throw new Error("injected geocoder failure");
    },
    osrm: async () => ({ distanceMeters: 1000, durationMinutes: 10 }),
  });
  const leaked = await db.select().from(creatorPlaceProposalsTable).where(and(
    eq(creatorPlaceProposalsTable.tenantId, tenant.id),
    like(creatorPlaceProposalsTable.proposedName, `${prefix}%`),
  ));
  assert.equal(leaked.every((row) => row.contentReady), true);
  assert.equal(leaked.some((row) => row.status !== "unresolved"), false);
  assert.ok(leaked.length > 0);
  const completed = await db.select().from(creatorRunsTable).where(and(
    eq(creatorRunsTable.tenantId, tenant.id), eq(creatorRunsTable.status, "completed"),
  ));
  assert.ok(completed.some((row) =>
    row.reportJson?.includes("nominatim-unavailable")
    && row.reportJson.includes("injected geocoder failure")
    && row.reportJson.includes("\"dependency\":\"nominatim\"")));
  const completedReport = completed
    .map((row) => row.reportJson ? JSON.parse(row.reportJson) as CreatorC1Report : null)
    .find((candidate) => candidate?.outcomes.some((outcome) => outcome.proposedName.startsWith(prefix)));
  assert.equal(completedReport?.quotaTargetedProposalCount, 8);
  assert.equal(completedReport?.quotaTargetedUnconfirmedCount, 8);
  assert.equal(completedReport?.nearRingResolvedAfterGlobalSieveFailedCount, 0);
  assert.deepEqual(completedReport?.surroundingSettlementFeatureCounts, [
    { name: "Testville", featureCount: 8 },
  ]);

  const [claimA, claimB] = await Promise.all([
    claimCreatorRunOnce(tenant.id, { latitude: 46.31, longitude: 14.91 }),
    claimCreatorRunOnce(tenant.id, { latitude: 46.31, longitude: 14.91 }),
  ]);
  assert.equal(claimA.claimedRunId, null);
  assert.equal(claimB.claimedRunId, null);
  assert.equal(claimA.existingRun?.id, claimed.id);
  assert.equal(claimB.existingRun?.id, claimed.id);

  const [rerun] = await db.insert(creatorRunsTable).values({
    tenantId: tenant.id, originLatitude: 46.31, originLongitude: 14.91,
  }).returning({ id: creatorRunsTable.id });
  assert.ok(rerun);
  await assert.rejects(db.insert(creatorRunsTable).values({
    tenantId: tenant.id, originLatitude: 46.31, originLongitude: 14.91,
  }));
  await db.update(creatorRunsTable).set({
    status: "completed", completedAt: new Date(),
  }).where(eq(creatorRunsTable.id, rerun.id));
  const [laterRun] = await db.insert(creatorRunsTable).values({
    tenantId: tenant.id, originLatitude: 46.31, originLongitude: 14.91,
  }).returning({ id: creatorRunsTable.id });
  assert.ok(laterRun);

  const [raceTenant] = await db.insert(tenantsTable).values({
    slug: `c1-claim-race-${suffix}`,
    name: `C1 claim race ${suffix}`,
  }).returning({ id: tenantsTable.id });
  assert.ok(raceTenant);
  const raceClaims = await Promise.all([
    claimCreatorRunOnce(raceTenant.id, { latitude: 46.31, longitude: 14.91 }),
    claimCreatorRunOnce(raceTenant.id, { latitude: 46.31, longitude: 14.91 }),
  ]);
  const claimedRace = raceClaims.find((claim) => claim.claimedRunId !== null);
  const observedRace = raceClaims.find((claim) => claim.existingRun !== null);
  assert.ok(claimedRace?.claimedRunId);
  assert.equal(observedRace?.existingRun?.id, claimedRace.claimedRunId);
  await db.update(creatorRunsTable).set({
    status: "completed", completedAt: new Date(),
  }).where(eq(creatorRunsTable.id, claimedRace.claimedRunId));
  const afterCompletion = await claimCreatorRunOnce(
    raceTenant.id,
    { latitude: 46.31, longitude: 14.91 },
  );
  assert.equal(afterCompletion.claimedRunId, null);
  assert.equal(afterCompletion.existingRun?.id, claimedRace.claimedRunId);
  await db.delete(tenantsTable).where(eq(tenantsTable.id, raceTenant.id));
  await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
});