import test from "node:test";
import assert from "node:assert/strict";
import { tenantSavePayload } from "../lib/tenant-publication-flow";

const form = {
  slug: "test", customDomain: "", email: "", mapUrl: "", wifiSsid: "", wifiPass: "",
  notificationWhatsappPhone: "", address: "Test street 24", mapQuery: "Separate map query",
};
test("self-service and operator saves carry the canonical address without rewriting map query", () => {
  for (const owner of [false, true]) {
    const payload = tenantSavePayload(form, "2", owner, true) as Record<string, unknown>;
    assert.equal(payload.address, form.address);
    assert.equal(payload.mapQuery, form.mapQuery);
  }
});
test("concierge contact-only saves cannot change the canonical address", () => {
  const payload = tenantSavePayload(form, "2", false, false);
  assert.equal("address" in payload, false);
});
test("clearing the canonical address is not silently omitted from the save", () => {
  const payload = tenantSavePayload({ ...form, address: "" }, "2", false, true) as Record<string, unknown>;
  assert.equal(payload.address, "");
});

test("landing text mode saves for self-service, never for concierge contact-only saves", () => {
  for (const landingTextMode of ["auto", "light", "dark"]) {
    const snapshot = { ...form, landingTextMode };
    const payload = tenantSavePayload(snapshot, "2", false, true) as Record<string, unknown>;
    assert.equal(payload.landingTextMode, landingTextMode);
    assert.equal("landingTextMode" in tenantSavePayload(snapshot, "2", false, false), false);
  }
});
