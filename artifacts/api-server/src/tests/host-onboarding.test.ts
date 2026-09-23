import assert from "node:assert/strict";
import test from "node:test";
import {
  AutosaveHostOnboardingBody,
  ConfirmHostOnboardingSubmissionBody,
} from "@workspace/api-zod";
import { ADMIN_ROUTE_REGISTRY } from "../lib/actorGate";
import {
  _setHostOnboardingDeliveryOverride,
  buildHostOnboardingEmail,
  HOST_ONBOARDING_OPERATOR_EMAIL,
  sendHostOnboardingEmail,
} from "../lib/hostOnboardingEmail";
import {
  hostOnboardingObjectCounterpart,
  hostOnboardingRawObjectPath,
  hostOnboardingSanitizedObjectPath,
} from "../lib/hostOnboardingPhotoPaths";
import {
  hostCustomCategoriesAreSubmittable,
  settleRecommendationProcessingFailure,
} from "../lib/hostOnboarding";
import { HOST_ROLE_GRANTS, POLICIES } from "../lib/rls";

const completeData = {
  accommodationName: "Hiša Sonce",
  address: "Glavni trg 1",
  guestPhone: "+386 40 000 000",
  guestEmail: "gost@example.test",
  website: "",
  checkInFrom: "15:00",
  checkOutUntil: "10:00",
  contacts: [{ id: "contact-1", name: "Ana", phone: "+386 40 000 001" }],
  wifiName: "Sonce",
  wifiPassword: "geslo",
  houseRulesParking: "Parkiranje je ob hiši. Po 22. uri prosimo za mir.",
  offers: [{ id: "offer-1", name: "Zajtrk", price: "12 EUR" }],
  recommendations: [{ id: "rec-1", categoryId: "shops", name: "Lokalna trgovina" }],
  customCategories: [{
    id: "custom-1",
    name: "Za deževne dni",
    entries: [
      { id: "custom-entry-1", name: "Muzej igrač" },
      { id: "custom-entry-2", name: "Notranje plezanje" },
    ],
  }],
  events: [{ id: "event-1", name: "Koncert", date: "2026-08-11", time: "19:30" }],
};

test("onboarding contracts accept partial autosave and exact event date/time", () => {
  assert.equal(
    AutosaveHostOnboardingBody.safeParse({
      revision: 4,
      canonicalRevision: "a".repeat(64),
      data: { guestPhone: "+386 40 111 111" },
    }).success,
    true,
  );
  const submission = ConfirmHostOnboardingSubmissionBody.parse({
    round: 1,
    revision: 5,
    data: completeData,
  });
  assert.ok(submission.data);
  assert.deepEqual(submission.data.events[0], {
    id: "event-1",
    name: "Koncert",
    date: "2026-08-11",
    time: "19:30",
  });
  assert.equal(submission.data.recommendations[0]?.categoryId, "shops");
  assert.deepEqual(submission.data.customCategories[0]?.entries.map(({ name }) => name), [
    "Muzej igrač",
    "Notranje plezanje",
  ]);
});

test("submit contract accepts round-only immutable replay payload", () => {
  const replay = ConfirmHostOnboardingSubmissionBody.parse({ round: 1 });
  assert.deepEqual(replay, { round: 1 });
});

test("incomplete custom category autosave shape remains valid but submission is blocked clearly", () => {
  const incomplete = {
    ...completeData,
    customCategories: [{
      id: "custom-incomplete",
      name: "",
      entries: [{ id: "entry-kept", name: "Vnos ne sme izginiti" }],
    }],
  };
  assert.equal(
    AutosaveHostOnboardingBody.safeParse({
      revision: 2,
      canonicalRevision: "b".repeat(64),
      data: { customCategories: incomplete.customCategories },
    }).success,
    true,
  );
  assert.equal(hostCustomCategoriesAreSubmittable(incomplete), false);
});

test("operator notification uses only direct Smart360 recipient and idempotency key", async () => {
  let captured:
    | {
        body: { to: string[]; subject: string; text: string };
        idempotencyKey: string;
      }
    | undefined;
  _setHostOnboardingDeliveryOverride(async (body, idempotencyKey) => {
    captured = { body, idempotencyKey };
    return { ok: true, providerMessageId: "test-message" };
  });
  try {
    const result = await sendHostOnboardingEmail(
      "Hiša Sonce",
      "00000000-0000-4000-8000-000000000001",
      2,
      "00000000-0000-4000-8000-000000000002",
    );
    assert.deepEqual(result, { ok: true, providerMessageId: "test-message" });
    assert.deepEqual(captured?.body.to, [HOST_ONBOARDING_OPERATOR_EMAIL]);
    assert.match(captured?.body.subject ?? "", /Hiša Sonce/);
    assert.equal(
      captured?.idempotencyKey,
      "host-onboarding-00000000-0000-4000-8000-000000000002",
    );
  } finally {
    _setHostOnboardingDeliveryOverride(null);
  }
});

test("operator notification uses the official renderer and escapes supplied values", () => {
  const email = buildHostOnboardingEmail(
    `Hiša <script>alert("x")</script>`,
    "00000000-0000-4000-8000-000000000001",
    3,
  );
  assert.match(email.html, /^<!DOCTYPE html>/);
  assert.match(email.html, /Agencija Sinhron d\.o\.o\./);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.text, /Nastanitev ID: 00000000-0000-4000-8000-000000000001/);
  assert.doesNotMatch(email.text, /Tenant ID/);
});

test("actor gate classifies all onboarding routes without tenant identity from body", () => {
  const onboarding = ADMIN_ROUTE_REGISTRY.filter((route) =>
    route.path.includes("/host/onboarding"),
  );
  const hostRoutes = onboarding.filter((route) =>
    route.path.startsWith("/admin/host/onboarding"),
  );
  const ownerRoutes = onboarding.filter((route) =>
    route.path.startsWith("/admin/tenants/"),
  );
  assert.equal(hostRoutes.length, 10);
  assert.ok(hostRoutes.every((route) => route.binding.kind === "host-self"));
  const categoryCreate = hostRoutes.find((route) =>
    route.method === "post" && route.path === "/admin/host/onboarding/categories"
  );
  assert.equal(categoryCreate?.binding.kind, "host-self");
  assert.equal(ownerRoutes.length, 4);
  assert.ok(ownerRoutes.every((route) => route.binding.kind === "owner-only"));
});

test("signed raw upload key can never be the immutable sanitized key", () => {
  const tenantId = "00000000-0000-4000-8000-000000000001";
  const roundId = "00000000-0000-4000-8000-000000000002";
  const photoId = "00000000-0000-4000-8000-000000000003";
  const signedRawPath = hostOnboardingRawObjectPath(tenantId, roundId, photoId);
  const finalPath = hostOnboardingSanitizedObjectPath(tenantId, roundId, photoId);
  assert.notEqual(signedRawPath, finalPath);
  assert.match(signedRawPath, /\.raw$/);
  assert.match(finalPath, /\.sanitized\.jpg$/);
  assert.equal(hostOnboardingObjectCounterpart(finalPath), signedRawPath);
  assert.equal(hostOnboardingObjectCounterpart(signedRawPath), finalPath);
});

test("startup restores grants and tenant RLS for every onboarding table", () => {
  for (const table of [
    "host_onboarding_rounds",
    "host_onboarding_photos",
    "host_onboarding_event_suggestions",
  ]) {
    assert.equal(HOST_ROLE_GRANTS[table], "SELECT, INSERT, UPDATE, DELETE");
    assert.match(POLICIES[table]?.using ?? "", /tenant_id/);
    assert.match(POLICIES[table]?.using ?? "", /app\.tenant_id/);
  }
});

test("a failed recommendation-status write cannot poison an already committed save response", async () => {
  const processing = {
    status: "failed" as const,
    revision: 9,
    errorCode: "42501",
  };
  const settled = await settleRecommendationProcessingFailure(
    processing,
    async () => {
      throw Object.assign(new Error("status persistence unavailable"), { code: "08006" });
    },
  );
  assert.deepEqual(settled, {
    ...processing,
    statusPersistence: "failed",
    persistenceErrorCode: "08006",
  });
});