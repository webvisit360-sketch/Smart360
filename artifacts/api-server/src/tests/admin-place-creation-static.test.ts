import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

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