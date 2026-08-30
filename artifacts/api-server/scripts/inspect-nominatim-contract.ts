import { acquireNominatimTurn } from "../src/lib/distanceEngine";

const origin = { latitude: 46.311456, longitude: 14.9093051 };
const radiusKm = 15;
const latDelta = radiusKm / 111.32;
const lonDelta =
  radiusKm / (111.32 * Math.cos((origin.latitude * Math.PI) / 180));
const url = new URL("https://nominatim.openstreetmap.org/search");
url.searchParams.set("format", "jsonv2");
url.searchParams.set("limit", "10");
url.searchParams.set("namedetails", "1");
url.searchParams.set("layer", "poi,natural,manmade");
url.searchParams.set(
  "viewbox",
  [
    origin.longitude - lonDelta,
    origin.latitude + latDelta,
    origin.longitude + lonDelta,
    origin.latitude - latDelta,
  ].join(","),
);
url.searchParams.set("bounded", "0");
url.searchParams.set("q", process.argv[2] ?? "Logarska dolina");

await acquireNominatimTurn();
const response = await fetch(url, {
  headers: {
    "User-Agent":
      "Smart360 Creator sieve contract inspection (admin contact via replit deployment)",
  },
});
if (!response.ok) throw new Error(`Nominatim ${response.status}`);
const results = (await response.json()) as Array<Record<string, unknown>>;
console.log(
  JSON.stringify(
    {
      resultCount: results.length,
      fieldsByResult: results.map((result) => Object.keys(result).sort()),
      results,
    },
    null,
    2,
  ),
);