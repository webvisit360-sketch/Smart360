import assert from "node:assert/strict";
import test from "node:test";
import {
  hasMeaningfulRichText,
  normalizeCanonicalSaveBaseline,
  reconcileCreatedCanonicalRows,
} from "../pages/host/onboarding";
import type { HostOnboardingData } from "../hooks/use-host-onboarding";
import type { HostOnboardingCanonicalItem } from "@workspace/api-client-react";

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