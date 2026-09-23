import assert from "node:assert/strict";
import test from "node:test";
import {
  hasMeaningfulRichText,
  normalizeCanonicalSaveBaseline,
  reconcileCreatedCanonicalRows,
  shouldAppendStayEntry,
} from "../pages/host/onboarding";
import {
  changedHostOnboardingFields,
  hostOnboardingSnapshot,
  omitLegacyRichAliasForCanonicalItems,
  preserveCanonicalMediaForWrite,
  type HostOnboardingData,
} from "../hooks/use-host-onboarding";
import {
  acknowledgeHostDraftWrite,
  rebaseHostOnboardingDraft,
} from "../lib/host-onboarding-draft-rebase";
import type { HostOnboardingCanonicalItem } from "@workspace/api-client-react";
import {
  blockingMediaQueueCount,
  continueMediaUploadChain,
} from "../components/admin/item-media-editor";

const data = (patch: Partial<HostOnboardingData> = {}): HostOnboardingData => ({
  contacts: [],
  offers: [],
  recommendations: [],
  customCategories: [],
  events: [],
  canonicalItems: [],
  ...patch,
});

const destination = (
  id: string,
  body: string,
): HostOnboardingCanonicalItem => ({
  id,
  categoryId: "empty-destination",
  categoryKey: "custom-empty",
  sectionKey: "stay",
  title: "",
  body,
  price: "",
  priceUnit: "",
  phone: "",
  website: "",
  mapQuery: "",
  difficulty: "",
  duration: "",
  distance: "",
  noteType: "",
  noteText: "",
  bullets: [],
  tint: "",
  frame: "",
  isVisible: true,
  orderEnabled: false,
  soldOut: false,
  producerName: "",
  producerNote: "",
});

test("empty rich-text initialization cannot enter a canonical save", () => {
  assert.equal(hasMeaningfulRichText(""), false);
  assert.equal(hasMeaningfulRichText("<p></p>"), false);
  assert.equal(hasMeaningfulRichText("<p><br></p>"), false);
  assert.equal(hasMeaningfulRichText("<p>&nbsp;</p>"), false);
  assert.equal(hasMeaningfulRichText("<p>Navodilo</p>"), true);
  assert.deepEqual(
    normalizeCanonicalSaveBaseline(data({
      canonicalItems: [destination("new-client", "<p><br></p>")],
    })).canonicalItems,
    [],
  );
});

test("stay-category adder focuses a blank trailing row and appends after content", () => {
  assert.equal(shouldAppendStayEntry({ title: "  ", body: "<p><br></p>" }), false);
  assert.equal(shouldAppendStayEntry({ title: "Apartma 2", body: "" }), true);
  assert.equal(shouldAppendStayEntry({ title: "", body: "<p>Pogled na morje</p>" }), true);
});

test("an in-flight item upload keeps onboarding submission blocked", () => {
  assert.equal(blockingMediaQueueCount([{ status: "uploading" }]), 1);
  assert.equal(blockingMediaQueueCount([
    { status: "pending" },
    { status: "uploading" },
    { status: "error" },
  ]), 3);
  assert.equal(blockingMediaQueueCount([]), 0);
});

test("a rejected media serialization cannot poison the next upload retry", async () => {
  let attempts = 0;
  const failed = continueMediaUploadChain(Promise.resolve(), async () => {
    attempts += 1;
    throw new Error("CAS flush failed");
  });
  const retried = continueMediaUploadChain(failed, async () => {
    attempts += 1;
    return true;
  });
  await retried;
  assert.equal(attempts, 2);
});

test("a title-only stay entry enters the canonical save", () => {
  assert.deepEqual(
    normalizeCanonicalSaveBaseline(data({
      canonicalItems: [{ ...destination("new-title-only", ""), title: "Apartma 2" }],
    })).canonicalItems?.map((item) => item.title),
    ["Apartma 2"],
  );
});

test("new destination ID is reconciled once and sequential saves update that DB row", () => {
  const submitted = destination("new-client", "<p>Prvi vnos</p>");
  const created = {
    ...destination("00000000-0000-4000-8000-000000000001", "<p>Prvi vnos</p>"),
    title: "Navodila po meri",
  };
  const first = reconcileCreatedCanonicalRows({
    local: data({ canonicalItems: [submitted] }),
    canonical: data({ canonicalItems: [created] }),
    baseline: data(),
    submitted: { canonicalItems: [submitted] },
  });
  assert.equal(first.canonicalItems?.[0]?.id, created.id);
  assert.equal(first.canonicalItems?.[0]?.title, "Navodila po meri");

  const edited = { ...first.canonicalItems![0]!, body: "<p>Drugi vnos</p>" };
  const second = reconcileCreatedCanonicalRows({
    local: data({ canonicalItems: [edited] }),
    canonical: data({ canonicalItems: [edited] }),
    baseline: data({ canonicalItems: [created] }),
    submitted: { canonicalItems: [edited] },
  });
  assert.deepEqual(second.canonicalItems, [edited]);
});

test("two equal stay entries reconcile to two distinct durable IDs", () => {
  const first = { ...destination("new-first", "<p>Enak opis</p>"), title: "Apartma" };
  const second = { ...destination("new-second", "<p>Enak opis</p>"), title: "Apartma" };
  const canonicalFirst = { ...first, id: "00000000-0000-4000-8000-000000000011" };
  const canonicalSecond = { ...second, id: "00000000-0000-4000-8000-000000000012" };
  const reconciled = reconcileCreatedCanonicalRows({
    local: data({ canonicalItems: [first, second] }),
    canonical: data({ canonicalItems: [canonicalFirst, canonicalSecond] }),
    baseline: data(),
    submitted: { canonicalItems: [first, second] },
  });
  assert.deepEqual(
    reconciled.canonicalItems?.map((item) => item.id),
    [canonicalFirst.id, canonicalSecond.id],
  );
});

test("rapid destination and offer edits during an in-flight create keep text and adopt server IDs", () => {
  const submittedDestination = destination("new-client", "<p>A</p>");
  const currentDestination = { ...submittedDestination, body: "<p>AB</p>" };
  const createdDestination = {
    ...destination("00000000-0000-4000-8000-000000000002", "<p>A</p>"),
    title: "Navodila po meri",
  };
  const submittedOffer = {
    id: "offer-client",
    categoryId: "offer-category",
    name: "Zajtrk",
    price: "10",
  };
  const currentOffer = { ...submittedOffer, price: "10 EUR" };
  const createdOffer = {
    ...submittedOffer,
    id: "00000000-0000-4000-8000-000000000003",
  };

  const reconciled = reconcileCreatedCanonicalRows({
    local: data({
      canonicalItems: [currentDestination],
      offers: [currentOffer],
    }),
    canonical: data({
      canonicalItems: [createdDestination],
      offers: [createdOffer],
    }),
    baseline: data(),
    submitted: {
      canonicalItems: [submittedDestination],
      offers: [submittedOffer],
    },
  });

  assert.deepEqual(reconciled.canonicalItems, [{
    ...currentDestination,
    id: createdDestination.id,
    title: "Navodila po meri",
  }]);
  assert.deepEqual(reconciled.offers, [{
    ...currentOffer,
    id: createdOffer.id,
  }]);
});

test("uncommitted offer inputs are absent from the canonical baseline", () => {
  const local = data();
  const normalized = normalizeCanonicalSaveBaseline(local);
  assert.deepEqual(normalized.offers, []);
});

test("lost-response ACK settles a full canonical draft despite response key insertion order", () => {
  const item = destination("house-1", "<p>Mir po 22. uri.</p>");
  const media = {
    id: "media-1",
    itemId: item.id,
    kind: "image" as const,
    url: "/house.jpg",
    alt: "Hiša",
    position: 0,
    posterUrl: null,
    durationSec: null,
    width: 1600,
    height: 900,
    focusX: 0.5,
    focusY: 0.5,
  };
  const ordinaryBaseline: HostOnboardingData = {
    accommodationName: "Planinska hiša",
    address: "Gorska pot 1",
    guestPhone: "+386 40 000 000",
    guestEmail: "gost@example.test",
    website: "https://example.test",
    checkInFrom: "15:00",
    checkOutUntil: "10:00",
    contacts: [
      { id: "contact-1", name: "Ana", phone: "+386 40 111 111" },
      { id: "contact-2", name: "Boris", phone: "+386 40 222 222" },
    ],
    wifiName: "Gost",
    wifiPassword: "ordinary-fixture",
    houseRulesParking: item.body,
    offers: [
      { id: "offer-1", categoryId: "food", name: "Zajtrk", price: "12 €" },
      { id: "offer-2", categoryId: "food", name: "Večerja", price: "24 €" },
    ],
    recommendations: [{ id: "rec-1", categoryId: "walks", name: "Pot ob jezeru" }],
    customCategories: [{
      id: "custom-1",
      name: "Posebnosti",
      entries: [{ id: "entry-1", name: "Razgledna točka" }],
    }],
    events: [
      { id: "event-1", name: "Sejem", date: "2026-10-01", time: "10:00" },
      { id: "event-2", name: "Koncert", date: "2026-10-02", time: "20:00" },
    ],
    media: [media],
    deleteContactIds: [],
    deleteOfferIds: [],
    deleteEventIds: [],
    deleteMediaIds: [],
    canonicalItems: [item],
    hero: { url: "/hero.jpg", alt: "Pogled", mediaId: "media-1" },
  };
  const clean = (value: HostOnboardingData) => preserveCanonicalMediaForWrite(
    omitLegacyRichAliasForCanonicalItems(normalizeCanonicalSaveBaseline(value)),
    ordinaryBaseline.media || [],
    false,
  );

  const local = {
    ...ordinaryBaseline,
    accommodationName: "Planinska hiša pod vrhom",
  };
  const sent = clean(local);

  // The first PATCH committed but its response was lost. GET after the ensuing
  // 409 returns the same semantic JSON with database/serializer key order.
  const acceptedWithServerOrder: HostOnboardingData = {
    hero: { mediaId: "media-1", alt: "Pogled", url: "/hero.jpg" },
    canonicalItems: [{
      producerNote: item.producerNote,
      producerName: item.producerName,
      soldOut: item.soldOut,
      orderEnabled: item.orderEnabled,
      isVisible: item.isVisible,
      frame: item.frame,
      tint: item.tint,
      bullets: item.bullets,
      noteText: item.noteText,
      noteType: item.noteType,
      distance: item.distance,
      duration: item.duration,
      difficulty: item.difficulty,
      mapQuery: item.mapQuery,
      website: item.website,
      phone: item.phone,
      priceUnit: item.priceUnit,
      price: item.price,
      body: item.body,
      title: item.title,
      sectionKey: item.sectionKey,
      categoryKey: item.categoryKey,
      categoryId: item.categoryId,
      id: item.id,
    }],
    deleteMediaIds: [],
    deleteEventIds: [],
    deleteOfferIds: [],
    deleteContactIds: [],
    media: [{ ...media }],
    events: [
      { time: "20:00", date: "2026-10-02", name: "Koncert", id: "event-2" },
      { time: "10:00", date: "2026-10-01", name: "Sejem", id: "event-1" },
    ],
    customCategories: [{
      entries: [{ name: "Razgledna točka", id: "entry-1" }],
      name: "Posebnosti",
      id: "custom-1",
    }],
    recommendations: [{ name: "Pot ob jezeru", categoryId: "walks", id: "rec-1" }],
    offers: [
      { price: "24 €", name: "Večerja", categoryId: "food", id: "offer-2" },
      { price: "12 €", name: "Zajtrk", categoryId: "food", id: "offer-1" },
    ],
    houseRulesParking: item.body,
    wifiPassword: "ordinary-fixture",
    wifiName: "Gost",
    contacts: [
      { phone: "+386 40 222 222", name: "Boris", id: "contact-2" },
      { phone: "+386 40 111 111", name: "Ana", id: "contact-1" },
    ],
    checkOutUntil: "10:00",
    checkInFrom: "15:00",
    website: "https://example.test",
    guestEmail: "gost@example.test",
    guestPhone: "+386 40 000 000",
    address: "Gorska pot 1",
    accommodationName: "Planinska hiša pod vrhom",
  };

  const rebased = rebaseHostOnboardingDraft(ordinaryBaseline, local, acceptedWithServerOrder);
  assert.deepEqual(rebased.conflicts, []);
  assert.deepEqual(
    changedHostOnboardingFields(clean(rebased.data), acceptedWithServerOrder),
    {},
    "GET already contains the lost PATCH and must not trigger another write",
  );

  const acknowledged = acknowledgeHostDraftWrite(sent, rebased.data, acceptedWithServerOrder);
  assert.deepEqual(
    changedHostOnboardingFields(clean(acknowledged), acceptedWithServerOrder),
    {},
    "a successful ACK must leave the realistic form lifecycle idle",
  );
  assert.notEqual(
    JSON.stringify(clean(acknowledged)),
    JSON.stringify(clean(acceptedWithServerOrder)),
    "the fixture must retain the observed insertion-order-only mismatch",
  );
  assert.equal(
    hostOnboardingSnapshot(clean(acknowledged)),
    hostOnboardingSnapshot(clean(acceptedWithServerOrder)),
    "the saved-state baseline must be semantic, not dependent on JSON object insertion order",
  );
});
