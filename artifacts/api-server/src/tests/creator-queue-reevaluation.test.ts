import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  adminUsersTable,
  categoriesTable,
  creatorPlaceMaterializationsTable,
  creatorPlaceProposalsTable,
  creatorProposalTranslationsTable,
  db,
  itemCategoryAttachmentsTable,
  itemsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import {
  CREATOR_ACCOMMODATION_REFUSAL_REASON,
  planCreatorQueueReevaluation,
  reevaluateCreatorQueue,
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

test("reevaluation backfills approved proposals whose approval predates materialization", async () => {
  const suffix = crypto.randomUUID();
  const [actor] = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
  assert.ok(actor, "development database needs one admin user");
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `creator-backfill-${suffix}`,
    name: "Creator backfill proof",
  }).returning({ id: tenantsTable.id });
  try {
    const [section] = await db.insert(sectionsTable).values({
      tenantId: tenant.id,
      key: "explore",
      title: "Okolica",
    }).returning({ id: sectionsTable.id });
    const [category] = await db.insert(categoriesTable).values({
      sectionId: section.id,
      key: "nature",
      label: "Narava in parki",
    }).returning({ id: categoriesTable.id });
    const reviewedAt = new Date("2026-09-03T06:00:00.000Z");
    const [proposal] = await db.insert(creatorPlaceProposalsTable).values({
      tenantId: tenant.id,
      runId: crypto.randomUUID(),
      categoryId: category.id,
      range: "near",
      proposedName: "Legacy approved place",
      normalizedName: `legacy-approved-${suffix}`,
      originalQuery: "Legacy approved place",
      confirmedQuery: "Legacy approved place",
      confirmationMethod: "exact",
      status: "approved",
      contentReady: true,
      resolvedName: "Legacy approved place",
      resolvedAddress: "Legacy address, Slovenija",
      osmType: "node",
      osmId: Number.parseInt(suffix.replaceAll("-", "").slice(0, 12), 16),
      latitude: 46.37,
      longitude: 14.84,
      straightLineDistanceM: 5_000,
      roadDistanceM: 6_000,
      travelDurationS: 720,
      reviewedBy: actor.id,
      reviewedAt,
    }).returning();
    await db.insert(creatorProposalTranslationsTable).values(
      ["sl", "en", "de", "it"].map((language) => ({
        proposalId: proposal.id,
        language,
        name: `Legacy ${language}`,
        description: `Legacy description ${language}`,
      })),
    );
    const [malformed] = await db.insert(creatorPlaceProposalsTable).values({
      tenantId: tenant.id,
      runId: crypto.randomUUID(),
      categoryId: category.id,
      range: "near",
      proposedName: "Malformed legacy coordinates",
      normalizedName: `malformed-legacy-${suffix}`,
      originalQuery: "Malformed legacy coordinates",
      confirmedQuery: "operator-map-pin",
      confirmationMethod: "operator_coordinates",
      status: "approved",
      contentReady: true,
      resolvedName: "Malformed legacy coordinates",
      operatorAddress: null,
      resolvedAddress: null,
      latitude: 46.38,
      longitude: 14.85,
      straightLineDistanceM: 4_000,
      roadDistanceM: 5_000,
      travelDurationS: 600,
      coordinateConfirmedBy: actor.id,
      coordinateConfirmedAt: reviewedAt,
      reviewedBy: actor.id,
      reviewedAt,
    }).returning();
    await db.insert(creatorProposalTranslationsTable).values(
      ["sl", "en", "de", "it"].map((language) => ({
        proposalId: malformed.id,
        language,
        name: `Malformed ${language}`,
        description: `Malformed description ${language}`,
      })),
    );

    const before = await db.select().from(creatorPlaceMaterializationsTable)
      .where(eq(creatorPlaceMaterializationsTable.proposalId, proposal.id));
    assert.equal(before.length, 0);

    const first = await reevaluateCreatorQueue(tenant.id);
    assert.equal(first.approvedBackfilled, 1);
    assert.deepEqual(first.failures, [{
      proposalId: malformed.id,
      proposedName: "Malformed legacy coordinates",
      reason: "Manjka naslov, ki ga je operater potrdil ob ročni določitvi koordinat.",
    }]);
    const [materialization] = await db.select().from(creatorPlaceMaterializationsTable)
      .where(eq(creatorPlaceMaterializationsTable.proposalId, proposal.id));
    assert.ok(materialization);
    const [item] = await db.select().from(itemsTable)
      .where(eq(itemsTable.id, materialization.itemId));
    assert.equal(item?.title, "Legacy sl");
    assert.equal(item?.isVisible, true);
    const [attachment] = await db.select().from(itemCategoryAttachmentsTable)
      .where(eq(itemCategoryAttachmentsTable.sourceProposalId, proposal.id));
    assert.equal(attachment?.itemId, materialization.itemId);
    assert.equal(attachment?.categoryId, category.id);
    const [unchangedDecision] = await db.select().from(creatorPlaceProposalsTable)
      .where(eq(creatorPlaceProposalsTable.id, proposal.id));
    assert.equal(unchangedDecision?.status, "approved");
    assert.equal(unchangedDecision?.reviewedBy, actor.id);
    assert.equal(unchangedDecision?.reviewedAt?.toISOString(), reviewedAt.toISOString());
    const malformedMaterialization = await db.select().from(creatorPlaceMaterializationsTable)
      .where(eq(creatorPlaceMaterializationsTable.proposalId, malformed.id));
    assert.equal(malformedMaterialization.length, 0);

    const second = await reevaluateCreatorQueue(tenant.id);
    assert.equal(second.approvedBackfilled, 0);
    assert.equal(second.failures.length, 1);
    assert.equal(second.failures[0]?.proposalId, malformed.id);
  } finally {
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
  }
});