import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import { and, eq, like } from "drizzle-orm";
import { creatorPlaceProposalsTable, creatorRunsTable, db, tenantsTable } from "@workspace/db";
import {
  assignCreatorC1Range,
  calculateCreatorC1Cost,
  CREATOR_C1_BATCH_SIZE,
  CREATOR_C1_PRICING,
  generateCreatorC1Batch,
  promptFor,
  serializeCreatorC1Report,
  validateCreatorC1Batch,
  validateCreatorC1ModelOutput,
  withCreatorC1DescriptionPolicy,
  runCreatorC1,
} from "../lib/creatorC1";
import { runCreatorSieve } from "../lib/creatorSieve";
import {
  claimCreatorRunOnce,
  isPreservedMeninaEvidenceTenant,
} from "../lib/creatorMeninaProductionRun";

function place(index: number, existingCategoryId: string | null = "category"): unknown {
  return {
    proposedName: `Place ${index}`,
    existingCategoryId,
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

test("C1 geocoding uses the plain name first and lookup hint only after no results", async () => {
  const queries: string[] = [];
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
  });
  assert.deepEqual(queries, [
    "Slap Rinka",
    "Slap Rinka, Logarska dolina, Solčava, Slovenia",
  ]);
  assert.equal(result.attempts.length, 2);
  assert.equal(result.originalQuery, "Slap Rinka");
  assert.equal(result.confirmedQuery, queries[1]);
  assert.equal(result.verdict, "resolved");
});

test("later C1 batches receive prior names and practical places are forbidden", () => {
  const prompt = promptFor({
    origin: { latitude: 46.31, longitude: 14.91 },
    region: "Savinjska",
    tenantType: "kamp",
    categories: [],
    rejectedNames: [],
    priorProposedNames: ["Mozirski gaj", "Golte"],
  });
  assert.match(prompt, /Do not repeat any name already proposed by an earlier batch/);
  assert.match(prompt, /\\["Mozirski gaj","Golte"\\]/);
  assert.match(prompt, /Never propose proximity-selected practical services/);
  assert.doesNotMatch(prompt, /practical means/);
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
    pricing: CREATOR_C1_PRICING,
    outcomes: [{ proposedName: "Missing place", outcome: "unconfirmed", refusalRule: "no-results" }],
  });
  const report = JSON.parse(serialized);
  assert.equal(report.nominatimThrottleWaitMs, 123);
  assert.equal(report.outcomes[0].refusalRule, "no-results");
  assert.equal(report.status, "failed");
});

test("only the exact Camping MENINA evidence tenant receives the authorized run ceiling", () => {
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

test("failed C1 rows stay hidden while run history allows reruns but blocks concurrent execution", async () => {
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
    return candidate;
  });
  let geocodes = 0;
  const [claimed] = await db.insert(creatorRunsTable).values({
    tenantId: tenant.id, originLatitude: 46.31, originLongitude: 14.91,
  }).returning({ id: creatorRunsTable.id });
  assert.ok(claimed);
  await assert.rejects(runCreatorC1({
    tenantId: tenant.id,
    claimedRunId: claimed.id,
    origin: { latitude: 46.31, longitude: 14.91 },
    region: "test", tenantType: "camp", batches: 1,
    model: async () => ({ content: { places: content }, inputTokens: 12, outputTokens: 34, costUsd: 0.01 }),
    fetchFn: async (_url) => {
      geocodes++;
      if (geocodes > 1) throw new Error("injected geocoder failure");
      return new Response(JSON.stringify([{
        osm_type: "node", osm_id: 8_000_000_000 + Math.floor(Math.random() * 100_000),
        category: "tourism", type: "attraction", addresstype: "attraction",
        name: `${prefix}-0`, display_name: `${prefix}-0`, lat: "46.32", lon: "14.92",
        namedetails: { name: `${prefix}-0` }, importance: 0.5,
      }]), { status: 200 });
    },
    osrm: async () => ({ distanceMeters: 1000, durationMinutes: 10 }),
  }), /injected geocoder failure/);
  const leaked = await db.select().from(creatorPlaceProposalsTable).where(and(
    eq(creatorPlaceProposalsTable.tenantId, tenant.id),
    like(creatorPlaceProposalsTable.proposedName, `${prefix}%`),
  ));
  assert.equal(leaked.some((row) => row.contentReady), false);
  assert.equal(leaked.length, 0);
  const failed = await db.select().from(creatorRunsTable).where(and(
    eq(creatorRunsTable.tenantId, tenant.id), eq(creatorRunsTable.status, "failed"),
  ));
  assert.ok(failed.some((row) => row.reportJson?.includes("injected geocoder failure")));

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