import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq, like } from "drizzle-orm";
import {
  categoriesTable,
  creatorPlaceProposalsTable,
  creatorProposalTranslationsTable,
  db,
  hostMembershipsTable,
  hostUsersTable,
  itemsTable,
  publishedSnapshotsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import {
  createHostOnboardingDraft,
  currentHostOnboarding,
  ownerHostOnboarding,
  saveHostOnboarding,
  submitHostOnboarding,
} from "../lib/hostOnboarding";
import {
  HOST_ONBOARDING_PROVENANCE,
  HOST_ONBOARDING_UNRESOLVED_REASON,
} from "../lib/hostOnboardingCreator";
import { _setHostOnboardingDeliveryOverride } from "../lib/hostOnboardingEmail";
import { ensureTenantPublication } from "../lib/publishedSnapshots";
import { seedTenantContent } from "../lib/tenantSeeds";
import { syncApprovedCreatorPlace } from "../lib/creatorProposalLedger";

test("real DB: custom category survives save, uses category tooling, and submits idempotently", async () => {
  const marker = randomUUID();
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `onboarding-custom-${marker}`,
    name: "Disposable onboarding integration",
    tenantType: "apartmaji",
    guestUiMode: "living-guide",
  }).returning();
  const [host] = await db.insert(hostUsersTable).values({
    email: `onboarding-${marker}@example.invalid`,
  }).returning();
  assert.ok(tenant && host);

  _setHostOnboardingDeliveryOverride(async () => ({
    ok: true,
    providerMessageId: `test-${marker}`,
  }));
  try {
    await db.insert(hostMembershipsTable).values({
      tenantId: tenant.id,
      hostUserId: host.id,
    });
    await seedTenantContent(tenant.id, "apartmaji");
    await ensureTenantPublication(tenant.id);
    const [publishedBefore] = await db.select({ content: publishedSnapshotsTable.content })
      .from(publishedSnapshotsTable)
      .where(eq(publishedSnapshotsTable.tenantId, tenant.id));
    assert.ok(publishedBefore);

    await db.transaction(async (tx) => {
      await createHostOnboardingDraft(tx, tenant.id, host.id);
    });
    const initial = await currentHostOnboarding(tenant.id, host.id);
    assert.ok(initial);
    const data = {
      ...initial.round.draftData,
      accommodationName: "Disposable onboarding integration",
      address: "Testna 1",
      guestPhone: "+386 40 000 000",
      guestEmail: "guest@example.invalid",
      checkInFrom: "15:00",
      checkOutUntil: "10:00",
      contacts: [{ id: "contact-1", name: "Test Host", phone: "+386 40 000 001" }],
      customCategories: [{
        id: "custom-rain",
        name: "Za deževne dni",
        entries: [
          { id: "rain-1", name: "Muzej igrač" },
          { id: "rain-2", name: "Notranje plezanje" },
        ],
      }],
    };

    const saved = await saveHostOnboarding(
      tenant.id,
      host.id,
      initial.round.revision,
      data,
    );
    assert.equal(saved.ok, true);
    const reloaded = await currentHostOnboarding(tenant.id, host.id);
    assert.ok(reloaded);
    assert.deepEqual(reloaded.round.draftData.customCategories, data.customCategories);

    const submitted = await submitHostOnboarding(
      tenant.id,
      host.id,
      reloaded.round.round,
      reloaded.round.revision,
      reloaded.round.draftData,
    );
    assert.deepEqual(
      { ok: submitted.ok, alreadySubmitted: submitted.ok && submitted.alreadySubmitted },
      { ok: true, alreadySubmitted: false },
    );

    const owner = await ownerHostOnboarding(tenant.id);
    assert.ok(owner);
    const customReview = owner.rounds[0]!.round.recommendationReview
      .filter((entry) => entry.hostCreated);
    assert.equal(customReview.length, 2);
    assert.ok(customReview.every((entry) =>
      entry.provenance === HOST_ONBOARDING_PROVENANCE &&
      entry.customCategoryId === "custom-rain" &&
      entry.categoryId
    ));

    const [explore] = await db.select({ id: sectionsTable.id })
      .from(sectionsTable)
      .where(and(eq(sectionsTable.tenantId, tenant.id), eq(sectionsTable.key, "explore")));
    assert.ok(explore);
    const customCategories = await db.select()
      .from(categoriesTable)
      .where(and(
        eq(categoriesTable.sectionId, explore.id),
        like(categoriesTable.key, "host-custom-%"),
      ));
    assert.equal(customCategories.length, 1);
    assert.equal(customCategories[0]!.label, "Za deževne dni");

    const proposalsBeforeReplay = await db.select()
      .from(creatorPlaceProposalsTable)
      .where(and(
        eq(creatorPlaceProposalsTable.tenantId, tenant.id),
        eq(creatorPlaceProposalsTable.categoryId, customCategories[0]!.id),
      ));
    assert.equal(proposalsBeforeReplay.length, 2);
    assert.deepEqual(
      new Set(proposalsBeforeReplay.map(({ proposedName }) => proposedName)),
      new Set(["Muzej igrač", "Notranje plezanje"]),
    );
    assert.ok(proposalsBeforeReplay.every((proposal) =>
      proposal.status === "unresolved" &&
      proposal.refusalReason === HOST_ONBOARDING_UNRESOLVED_REASON &&
      proposal.inclusionReason === HOST_ONBOARDING_PROVENANCE &&
      proposal.contentReady === false &&
      proposal.osmId === null &&
      proposal.latitude === null &&
      proposal.longitude === null
    ));

    // The normal Creator review/materialization path validates tenant-local
    // category IDs directly (not a canonical skeleton enum). Prepare one
    // disposable proposal as though an operator had resolved and edited it,
    // then run approval validation only: no item is materialized here.
    const compatibleProposal = proposalsBeforeReplay[0]!;
    await db.update(creatorPlaceProposalsTable).set({
      confirmationMethod: "exact",
      confirmedQuery: compatibleProposal.proposedName,
      resolvedName: compatibleProposal.proposedName,
      resolvedAddress: "Testni naslov 1",
      osmType: "node",
      osmId: 987654321,
      latitude: 46.1,
      longitude: 14.8,
      roadDistanceM: 1200,
      travelDurationS: 300,
      range: "near",
      contentReady: true,
    }).where(eq(creatorPlaceProposalsTable.id, compatibleProposal.id));
    await db.insert(creatorProposalTranslationsTable).values(
      ["sl", "en", "de", "it"].map((language) => ({
        proposalId: compatibleProposal.id,
        language,
        name: compatibleProposal.proposedName,
        description: "Testni opis za preverjanje združljivosti.",
      })),
    );
    await db.transaction(async (tx) => {
      const [resolved] = await tx.select().from(creatorPlaceProposalsTable)
        .where(eq(creatorPlaceProposalsTable.id, compatibleProposal.id));
      assert.ok(resolved);
      await syncApprovedCreatorPlace(tx, resolved, { validateOnly: true });
    });
    assert.equal(
      (await db.select().from(itemsTable)
        .where(eq(itemsTable.categoryId, customCategories[0]!.id))).length,
      0,
      "validation must not auto-resolve or materialize the host suggestion",
    );

    const replay = await submitHostOnboarding(
      tenant.id,
      host.id,
      reloaded.round.round,
      reloaded.round.revision,
      reloaded.round.draftData,
    );
    assert.deepEqual(
      { ok: replay.ok, alreadySubmitted: replay.ok && replay.alreadySubmitted },
      { ok: true, alreadySubmitted: true },
    );
    assert.equal(
      (await db.select().from(creatorPlaceProposalsTable)
        .where(eq(creatorPlaceProposalsTable.tenantId, tenant.id))).length,
      2,
    );
    assert.equal(
      (await db.select().from(categoriesTable)
        .where(and(
          eq(categoriesTable.sectionId, explore.id),
          like(categoriesTable.key, "host-custom-%"),
        ))).length,
      1,
    );
    const [publishedAfter] = await db.select({ content: publishedSnapshotsTable.content })
      .from(publishedSnapshotsTable)
      .where(eq(publishedSnapshotsTable.tenantId, tenant.id));
    assert.deepEqual(publishedAfter?.content, publishedBefore.content);
  } finally {
    _setHostOnboardingDeliveryOverride(null);
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
    await db.delete(hostUsersTable).where(eq(hostUsersTable.id, host.id));
  }
});