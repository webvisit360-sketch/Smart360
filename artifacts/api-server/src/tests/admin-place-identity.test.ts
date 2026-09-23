import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { db, tenantsTable } from "@workspace/db";
import { adminPlaceDuplicateRows, findAdminPlaceDuplicate, sameAdminPlace } from "../lib/adminPlaceCreation";

test("real Gril pending park identity does not confuse the Logarska dolina valley", () => {
  const valley = { name: "Logarska dolina", osmType: "way", osmId: 1101539589, latitude: 46.3912165, longitude: 14.6283021 };
  const park = { name: "Krajinski park Logarska dolina", osmType: null, osmId: null, latitude: 46.396673, longitude: 14.62944 };
  const match = { kind: "pending" as const, id: "50a57309-79f2-4da3-952d-0511566365b1", name: park.name, categoryId: "3e7b542d-8685-41bf-8adb-bf79df2b6488", category: "Izleti", hidden: false };
  assert.deepEqual(findAdminPlaceDuplicate(park, [{ ...park, match }]), match);
  assert.equal(findAdminPlaceDuplicate(valley, [{ ...park, match }]), null);
  assert.equal(sameAdminPlace(valley, { ...valley, osmId: 1101539588 }), false);
  assert.equal(sameAdminPlace(park, { ...park, latitude: park.latitude + 0.001 }), false);
  assert.equal(sameAdminPlace(park, { ...park, latitude: park.latitude + 0.0001, name: "Drug kraj" }), false);
  assert.equal(sameAdminPlace(park, { ...park, latitude: park.latitude + 0.00008 }), true);
  assert.equal(sameAdminPlace({ ...park, osmType: "node", osmId: 123 }, { ...park, osmType: "way", osmId: 123 }), false);
  const archived = { ...match, kind: "archived" as const, hidden: true };
  assert.deepEqual(findAdminPlaceDuplicate(park, [{ ...park, match: archived }]), archived);
  const unlocatedLegacy = { name: valley.name, osmType: null, osmId: null, latitude: null, longitude: null };
  assert.equal(sameAdminPlace(valley, unlocatedLegacy), false);
  assert.equal(findAdminPlaceDuplicate(valley, [{
    ...unlocatedLegacy,
    match: { kind: "item", id: "legacy-item", categoryId: "legacy-category", category: "Izleti", name: valley.name, hidden: false },
  }]), null, "an unlocated legacy item with the same name must never hard-block a verified place");
  assert.equal(sameAdminPlace(unlocatedLegacy, { ...unlocatedLegacy }), false);
});

test("read-only actual development Gril valley OSM candidate resolves to its pending Creator queue row", async () => {
  const [tenant] = await db.select({ id: tenantsTable.id }).from(tenantsTable)
    .where(eq(tenantsTable.slug, "piknik-prostor-in-kamp-gril-4205182f")).limit(1);
  assert.ok(tenant, "development Gril tenant must exist for this real-data regression");
  const match = findAdminPlaceDuplicate(
    { name: "Logarska dolina", osmType: "way", osmId: 1101539589, latitude: 46.3912165, longitude: 14.6283021 },
    await adminPlaceDuplicateRows(tenant.id),
  );
  assert.deepEqual(match, {
    kind: "pending", id: "684fea42-f7f5-4589-8fbf-5c48d86f06ad",
    categoryId: "f357dded-b0b2-4e25-9b2b-89ac6529000f",
    category: "Naravna dediščina", name: "Logarska dolina", hidden: false,
  });
});