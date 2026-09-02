import assert from "node:assert/strict";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  categoriesTable,
  creatorPlaceProposalsTable,
  db,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import {
  CREATOR_SHARED_CATEGORY_KEYS,
  remapLegacyCreatorCategory,
  type CreatorSharedCategory,
} from "../lib/creatorCategoryAssignment";

const GRIL_ID = "1bf40460-bca8-418a-b01d-974b436ef3b0";
const GRIL_SLUG = "piknik-prostor-in-kamp-gril-4205182f";
const EXPECTED_VISIBLE_PROPOSALS = 337;
const apply = process.argv.includes("--apply");

if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("Gril proposal remap is development-only.");
}

const report = await db.transaction(async (tx) => {
  const [tenant] = await tx
    .select({ id: tenantsTable.id, slug: tenantsTable.slug })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, GRIL_ID));
  assert.deepEqual(tenant, { id: GRIL_ID, slug: GRIL_SLUG }, "Gril identity mismatch");

  const categoryRows = await tx
    .select({ id: categoriesTable.id, key: categoriesTable.key })
    .from(categoriesTable)
    .innerJoin(sectionsTable, eq(sectionsTable.id, categoriesTable.sectionId))
    .where(and(
      eq(sectionsTable.tenantId, GRIL_ID),
      isNull(categoriesTable.deletedAt),
    ));
  const categoriesByKey = new Map<string, string>();
  for (const category of categoryRows) {
    assert.ok(category.key, "Every remap target must have a stable key");
    assert.equal(categoriesByKey.has(category.key), false, `Duplicate Gril category key: ${category.key}`);
    categoriesByKey.set(category.key, category.id);
  }
  for (const key of CREATOR_SHARED_CATEGORY_KEYS) {
    assert.ok(categoriesByKey.has(key), `Missing shared Gril category: ${key}`);
  }

  const proposals = await tx
    .select({
      id: creatorPlaceProposalsTable.id,
      categoryId: creatorPlaceProposalsTable.categoryId,
      proposedName: creatorPlaceProposalsTable.proposedName,
      originalQuery: creatorPlaceProposalsTable.originalQuery,
      resolvedName: creatorPlaceProposalsTable.resolvedName,
      resolvedAddress: creatorPlaceProposalsTable.resolvedAddress,
      osmCategory: creatorPlaceProposalsTable.osmCategory,
      osmFeatureType: creatorPlaceProposalsTable.osmFeatureType,
      osmAddressType: creatorPlaceProposalsTable.osmAddressType,
      status: creatorPlaceProposalsTable.status,
      updatedAt: creatorPlaceProposalsTable.updatedAt,
    })
    .from(creatorPlaceProposalsTable)
    .where(and(
      eq(creatorPlaceProposalsTable.tenantId, GRIL_ID),
      eq(creatorPlaceProposalsTable.contentReady, true),
    ))
    .orderBy(asc(creatorPlaceProposalsTable.id));
  const selected = proposals.filter((proposal) => proposal.categoryId);
  assert.equal(selected.length, EXPECTED_VISIBLE_PROPOSALS, "Visible Gril proposal count changed");

  const keyByCategoryId = new Map(categoryRows.map((row) => [row.id, row.key!]));
  const assignments = selected.map((proposal) => {
    const oldKey = keyByCategoryId.get(proposal.categoryId!);
    assert.ok(oldKey, `Proposal ${proposal.id} has a non-Gril category`);
    const targetKey = remapLegacyCreatorCategory({
      name: proposal.proposedName,
      legacyCategory: oldKey,
    });
    return {
      id: proposal.id,
      oldKey,
      targetKey,
      targetId: categoriesByKey.get(targetKey)!,
    };
  });

  if (apply) {
    for (const targetKey of CREATOR_SHARED_CATEGORY_KEYS) {
      const ids = assignments
        .filter((row) => row.targetKey === targetKey && row.targetId !== selected.find((proposal) => proposal.id === row.id)!.categoryId)
        .map((row) => row.id);
      if (ids.length === 0) continue;
      await tx.execute(sql`
        UPDATE "creator_place_proposals"
        SET "category_id" = ${categoriesByKey.get(targetKey)!}
        WHERE "tenant_id" = ${GRIL_ID}
          AND "content_ready" = true
          AND ${inArray(creatorPlaceProposalsTable.id, ids)}
      `);
    }
    const persisted = await tx
      .select({
        id: creatorPlaceProposalsTable.id,
        categoryId: creatorPlaceProposalsTable.categoryId,
      })
      .from(creatorPlaceProposalsTable)
      .where(and(
        eq(creatorPlaceProposalsTable.tenantId, GRIL_ID),
        eq(creatorPlaceProposalsTable.contentReady, true),
      ));
    assert.equal(persisted.length, EXPECTED_VISIBLE_PROPOSALS, "Visible count changed during remap");
    const persistedById = new Map(persisted.map((row) => [row.id, row.categoryId]));
    for (const assignment of assignments) {
      assert.equal(
        persistedById.get(assignment.id),
        assignment.targetId,
        `Category remap verification failed for proposal ${assignment.id}`,
      );
    }
  }

  const pairCounts = new Map<string, number>();
  const pairExamples = new Map<string, string[]>();
  const categoryCounts = new Map<CreatorSharedCategory, number>();
  for (const row of assignments) {
    const pair = `${row.oldKey} → ${row.targetKey}`;
    pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
    const examples = pairExamples.get(pair) ?? [];
    if (examples.length < 8) {
      examples.push(selected.find((proposal) => proposal.id === row.id)!.proposedName);
      pairExamples.set(pair, examples);
    }
    categoryCounts.set(row.targetKey, (categoryCounts.get(row.targetKey) ?? 0) + 1);
  }

  return {
    mode: apply ? "applied" : "dry-run",
    proposalCount: assignments.length,
    changedCount: assignments.filter((row) => row.targetId !== selected.find((proposal) => proposal.id === row.id)!.categoryId).length,
    mapping: [...pairCounts].sort(([a], [b]) => a.localeCompare(b, "sl")).map(([pair, count]) => ({
      pair,
      count,
      examples: pairExamples.get(pair),
    })),
    after: CREATOR_SHARED_CATEGORY_KEYS.map((category) => ({
      category,
      count: categoryCounts.get(category) ?? 0,
    })),
  };
});

console.log(JSON.stringify(report, null, 2));