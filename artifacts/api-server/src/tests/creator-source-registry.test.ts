import test from "node:test";
import assert from "node:assert/strict";
import {
  assertRunnableCreatorSourceStatuses,
  creatorSourceListFingerprint,
  CreatorSourceRegistryError,
} from "../lib/creatorSourceRegistry";
import {
  buildCreatorSourceRunCompositeBatches,
  CREATOR_SOURCE_RUN_COMPOSITE_CHARACTERS,
  CREATOR_SOURCE_RUN_COMPOSITE_PAGE_SIZE,
  reserveCreatorSourceModelAttempt,
} from "../lib/creatorSourceRunService";
import {
  groundCreatorSourceCandidates,
  routeGroundedCreatorSourceFactsToPages,
} from "../lib/creatorSourceModelExtraction";
import { ListCreatorSourcesResponse } from "@workspace/api-zod";

test("source-first approval gate rejects proposed municipality entries", () => {
  assert.throws(
    () => assertRunnableCreatorSourceStatuses(["approved", "proposed", "rejected"]),
    (error) =>
      error instanceof CreatorSourceRegistryError
      && error.kind === "approval-gate",
  );
});

test("GET source-list contract serializes durable false approval", () => {
  const parsed = ListCreatorSourcesResponse.parse({
    sources: [],
    approval: { approved: false, approvedSourceCount: 0 },
  });
  assert.equal(parsed.approval.approved, false);
});

test("source-first approval gate rejects a fully blocked list", () => {
  assert.throws(
    () => assertRunnableCreatorSourceStatuses(["rejected", "revoked"]),
    (error) =>
      error instanceof CreatorSourceRegistryError
      && error.kind === "approval-gate",
  );
});

test("source-first approval gate rejects more than fifteen approved seeds", () => {
  assert.throws(
    () => assertRunnableCreatorSourceStatuses(Array.from({ length: 16 }, () => "approved")),
    (error) =>
      error instanceof CreatorSourceRegistryError
      && error.kind === "approval-gate"
      && /at most 15/.test(error.message),
  );
});

test("approval fingerprint cannot replay after status or municipality changes", () => {
  const source = {
    id: "00000000-0000-0000-0000-000000000001",
    status: "approved",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const initial = creatorSourceListFingerprint({
    tenantId: "00000000-0000-0000-0000-000000000010",
    municipality: "Ljubno ob Savinji",
    sources: [source],
  });
  assert.notEqual(initial, creatorSourceListFingerprint({
    tenantId: "00000000-0000-0000-0000-000000000010",
    municipality: "Luče",
    sources: [source],
  }));
  assert.notEqual(initial, creatorSourceListFingerprint({
    tenantId: "00000000-0000-0000-0000-000000000010",
    municipality: "Ljubno ob Savinji",
    sources: [{ ...source, status: "revoked", updatedAt: new Date("2026-01-02T00:00:00.000Z") }],
  }));
});

test("blocked sources remain visible decisions but are excluded from run count", () => {
  assert.equal(
    assertRunnableCreatorSourceStatuses([
      "approved",
      "rejected",
      "revoked",
      "approved",
    ]),
    2,
  );
});

test("production source runs deterministically batch nine pages into 80k composites", () => {
  const texts = Array.from({ length: 19 }, (_, index) => `Page ${index}`);
  const first = buildCreatorSourceRunCompositeBatches(texts);
  const second = buildCreatorSourceRunCompositeBatches(texts);
  assert.equal(CREATOR_SOURCE_RUN_COMPOSITE_PAGE_SIZE, 9);
  assert.equal(CREATOR_SOURCE_RUN_COMPOSITE_CHARACTERS, 80_000);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((batch) => batch.compositePages.length), [9, 9, 1]);
});

test("composite facts are independently re-grounded against original pages", () => {
  const batches = buildCreatorSourceRunCompositeBatches([
    "Golte so priljubljena izletniška točka.",
    "Mozirski gaj je botanični park.",
  ]);
  const composite = batches[0]!;
  const extracted = groundCreatorSourceCandidates(composite.compositeText, {
    places: [{
      canonicalName: "Golte",
      settlement: null,
      categoryKey: "trips",
      evidence: "Golte",
    }],
  }).facts;
  const routed = routeGroundedCreatorSourceFactsToPages(
    composite.compositePages,
    extracted,
  );
  assert.equal(routed[0]!.facts.length, 1);
  assert.equal(routed[1]!.facts.length, 0);
});

test("model attempt reservations commit actual usage and release every upper bound", () => {
  const committed = {
    modelRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    modelCostUsd: 0,
  };
  const inFlight = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const reservation = reserveCreatorSourceModelAttempt(
    committed,
    inFlight,
    { inputTokens: 10_000, outputTokens: 8_000, costUsd: 1 },
  );
  assert.deepEqual(inFlight, {
    requests: 1,
    inputTokens: 10_000,
    outputTokens: 8_000,
    costUsd: 1,
  });
  reservation.release({ inputTokens: 300, outputTokens: 40, costUsd: 0.02 });
  assert.deepEqual(inFlight, {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  });
  assert.deepEqual(committed, {
    modelRequests: 1,
    inputTokens: 300,
    outputTokens: 40,
    modelCostUsd: 0.02,
  });
  assert.throws(() => reservation.release({
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  }), /already released/);
});