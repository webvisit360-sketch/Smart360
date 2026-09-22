import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test from "node:test";
import {
  creatorPlaceProposalsTable,
  db,
  hostOnboardingEventSuggestionsTable,
  hostOnboardingRoundsTable,
  itemsTable,
  mediaTable,
  publishedSnapshotsTable,
  tenantsTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  currentHostOnboarding,
  openHostOnboarding,
  ownerHostOnboarding,
  saveHostOnboarding,
  submitHostOnboarding,
} from "../lib/hostOnboarding";
import { _setHostOnboardingDeliveryOverride } from "../lib/hostOnboardingEmail";
import {
  assertNoCanonicalOnboardingFixtureRows,
  canonicalFixtureDigest,
  canonicalOnboardingFixtureRows,
  cleanupCanonicalOnboardingFixture,
  createCanonicalOnboardingFixture,
  type CanonicalOnboardingFixture,
} from "./helpers/canonicalOnboardingFixture";

const reportJsonUrl = new URL("../../../../reports/admin-host-canonical-binding-verification.json", import.meta.url);
const reportHtmlUrl = new URL("../../../../reports/admin-host-canonical-binding-verification.html", import.meta.url);

test("development copy: admin and host onboarding are two views over one unpublished canonical draft", async (context) => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Canonical binding verification rejects production");
  }
  if (!process.env.DATABASE_URL) {
    context.skip("development database is unavailable");
    return;
  }

  let fixture: CanonicalOnboardingFixture | undefined;
  let report: Record<string, unknown> | undefined;
  _setHostOnboardingDeliveryOverride(async () => ({
    ok: true,
    providerMessageId: "canonical-binding-fixture",
  }));
  try {
    fixture = await createCanonicalOnboardingFixture();
    const publishedBeforeDigest = canonicalFixtureDigest(fixture.publishedContent);
    const firstOpen = await currentHostOnboarding(fixture.tenantId, fixture.hostUserId);
    assert.ok(firstOpen);
    const first = firstOpen.round.draftData;

    // The deliberately stale JSON workflow copy must never win over the
    // operator's current canonical tenant draft.
    assert.equal(first.accommodationName, "Operaterjev trenutni osnutek");
    assert.equal(first.address, "Osnutkova ulica 2");
    assert.equal(first.guestPhone, "+386 40 200 200");
    assert.equal(first.guestEmail, "draft@example.invalid");
    assert.equal(first.website, "https://fixture.example.invalid");
    assert.equal(first.checkInFrom, "15:00");
    assert.equal(first.checkOutUntil, "10:00");
    assert.deepEqual(first.contacts, [
      { id: fixture.itemIds.contacts[0], name: "Ana", phone: "+386 40 200 201" },
      { id: fixture.itemIds.contacts[1], name: "Bine", phone: "+386 40 200 202" },
    ]);
    assert.equal(first.wifiName, "Fixture Wi-Fi");
    assert.equal(first.wifiPassword, "fixture-password");
    assert.equal(first.houseRulesParking, "<p>Po 22. uri prosimo za mir.</p>");
    assert.deepEqual(
      new Map(first.offers.map((offer) => [offer.id, offer])),
      new Map([
        [fixture.itemIds.offer, {
          id: fixture.itemIds.offer,
          name: "Košarica zajtrka",
          price: "14 EUR",
          categoryId: fixture.categoryIds.sup,
        }],
        [fixture.itemIds.customOffer, {
          id: fixture.itemIds.customOffer,
          name: "Zasebni ogled",
          price: "35 EUR",
          categoryId: fixture.categoryIds.customOffer,
        }],
      ]),
    );
    assert.deepEqual(first.events, [{
      id: fixture.itemIds.event,
      name: "Poletni koncert",
      date: "2026-08-11",
      time: "19:30",
    }]);
    const canonicalItemsById = new Map(first.canonicalItems?.map((row) => [row.id, row]));
    assert.equal(
      canonicalItemsById.get(fixture.itemIds.welcome)?.body,
      "<p><strong>Operaterjevo bogato besedilo</strong> ostane nespremenjeno.</p>",
    );
    assert.equal(canonicalItemsById.get(fixture.itemIds.house)?.body, "<p>Po 22. uri prosimo za mir.</p>");
    assert.equal(canonicalItemsById.get(fixture.itemIds.park)?.body, "Parkirajte ob leseni ograji.");
    assert.equal(canonicalItemsById.get(fixture.itemIds.offer)?.price, "14 EUR");
    assert.deepEqual(first.media?.map(({ id, kind, itemId }) => ({ id, kind, itemId })), [
      { id: fixture.mediaIds.photo, kind: "image", itemId: fixture.itemIds.welcome },
      { id: fixture.mediaIds.video, kind: "video", itemId: fixture.itemIds.welcome },
    ]);
    const canonicalPhoto = first.media?.find((row) => row.id === fixture!.mediaIds.photo);
    const canonicalVideo = first.media?.find((row) => row.id === fixture!.mediaIds.video);
    assert.deepEqual({
      url: canonicalPhoto?.url,
      alt: canonicalPhoto?.alt,
      width: canonicalPhoto?.width,
      height: canonicalPhoto?.height,
    }, {
      url: `/objects/${fixture.marker}/welcome-photo.jpg`,
      alt: "Operaterjeva fotografija",
      width: 1600,
      height: 1067,
    });
    assert.deepEqual({
      url: canonicalVideo?.url,
      posterUrl: canonicalVideo?.posterUrl,
      alt: canonicalVideo?.alt,
      durationSec: canonicalVideo?.durationSec,
      width: canonicalVideo?.width,
      height: canonicalVideo?.height,
    }, {
      url: `/objects/${fixture.marker}/welcome-video.mp4`,
      posterUrl: `/objects/${fixture.marker}/welcome-video-poster.jpg`,
      alt: "Operaterjev video",
      durationSec: 37,
      width: 1920,
      height: 1080,
    });
    assert.ok(first.recommendations.some((row) =>
      row.id === "queue-hint-stable" &&
      row.categoryId === "shops" &&
      row.name === "Trgovina iz čakalne vrste"
    ));

    // An operator write after the host's GET must reject the stale host save;
    // the independently fingerprinted canonical draft cannot be overwritten
    // just because the workflow-round revision itself is unchanged.
    await db.update(tenantsTable).set({ address: "Operaterjev novejši naslov 3" })
      .where(eq(tenantsTable.id, fixture.tenantId));
    const staleCanonicalSave = await saveHostOnboarding(
      fixture.tenantId,
      fixture.hostUserId,
      firstOpen.round.revision,
      { address: "Tihi prepis, ki mora biti zavrnjen" },
      firstOpen.canonicalRevision,
    );
    assert.deepEqual(
      { ok: staleCanonicalSave.ok, kind: staleCanonicalSave.ok ? undefined : staleCanonicalSave.kind },
      { ok: false, kind: "stale" },
    );

    // A later operator write is visible on the next form open, not only after
    // a new onboarding round is created.
    const refreshed = await currentHostOnboarding(fixture.tenantId, fixture.hostUserId);
    assert.equal(refreshed?.round.draftData.address, "Operaterjev novejši naslov 3");

    const firstPatch = {
      accommodationName: "Gostiteljev neposredni osnutek",
      address: "Gostiteljeva ulica 4",
      contacts: [
        { id: fixture.itemIds.contacts[0], name: "Ana Novak", phone: "+386 40 300 301" },
        { id: fixture.itemIds.contacts[1], name: "Bine Kovač", phone: "+386 40 300 302" },
      ],
      website: "https://host-edit.example.invalid",
      wifiName: "Host Wi-Fi",
      wifiPassword: "host-password",
      houseRulesParking: "<p><strong>Novo pravilo:</strong> brez hrupa po 21. uri.</p>",
      offers: [{
        id: fixture.itemIds.offer,
        name: "Košarica zajtrka",
        price: "16 EUR",
      }],
      events: [{
        id: fixture.itemIds.event,
        name: "Jesenski koncert",
        date: "2026-09-12",
        time: "20:15",
      }],
      canonicalItems: [{
        ...canonicalItemsById.get(fixture.itemIds.welcome)!,
        body: "<p><strong>Gostiteljev neposredni popravek</strong> bogatega besedila.</p>",
      }],
    };
    const saved = await saveHostOnboarding(
      fixture.tenantId,
      fixture.hostUserId,
      refreshed!.round.revision,
      firstPatch,
      refreshed!.canonicalRevision,
    );
    assert.equal(saved.ok, true);

    // Omitting media is not deletion.
    const mediaAfterTextSave = await db.select().from(mediaTable)
      .where(inArray(mediaTable.id, Object.values(fixture.mediaIds)));
    assert.equal(mediaAfterTextSave.length, 2);

    const canonicalAfterSave = await canonicalOnboardingFixtureRows(fixture);
    assert.equal(canonicalAfterSave.tenant?.name, firstPatch.accommodationName);
    assert.equal(canonicalAfterSave.tenant?.address, firstPatch.address);
    const byId = new Map(canonicalAfterSave.items.map((row) => [row.id, row]));
    assert.equal(byId.get(fixture.itemIds.contacts[0])?.title, "Ana Novak");
    assert.equal(byId.get(fixture.itemIds.contacts[0])?.phone, "+386 40 300 301");
    assert.equal(byId.get(fixture.itemIds.offer)?.price, "16 EUR");
    assert.equal(byId.get(fixture.itemIds.event)?.eventStart, "2026-09-12T20:15:00");
    assert.equal(
      byId.get(fixture.itemIds.house)?.body,
      "<p><strong>Novo pravilo:</strong> brez hrupa po 21. uri.</p>",
    );
    assert.equal(
      byId.get(fixture.itemIds.welcome)?.body,
      "<p><strong>Gostiteljev neposredni popravek</strong> bogatega besedila.</p>",
      "an edited rich-text field must write directly into the canonical admin draft",
    );
    assert.equal(
      byId.get(fixture.itemIds.park)?.body,
      "Parkirajte ob leseni ograji.",
      "an unedited canonical text item must not be clobbered",
    );
    const ownerRead = await ownerHostOnboarding(fixture.tenantId);
    assert.equal(ownerRead?.rounds[0]?.round.draftData.events[0]?.id, fixture.itemIds.event);
    assert.equal(ownerRead?.rounds[0]?.events[0]?.name, "Jesenski koncert");
    assert.equal(ownerRead?.rounds[0]?.events[0]?.eventDate, "2026-09-12");

    const afterFirstSave = await currentHostOnboarding(fixture.tenantId, fixture.hostUserId);
    assert.ok(afterFirstSave);
    const sparseCollectionsSave = await saveHostOnboarding(
      fixture.tenantId,
      fixture.hostUserId,
      afterFirstSave.round.revision,
      {
        contacts: [afterFirstSave.round.draftData.contacts[0]!],
        offers: [],
        events: [],
      },
      afterFirstSave.canonicalRevision,
    );
    assert.equal(sparseCollectionsSave.ok, true);
    const rowsAfterSparseCollections = await canonicalOnboardingFixtureRows(fixture);
    const liveAfterSparseCollections = new Map(rowsAfterSparseCollections.items.map((row) => [row.id, row]));
    assert.equal(liveAfterSparseCollections.get(fixture.itemIds.contacts[1])?.deletedAt, null);
    assert.equal(liveAfterSparseCollections.get(fixture.itemIds.offer)?.deletedAt, null);
    assert.equal(liveAfterSparseCollections.get(fixture.itemIds.event)?.deletedAt, null);

    const afterSparseCollections = await currentHostOnboarding(fixture.tenantId, fixture.hostUserId);
    assert.ok(afterSparseCollections);
    const retainedPhoto = afterSparseCollections.round.draftData.media?.find(
      (row) => row.id === fixture!.mediaIds.photo,
    );
    assert.ok(retainedPhoto);
    const explicitMediaSave = await saveHostOnboarding(
      fixture.tenantId,
      fixture.hostUserId,
      afterSparseCollections.round.revision,
      {
        media: [{ ...retainedPhoto, alt: "Gostiteljev posodobljen opis fotografije" }],
      },
      afterSparseCollections.canonicalRevision,
    );
    assert.equal(explicitMediaSave.ok, true);
    const mediaAfterSparseMediaPatch = await db.select().from(mediaTable)
      .where(inArray(mediaTable.id, Object.values(fixture.mediaIds)));
    assert.equal(
      mediaAfterSparseMediaPatch.length,
      2,
      "a sparse media array must not delete an omitted canonical video",
    );
    assert.equal(
      mediaAfterSparseMediaPatch.find((row) => row.id === fixture!.mediaIds.photo)?.alt,
      "Gostiteljev posodobljen opis fotografije",
    );

    const beforeExplicitRemoval = await currentHostOnboarding(fixture.tenantId, fixture.hostUserId);
    assert.ok(beforeExplicitRemoval);
    const explicitRemoval = await saveHostOnboarding(
      fixture.tenantId,
      fixture.hostUserId,
      beforeExplicitRemoval.round.revision,
      { deleteMediaIds: [fixture.mediaIds.video] },
      beforeExplicitRemoval.canonicalRevision,
    );
    assert.equal(explicitRemoval.ok, true);
    const mediaAfterExplicitRemoval = await db.select().from(mediaTable)
      .where(inArray(mediaTable.id, Object.values(fixture.mediaIds)));
    assert.deepEqual(
      mediaAfterExplicitRemoval.map((row) => row.id),
      [fixture.mediaIds.photo],
      "only deleteMediaIds removes the video",
    );

    const beforeReplay = await currentHostOnboarding(fixture.tenantId, fixture.hostUserId);
    assert.ok(beforeReplay);
    const stableIds = {
      contacts: beforeReplay.round.draftData.contacts.map((row) => row.id),
      offers: beforeReplay.round.draftData.offers.map((row) => row.id),
      events: beforeReplay.round.draftData.events.map((row) => row.id),
      media: beforeReplay.round.draftData.media?.map((row) => row.id),
    };
    const replaySave = await saveHostOnboarding(
      fixture.tenantId,
      fixture.hostUserId,
      beforeReplay.round.revision,
      {
        contacts: beforeReplay.round.draftData.contacts,
        offers: beforeReplay.round.draftData.offers,
        events: beforeReplay.round.draftData.events,
        media: beforeReplay.round.draftData.media,
      },
      beforeReplay.canonicalRevision,
    );
    assert.equal(replaySave.ok, true);
    const afterReplay = await currentHostOnboarding(fixture.tenantId, fixture.hostUserId);
    assert.ok(afterReplay);
    assert.deepEqual({
      contacts: afterReplay.round.draftData.contacts.map((row) => row.id),
      offers: afterReplay.round.draftData.offers.map((row) => row.id),
      events: afterReplay.round.draftData.events.map((row) => row.id),
      media: afterReplay.round.draftData.media?.map((row) => row.id),
    }, stableIds);

    const queueSave = await saveHostOnboarding(
      fixture.tenantId,
      fixture.hostUserId,
      afterReplay.round.revision,
      {
        recommendations: [
          ...afterReplay.round.draftData.recommendations,
          { id: "save-hint-new", categoryId: "shops", name: "Namig ob shranjevanju" },
        ],
      },
      afterReplay.canonicalRevision,
    );
    assert.equal(queueSave.ok, true);
    assert.equal(
      (await db.select().from(creatorPlaceProposalsTable).where(and(
        eq(creatorPlaceProposalsTable.tenantId, fixture.tenantId),
        eq(creatorPlaceProposalsTable.proposedName, "Namig ob shranjevanju"),
      ))).length,
      1,
      "a new surrounding-place hint reaches Creator on save, before submit",
    );

    const readyToSubmit = await currentHostOnboarding(fixture.tenantId, fixture.hostUserId);
    assert.ok(readyToSubmit);
    const submission = await submitHostOnboarding(
      fixture.tenantId,
      fixture.hostUserId,
      readyToSubmit.round.round,
      readyToSubmit.round.revision,
      readyToSubmit.round.draftData,
      readyToSubmit.canonicalRevision,
    );
    assert.equal(submission.ok, true);
    assert.equal(submission.ok && submission.alreadySubmitted, false);
    const proposals = await db.select().from(creatorPlaceProposalsTable)
      .where(and(
        eq(creatorPlaceProposalsTable.tenantId, fixture.tenantId),
        eq(creatorPlaceProposalsTable.proposedName, "Trgovina iz čakalne vrste"),
      ));
    assert.equal(proposals.length, 1, "the surrounding-place name remains a Creator queue hint");
    assert.equal(proposals[0]?.status, "unresolved");
    assert.equal(
      (await db.select().from(hostOnboardingEventSuggestionsTable)
        .where(eq(hostOnboardingEventSuggestionsTable.tenantId, fixture.tenantId))).length,
      0,
      "events are canonical draft items, not suggestion-only rows",
    );

    const [publishedAfter] = await db.select().from(publishedSnapshotsTable)
      .where(eq(publishedSnapshotsTable.tenantId, fixture.tenantId));
    assert.equal(canonicalFixtureDigest(publishedAfter?.content), publishedBeforeDigest);
    assert.notEqual(
      (publishedAfter?.content as { languages?: { sl?: { tree?: { name?: string } } } })
        ?.languages?.sl?.tree?.name,
      "Gostiteljev neposredni osnutek",
      "host changes must not reach the guest snapshot without publish",
    );

    const reopenedRound = await openHostOnboarding(fixture.tenantId, true);
    assert.ok(reopenedRound);
    const reopened = await currentHostOnboarding(fixture.tenantId, fixture.hostUserId);
    assert.ok(reopened);
    assert.equal(reopened.round.round, 2);
    assert.equal(reopened.round.draftData.accommodationName, "Gostiteljev neposredni osnutek");
    assert.ok(reopened.round.draftData.offers.some((offer) => offer.id === fixture!.itemIds.offer));
    assert.equal(reopened.round.draftData.events[0]?.id, fixture.itemIds.event);
    assert.deepEqual(reopened.round.draftData.media?.map((row) => row.id), [fixture.mediaIds.photo]);

    report = {
      status: "PASSED_DEVELOPMENT_COPY_NOT_PUBLISHED",
      fixtureTenantId: fixture.tenantId,
      verified: {
        adminDraftPrefillsFreshForm: true,
        adminDraftPrefillsReopenedForm: true,
        hostSaveImmediatelyUpdatesCanonicalAdminDraft: true,
        richTextPreserved: true,
        richTextPrefilledAndHostEditCanonical: true,
        photoAndVideoPrefilled: true,
        videoMetadataRoundTrips: true,
        omittedMediaPreserved: true,
        explicitMediaRemovalApplied: true,
        sparseArraysDoNotDeleteCanonicalRows: true,
        staleCanonicalFingerprintRejected: true,
        offersContactsWifiRulesAndEventsCanonical: true,
        canonicalEventsConsistentInOwnerRead: true,
        okolicaNamesRemainCreatorQueueHints: true,
        okolicaHintsQueuedOnSave: true,
        stableIdsAcrossIdempotentSave: true,
        publishedSnapshotUnchanged: true,
      },
      counts: {
        contacts: reopened.round.draftData.contacts.length,
        offers: reopened.round.draftData.offers.length,
        events: reopened.round.draftData.events.length,
        mediaAfterExplicitRemoval: reopened.round.draftData.media?.length ?? 0,
        queuedPlaceHints: proposals.length,
      },
      authentication: {
        host: "disposable tenant-scoped development membership and expiring session",
        owner: "none created",
        emailsSent: false,
      },
      browserHarness: {
        transport: "workspace-loopback relay; actor binding is simulated and restricted to the disposable tenant",
        setup: "cd artifacts/api-server && NODE_ENV=development node --import tsx/esm src/tests/fixtures/canonical-onboarding-browser-harness.ts setup",
        serve: "cd artifacts/api-server && NODE_ENV=development node --import tsx/esm src/tests/fixtures/canonical-onboarding-browser-harness.ts serve",
        inspect: "cd artifacts/api-server && NODE_ENV=development node --import tsx/esm src/tests/fixtures/canonical-onboarding-browser-harness.ts inspect",
        cleanup: "cd artifacts/api-server && NODE_ENV=development node --import tsx/esm src/tests/fixtures/canonical-onboarding-browser-harness.ts cleanup",
        searchAndCreate: "real Nominatim, OSRM, duplicate guard, and createAdminPlace services; no search mocks",
        adminTenant: "real buildTenantContent + production GetTenantResponse DTO serialization",
        operatorEdit: "fixture-ID allowlisted direct canonical DB write; simulated owner transport, no permission claim",
      },
    };
  } finally {
    _setHostOnboardingDeliveryOverride(null);
    if (fixture) {
      await cleanupCanonicalOnboardingFixture(fixture);
      await assertNoCanonicalOnboardingFixtureRows(fixture);
    }
  }

  assert.ok(report);
  const finalReport = {
    ...report,
    cleanup: { fixtureTenantsRemaining: 0, fixtureHostUsersRemaining: 0 },
  };
  await writeFile(reportJsonUrl, JSON.stringify(finalReport, null, 2));
  const escaped = JSON.stringify(finalReport, null, 2)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  await writeFile(reportHtmlUrl, `<!doctype html>
<html lang="sl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Preverjanje skupnega osnutka admina in obrazca</title>
<style>body{font:16px/1.55 Archivo,system-ui,sans-serif;max-width:1050px;margin:auto;padding:32px;color:#183126;background:#f4f6f2}main{background:white;border:1px solid #e8ebe6;border-radius:16px;padding:28px}h1{line-height:1.2}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6f2;padding:18px;border-radius:10px}</style>
</head><body><main><h1>Skupni osnutek admina in obrazca</h1>
<p><strong>Uspešno na odstranljivi razvojni kopiji.</strong> Brez objave in brez operaterskega računa.</p>
<ul><li>Svež in ponovno odprt obrazec bereta trenutni admin osnutek.</li>
<li>Shranjevanje obrazca neposredno posodobi isti osnutek.</li>
<li>Fotografije se brez izrecne spremembe ne odstranijo.</li>
<li>Objavljeni posnetek ostane nespremenjen.</li></ul>
<h2>Natančen rezultat</h2><pre>${escaped}</pre></main></body></html>`);
});