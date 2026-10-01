import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { tenantPermissions } from "../lib/tenant-permissions";
import { savedTenantDraft, tenantSavePayload } from "../lib/tenant-publication-flow";

const host = (managementMode?: "self_service" | "concierge", tenantId = "a") =>
  tenantPermissions({ operator: false, hostTenantId: "a", tenantId, managementMode });

test("concierge and unresolved modes retain restricted permissions; self-service gains content and reviewed publication", () => {
  for (const mode of [undefined, "concierge"] as const) {
    const permissions = host(mode);
    assert.equal(permissions.canManageContent, false);
    assert.equal(permissions.canEditIdentity, false);
    assert.equal(permissions.canEditAppearance, false);
    assert.equal(permissions.canPublish, false);
  }
  const permissions = host("self_service");
  assert.equal(permissions.canManageContent, true);
  assert.equal(permissions.canEditIdentity, true);
  assert.equal(permissions.canEditAppearance, true);
  assert.equal(permissions.canPublish, true);
  for (const mode of ["self_service", "concierge"] as const) {
    assert.equal(host(mode).canUseCreator, false);
    assert.equal(host(mode).canPurge, false);
    assert.equal(host(mode).isOperator, false);
  }
});

test("host permissions are scoped to own tenant and recomputed in both mode-switch directions", () => {
  for (const mode of ["self_service", "concierge"] as const) {
    assert.equal(host(mode, "b").canPublish, false);
    assert.equal(host(mode, "b").canManageContent, false);
  }
  for (const mode of ["concierge", "self_service", "concierge", "self_service"] as const) {
    assert.equal(host(mode).canPublish, mode === "self_service");
  }
  assert.equal(tenantPermissions({ operator: false, tenantId: "a", managementMode: "self_service" }).canPublish, false);
  const operator = tenantPermissions({ operator: true, tenantId: "a", managementMode: "concierge" });
  assert.ok(Object.values(operator).every(Boolean));
});

const draft = {
  slug: "protected-pending-rename", draftSlug: "protected-pending-rename",
  customDomain: " guest.example.com ", email: " host@example.com ",
  mapUrl: " https://maps.google.com/ ", wifiSsid: " Guest ", wifiPass: "secret",
  notificationWhatsappPhone: "", name: "My guide", subtitle: "Welcome",
  theme: "mediterran", heroUrl: "/hero.jpg", logoUrl: "/logo.jpg",
  mapQuery: "Izola", tourRecordingEnabled: true, coverTitle: "Welcome",
  latitude: 45.5, longitude: 13.6, guestUiMode: "living-guide",
  isPublished: false, publishNow: true, publishToken: "not-an-autosave",
  mediaQuotaBytes: 100, renewsAt: "2099-01-01", isTemplate: true,
  rating: 5, reviewsCount: 100, managementMode: "self_service", coordinateOverride: true,
};

test("self-service autosave carries approved identity/appearance fields, never operator fields or publication commands", () => {
  const original = structuredClone(draft);
  const data = tenantSavePayload(draft, "2", false, true) as Record<string, unknown>;
  for (const field of ["name", "subtitle", "theme", "heroUrl", "logoUrl", "mapQuery", "tourRecordingEnabled", "coverTitle"]) {
    assert.equal(data[field], draft[field as keyof typeof draft]);
  }
  assert.equal(data.customDomain, "guest.example.com");
  assert.equal(data.email, "host@example.com");
  for (const field of [
    "slug", "draftSlug", "isPublished", "publishNow", "publishToken", "mediaQuotaBytes",
    "renewsAt", "isTemplate", "rating", "reviewsCount", "managementMode",
    "coordinateOverride", "latitude", "longitude",
  ]) assert.equal(field in data, false, field);
  assert.deepEqual(draft, original, "permission changes must not mutate unsaved drafts");
});

test("concierge autosave stays on the exact legacy contact/Wi-Fi/notification allowlist", () => {
  const data = tenantSavePayload(draft, "2", false);
  assert.deepEqual(Object.keys(data).sort(), [
    "wifiSsid", "wifiPass", "wifiEnc", "phone", "email", "whatsapp", "viber", "instagram",
    "notificationChannel", "notificationWhatsappPhone", "orderNotifyEmail", "messageNotifyEmail",
  ].sort());
  assert.equal(data.wifiSsid, "Guest");
});

test("a downgrade contact save preserves unsaved appearance fields for a later upgrade", () => {
  const previous = { ...draft, coverTitle: "Saved cover", email: "old@example.com" };
  const conciergeSave = tenantSavePayload(draft, "2", false, false);
  const baseline = savedTenantDraft(previous, draft, conciergeSave);
  assert.equal(baseline.email, draft.email);
  assert.equal(baseline.coverTitle, previous.coverTitle);
  const upgradedSave = tenantSavePayload(draft, "2", false, true);
  assert.equal(savedTenantDraft(baseline, draft, upgradedSave).coverTitle, draft.coverTitle);
});

test("capabilities refresh on focus and finite polling, while the form initializes only per tenant", () => {
  const hook = readFileSync(new URL("../hooks/use-tenant-permissions.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../pages/admin/tenant-edit.tsx", import.meta.url), "utf8");
  assert.match(hook, /refetchInterval: 15_000/);
  assert.match(hook, /refetchOnWindowFocus: "always"/);
  assert.match(page, /tenant && initRef\.current !== tenant\.id/);
  assert.match(page, /permissions\.canPublish && <Button/);
  assert.match(page, /<PublishConfirmationDialog/);
  assert.match(page, /<TenantChangelogCard/);
  assert.match(page, /permissions\.canUseCreator && <TabsContent value="kreator"/);
  const content = readFileSync(new URL("../components/admin/content-editor.tsx", import.meta.url), "utf8");
  assert.match(content, /const \[placeCreation\] = useState/);
  assert.match(content, /<ContentDraftAccess allowed=\{canCreateSection\}>/);
  assert.match(content, /<fieldset disabled=\{!allowed\}/);
});