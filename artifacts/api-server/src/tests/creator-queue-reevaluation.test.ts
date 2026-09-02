import assert from "node:assert/strict";
import test from "node:test";
import {
  CREATOR_ACCOMMODATION_REFUSAL_REASON,
  planCreatorQueueReevaluation,
  type CreatorQueueReevaluationRow,
} from "../lib/creatorQueueReevaluation";

const row = (
  id: string,
  proposedName: string,
  overrides: Partial<CreatorQueueReevaluationRow> = {},
): CreatorQueueReevaluationRow => ({
  id,
  proposedName,
  status: "pending",
  contentReady: true,
  geocodingLookupHint: null,
  resolvedAddress: null,
  confirmedQuery: null,
  confirmationMethod: null,
  osmType: null,
  osmId: null,
  refusalReason: null,
  supersededBy: null,
  createdAt: new Date(`2026-01-0${id.length}T00:00:00Z`),
  ...overrides,
});

test("reevaluation plans accommodation, settlement binding and fuzzy merging only for open rows", () => {
  const rows = [
    row("a", "Hotel Planinka"),
    row("b", "Slap Rinka", {
      geocodingLookupHint: "Slap Rinka, Solčava",
      resolvedAddress: "Slap Rinka, Logarska Dolina, Slovenija",
      confirmedQuery: "Slap Rinka",
      confirmationMethod: "exact",
      osmType: "node",
      osmId: 12,
    }),
    row("c", "Žičnica Golte"),
    row("dddd", "Zicnica   Golte"),
    row("eeeee", "Hotel already reviewed", { status: "approved" }),
    row("ffffff", "Hotel rejected", { status: "rejected" }),
  ];
  const changes = planCreatorQueueReevaluation(rows, []);
  assert.deepEqual(changes.map(({ id, kind }) => ({ id, kind })), [
    { id: "a", kind: "accommodation" },
    { id: "dddd", kind: "duplicate" },
    { id: "b", kind: "wrong_settlement" },
  ]);
  assert.equal(changes[0]?.reason, CREATOR_ACCOMMODATION_REFUSAL_REASON);
  assert.equal(changes[1]?.supersededBy, "c");
  assert.match(changes[2]?.reason ?? "", /^Najdeno samo v drugem kraju/);
});

test("a second reevaluation of the resulting visible queue plans zero changes", () => {
  const rows = [
    row("a", "Hotel Planinka"),
    row("b", "Slap Rinka", {
      geocodingLookupHint: "Slap Rinka, Solčava",
      resolvedAddress: "Slap Rinka, Logarska Dolina, Slovenija",
      confirmedQuery: "Slap Rinka",
      confirmationMethod: "exact",
      osmType: "node",
      osmId: 12,
    }),
  ];
  const first = planCreatorQueueReevaluation(rows, []);
  const applied = rows.map((current) => {
    const change = first.find((candidate) => candidate.id === current.id);
    if (change?.kind === "accommodation") {
      return {
        ...current,
        contentReady: false,
        status: "unresolved" as const,
        refusalReason: CREATOR_ACCOMMODATION_REFUSAL_REASON,
      };
    }
    if (change?.kind === "wrong_settlement") {
      return {
        ...current,
        status: "unresolved" as const,
        refusalReason: change.reason ?? null,
        confirmedQuery: null,
        confirmationMethod: null,
        osmType: null,
        osmId: null,
      };
    }
    return current;
  });
  assert.equal(first.length, 2);
  assert.deepEqual(planCreatorQueueReevaluation(applied, []), []);
});