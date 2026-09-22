import assert from "node:assert/strict";
import test from "node:test";
import {
  enrichAdminPlaceRoutes,
  type AdminPlaceSearchCandidate,
} from "../lib/adminPlaceCreation";

type CandidateInput = Omit<
  AdminPlaceSearchCandidate,
  "roadDistanceM" | "travelDurationS" | "routeStatus"
>;

function candidate(
  name: string,
  latitude: number,
  longitude: number,
): CandidateInput {
  return {
    name,
    address: `${name}, Slovenija`,
    latitude,
    longitude,
    osmType: "node",
    osmId: latitude * 1_000_000,
    osmCategory: "tourism",
    osmFeatureType: "attraction",
    osmAddressType: "attraction",
    straightLineDistanceM: 1_000,
    duplicate: false,
    duplicateLabel: null,
  };
}

test("search route enrichment returns rounded OSRM distance and duration", async () => {
  const result = await enrichAdminPlaceRoutes(
    { latitude: 46.25, longitude: 14.9 },
    [candidate("Center Rinka", 46.4, 14.65)],
    {
      computeRoute: async () => ({
        distanceMeters: 12_345.6,
        durationMinutes: 17.51,
      }),
    },
  );

  assert.deepEqual(result.map((row) => ({
    roadDistanceM: row.roadDistanceM,
    travelDurationS: row.travelDurationS,
    routeStatus: row.routeStatus,
  })), [{
    roadDistanceM: 12_346,
    travelDurationS: 1_051,
    routeStatus: "available",
  }]);
});

test("an unavailable route preserves the search candidate explicitly", async () => {
  const input = candidate("Mozirski gaj", 46.34, 14.96);
  const [result] = await enrichAdminPlaceRoutes(
    { latitude: 46.25, longitude: 14.9 },
    [input],
    { computeRoute: async () => null },
  );

  assert.equal(result?.name, input.name);
  assert.equal(result?.roadDistanceM, null);
  assert.equal(result?.travelDurationS, null);
  assert.equal(result?.routeStatus, "unavailable");
});

test("one rejected routing call does not remove other search results", async () => {
  const result = await enrichAdminPlaceRoutes(
    { latitude: 46, longitude: 14 },
    [
      candidate("Nedosegljiva pot", 46.1, 14.1),
      candidate("Dosegljiva pot", 46.2, 14.2),
    ],
    {
      computeRoute: async (_origin, destination) => {
        if (destination.latitude === 46.1) throw new Error("OSRM timeout");
        return { distanceMeters: 2_500, durationMinutes: 5 };
      },
    },
  );

  assert.deepEqual(result.map((row) => row.routeStatus), ["unavailable", "available"]);
  assert.deepEqual(result.map((row) => row.roadDistanceM), [null, 2_500]);
});

test("route enrichment bounds concurrency and shares duplicate-coordinate requests", async () => {
  let active = 0;
  let maxActive = 0;
  let calls = 0;
  const inputs = [
    candidate("A", 46.1, 14.1),
    candidate("A duplicate", 46.1, 14.1),
    candidate("B", 46.2, 14.2),
    candidate("C", 46.3, 14.3),
  ];
  await enrichAdminPlaceRoutes(
    { latitude: 46, longitude: 14 },
    inputs,
    {
      concurrency: 2,
      computeRoute: async () => {
        calls += 1;
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return { distanceMeters: 1_000, durationMinutes: 2 };
      },
    },
  );

  assert.equal(calls, 3);
  assert.ok(maxActive <= 2);
});