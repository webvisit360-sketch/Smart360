import test from "node:test";
import assert from "node:assert";
import {
  getSkeletonIndex,
  layoutToLabel,
  guessCategory,
  OKOLICA_SKELETON_KEYS
} from "../components/admin/content-editor";

test("getSkeletonIndex uses canonical keys and ignores labels", () => {
  assert.equal(
    getSkeletonIndex({ key: "culinary", label: "Znamenitosti" } as any),
    OKOLICA_SKELETON_KEYS.indexOf("culinary")
  );
  
  // Custom categories or unknowns go to the end
  assert.equal(
    getSkeletonIndex({ key: "host-custom-123", label: "Moja kategorija" } as any),
    999
  );
  
  // Legacy category not in skeleton goes to the end
  assert.equal(
    getSkeletonIndex({ key: "health", label: "Zdravje" } as any),
    999
  );
});

test("layoutToLabel maps layout keys explicitly to Slovenian terms without fallback", () => {
  assert.equal(layoutToLabel("cards"), "Kartice");
  assert.equal(layoutToLabel("apartments"), "Apartmaji");
  assert.equal(layoutToLabel("poi"), "Kartice");
  assert.equal(layoutToLabel("products"), "Izdelek");
  assert.equal(layoutToLabel("wifi"), "WiFi");
  assert.equal(layoutToLabel("contacts"), "Kontakti");
  
  // No raw technical fallback
  assert.equal(layoutToLabel("unknown_layout"), "");
});

test("guessCategory determines correct canonical category from OSM attributes", () => {
  const categories = [
    { id: "c1", key: "culinary" },
    { id: "c2", key: "hike" },
    { id: "c3", key: "nature" }
  ] as any[];
  
  // By feature type
  assert.equal(
    guessCategory({
      osmType: "node", osmId: 1, name: "Test", address: "Test", straightLineDistanceM: 10,
      osmFeatureType: "restaurant"
    }, categories),
    "c1"
  );
  
  // By category
  assert.equal(
    guessCategory({
      osmType: "node", osmId: 1, name: "Test", address: "Test", straightLineDistanceM: 10,
      osmCategory: "peak"
    }, categories),
    "c2"
  );
  
  // Unmatched
  assert.equal(
    guessCategory({
      osmType: "node", osmId: 1, name: "Test", address: "Test", straightLineDistanceM: 10,
      osmCategory: "unknown"
    }, categories),
    null
  );
});