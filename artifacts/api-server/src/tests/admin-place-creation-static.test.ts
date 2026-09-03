import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { recomputedCreatorRange } from "../lib/adminPlaceCreation";

const service = await readFile(new URL("../lib/adminPlaceCreation.ts", import.meta.url), "utf8");
const routes = await readFile(new URL("../routes/adminContent.ts", import.meta.url), "utf8");

test("operator place endpoints enforce OKOLICA server-side", () => {
  assert.match(service, /\["explore", "services"\]\.includes\(row\.sectionKey\)/);
  assert.match(routes, /SearchAdminPlacesQueryParams\.safeParse/);
  assert.match(routes, /CreateAdminPlaceBody\.safeParse/);
});

test("creation re-verifies OSM and computes road metrics server-side", () => {
  assert.match(service, /fetchAdminPlaceNominatim\("\/lookup"/);
  assert.match(service, /computeRoadRoute\(ctx/);
  assert.match(service, /dodal operater prek iskanja/);
  assert.match(service, /syncApprovedCreatorPlace\(tx, proposal\)/);
});

test("duplicate locks cover OSM or rounded coordinates and normalized name", () => {
  assert.match(service, /lockCreatorPlaceIdentity/);
  assert.match(service, /toFixed\(5\)/);
  assert.match(service, /assertNoLiveCreatorPlaceDuplicate/);
});

test("item distance recompute uses authoritative materialization and updates item plus proposal", () => {
  assert.match(service, /eq\(creatorPlaceMaterializationsTable\.isActive, true\)/);
  assert.match(service, /originLatitude: tenantsTable\.latitude/);
  assert.match(service, /computeRoadRoute\(/);
  assert.match(service, /update\(itemsTable\)\.set\(\{ distanceMeters: roadDistanceM, duration \}\)/);
  assert.match(service, /update\(creatorPlaceProposalsTable\)\.set\(\{/);
  assert.match(service, /travelDurationS/);
  assert.match(routes, /"\/admin\/items\/:id\/distance\/recompute"/);
});

test("item recompute preserves practical classification and rejects stale materializations", () => {
  assert.equal(recomputedCreatorRange("practical", 45), "practical");
  assert.equal(recomputedCreatorRange("near", 45), "excursion");
  assert.match(service, /\.for\("update"\)/);
  assert.match(service, /Aktivna materializacija ali izhodišče se je med preračunom spremenilo/);
  assert.match(service, /itemDistanceProposalsTable/);
  assert.match(service, /const duration = `\$\{Math\.round\(travelDurationS \/ 60\)\} min`/);
  assert.match(
    service,
    /await db\.transaction[\s\S]*?from\(itemsTable\)[\s\S]*?for\("update"\)[\s\S]*?from\(creatorPlaceMaterializationsTable\)[\s\S]*?for\("update"\)/,
  );
});

test("ordinary item PATCH locks and ignores a Creator-owned distance", () => {
  assert.match(routes, /activeMaterialization/);
  assert.match(routes, /delete fields\.distanceMeters/);
  assert.match(routes, /creatorPlaceMaterializationsTable\.isActive, true/);
});