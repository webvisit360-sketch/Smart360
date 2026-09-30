import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  toDms, formatDecimal, formatDmsPair, distanceMeters, bearingDeg, cardinal, formatDistance,
  copyText, shareText, mapsUrl, sosStatus, toFix, isValidCoords, tenantHasCoords,
  SOS_ACCURACY_THRESHOLD_M, SOS_FRESH_MS, type SosFix,
} from "../pages/living-guide/sos/sos-model";
import { SOS_DICT, sosLang } from "../pages/living-guide/sos/sos-i18n";

const fix = (o: Partial<SosFix> = {}): SosFix => ({ lat: 46.35812, lon: 14.83294, altitude: 612, accuracy: 8, timestamp: 1000, ...o });

test("decimal and DMS formatting match reference", () => {
  assert.equal(formatDecimal(46.35812, "lat"), "N 46.35812°");
  assert.equal(formatDecimal(14.83294, "lon"), "E 14.83294°");
  assert.equal(formatDmsPair(46.35812, 14.83294), `46°21'29" N · 14°49'59" E`);
});
test("signed hemispheres and zero", () => {
  assert.equal(formatDecimal(-33.5, "lat"), "S 33.50000°");
  assert.equal(formatDecimal(-70.25, "lon"), "W 70.25000°");
  assert.equal(formatDecimal(0, "lat"), "N 0.00000°");
  assert.equal(formatDecimal(-0.000001, "lon"), "E 0.00000°");
  assert.equal(toDms(-12.5, "lat"), `12°30'0" S`);
  assert.ok(isValidCoords(0, 0));
  assert.ok(!isValidCoords(91, 0));
  assert.ok(!isValidCoords(NaN, 0));
});
test("DMS rounding carries into minutes and degrees", () => {
  assert.equal(toDms(10.9999999, "lat"), `11°0'0" N`);
  assert.equal(toDms(10 + 59 / 60 + 59.8 / 3600, "lon"), `11°0'0" E`);
  assert.equal(toDms(10 + 29.9999 / 60, "lat"), `10°30'0" N`);
});
test("distance and cardinal direction from tenant", () => {
  const home = { lat: 46.37, lon: 14.812 };
  const d = distanceMeters(home, fix());
  assert.ok(d > 1900 && d < 2400, String(d));
  assert.equal(cardinal(bearingDeg(home, fix())), "SE");
  assert.equal(cardinal(0), "N"); assert.equal(cardinal(359), "N"); assert.equal(cardinal(270), "W");
  assert.equal(formatDistance(2400, "sl"), "2,4 km");
  assert.equal(formatDistance(2400, "en"), "2.4 km");
  assert.equal(formatDistance(843, "de"), "840 m");
});
test("altitude null stays unknown, not 0", () => {
  const f = toFix({ coords: { latitude: 0, longitude: 0, altitude: null, accuracy: 5 }, timestamp: 1 });
  assert.ok(f); assert.equal(f!.altitude, null); assert.equal(f!.lat, 0);
  assert.equal(toFix({ coords: { latitude: 100, longitude: 0, accuracy: 5 }, timestamp: 1 }), null);
});
test("states: acquiring, poor, active, stale, denied", () => {
  assert.equal(SOS_ACCURACY_THRESHOLD_M, 50);
  assert.equal(SOS_FRESH_MS, 30000);
  assert.equal(sosStatus(null, null, 0).kind, "acquiring");
  assert.equal(sosStatus(fix({ accuracy: 140 }), null, 1000).kind, "poor");
  assert.equal(sosStatus(fix({ accuracy: 50 }), null, 1000).kind, "active");
  assert.equal(sosStatus(fix(), null, 1000 + 30000).kind, "active");
  assert.equal(sosStatus(fix(), null, 1000 + 30001).kind, "stale");
  assert.equal(sosStatus(fix(), "denied", 1000).kind, "denied");
  assert.equal(sosStatus(fix(), "timeout", 1000).kind, "stale");
  assert.equal(sosStatus(fix(), "unavailable", 1000).kind, "stale");
});
test("copy and share text", () => {
  assert.equal(copyText(fix()), "N 46.35812, E 14.83294 (±8 m)");
  assert.equal(mapsUrl(fix()), "https://www.google.com/maps/search/?api=1&query=46.35812,14.83294");
  assert.equal(shareText(fix()), "N 46.35812, E 14.83294 (±8 m)\nhttps://www.google.com/maps/search/?api=1&query=46.35812,14.83294");
  assert.equal(copyText(fix({ lat: -1, lon: -2 })), "S 1.00000, W 2.00000 (±8 m)");
});
test("tenant coords gate orientation row", () => {
  assert.ok(tenantHasCoords({ name: "x", latitude: 0, longitude: 0 }));
  assert.ok(!tenantHasCoords({ name: "x", latitude: null, longitude: 14 }));
  assert.ok(!tenantHasCoords(null));
});
test("four languages complete, 112 kept, directions localized", () => {
  const keys = Object.keys(SOS_DICT.sl).sort();
  for (const l of ["sl", "en", "de", "it"] as const) {
    const d = SOS_DICT[l];
    assert.deepEqual(Object.keys(d).sort(), keys, l);
    assert.match(d.call, /112/);
    assert.equal(d.guide.length, 3);
    for (const os of ["ios", "android", "desktop"] as const) assert.equal(d.os[os].length, 3);
  }
  assert.equal(SOS_DICT.sl.dir.SE, "jugovzhodno");
  assert.equal(SOS_DICT.en.dir.SE, "southeast");
  assert.equal(SOS_DICT.de.dir.SE, "südöstlich");
  assert.equal(SOS_DICT.it.dir.SE, "a sud-est");
  assert.equal(SOS_DICT.sl.near("2,4 km", "jugovzhodno", "Turizem Drobež"), "pribl. 2,4 km jugovzhodno od Turizem Drobež");
  assert.equal(sosLang("fr"), "sl"); assert.equal(sosLang("de-AT"), "de");
});
test("SOS sources contain no network, storage or logging calls", () => {
  const dir = join(import.meta.dirname, "../pages/living-guide/sos");
  for (const f of readdirSync(dir).filter((n) => /\.tsx?$/.test(n))) {
    const src = readFileSync(join(dir, f), "utf8");
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|console\.|new Image|<img|apiClient|useMutation|useQuery/, f);
  }
});
