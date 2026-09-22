import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test from "node:test";
import {
  categoriesTable,
  creatorPlaceProposalsTable,
  db,
  sectionsTable,
  translationsTable,
} from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { alignTenantSkeleton } from "../lib/tenantSkeletonAlignment";
import { tenantSeedPlan } from "../lib/tenantSeeds";
import {
  cleanupFullCopyFixtures,
  createFullCopyFixtures,
  ExistingReviewerMetadataUnavailableError,
  fixtureCounts,
  fixtureHash,
  protectedFixtureState,
  type FullCopyFixtureSet,
} from "./helpers/tenantAlignmentFixture";

const zeroCounts = {
  categoriesUpdated: 0,
  translationsUpdated: 0,
  categoriesRetired: 0,
  proposalsRekeyed: 0,
  itemMoves: 0,
};

test("real development full copies preserve all Gril/MENINA rows and only rekey five approved proposal IDs", async (context) => {
  if (process.env["NODE_ENV"] === "production") throw new Error("Full-copy alignment proof rejects production");
  if (!process.env["DATABASE_URL"]) {
    context.skip("development database is unavailable");
    return;
  }
  let fixtures: FullCopyFixtureSet;
  try {
    fixtures = await createFullCopyFixtures();
  } catch (error) {
    if (error instanceof ExistingReviewerMetadataUnavailableError) {
      context.skip(error.message);
      return;
    }
    throw error;
  }
  const before = {
    gril: await protectedFixtureState(fixtures.gril),
    menina: await protectedFixtureState(fixtures.menina),
  };
  try {
    assert.deepEqual(before.gril.counts, {
      categories: 22, items: 27, proposals: 367, attachments: 26,
      materializations: 27, media: 2, snapshots: 1,
    });
    assert.deepEqual(before.menina.counts, {
      categories: 22, items: 0, proposals: 272, attachments: 0,
      materializations: 0, media: 1, snapshots: 1,
    });
    const capturedStatusCounts = (rows: typeof before.gril.proposals) =>
      Object.fromEntries(["approved", "pending", "unresolved", "rejected", "superseded"]
        .map((status) => [status, rows.filter((row) => row.status === status).length])
        .filter(([, count]) => count !== 0));
    assert.deepEqual(capturedStatusCounts(before.gril.proposals), {
      approved: 29, pending: 24, unresolved: 189, rejected: 88, superseded: 37,
    });
    assert.deepEqual(capturedStatusCounts(before.menina.proposals), {
      pending: 88, unresolved: 172, superseded: 12,
    });
    for (const fixture of [fixtures.gril, fixtures.menina]) {
      const sections = await db.select().from(sectionsTable).where(eq(sectionsTable.tenantId, fixture.tenantId));
      const sectionKey = new Map(sections.map((row) => [row.id, row.key]));
      const categories = await db.select().from(categoriesTable)
        .where(inArray(categoriesTable.sectionId, fixture.sectionIds));
      const actualShape = categories.map((row) => ({
        section: sectionKey.get(row.sectionId)!,
        key: row.key,
        label: row.label,
        layout: row.layout,
        position: row.position,
      })).sort((a, b) => `${a.section}/${a.position}/${a.key}`.localeCompare(`${b.section}/${b.position}/${b.key}`));
      assert.deepEqual(actualShape, fixture.capturedCategoryShape);
      assert.equal(actualShape.find((row) => row.key === "hosp")?.label, "Bolnišnica");
    }

    const grilResult = await alignTenantSkeleton(fixtures.gril.tenantId);
    const meninaResult = await alignTenantSkeleton(fixtures.menina.tenantId, {
      fixtureProposalRules: fixtures.menina.approvedRules,
    });
    assert.ok(grilResult && meninaResult);
    assert.equal(grilResult.counts.itemMoves, 0);
    assert.equal(meninaResult.counts.itemMoves, 0);
    assert.equal(meninaResult.counts.proposalsRekeyed, 5);

    const after = {
      gril: await protectedFixtureState(fixtures.gril),
      menina: await protectedFixtureState(fixtures.menina),
    };
    assert.equal(after.gril.counts.items, 27);
    assert.equal(after.gril.counts.proposals, 367);
    assert.equal(after.menina.counts.items, 0);
    assert.equal(after.menina.counts.proposals, 272);
    for (const source of ["gril", "menina"] as const) {
      assert.equal(fixtureHash(after[source].items), fixtureHash(before[source].items), `${source}: item payload drift`);
      assert.equal(fixtureHash(after[source].attachments), fixtureHash(before[source].attachments), `${source}: attachment drift`);
      assert.equal(fixtureHash(after[source].materializations), fixtureHash(before[source].materializations), `${source}: materialization drift`);
      assert.equal(fixtureHash(after[source].media), fixtureHash(before[source].media), `${source}: media drift`);
      assert.equal(fixtureHash(after[source].snapshots), fixtureHash(before[source].snapshots), `${source}: snapshot drift`);
      assert.equal(
        fixtureHash(after[source].proposalPayloadWithoutCategory),
        fixtureHash(before[source].proposalPayloadWithoutCategory),
        `${source}: proposal payload other than categoryId drift`,
      );
    }

    const movedIds = new Set(fixtures.menina.approvedRules.map((rule) => rule.id));
    const beforeById = new Map(before.menina.proposals.map((row) => [row.id, row]));
    const categories = await db.select().from(categoriesTable)
      .where(inArray(categoriesTable.sectionId, fixtures.menina.sectionIds));
    const targetByKey = new Map(categories.map((row) => [row.key, row.id]));
    for (const proposal of after.menina.proposals) {
      const original = beforeById.get(proposal.id)!;
      if (movedIds.has(proposal.id)) {
        const rule = fixtures.menina.approvedRules.find((entry) => entry.id === proposal.id)!;
        assert.equal(proposal.categoryId, targetByKey.get(rule.targetKey));
      } else {
        assert.equal(proposal.categoryId, original.categoryId, `unexpected proposal move ${proposal.id}`);
      }
      assert.equal(proposal.status, original.status);
    }

    const canonical = tenantSeedPlan("kamp")
      .filter((section) => section.key === "explore" || section.key === "services");
    for (const fixture of [fixtures.gril, fixtures.menina]) {
      const sections = await db.select().from(sectionsTable).where(eq(sectionsTable.tenantId, fixture.tenantId));
      const sectionByKey = new Map(sections.map((row) => [row.key, row]));
      for (const sectionSeed of canonical) {
        const section = sectionByKey.get(sectionSeed.key)!;
        const current = await db.select().from(categoriesTable).where(and(
          eq(categoriesTable.sectionId, section.id), isNull(categoriesTable.deletedAt),
        ));
        for (const [position, seed] of sectionSeed.categories.entries()) {
          const category = current.find((row) => row.key === seed.key)!;
          assert.ok(category, `${fixture.source}: missing ${sectionSeed.key}/${seed.key}`);
          assert.equal(category.label, seed.names.sl);
          assert.equal(category.position, position);
          assert.equal(category.layout, seed.layout);
          const translations = await db.select().from(translationsTable).where(and(
            eq(translationsTable.model, "category"),
            eq(translationsTable.recordId, category.id),
            eq(translationsTable.field, "label"),
          ));
          for (const language of ["en", "de", "it"] as const) {
            assert.equal(translations.find((row) => row.lang === language)?.value, seed.names[language]);
          }
        }
      }
    }

    const grilReplay = await alignTenantSkeleton(fixtures.gril.tenantId);
    const meninaReplay = await alignTenantSkeleton(fixtures.menina.tenantId, {
      fixtureProposalRules: fixtures.menina.approvedRules,
    });
    assert.deepEqual(grilReplay?.counts, zeroCounts);
    assert.deepEqual(meninaReplay?.counts, zeroCounts);
    assert.equal(grilReplay?.changed, false);
    assert.equal(meninaReplay?.changed, false);

    await writeFile("/tmp/tenant-skeleton-alignment-full-copy-result.json", JSON.stringify({
      fixtureTenantIds: { gril: fixtures.gril.tenantId, menina: fixtures.menina.tenantId },
      before: { gril: before.gril.counts, menina: before.menina.counts },
      after: {
        gril: await fixtureCounts(fixtures.gril.tenantId),
        menina: await fixtureCounts(fixtures.menina.tenantId),
      },
      firstRun: { gril: grilResult, menina: meninaResult },
      secondRun: { gril: grilReplay, menina: meninaReplay },
      proof: {
        zeroItemLoss: true,
        proposalsOnlyFiveApprovedCategoryIdsChanged: true,
        protectedRowHashesUnchanged: true,
        allCanonicalCategoryLanguagesVerified: ["sl", "en", "de", "it"],
      },
    }, null, 2));
  } finally {
    await cleanupFullCopyFixtures(fixtures);
  }
});

test("custom category is exempt from alignment and remains active", async (context) => {
  if (process.env["NODE_ENV"] === "production") throw new Error("Custom-category fixture rejects production");
  if (!process.env["DATABASE_URL"]) {
    context.skip("development database is unavailable");
    return;
  }
  let fixtures: FullCopyFixtureSet;
  try {
    fixtures = await createFullCopyFixtures();
  } catch (error) {
    if (error instanceof ExistingReviewerMetadataUnavailableError) {
      context.skip(error.message);
      return;
    }
    throw error;
  }
  try {
    const [explore] = await db.select().from(sectionsTable).where(and(
      eq(sectionsTable.tenantId, fixtures.gril.tenantId),
      eq(sectionsTable.key, "explore"),
    ));
    const [custom] = await db.insert(categoriesTable).values({
      sectionId: explore!.id,
      key: `host-custom-${fixtures.gril.tenantId}`,
      label: "Gostiteljeva kategorija",
      icon: "star",
      layout: "cards",
      exploreGroup: "experiences",
      position: 91,
    }).returning();
    await alignTenantSkeleton(fixtures.gril.tenantId);
    const [after] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, custom!.id));
    assert.equal(after?.label, custom?.label);
    assert.equal(after?.position, 91);
    assert.equal(after?.deletedAt, null);
  } finally {
    await cleanupFullCopyFixtures(fixtures);
  }
});