import assert from "node:assert/strict";
import test from "node:test";
import type { HostOnboardingData } from "../hooks/use-host-onboarding";
import { changedHostOnboardingFields } from "../hooks/use-host-onboarding";
import {
  rebaseHostOnboardingDraft,
  resolveDraftConflict,
  safeRecoveryData,
  acknowledgeUnsavedFailure,
  hostDraftRetryDelay,
  recordUnsavedFailure,
  restoreHostDraftRecovery,
  type HostDraftRecovery,
  autosaveRenderFrame,
  acknowledgeHostDraftWrite,
} from "../lib/host-onboarding-draft-rebase";

const base = (patch: Partial<HostOnboardingData> = {}): HostOnboardingData => ({
  accommodationName: "Staro ime",
  address: "Stari naslov",
  offers: [{ id: "offer-1", categoryId: "food", name: "Zajtrk", price: "10 €" }],
  media: [{
    id: "media-1",
    itemId: null,
    kind: "image",
    url: "/one.jpg",
    alt: "Pogled",
    position: 0,
    posterUrl: null,
    durationSec: null,
  }],
  ...patch,
});

test("a response-lost own autosave rebases as already acknowledged without self-conflict", () => {
  const original = base();
  const local = { ...original, accommodationName: "Novo ime" };
  const result = rebaseHostOnboardingDraft(original, local, local);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.data.accommodationName, "Novo ime");
});

test("admin and host changes to different fields auto-merge", () => {
  const original = base();
  const local = { ...original, accommodationName: "Hostovo ime" };
  const remote = { ...original, address: "Administratorjev naslov" };
  const result = rebaseHostOnboardingDraft(original, local, remote);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.data.accommodationName, "Hostovo ime");
  assert.equal(result.data.address, "Administratorjev naslov");
});

test("different properties of the same stable-ID row auto-merge", () => {
  const original = base();
  const local = {
    ...original,
    offers: [{ ...original.offers![0]!, price: "12 €" }],
  };
  const remote = {
    ...original,
    offers: [{ ...original.offers![0]!, name: "Domači zajtrk" }],
  };
  const result = rebaseHostOnboardingDraft(original, local, remote);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.data.offers, [{
    ...original.offers![0],
    name: "Domači zajtrk",
    price: "12 €",
  }]);
});

test("same-field conflict is named, retains input, and requires an explicit choice", () => {
  const original = base();
  const local = { ...original, accommodationName: "Hostovo ime" };
  const remote = { ...original, accommodationName: "Adminovo ime" };
  const result = rebaseHostOnboardingDraft(original, local, remote);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0]?.label, "Ime nastanitve");
  assert.equal(result.data.accommodationName, "Hostovo ime");
  assert.equal(
    resolveDraftConflict(result.data, result.conflicts[0]!, "remote").accommodationName,
    "Adminovo ime",
  );
});

test("choosing local keeps typing entered after the conflict was detected", () => {
  const original = base();
  const detected = rebaseHostOnboardingDraft(
    original,
    { ...original, accommodationName: "Moj prvi vnos" },
    { ...original, accommodationName: "Adminovo ime" },
  );
  const afterMoreTyping = {
    ...detected.data,
    accommodationName: "Moj novejši vnos med prikazanim sporom",
  };
  const resolved = resolveDraftConflict(afterMoreTyping, detected.conflicts[0]!, "local");
  assert.equal(resolved.accommodationName, "Moj novejši vnos med prikazanim sporom");
});

test("explicit removals and remote additions retain stable identities and media", () => {
  const original = base();
  const local = { ...original, offers: [] };
  const remote = {
    ...original,
    offers: [
      ...original.offers!,
      { id: "offer-2", categoryId: "food", name: "Večerja", price: "20 €" },
    ],
    media: [
      ...original.media!,
      { ...original.media![0]!, id: "media-2", url: "/two.jpg" },
    ],
  };
  const result = rebaseHostOnboardingDraft(original, local, remote);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.data.offers?.map((row) => row.id), ["offer-2"]);
  assert.deepEqual(result.data.media?.map((row) => row.id), ["media-1", "media-2"]);
});

test("refresh recovery retains the complete pending app draft including guest Wi-Fi content", () => {
  const original = base({ wifiPassword: "zelo-skrivno" });
  const pending = safeRecoveryData({ ...original, address: "Tipkan naslov" });
  assert.equal(pending.wifiPassword, "zelo-skrivno");
  const restored = rebaseHostOnboardingDraft(
    safeRecoveryData(original),
    pending,
    original,
  );
  assert.equal(restored.data.address, "Tipkan naslov");
  assert.equal(restored.data.wifiPassword, "zelo-skrivno");
});

test("full-snapshot refresh recovery keeps every canonical row when only one was edited", () => {
  const item = (
    id: string,
    title: string,
  ): NonNullable<HostOnboardingData["canonicalItems"]>[number] => ({
    id,
    categoryId: "stay",
    categoryKey: "rooms",
    sectionKey: "stay",
    title,
    body: "", price: "", priceUnit: "", phone: "", website: "", mapQuery: "",
    difficulty: "", duration: "", distance: "", noteType: "", noteText: "",
    bullets: [] as string[], tint: "", frame: "", isVisible: true,
    orderEnabled: false, soldOut: false, producerName: "", producerNote: "",
  });
  const original = base({
    canonicalItems: [item("room-1", "Soba 1"), item("room-2", "Soba 2")],
  });
  const recovery: HostDraftRecovery = {
    tenantId: "tenant-1",
    round: 2,
    base: original,
    local: {
      ...original,
      canonicalItems: [
        item("room-1", "Urejena soba 1"),
        item("room-2", "Soba 2"),
      ],
    },
  };
  const restored = restoreHostDraftRecovery(recovery, original);
  assert.deepEqual(
    restored.data.canonicalItems?.map((row) => [row.id, row.title]),
    [["room-1", "Urejena soba 1"], ["room-2", "Soba 2"]],
  );

  const legacySparse = restoreHostDraftRecovery({
    ...recovery,
    local: undefined,
    patch: { canonicalItems: [item("room-1", "Urejena soba 1")] },
  }, original);
  assert.deepEqual(
    legacySparse.data.canonicalItems?.map((row) => [row.id, row.title]),
    [["room-1", "Urejena soba 1"], ["room-2", "Soba 2"]],
  );
});

test("the stale render frame from the hydration commit cannot erase recovered local input", () => {
  const recovered = base({ accommodationName: "Najbolj sveže lokalno ime" });
  const frame = autosaveRenderFrame(recovered, {}, true);
  assert.equal(frame.shouldProcess, false);
  assert.equal(frame.latest.accommodationName, "Najbolj sveže lokalno ime");

  const hydratedRender = autosaveRenderFrame(frame.latest, recovered, frame.skipNext);
  assert.equal(hydratedRender.shouldProcess, true);
  assert.equal(hydratedRender.latest.accommodationName, "Najbolj sveže lokalno ime");
});

test("a queued row write is rederived after rebase and retains a remote different-field edit", () => {
  const original = base();
  const staleQueuedRow = {
    ...original.offers![0]!,
    price: "12 €",
  };
  const remote = {
    ...original,
    offers: [{ ...original.offers![0]!, name: "Adminov domači zajtrk" }],
  };
  const latestLocal = {
    ...original,
    offers: [staleQueuedRow],
  };
  const rebased = rebaseHostOnboardingDraft(original, latestLocal, remote);
  assert.deepEqual(rebased.conflicts, []);
  const executionTimePatch = changedHostOnboardingFields(rebased.data, remote);
  assert.deepEqual(executionTimePatch.offers, [{
    ...staleQueuedRow,
    name: "Adminov domači zajtrk",
  }]);
});

test("server-retained rows omitted without explicit deletion are adopted on acknowledgement", () => {
  const canonicalRow = {
    id: "canonical-kept",
    categoryId: "stay",
    categoryKey: "house",
    sectionKey: "stay",
    title: "Ohranjeno",
    body: "<p>Strežnik je vrstico pravilno ohranil.</p>",
    price: "", priceUnit: "", phone: "", website: "", mapQuery: "",
    difficulty: "", duration: "", distance: "", noteType: "", noteText: "",
    bullets: [] as string[], tint: "", frame: "", isVisible: true,
    orderEnabled: false, soldOut: false, producerName: "", producerNote: "",
  };
  const sent = base({ contacts: [], offers: [], events: [], canonicalItems: [] });
  const server = base({
    contacts: [{ id: "contact-kept", name: "Ana", phone: "123" }],
    offers: [{ id: "offer-kept", name: "Zajtrk", price: "10 €" }],
    events: [{ id: "event-kept", name: "Sejem", date: "2026-10-01", time: "10:00" }],
    canonicalItems: [canonicalRow],
  });
  const acknowledged = acknowledgeHostDraftWrite(sent, sent, server);
  assert.deepEqual(acknowledged.contacts, server.contacts);
  assert.deepEqual(acknowledged.offers, server.offers);
  assert.deepEqual(acknowledged.events, server.events);
  assert.deepEqual(acknowledged.canonicalItems, server.canonicalItems);
  assert.deepEqual(changedHostOnboardingFields(acknowledged, server), {});
});

test("acknowledgement preserves typing that happened while the request was in flight", () => {
  const sent = base({
    contacts: [{ id: "contact-1", name: "Ana", phone: "123" }],
  });
  const latest = base({
    contacts: [{ id: "contact-1", name: "Ana", phone: "123 456" }],
  });
  const canonical = base({
    contacts: [{ id: "contact-1", name: "Ana", phone: "123" }],
    address: "Strežniško normaliziran naslov",
  });
  const acknowledged = acknowledgeHostDraftWrite(sent, latest, canonical);
  assert.equal(acknowledged.contacts?.[0]?.phone, "123 456");
  assert.equal(acknowledged.address, "Strežniško normaliziran naslov");
});

test("repeated concurrent different-field revisions remain mergeable instead of dead-ending", () => {
  const original = base();
  const local = { ...original, accommodationName: "Hostovo ime" };
  const firstRemote = { ...original, address: "Prvi oddaljeni naslov" };
  const first = rebaseHostOnboardingDraft(original, local, firstRemote);
  assert.deepEqual(first.conflicts, []);

  const secondRemote = { ...firstRemote, guestPhone: "+386 40 111 222" };
  const second = rebaseHostOnboardingDraft(firstRemote, first.data, secondRemote);
  assert.deepEqual(second.conflicts, []);
  assert.equal(second.data.accommodationName, "Hostovo ime");
  assert.equal(second.data.address, "Prvi oddaljeni naslov");
  assert.equal(second.data.guestPhone, "+386 40 111 222");
});

test("a rejected save keeps the first warning time until a retry fully succeeds", () => {
  const first = recordUnsavedFailure(null, "2026-09-23T08:15:00.000Z");
  const repeated = recordUnsavedFailure(first, "2026-09-23T08:16:00.000Z");
  assert.equal(repeated, first);
  assert.equal(acknowledgeUnsavedFailure(repeated, false), first);
  assert.equal(acknowledgeUnsavedFailure(repeated, true), null);
  assert.deepEqual(
    [0, 1, 2, 8].map(hostDraftRetryDelay),
    [2_000, 4_000, 8_000, 30_000],
  );
});
