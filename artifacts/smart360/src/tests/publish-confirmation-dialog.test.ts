import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  publicationDraftChanged,
  publicationNeedsConfirmation,
  tenantSavePayload,
} from "../lib/tenant-publication-flow";

const source = readFileSync(
  new URL("../components/admin/publish-confirmation-dialog.tsx", import.meta.url),
  "utf8",
);
const tenantEdit = readFileSync(
  new URL("../pages/admin/tenant-edit.tsx", import.meta.url),
  "utf8",
);
const slugField = readFileSync(
  new URL("../components/admin/slug-field.tsx", import.meta.url),
  "utf8",
);

test("autosave and save-before-publish share a role-aware tenant PATCH body", () => {
  const form = {
    name: "Apartma",
    slug: "apartma",
    customDomain: " guest.example.com ",
    email: " host@example.com ",
    mapUrl: " https://www.google.com/maps/place/example ",
    wifiSsid: " Guest ",
    wifiPass: "secret",
    notificationWhatsappPhone: "",
    latitude: "45.1",
    longitude: "13.2",
    guestUiMode: "living-guide",
    isTemplate: true,
    renewsAt: "2026-01-01",
    rating: 5,
    reviewsCount: 10,
    coordinateOverride: true,
  };
  const owner = tenantSavePayload(form, "3", true);
  const host = tenantSavePayload(form, "3", false);
  for (const key of [
    "slug", "customDomain", "isTemplate", "mediaQuotaBytes", "renewsAt",
    "rating", "reviewsCount", "coordinateOverride",
  ]) {
    assert.ok(Object.hasOwn(owner, key), `operator keeps ${key}`);
    assert.ok(!Object.hasOwn(host, key), `host omits ${key}`);
  }
  assert.equal(owner.mediaQuotaBytes, 3_000_000_000);
  assert.equal(owner.customDomain, "guest.example.com");
  assert.ok(!Object.hasOwn(host, "name"));
  assert.ok(!Object.hasOwn(host, "mapUrl"));
  assert.equal(host.email, "host@example.com");
  assert.deepEqual(Object.keys(host).sort(), [
    "email", "instagram", "messageNotifyEmail", "notificationChannel",
    "notificationWhatsappPhone", "orderNotifyEmail", "phone", "viber",
    "whatsapp", "wifiEnc", "wifiPass", "wifiSsid",
  ].sort());
  const hostileForm = {
    ...form,
    theme: "swipe",
    isPublished: false,
    publishNow: true,
    mapQuery: "hidden",
    heroUrl: "https://example.com/photo",
    coverTitle: "hidden",
    logoUrl: "https://example.com/logo",
    navColor: "#000000",
    tourUrl: "https://example.com/tour",
    phone: "+386123",
    wifiEnc: "WPA",
    orderNotifyEmail: true,
  };
  assert.deepEqual(Object.keys(tenantSavePayload(hostileForm, "3", false)).sort(), Object.keys(host).sort());
  assert.equal(tenantSavePayload(hostileForm, "3", false).phone, "+386123");
  for (const key of ["latitude", "longitude", "guestUiMode"]) {
    assert.ok(!Object.hasOwn(host, key));
    assert.ok(!Object.hasOwn(owner, key));
  }
  assert.match(tenantEdit, /data: tenantSavePayload\(snapshot, quotaSnapshot, isOwner\)/);
  assert.match(tenantEdit, /data: tenantSaveDataFor\(formSnapshot, quotaSnapshot\)/);
  assert.match(tenantEdit, /=> tenantSavePayload\(formSnapshot, quotaSnapshot, isOwner\)/);
});

test("publish confirmation presents exact Slovenian groups in a mobile scroll area", () => {
  assert.match(source, /Ta objava vsebuje \$\{preview\.total\} sprememb/);
  assert.match(source, /title="Novo:"/);
  assert.match(source, /title="Spremenjeno:"/);
  assert.match(source, /title="Izbrisano ali odstranjeno:"/);
  assert.match(source, /#DD9A2B/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /w-\[calc\(100%-1\.5rem\)\]/);
  assert.match(source, /\bPrekliči\b/);
  assert.match(source, /\bObjavi\b/);
});

test("tenant publish flow previews first and publishes only with the returned token", () => {
  assert.match(tenantEdit, /usePreviewTenantPublication/);
  assert.match(tenantEdit, /publishToken:\s*preview\.token/);
  assert.match(tenantEdit, /publishNow:\s*true/);
  assert.match(tenantEdit, /isPublished:\s*true/);
  assert.match(tenantEdit, /<PublishConfirmationDialog/);
  assert.doesNotMatch(tenantEdit, /publishWithoutConfirmation/);
  assert.doesNotMatch(tenantEdit, /\.\.\.tenantSaveDataFor\([^)]*\)[\s\S]{0,120}publishNow:\s*true/);
});

test("a saved rename remains a draft; live URLs and downloads keep their canonical slug", () => {
  assert.match(tenantEdit, /draftSlug \|\| tenant\.slug/);
  assert.match(tenantEdit, /publishToken:\s*preview\.token/);
  assert.match(tenantEdit, /setOriginalSlug\(data\.slug\)/);
  assert.match(slugField, /window\.location\.origin\}\/\$\{originalSlug\}/);
  assert.match(slugField, /začne veljati šele po objavi/);
  assert.match(slugField, /\/api\/admin\/tenants\/\$\{tenantId\}\/qr\.png/);
  assert.match(slugField, /\/api\/admin\/tenants\/\$\{tenantId\}\/label\.pdf/);
});

test("only an authoritative clean preview may keep the green no-dialog behavior", () => {
  assert.equal(publicationNeedsConfirmation({
    cachedDirty: false,
    localDirty: false,
    previewTotal: 0,
    allowCleanAutoPublish: true,
  }), false);
  assert.equal(publicationNeedsConfirmation({
    cachedDirty: false,
    localDirty: false,
    previewTotal: 1,
    allowCleanAutoPublish: true,
  }), true, "a stale clean cache cannot bypass confirmation");
  assert.equal(publicationNeedsConfirmation({
    cachedDirty: false,
    localDirty: true,
    previewTotal: 0,
    allowCleanAutoPublish: true,
  }), true, "a local edit cannot bypass confirmation");
  assert.equal(publicationNeedsConfirmation({
    cachedDirty: false,
    localDirty: false,
    previewTotal: 0,
    allowCleanAutoPublish: false,
  }), true, "a stale-token refresh always requires reconfirmation");
});

test("autosave completion prevents duplicate saves without hiding newer local edits", () => {
  const clicked = { name: "Po kliku" };
  assert.equal(
    publicationDraftChanged(clicked, clicked, "2", "2"),
    false,
    "an in-flight autosave that saved the click snapshot must not be repeated",
  );
  assert.equal(
    publicationDraftChanged(clicked, { name: "Starejši autosave" }, "2", "2"),
    true,
    "a click snapshot newer than the completed autosave still must be saved",
  );
  assert.equal(
    publicationDraftChanged(clicked, clicked, "3", "2"),
    true,
    "media quota edits participate in the publication save barrier",
  );
});