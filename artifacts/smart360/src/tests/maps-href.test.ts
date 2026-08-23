import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { itemMapsHref, mapsHrefForQuery, sanitizePastedMapsUrl } from "../lib/maps-href";

// REGRESSION GUARD (third occurrence protection): a POI "Google Maps" action
// must open the PLACE, never turn-by-turn navigation from the guest's current
// position. This broke twice: once in the legacy theme, once in Living Guide
// (detail templates passed the "directions" intent for item POIs).

test("itemMapsHref prefers the host's pasted Maps link untouched", () => {
  const link = "https://maps.app.goo.gl/AbC123";
  assert.equal(itemMapsHref({ mapQuery: link, latitude: 45.5, longitude: 13.6 }), link);
});

test("itemMapsHref uses approved coordinates as a place search", () => {
  assert.equal(
    itemMapsHref({ mapQuery: "Pot zdravja, Strunjan", latitude: 45.528, longitude: 13.605 }),
    "https://www.google.com/maps/search/?api=1&query=45.528,13.605",
  );
  // Coordinates alone (no text query) still resolve.
  assert.equal(
    itemMapsHref({ latitude: 45.5, longitude: 13.6 }),
    "https://www.google.com/maps/search/?api=1&query=45.5,13.6",
  );
});

test("itemMapsHref falls back to a text SEARCH when no link or coordinates exist", () => {
  assert.equal(
    itemMapsHref({ mapQuery: "Restavracija Kamin, Izola" }),
    "https://www.google.com/maps/search/?api=1&query=Restavracija%20Kamin%2C%20Izola",
  );
  assert.equal(itemMapsHref({ mapQuery: "  " }), null);
  assert.equal(itemMapsHref(null), null);
});

test("a pasted directions link is rejected and falls back to coordinates", () => {
  const dirLink = "https://www.google.com/maps/dir/Celje/Izola";
  const apiDir = "https://www.google.com/maps/dir/?api=1&destination=Izola";
  const travel = "https://www.google.com/maps/place/x?travelmode=driving";
  assert.equal(sanitizePastedMapsUrl(dirLink), null);
  assert.equal(sanitizePastedMapsUrl(apiDir), null);
  assert.equal(sanitizePastedMapsUrl(travel), null);
  assert.equal(
    itemMapsHref({ mapQuery: dirLink, latitude: 45.53, longitude: 13.66 }),
    "https://www.google.com/maps/search/?api=1&query=45.53,13.66",
  );
  // No coordinates either: hide the action instead of risking navigation
  // or searching for a raw URL string.
  assert.equal(itemMapsHref({ mapQuery: dirLink }), null);
});

test("HTTP and malformed pasted links fall back instead of dead-ending", () => {
  assert.equal(
    itemMapsHref({ mapQuery: "http://maps.google.com/x", latitude: 45.5, longitude: 13.6 }),
    "https://www.google.com/maps/search/?api=1&query=45.5,13.6",
  );
  assert.equal(
    itemMapsHref({ mapQuery: "https://bad url with spaces", latitude: 45.5, longitude: 13.6 }),
    "https://www.google.com/maps/search/?api=1&query=45.5,13.6",
  );
  assert.equal(itemMapsHref({ mapQuery: "http://maps.google.com/x" }), null);
});

test("itemMapsHref can never produce a directions/navigation URL", () => {
  const samples = [
    itemMapsHref({ mapQuery: "Izola" }),
    itemMapsHref({ mapQuery: "Izola", latitude: 45.53, longitude: 13.66 }),
    itemMapsHref({ latitude: 45.53, longitude: 13.66 }),
    itemMapsHref({ mapQuery: "https://www.google.com/maps/place/x" }),
  ];
  for (const href of samples) {
    assert.ok(href, "href must exist for every populated sample");
    assert.ok(!href!.includes("/maps/dir"), `navigation URL leaked: ${href}`);
    assert.ok(!href!.includes("origin="), `origin leaked: ${href}`);
    assert.ok(!href!.includes("destination="), `destination leaked: ${href}`);
  }
});

test("mapsHrefForQuery default intent remains a search", () => {
  assert.equal(
    mapsHrefForQuery("Izola"),
    "https://www.google.com/maps/search/?api=1&query=Izola",
  );
});

// Source-level guard: no Living Guide guest file may request the "directions"
// intent or hand-build a /maps/dir/ URL. Item POIs must go through
// itemMapsHref; the tenant-level property navigation lives outside these files.
test("Living Guide guest sources contain no directions intent", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, "..", "pages", "living-guide");
  const offenders: string[] = [];
  for (const file of readdirSync(dir)) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const source = readFileSync(join(dir, file), "utf8");
    if (source.includes('"directions"') || source.includes("/maps/dir")) {
      offenders.push(file);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `POI Maps actions must open the place, not navigation. Use itemMapsHref. Offending files: ${offenders.join(", ")}`,
  );
});

// Source-level guard over EVERY guest-facing surface (legacy themes included):
// the only permitted "directions" intents are tenant-level — navigating to the
// property itself. An item-level POI may never request directions.
test("no guest surface builds item-level directions", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const roots = ["living-guide", "guest"];
  const offenders: string[] = [];
  for (const root of roots) {
    const dir = join(here, "..", "pages", root);
    for (const file of readdirSync(dir)) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const lines = readFileSync(join(dir, file), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!line.includes('"directions"') && !line.includes("/maps/dir")) return;
        // Allowed: tenant-level navigation to the property itself.
        if (line.includes('resolveTenantMapsUrl(tenant, "directions")')) return;
        // Allowed: legacy themes render a directions action only for the item
        // that IS the property, guarded by equality with the tenant's own
        // mapQuery on the same or immediately preceding line.
        const context = `${lines[i - 1] ?? ""}\n${line}`;
        if (
          line.includes('mapsHrefForQuery(item.mapQuery, "directions")') &&
          context.includes("item.mapQuery === tenant.mapQuery")
        ) {
          return;
        }
        offenders.push(`${root}/${file}:${i + 1}`);
      });
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `item-level directions are forbidden on every guest surface: ${offenders.join(", ")}`,
  );
});

test("the guest shell's POI Maps buttons go through itemMapsHref", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(
    join(here, "..", "pages", "living-guide", "LivingGuideGuestShell.tsx"),
    "utf8",
  );
  const calls = source.match(/itemMapsHref\(/g) ?? [];
  // Two detail templates render the Google Maps action; each checks
  // visibility and builds the href — at least two call sites must remain.
  assert.ok(
    calls.length >= 2,
    `expected the detail templates to call itemMapsHref, found ${calls.length} call(s)`,
  );
  assert.ok(
    !source.includes("mapsHrefForQuery("),
    "guest shell must not build item Maps links with mapsHrefForQuery directly",
  );
});
