import assert from "node:assert/strict";
import test from "node:test";
import {
  enqueueHostRecommendations,
  getHostOnboardingCategories,
  HOST_ONBOARDING_PROVENANCE,
  HOST_ONBOARDING_UNRESOLVED_REASON,
} from "../lib/hostOnboardingCreator";
import { MELI_PU_SKELETON } from "../lib/tenantSeeds";

test("host onboarding categories follow all shared surrounding skeleton categories", () => {
  const expected = MELI_PU_SKELETON
    .filter((section) => section.key === "explore" || section.key === "services")
    .flatMap((section) => section.categories)
    .filter((category) => category.key !== "events")
    .map((category) => ({ key: category.key, label: category.names.sl }));

  assert.deepEqual(getHostOnboardingCategories(), expected);
  assert.deepEqual(
    getHostOnboardingCategories().slice(-6).map(({ key }) => key),
    ["shops", "bakery", "gas", "atm", "pharm", "hosp"],
  );
  const hike = getHostOnboardingCategories().findIndex(({ key }) => key === "hike");
  const bike = getHostOnboardingCategories().findIndex(({ key }) => key === "bike");
  assert.equal(getHostOnboardingCategories()[hike]?.label, "Pohodništvo");
  assert.equal(getHostOnboardingCategories()[bike]?.label, "Kolesarjenje");
  assert.equal(bike, hike + 1);
});

test("host onboarding place categories exclude house, offer, and event blocks", () => {
  const keys = new Set(getHostOnboardingCategories().map(({ key }) => key));
  assert.equal(keys.has("house"), false);
  assert.equal(keys.has("sup"), false);
  assert.equal(keys.has("events"), false);
  assert.equal(keys.has("culinary"), true);
});

test("host Creator markers remain exact and machine-addressable", () => {
  assert.equal(HOST_ONBOARDING_PROVENANCE, "vnesel gostitelj prek obrazca");
  assert.equal(HOST_ONBOARDING_UNRESOLVED_REASON, "host-name-awaiting-resolution");
});

test("enqueue writes unresolved existing-ledger proposals without source evidence", async () => {
  const insertedValues: Array<Record<string, unknown>> = [];
  let nextId = 0;
  const tx = {
    execute: async () => undefined,
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async () => [
            { id: "category-culinary", key: "culinary" },
            { id: "category-shops", key: "shops" },
          ],
        }),
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        insertedValues.push(values);
        return {
          onConflictDoNothing: () => ({
            returning: async () => [{ id: `proposal-${++nextId}` }],
          }),
        };
      },
    }),
  };

  const result = await enqueueHostRecommendations(tx as never, {
    tenantId: "d60ce753-7088-4ba9-ae2a-5ca517741217",
    submissionId: "97c71d7b-1af2-4cbc-975d-599401265383",
    recommendations: [
      { categoryKey: "culinary", name: "  Gostilna Pri mostu  " },
      { categoryKey: "culinary", name: "Gostilna Pri mostu" },
      { categoryKey: "shops", name: "Gostilna Pri mostu" },
      { categoryKey: "shops", name: "Trgovina Center" },
    ],
  });

  assert.deepEqual(result, {
    proposalIds: ["proposal-1", "proposal-1", "proposal-2", "proposal-3"],
  });
  assert.equal(new Set(result.proposalIds).size, 3);
  assert.equal(insertedValues.length, 3);
  assert.deepEqual(insertedValues.map((row) => ({
    categoryId: row.categoryId,
    proposedName: row.proposedName,
    status: row.status,
    refusalReason: row.refusalReason,
    contentReady: row.contentReady,
    inclusionReason: row.inclusionReason,
    runId: row.runId,
  })), [
    {
      categoryId: "category-culinary",
      proposedName: "Gostilna Pri mostu",
      status: "unresolved",
      refusalReason: HOST_ONBOARDING_UNRESOLVED_REASON,
      contentReady: false,
      inclusionReason: HOST_ONBOARDING_PROVENANCE,
      runId: insertedValues[0]!.runId,
    },
    {
      categoryId: "category-shops",
      proposedName: "Gostilna Pri mostu",
      status: "unresolved",
      refusalReason: HOST_ONBOARDING_UNRESOLVED_REASON,
      contentReady: false,
      inclusionReason: HOST_ONBOARDING_PROVENANCE,
      runId: insertedValues[1]!.runId,
    },
    {
      categoryId: "category-shops",
      proposedName: "Trgovina Center",
      status: "unresolved",
      refusalReason: HOST_ONBOARDING_UNRESOLVED_REASON,
      contentReady: false,
      inclusionReason: HOST_ONBOARDING_PROVENANCE,
      runId: insertedValues[2]!.runId,
    },
  ]);
  assert.notEqual(insertedValues[0]!.runId, insertedValues[1]!.runId);
  assert.equal(insertedValues[1]!.runId, insertedValues[2]!.runId);
  assert.equal("sourceUrl" in insertedValues[0]!, false);
});

test("enqueue replay returns the same proposal after existing resolution changed OSM fields", async () => {
  const tx = {
    execute: async () => undefined,
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async () => [{ id: "category-bakery", key: "bakery" }],
        }),
        // This represents an already-resolved row. The adapter deliberately
        // looks it up by stable run/name identity, not nullable OSM fields.
        where: () => ({
          limit: async () => [{ id: "resolved-proposal" }],
        }),
      }),
    }),
    insert: () => {
      throw new Error("replay must not insert a second proposal");
    },
  };

  const result = await enqueueHostRecommendations(tx as never, {
    tenantId: "d60ce753-7088-4ba9-ae2a-5ca517741217",
    submissionId: "97c71d7b-1af2-4cbc-975d-599401265383",
    recommendations: [{ categoryKey: "bakery", name: "Pekarna Center" }],
  });

  assert.deepEqual(result, { proposalIds: ["resolved-proposal"] });
});