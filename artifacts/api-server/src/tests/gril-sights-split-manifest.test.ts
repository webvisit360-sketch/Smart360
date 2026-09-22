import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GRIL_SIGHTS_SPLIT } from "../lib/grilSightsSplitManifest";

type ReviewRow = {
  itemId?: string;
  proposalId?: string;
  title?: string;
  proposedName?: string;
  target: { key: string } | null;
};

const reviewUrl = new URL("../../../../reports/gril-znamenitosti-mapping-review.json", import.meta.url);
const operatorDecisions = new Map([
  ["Center Rinka", "culture"],
  ["Mozirski gaj", "nature"],
  ["Kmetija Bukovnik", "culinary"],
  ["Razgledni stolp na Golteh", "act"],
]);
const targetCounts = (rules: ReadonlyArray<{ targetKey: string }>): Record<string, number> =>
  rules.reduce<Record<string, number>>((counts, rule) => {
    counts[rule.targetKey] = (counts[rule.targetKey] ?? 0) + 1;
    return counts;
  }, {});

test("approved Gril ledger exactly covers the 14 items and 63 proposals in the review", async () => {
  const review = JSON.parse(await readFile(reviewUrl, "utf8")) as {
    items: ReviewRow[];
    proposals: ReviewRow[];
  };
  assert.equal(GRIL_SIGHTS_SPLIT.itemRules.length, 14);
  assert.equal(GRIL_SIGHTS_SPLIT.proposalRules.length, 63);
  assert.equal(new Set(GRIL_SIGHTS_SPLIT.itemRules.map((rule) => rule.id)).size, 14);
  assert.equal(new Set(GRIL_SIGHTS_SPLIT.proposalRules.map((rule) => rule.id)).size, 63);

  const approvedItems = new Map(GRIL_SIGHTS_SPLIT.itemRules.map((rule) => [rule.id, rule]));
  for (const row of review.items) {
    const rule = approvedItems.get(row.itemId!);
    assert.ok(rule, `missing approved item ${row.itemId}`);
    assert.equal(rule.expectedTitle, row.title);
    assert.equal(rule.sourceKey, "sights");
    assert.equal(rule.targetKey, row.target?.key ?? operatorDecisions.get(row.title!));
  }

  const approvedProposals = new Map(GRIL_SIGHTS_SPLIT.proposalRules.map((rule) => [rule.id, rule]));
  for (const row of review.proposals) {
    const rule = approvedProposals.get(row.proposalId!);
    assert.ok(rule, `missing approved proposal ${row.proposalId}`);
    assert.equal(rule.expectedName, row.proposedName);
    assert.equal(rule.sourceKey, "sights");
    assert.equal(rule.targetKey, row.target?.key ?? operatorDecisions.get(row.proposedName!));
  }

  assert.deepEqual(targetCounts(GRIL_SIGHTS_SPLIT.itemRules), { culture: 6, nature: 8 });
  assert.deepEqual(targetCounts(GRIL_SIGHTS_SPLIT.proposalRules), {
    nature: 25, culture: 36, culinary: 1, act: 1,
  });
});