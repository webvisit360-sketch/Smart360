import assert from "node:assert/strict";
import test from "node:test";
import { UpdateTenantBody } from "@workspace/api-zod";
import {
  normalizeTenantMapUrl,
  TenantLocationError,
  validateTenantCoordinatePair,
} from "../lib/tenant-location";

const frontendModuleUrl = new URL(
  "../../../smart360/src/lib/tenant-maps.ts",
  import.meta.url,
).href;

async function loadFrontendResolver(): Promise<{
  resolveTenantMapsUrl: (
    tenant: Record<string, unknown>,
    intent?: "search" | "directions",
  ) => string | null;
}> {
  return import(frontendModuleUrl);
}

test("tenant Maps resolver obeys explicit URL, coordinates, then legacy address fallback", async () => {
  const { resolveTenantMapsUrl } = await loadFrontendResolver();
  const explicit = "https://www.google.com/maps/place/Exact+Door";

  assert.equal(
    resolveTenantMapsUrl({
      mapUrl: explicit,
      latitude: 45.5,
      longitude: 13.6,
      address: "Wrong neighbour",
    }),
    explicit,
  );
  assert.equal(
    resolveTenantMapsUrl(
      {
        latitude: 45.5126898,
        longitude: 13.6339282,
        address: "Wrong neighbour",
      },
      "directions",
    ),
    "https://www.google.com/maps/dir/?api=1&destination=45.5126898%2C13.6339282",
  );
  assert.equal(
    resolveTenantMapsUrl({ mapQuery: "Legacy precise query", address: "Street" }),
    "https://www.google.com/maps/search/?api=1&query=Legacy%20precise%20query",
  );
  assert.equal(
    resolveTenantMapsUrl({ address: "Malija 143b" }),
    "https://www.google.com/maps/search/?api=1&query=Malija%20143b",
  );
});

test("configured invalid links or incomplete coordinates never fall back to address", async () => {
  const { resolveTenantMapsUrl } = await loadFrontendResolver();

  assert.equal(
    resolveTenantMapsUrl({ mapUrl: "javascript:alert(1)", address: "Street" }),
    null,
  );
  assert.equal(
    resolveTenantMapsUrl({ latitude: 45.5, address: "Street" }),
    null,
  );
  assert.equal(
    resolveTenantMapsUrl({ latitude: 95, longitude: 13.6, address: "Street" }),
    null,
  );
});

/* openExternalMapsUrl (window.open) je odstranjen: na iOS je puščal prazen
   zavihek, ko je URL prestregla aplikacija Zemljevidi. Zunanje povezave so
   zdaj navadni <a> brez target="_blank". */

test("tenant location validation enforces HTTPS and complete coordinate pairs", () => {
  assert.equal(
    normalizeTenantMapUrl(" https://maps.app.goo.gl/example "),
    "https://maps.app.goo.gl/example",
  );
  assert.throws(
    () => normalizeTenantMapUrl("http://example.com"),
    TenantLocationError,
  );
  assert.equal(validateTenantCoordinatePair(null, null), null);
  assert.equal(validateTenantCoordinatePair(45.5, 13.6), null);
  assert.match(validateTenantCoordinatePair(45.5, null) ?? "", /skupaj/);
  assert.match(validateTenantCoordinatePair(91, 13.6) ?? "", /Latitude/);
});

test("generated tenant update contract accepts nullable in-range location fields", () => {
  const value = UpdateTenantBody.parse({
    mapUrl: "https://www.google.com/maps/place/example",
    latitude: 45.5126898,
    longitude: 13.6339282,
  });
  assert.equal(value.latitude, 45.5126898);
  assert.equal(value.longitude, 13.6339282);
  assert.throws(() => UpdateTenantBody.parse({ latitude: 91 }));
});