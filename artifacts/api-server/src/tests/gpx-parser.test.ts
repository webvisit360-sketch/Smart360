import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { MAX_GPX_BYTES, parseGpx } from "../lib/gpxParser";

const fixture = readFileSync(fileURLToPath(new URL("./fixtures/synthetic-soca-route.gpx", import.meta.url)));
const parse = (xml: string, activity: "cycling" | "hiking" | "running" = "hiking") =>
  parseGpx(Buffer.from(xml), activity);
const document = (body: string) => `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;
const point = (lat: string, lon: string, ele?: string) =>
  `<trkpt lat="${lat}" lon="${lon}">${ele === undefined ? "" : `<ele>${ele}</ele>`}</trkpt>`;
const fails = (xml: string, pattern = /Neveljavna datoteka GPX:/) =>
  assert.throws(() => parse(xml), pattern);

test("synthetic Slovenian route preserves segment breaks and full-resolution stats", () => {
  const result = parseGpx(fixture, "hiking");
  assert.equal(result.segments.length, 2);
  assert.deepEqual(result.segments.map((segment) => segment.length), [3, 2]);
  assert.equal(result.profile[3]?.segment, 1);
  assert.equal(result.profile[2]?.distanceKm, result.profile[3]?.distanceKm, "no distance across a gap");
  assert.equal(result.ascentM, 50);
  assert.equal(result.descentM, 15);
  assert.equal(result.minElevationM, 450);
  assert.equal(result.maxElevationM, 530);
  assert.ok(result.distanceKm > 0.3 && result.distanceKm < 0.5);
  assert.equal(result.durationMinutes, Number((result.distanceKm / 5 * 60 + 5).toFixed(2)));
  const cycling = parseGpx(fixture, "cycling");
  assert.equal(cycling.durationMinutes, Number((cycling.distanceKm / 15 * 60 + 5).toFixed(2)));
  const running = parseGpx(fixture, "running");
  assert.equal(running.durationMinutes, Number(((running.distanceKm / 10 + running.ascentM! / 600) * 60).toFixed(2)));
});

test("namespaced route points and a singleton segment are supported", () => {
  const result = parse(`<p:gpx xmlns:p="http://www.topografix.com/GPX/1/0"><p:rte><p:rtept lat="46" lon="14"><p:ele>100</p:ele></p:rtept><p:rtept lat="46" lon="14.01"><p:ele>110</p:ele></p:rtept></p:rte><p:rte><p:rtept lat="47" lon="15"><p:ele>25</p:ele></p:rtept></p:rte></p:gpx>`);
  assert.deepEqual(result.segments.map((segment) => segment.length), [2, 1]);
  assert.equal(result.ascentM, 10);
  assert.equal(result.descentM, 0);
  assert.equal(result.profile[1]?.distanceKm, result.profile[2]?.distanceKm);
});

test("missing elevation nulls ascent, descent and estimates but keeps known extrema", () => {
  const result = parse(document(`<trk><trkseg>${point("46", "14", "100")}${point("46.01", "14")}${point("46.02", "14", "50")}</trkseg></trk>`));
  assert.equal(result.ascentM, null);
  assert.equal(result.descentM, null);
  assert.equal(result.durationMinutes, null);
  assert.equal(result.minElevationM, 50);
  assert.equal(result.maxElevationM, 100);
  assert.equal(result.profile[1]?.elevationM, null);
  assert.equal(parseGpx(Buffer.from(document(`<trk><trkseg>${point("46", "14", "100")}${point("46.01", "14")}</trkseg></trk>`)), "running").durationMinutes, null);
  const allMissing = parse(document(`<rte><rtept lat="46" lon="14"/></rte>`));
  assert.equal(allMissing.minElevationM, null);
  assert.equal(allMissing.maxElevationM, null);
});

test("invalid XML, coordinates, elevations and unsupported encodings fail closed", () => {
  for (const xml of [
    "<gpx><trk>", document("<trk><trkseg><trkpt lat='46' lon='14'></trkseg></trk>"),
    document(`<trk><trkseg>${point("NaN", "14")}</trkseg></trk>`),
    document(`<trk><trkseg>${point("91", "14")}</trkseg></trk>`),
    document(`<trk><trkseg>${point("46", "-181")}</trkseg></trk>`),
    document(`<trk><trkseg>${point("46", "14", "Infinity")}</trkseg></trk>`),
    document(`<trk><trkseg>${point("46", "14", "12001")}</trkseg></trk>`),
    document("<trk><trkseg><trkpt lat='46'/></trkseg></trk>"),
    document("<name>No track points</name>"),
    `<?xml version="1.0" encoding="ISO-8859-1"?><gpx/>`,
    "<html><trk><trkseg><trkpt lat='46' lon='14'/></trkseg></trk></html>",
    document(`<trk><trkseg>${point("46", "14")}&undefined;</trkseg></trk>`),
  ]) fails(xml);
  assert.throws(() => parseGpx(Buffer.from([0xff, 0xfe, 0x3c]), "hiking"), /kodiranje/);
});

test("DOCTYPE, internal and external entities are rejected without resolution", () => {
  for (const xml of [
    `<!DOCTYPE gpx [<!ENTITY x "hi">]><gpx><name>&x;</name></gpx>`,
    `<!DOCTYPE gpx SYSTEM "file:///etc/passwd"><gpx/>`,
    `<!DOCTYPE gpx [<!ENTITY x SYSTEM "https://example.com/secret">]><gpx/>`,
  ]) fails(xml, /DOCTYPE/);
});

test("size and segment/point limits are enforced", () => {
  assert.equal(MAX_GPX_BYTES, 5 * 1024 * 1024);
  assert.throws(() => parseGpx(Buffer.alloc(MAX_GPX_BYTES + 1), "hiking"), /5 MB/);
  fails(document(`<trk>${"<trkseg><trkpt lat='46' lon='14'/></trkseg>".repeat(101)}</trk>`), /preveč odsekov/);
  fails(document(`<trk><trkseg>${"<trkpt lat='46' lon='14'/>".repeat(150_001)}</trkseg></trk>`), /preveč točk/);
});

test("100 segments retain every first and last point within global budgets", () => {
  const xml = document(`<trk>${Array.from({ length: 100 }, (_, segment) =>
    `<trkseg>${Array.from({ length: 8 }, (_, i) =>
      point("46", (14 + segment * 0.001 + i * 0.00001).toFixed(5), String(i))).join("")}</trkseg>`).join("")}</trk>`);
  const result = parse(xml);
  assert.equal(result.segments.length, 100);
  assert.equal(result.segments.flat().length, 400);
  assert.equal(result.profile.length, 300);
  for (let i = 0; i < 100; i++) {
    assert.equal(result.segments[i]?.[0]?.lon, Number((14 + i * 0.001).toFixed(5)));
    assert.equal(result.segments[i]?.at(-1)?.lon, Number((14 + i * 0.001 + 0.00007).toFixed(5)));
    assert.equal(result.profile.filter((entry) => entry.segment === i).at(-1)?.elevationM, 7);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 64 * 1024);
});

test("100k full-resolution points remain bounded and endpoints survive simplification", () => {
  const xml = document(`<trk><trkseg>${Array.from({ length: 100_000 }, (_, i) =>
    point("0", (i * 0.00001).toFixed(5), String(i % 10))).join("")}</trkseg></trk>`);
  const result = parse(xml);
  assert.ok(Buffer.byteLength(xml) < MAX_GPX_BYTES);
  assert.ok(result.segments.flat().length <= 400);
  assert.ok(result.profile.length <= 300);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 64 * 1024);
  assert.deepEqual(result.segments[0]?.[0], { lat: 0, lon: 0 });
  assert.deepEqual(result.segments[0]?.at(-1), { lat: 0, lon: 0.99999 });
  assert.equal(result.ascentM, 90000);
  assert.equal(result.descentM, 89991);
  assert.ok(result.distanceKm > 110 && result.distanceKm < 112);
});