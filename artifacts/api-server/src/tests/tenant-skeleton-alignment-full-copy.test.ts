import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import test from "node:test";
import {
  adminUsersTable,
  categoriesTable,
  creatorPlaceProposalsTable,
  db,
  sectionsTable,
  tenantsTable,
  translationsTable,
} from "@workspace/db";
import { and, eq, inArray, isNull, like } from "drizzle-orm";
import { alignTenantSkeleton } from "../lib/tenantSkeletonAlignment";
import { GRIL_SIGHTS_SPLIT } from "../lib/grilSightsSplitManifest";
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

const mappingReviewUrl = new URL("../../../../reports/gril-znamenitosti-mapping-review.json", import.meta.url);
const verificationJsonUrl = new URL("../../../../reports/approved-sights-split-verification.json", import.meta.url);
const verificationHtmlUrl = new URL("../../../../reports/approved-sights-split-verification.html", import.meta.url);

type MappingReview = {
  items: Array<{ itemId: string; title: string; decision: "culture" | "nature" | "operator_decides" }>;
  proposals: Array<{ proposalId: string; proposedName: string; decision: "culture" | "nature" | "operator_decides" }>;
};

const operatorTargets = new Map<string, "culture" | "nature" | "culinary" | "act">([
  ["Center Rinka", "culture"],
  ["Mozirski gaj", "nature"],
  ["Kmetija Bukovnik", "culinary"],
  ["Razgledni stolp na Golteh", "act"],
]);

const approvedTarget = (name: string, decision: MappingReview["items"][number]["decision"]) =>
  decision === "operator_decides" ? operatorTargets.get(name) : decision;

const byId = <T extends { id: string }>(rows: readonly T[]) =>
  [...rows].sort((a, b) => a.id.localeCompare(b.id));

test("development full copies apply the approved Gril split, preserve rows, and replay with zero changes", async (context) => {
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
  const captured = {
    gril: await protectedFixtureState(fixtures.gril),
    menina: await protectedFixtureState(fixtures.menina),
  };
  let verification: Record<string, unknown> | null = null;
  try {
    assert.deepEqual(captured.gril.counts, {
      categories: 22, items: 27, proposals: 367, attachments: 26,
      materializations: 27, media: 2, snapshots: 1,
    });
    assert.deepEqual(captured.menina.counts, {
      categories: 22, items: 0, proposals: 272, attachments: 0,
      materializations: 0, media: 1, snapshots: 1,
    });
    const capturedStatusCounts = (rows: typeof captured.gril.proposals) =>
      Object.fromEntries(["approved", "pending", "unresolved", "rejected", "superseded"]
        .map((status) => [status, rows.filter((row) => row.status === status).length])
        .filter(([, count]) => count !== 0));
    assert.deepEqual(capturedStatusCounts(captured.gril.proposals), {
      approved: 29, pending: 24, unresolved: 189, rejected: 88, superseded: 37,
    });
    assert.deepEqual(capturedStatusCounts(captured.menina.proposals), {
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

    const review = JSON.parse(await readFile(mappingReviewUrl, "utf8")) as MappingReview;
    const reviewedItems = review.items.map((row) => ({
      id: row.itemId,
      expectedTitle: row.title,
      sourceKey: "sights",
      targetKey: approvedTarget(row.title, row.decision),
    }));
    const reviewedProposals = review.proposals.map((row) => ({
      id: row.proposalId,
      expectedName: row.proposedName,
      sourceKey: "sights",
      targetKey: approvedTarget(row.proposedName, row.decision),
    }));
    assert.equal(reviewedItems.length, 14);
    assert.equal(reviewedProposals.length, 63);
    assert.ok(reviewedItems.every((rule) => rule.targetKey));
    assert.ok(reviewedProposals.every((rule) => rule.targetKey));
    assert.deepEqual(byId(GRIL_SIGHTS_SPLIT.itemRules), byId(reviewedItems as typeof GRIL_SIGHTS_SPLIT.itemRules));
    assert.deepEqual(byId(GRIL_SIGHTS_SPLIT.proposalRules), byId(reviewedProposals as typeof GRIL_SIGHTS_SPLIT.proposalRules));
    assert.equal(fixtures.gril.approvedSightsRules?.itemRules.length, 14);
    assert.equal(fixtures.gril.approvedSightsRules?.proposalRules.length, 63);

    // First bring the captured copy to the already-verified metadata state.
    // The approved split must also work when that earlier action has run.
    const grilPreparation = await alignTenantSkeleton(fixtures.gril.tenantId);
    const meninaResult = await alignTenantSkeleton(fixtures.menina.tenantId, {
      fixtureProposalRules: fixtures.menina.approvedRules,
    });
    assert.ok(grilPreparation && meninaResult);
    assert.equal(grilPreparation.counts.itemMoves, 0);
    assert.equal(grilPreparation.counts.proposalsRekeyed, 0);
    assert.equal(meninaResult.counts.itemMoves, 0);
    assert.equal(meninaResult.counts.proposalsRekeyed, 5);

    const beforeSplit = {
      gril: await protectedFixtureState(fixtures.gril),
      menina: await protectedFixtureState(fixtures.menina),
    };
    const grilResult = await alignTenantSkeleton(fixtures.gril.tenantId, {
      fixtureSightsSplitRules: fixtures.gril.approvedSightsRules!,
    });
    assert.ok(grilResult);
    assert.deepEqual(grilResult.counts, {
      categoriesUpdated: 0,
      translationsUpdated: 0,
      categoriesRetired: 1,
      proposalsRekeyed: 63,
      itemMoves: 14,
    });

    const after = {
      gril: await protectedFixtureState(fixtures.gril),
      menina: await protectedFixtureState(fixtures.menina),
    };
    assert.equal(after.gril.counts.items, 27);
    assert.equal(after.gril.counts.proposals, 367);
    assert.equal(after.menina.counts.items, 0);
    assert.equal(after.menina.counts.proposals, 272);
    for (const source of ["gril", "menina"] as const) {
      assert.equal(fixtureHash(after[source].itemPayloadWithoutCategory), fixtureHash(beforeSplit[source].itemPayloadWithoutCategory), `${source}: item payload other than categoryId drift`);
      assert.equal(fixtureHash(after[source].attachmentPayloadWithoutCategory), fixtureHash(beforeSplit[source].attachmentPayloadWithoutCategory), `${source}: attachment payload other than categoryId drift`);
      assert.equal(fixtureHash(after[source].canonicalPlaces), fixtureHash(beforeSplit[source].canonicalPlaces), `${source}: canonical place drift`);
      assert.equal(fixtureHash(after[source].materializations), fixtureHash(beforeSplit[source].materializations), `${source}: materialization drift`);
      assert.equal(fixtureHash(after[source].media), fixtureHash(beforeSplit[source].media), `${source}: media drift`);
      assert.equal(fixtureHash(after[source].snapshots), fixtureHash(beforeSplit[source].snapshots), `${source}: snapshot drift`);
      assert.equal(
        fixtureHash(after[source].proposalPayloadWithoutCategory),
        fixtureHash(beforeSplit[source].proposalPayloadWithoutCategory),
        `${source}: proposal payload other than categoryId drift`,
      );
    }

    const meninaMovedIds = new Set(fixtures.menina.approvedRules.map((rule) => rule.id));
    const meninaBeforeById = new Map(captured.menina.proposals.map((row) => [row.id, row]));
    const meninaCategories = await db.select().from(categoriesTable)
      .where(inArray(categoriesTable.sectionId, fixtures.menina.sectionIds));
    const meninaTargetByKey = new Map(meninaCategories.map((row) => [row.key, row.id]));
    for (const proposal of after.menina.proposals) {
      const original = meninaBeforeById.get(proposal.id)!;
      if (meninaMovedIds.has(proposal.id)) {
        const rule = fixtures.menina.approvedRules.find((entry) => entry.id === proposal.id)!;
        assert.equal(proposal.categoryId, meninaTargetByKey.get(rule.targetKey));
      } else {
        assert.equal(proposal.categoryId, original.categoryId, `unexpected proposal move ${proposal.id}`);
      }
      assert.equal(proposal.status, original.status);
    }

    const grilCategories = await db.select().from(categoriesTable)
      .where(inArray(categoriesTable.sectionId, fixtures.gril.sectionIds));
    const grilTargetByKey = new Map(grilCategories.map((row) => [row.key, row.id]));
    const afterItemsById = new Map(after.gril.items.map((row) => [row.id, row]));
    for (const rule of fixtures.gril.approvedSightsRules!.itemRules) {
      assert.equal(afterItemsById.get(rule.id)?.categoryId, grilTargetByKey.get(rule.targetKey));
    }
    const afterProposalsById = new Map(after.gril.proposals.map((row) => [row.id, row]));
    for (const rule of fixtures.gril.approvedSightsRules!.proposalRules) {
      assert.equal(afterProposalsById.get(rule.id)?.categoryId, grilTargetByKey.get(rule.targetKey));
    }
    const splitProposalIds = new Set(fixtures.gril.approvedSightsRules!.proposalRules.map((rule) => rule.id));
    const splitAttachments = after.gril.attachments.filter((row) =>
      row.sourceProposalId && splitProposalIds.has(row.sourceProposalId));
    assert.equal(splitAttachments.length, 14);
    const ruleByProposal = new Map(fixtures.gril.approvedSightsRules!.proposalRules.map((rule) => [rule.id, rule]));
    for (const attachment of splitAttachments) {
      assert.equal(attachment.categoryId, grilTargetByKey.get(ruleByProposal.get(attachment.sourceProposalId!)!.targetKey));
    }
    assert.equal(grilCategories.find((row) => row.key === "sights")?.deletedAt instanceof Date, true);

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

    const grilReplay = await alignTenantSkeleton(fixtures.gril.tenantId, {
      fixtureSightsSplitRules: fixtures.gril.approvedSightsRules!,
    });
    const meninaReplay = await alignTenantSkeleton(fixtures.menina.tenantId, {
      fixtureProposalRules: fixtures.menina.approvedRules,
    });
    assert.deepEqual(grilReplay?.counts, zeroCounts);
    assert.deepEqual(meninaReplay?.counts, zeroCounts);
    assert.equal(grilReplay?.changed, false);
    assert.equal(meninaReplay?.changed, false);

    verification = {
      status: "PASSED_DEVELOPMENT_COPIES_NOT_PUBLISHED",
      fixtureTenantIds: { gril: fixtures.gril.tenantId, menina: fixtures.menina.tenantId },
      approvedLedger: {
        items: 14,
        proposals: 63,
        decisions: {
          "Center Rinka": "culture",
          "Mozirski gaj": "nature",
          "Kmetija Bukovnik": "culinary",
          "Razgledni stolp na Golteh": "act",
        },
      },
      before: { gril: captured.gril.counts, menina: captured.menina.counts },
      after: {
        gril: await fixtureCounts(fixtures.gril.tenantId),
        menina: await fixtureCounts(fixtures.menina.tenantId),
      },
      priorMetadataAlignment: { gril: grilPreparation, menina: meninaResult },
      approvedSplitRun: { gril: grilResult },
      secondRun: { gril: grilReplay, menina: meninaReplay },
      proof: {
        zeroItemLoss: true,
        zeroProposalLoss: true,
        exactFourteenItemsMoved: true,
        exactSixtyThreeGrilProposalsRekeyed: true,
        exactFiveMeninaProposalsRekeyed: true,
        exactFourteenAttachmentProjectionsRekeyed: true,
        immutableCanonicalMaterializationMediaSnapshotHashes: true,
        payloadOtherThanApprovedCategoryFieldsUnchanged: true,
        allCanonicalCategoryLanguagesVerified: ["sl", "en", "de", "it"],
        idempotentReplayAllZero: true,
        publicationPerformed: false,
        realTenantWrites: false,
      },
    };
  } finally {
    await cleanupFullCopyFixtures(fixtures);
  }
  const leftoverTenants = await db.select({ id: tenantsTable.id }).from(tenantsTable)
    .where(like(tenantsTable.slug, "alignment-full-copy-%"));
  const leftoverReviewers = await db.select({ id: adminUsersTable.id }).from(adminUsersTable)
    .where(like(adminUsersTable.email, "alignment-fixture-%@invalid.test"));
  assert.equal(leftoverTenants.length, 0);
  assert.equal(leftoverReviewers.length, 0);
  const finalVerification = {
    ...verification,
    cleanup: {
      fixtureTenantsRemaining: leftoverTenants.length,
      syntheticReviewerRowsRemaining: leftoverReviewers.length,
      accountsCreated: false,
    },
  };
  await writeFile(verificationJsonUrl, JSON.stringify(finalVerification, null, 2));
  const escaped = JSON.stringify(finalVerification, null, 2)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  await writeFile(verificationHtmlUrl, `<!doctype html>
<html lang="sl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Preverjanje odobrene razdelitve Znamenitosti</title>
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:1050px;margin:auto;padding:32px;color:#183126;background:#f4f7f3}main{background:white;border:1px solid #cfdbd2;border-radius:16px;padding:28px}h1{line-height:1.2}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eff5ef;padding:18px;border-radius:10px}</style>
</head><body><main><h1>Preverjanje odobrene razdelitve Znamenitosti</h1>
<p><strong>Uspešno na odstranljivih razvojnih kopijah.</strong> Ni bilo objave ali zapisa v pravi nastanitvi.</p>
<ul><li>14/14 vnosov in 63/63 predlogov je bilo prerazvrščenih na odobrene cilje.</li>
<li>Število vseh vnosov in predlogov je ohranjeno.</li>
<li>Drugi zagon ni izvedel nobene spremembe.</li>
<li>Po preizkusu ni ostala nobena kopija ali tehnični račun.</li></ul>
<h2>Natančen rezultat</h2><pre>${escaped}</pre></main></body></html>`);
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