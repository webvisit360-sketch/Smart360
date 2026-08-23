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
  assert.equal(
    itemMapsHref({
      title: "Portopiccolo Sistiana",
      mapQuery: link,
      latitude: 45.5,
      longitude: 13.6,
      resolvedAddress: "Portopiccolo, Sistiana Mare, 34011, Italia",
    }),
    link,
  );
});

test("itemMapsHref builds a NAMED search from title + approved address, beating coordinates", () => {
  assert.equal(
    itemMapsHref({
      title: "Portopiccolo Sistiana",
      mapQuery: "Portopiccolo Sistiana",
      latitude: 45.7659918,
      longitude: 13.6375087,
      resolvedAddress: "Portopiccolo, Sistiana Mare, 34011, Italia",
    }),
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      "Portopiccolo Sistiana, Portopiccolo, Sistiana Mare, 34011, Italia",
    )}`,
  );
  // Address without a title still searches the address alone.
  assert.equal(
    itemMapsHref({ resolvedAddress: "Titov trg 3, Koper" }),
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Titov trg 3, Koper")}`,
  );
  // Blank address falls through to coordinates.
  assert.equal(
    itemMapsHref({ resolvedAddress: "  ", latitude: 45.5, longitude: 13.6 }),
    "https://www.google.com/maps/search/?api=1&query=45.5,13.6",
  );
});

test("itemMapsHref uses coordinates only as the last resort, labelled with the title", () => {
  assert.equal(
    itemMapsHref({ title: "Pot zdravja", mapQuery: "Pot zdravja, Strunjan", latitude: 45.528, longitude: 13.605 }),
    "https://maps.google.com/?q=45.528,13.605(Pot%20zdravja)",
  );
  // Parentheses in the title cannot break out of the pin label.
  assert.equal(
    itemMapsHref({ title: "Pirat (Piran)", latitude: 45.5, longitude: 13.6 }),
    "https://maps.google.com/?q=45.5,13.6(Pirat%20%28Piran%29)",
  );
  // Coordinates alone (no title) still resolve as a plain place search.
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

test("a pasted directions link is rejected and falls back to named search or coordinates", () => {
  const dirLink = "https://www.google.com/maps/dir/Celje/Izola";
  const apiDir = "https://www.google.com/maps/dir/?api=1&destination=Izola";
  const travel = "https://www.google.com/maps/place/x?travelmode=driving";
  assert.equal(sanitizePastedMapsUrl(dirLink), null);
  assert.equal(sanitizePastedMapsUrl(apiDir), null);
  assert.equal(sanitizePastedMapsUrl(travel), null);
  // Legacy and alternate Google directions forms must be rejected too.
  assert.equal(sanitizePastedMapsUrl("https://www.google.com/maps?daddr=Izola"), null);
  assert.equal(sanitizePastedMapsUrl("https://maps.google.com/?saddr=Celje&daddr=Izola"), null);
  assert.equal(sanitizePastedMapsUrl("https://www.google.com/maps?dirflg=d&q=Izola"), null);
  assert.equal(sanitizePastedMapsUrl("https://www.google.com/maps/dir/?api=1&origin=Celje"), null);
  assert.equal(sanitizePastedMapsUrl("https://www.google.com/maps/%64ir/Celje/Izola"), null);
  assert.equal(sanitizePastedMapsUrl("https://maps.google.com/maps#!daddr=Izola"), null);
  assert.equal(
    itemMapsHref({ title: "Kamin", mapQuery: "https://www.google.com/maps?daddr=Izola", resolvedAddress: "Dobrava 1A, Izola" }),
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Kamin, Dobrava 1A, Izola")}`,
  );
  assert.equal(itemMapsHref({ mapQuery: "https://maps.google.com/?saddr=Celje&daddr=Izola" }), null);
  // A legitimate place link keeps working.
  assert.equal(
    sanitizePastedMapsUrl("https://www.google.com/maps/place/Restavracija+Kamin/@45.53,13.66,17z"),
    "https://www.google.com/maps/place/Restavracija+Kamin/@45.53,13.66,17z",
  );
  assert.equal(sanitizePastedMapsUrl("https://maps.app.goo.gl/AbC123"), "https://maps.app.goo.gl/AbC123");
  // With an approved address the rejected link falls to the named search.
  assert.equal(
    itemMapsHref({ title: "Kamin", mapQuery: dirLink, resolvedAddress: "Dobrava 1A, Izola", latitude: 45.53, longitude: 13.66 }),
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Kamin, Dobrava 1A, Izola")}`,
  );
  assert.equal(
    itemMapsHref({ mapQuery: dirLink, latitude: 45.53, longitude: 13.66 }),
    "https://www.google.com/maps/search/?api=1&query=45.53,13.66",
  );
  // No address or coordinates either: hide the action instead of risking
  // navigation or searching for a raw URL string.
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
    itemMapsHref({ title: "Izola", mapQuery: "Izola", latitude: 45.53, longitude: 13.66 }),
    itemMapsHref({ title: "Kamin", resolvedAddress: "Dobrava 1A, Izola" }),
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
