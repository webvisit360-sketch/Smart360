import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  creatorPlaceProposalsTable,
  db,
  hostOnboardingRoundsTable,
  runWithHostDbContext,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  currentHostOnboarding,
  saveHostOnboarding,
} from "../lib/hostOnboarding";
import {
  HOST_ONBOARDING_PROVENANCE,
  HOST_ONBOARDING_UNRESOLVED_REASON,
} from "../lib/hostOnboardingCreator";
import {
  assertNoCanonicalOnboardingFixtureRows,
  cleanupCanonicalOnboardingFixture,
  createCanonicalOnboardingFixture,
  type CanonicalOnboardingFixture,
} from "./helpers/canonicalOnboardingFixture";

test("host recommendation save persists several Creator rows only in the privileged post-commit phase", async (context) => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Host recommendation persistence proof rejects production");
  }
  if (!process.env.DATABASE_URL) {
    context.skip("development database is unavailable");
    return;
  }

  let fixture: CanonicalOnboardingFixture | undefined;
  try {
    fixture = await createCanonicalOnboardingFixture();
    const syntheticRecommendations = [
      {
        id: "proof-shops",
        categoryId: "shops",
        name: `Synthetic fixture shop ${fixture.marker}`,
      },
      {
        id: "proof-nature",
        categoryId: "nature",
        name: `Synthetic fixture nature ${fixture.marker}`,
      },
    ];

    const result = await runWithHostDbContext(fixture.tenantId, async () => {
      const role = await db.execute(sql`select current_user`);
      assert.equal(role.rows[0]?.["current_user"], "smart360_host");

      // Option B is intentional: the ordinary host role cannot access the
      // Creator ledger. Persistence must happen through the explicit
      // privileged escape after the host save transaction commits.
      await assert.rejects(
        db.select({ id: creatorPlaceProposalsTable.id })
          .from(creatorPlaceProposalsTable)
          .limit(1),
        (error: unknown) => {
          const cause = (error as { cause?: { code?: string; message?: string } }).cause;
          assert.equal(cause?.code, "42501");
          assert.match(cause?.message ?? "", /creator_place_proposals/);
          return true;
        },
      );

      const opened = await currentHostOnboarding(fixture!.tenantId, fixture!.hostUserId);
      assert.ok(opened);

      // The actor identity remains part of the round lookup even inside the
      // correctly tenant-scoped host connection.
      const wrongActor = await saveHostOnboarding(
        fixture!.tenantId,
        randomUUID(),
        opened.round.revision,
        { recommendations: syntheticRecommendations },
        opened.canonicalRevision,
      );
      assert.deepEqual(wrongActor, { ok: false, kind: "missing" });

      return saveHostOnboarding(
        fixture!.tenantId,
        fixture!.hostUserId,
        opened.round.revision,
        { recommendations: syntheticRecommendations },
        opened.canonicalRevision,
      );
    });

    assert.equal(result.ok, true);
    assert.equal(
      result.ok && result.recommendationProcessing?.status,
      "succeeded",
    );

    const proposals = await db.select({
      id: creatorPlaceProposalsTable.id,
      categoryId: creatorPlaceProposalsTable.categoryId,
      proposedName: creatorPlaceProposalsTable.proposedName,
      status: creatorPlaceProposalsTable.status,
      contentReady: creatorPlaceProposalsTable.contentReady,
      inclusionReason: creatorPlaceProposalsTable.inclusionReason,
      refusalReason: creatorPlaceProposalsTable.refusalReason,
    }).from(creatorPlaceProposalsTable)
      .where(eq(creatorPlaceProposalsTable.tenantId, fixture.tenantId));
    const expectedNames = syntheticRecommendations.map(({ name }) => name).sort();
    const proofRows = proposals
      .filter(({ proposedName }) => expectedNames.includes(proposedName))
      .sort((left, right) => left.proposedName.localeCompare(right.proposedName));

    assert.equal(proofRows.length, 2, "both ordinary recommendations must persist as Creator rows");
    assert.deepEqual(proofRows.map(({ proposedName }) => proposedName), expectedNames);
    assert.equal(new Set(proofRows.map(({ categoryId }) => categoryId)).size, 2);
    for (const row of proofRows) {
      assert.equal(row.status, "unresolved");
      assert.equal(row.contentReady, false);
      assert.equal(row.inclusionReason, HOST_ONBOARDING_PROVENANCE);
      assert.equal(row.refusalReason, HOST_ONBOARDING_UNRESOLVED_REASON);
    }

    const [round] = await db.select({
      recommendationReview: hostOnboardingRoundsTable.recommendationReview,
    }).from(hostOnboardingRoundsTable)
      .where(eq(hostOnboardingRoundsTable.id, fixture.roundId));
    assert.ok(round);
    assert.deepEqual(
      round.recommendationReview
        .filter(({ name }) => expectedNames.includes(name))
        .map(({ name, proposalId }) => ({ name, proposalId }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      proofRows.map(({ id, proposedName }) => ({ name: proposedName, proposalId: id })),
      "the onboarding review must link to the persisted queue rows",
    );

    console.log(JSON.stringify({
      proof: "host-recommendations-persisted",
      hostRoleDirectCreatorAccess: "denied",
      expectedCount: expectedNames.length,
      persistedCount: proofRows.length,
      expectedNames,
      statuses: proofRows.map(({ status }) => status),
      contentReady: proofRows.map(({ contentReady }) => contentReady),
    }));
  } finally {
    if (fixture) {
      await cleanupCanonicalOnboardingFixture(fixture);
      await assertNoCanonicalOnboardingFixtureRows(fixture);
      assert.equal(
        (await db.select({ id: creatorPlaceProposalsTable.id })
          .from(creatorPlaceProposalsTable)
          .where(eq(creatorPlaceProposalsTable.tenantId, fixture.tenantId))).length,
        0,
        "fixture Creator rows must be removed by tenant cleanup",
      );
      assert.equal(
        (await db.select({ id: hostOnboardingRoundsTable.id })
          .from(hostOnboardingRoundsTable)
          .where(eq(hostOnboardingRoundsTable.tenantId, fixture.tenantId))).length,
        0,
        "fixture onboarding rounds must be removed by tenant cleanup",
      );
    }
  }
});