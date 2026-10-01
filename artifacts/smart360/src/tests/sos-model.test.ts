import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  toDms, formatDecimal, formatDmsPair, distanceMeters, bearingDeg, cardinal, formatDistance,
  copyText, shareText, mapsUrl, sosStatus, toFix, isValidCoords, tenantHasCoords,
  smsText, smsUrl, detectOs, SOS_ACCURACY_THRESHOLD_M, SOS_FRESH_MS, type SosFix,
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
test("SMS draft is bilingual ASCII with real coordinates and measurement precision", () => {
  const expected = "SOS - potrebujem pomoc / I need help. Lokacija/Location: N 46.35812, E 14.83294 (+/-8 m), visina/alt 612 m.";
  assert.equal(smsText(fix()), expected);
  assert.match(smsText(fix()), /^[\x20-\x7e]+$/);
  assert.equal(
    smsText(fix({ lat: -33.512346, lon: -70.251236, altitude: -12.6, accuracy: 8.6 })),
    "SOS - potrebujem pomoc / I need help. Lokacija/Location: S 33.51235, W 70.25124 (+/-9 m), visina/alt -13 m.",
  );
  assert.equal(
    smsText(fix({ lat: -0, lon: -0.000001, altitude: 0, accuracy: 0 })),
    "SOS - potrebujem pomoc / I need help. Lokacija/Location: N 0.00000, E 0.00000 (+/-0 m), visina/alt 0 m.",
  );
});
test("SMS omits unknown altitude and accuracy instead of inventing measurements", () => {
  const coords = { lat: 46.35812, lon: 14.83294 };
  const bare = "SOS - potrebujem pomoc / I need help. Lokacija/Location: N 46.35812, E 14.83294.";
  assert.equal(smsText(coords), bare);
  assert.equal(smsText({ ...coords, altitude: null, accuracy: null }), bare);
  assert.equal(smsText({ ...coords, altitude: NaN, accuracy: Infinity }), bare);
  assert.equal(smsText({ ...coords, altitude: Infinity, accuracy: -1 }), bare);
  assert.equal(smsText(fix({ altitude: null })), bare.slice(0, -1) + " (+/-8 m).");
});
test("SMS URI uses iOS &body and Android ?body with an encoded ASCII draft", () => {
  for (const os of ["ios", "android", "desktop"] as const) {
    const url = smsUrl(fix(), os);
    const prefix = `sms:112${os === "ios" ? "&" : "?"}body=`;
    assert.ok(url.startsWith(prefix), os);
    const encoded = url.slice(prefix.length);
    assert.equal(encoded, encodeURIComponent(smsText(fix())));
    assert.equal(decodeURIComponent(encoded), smsText(fix()));
    assert.match(encoded, /%2B%2F-8%20m/);
    assert.match(encoded, /potrebujem%20pomoc%20%2F%20I%20need%20help/);
    assert.doesNotMatch(encoded, /[\s+°±]|https?:/);
  }
});
test("OS detection includes iPad desktop UA without mistaking a Mac for an iPad", () => {
  assert.equal(detectOs("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "ios");
  assert.equal(detectOs("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"), "ios");
  assert.equal(detectOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Mobile/15E148"), "ios");
  assert.equal(detectOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1.15", 5), "ios");
  assert.equal(detectOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1.15", 0), "desktop");
  assert.equal(detectOs("Mozilla/5.0 (Linux; Android 14)"), "android");
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
test("all four languages reassure calmly and qualify operator visibility and denied-browser location", () => {
  const qualifiers = { sl: /praviloma/, en: /usually/, de: /in der Regel/, it: /di solito/ };
  const confirmations = { sl: /Za potrditev/, en: /to confirm/, de: /zur Bestätigung/, it: /per confermarla/ };
  const noHesitation = { sl: /Ne odlašajte s klicem/, en: /Don't hesitate to call/, de: /Zögern Sie nicht anzurufen/, it: /Non esitare a chiamare/ };
  const smsLabels = { sl: "SMS na 112", en: "SMS to 112", de: "SMS an 112", it: "SMS al 112" };
  assert.equal(SOS_DICT.sl.callReassurance, "Ob klicu na 112 sodobni telefoni samodejno pošljejo vašo lokacijo reševalcem. Koordinate zgoraj so potrditev in rezerva.");
  for (const lang of ["sl", "en", "de", "it"] as const) {
    const d = SOS_DICT[lang];
    assert.match(d.callReassurance, /112/);
    assert.match(d.guide[0][1], qualifiers[lang]);
    assert.match(d.guide[0][1], confirmations[lang]);
    assert.match(d.deniedReassurance, qualifiers[lang]);
    assert.match(d.deniedReassurance, noHesitation[lang]);
    assert.match(d.deniedReassurance, /112/);
    assert.equal(d.sms, smsLabels[lang]);
    assert.ok(d.smsHint.length > 0);
    assert.ok(d.smsManual.length > 0);
  }
  assert.equal(new Set(Object.values(SOS_DICT).map(d => d.callReassurance)).size, 4);
  assert.equal(new Set(Object.values(SOS_DICT).map(d => d.deniedReassurance)).size, 4);
  assert.equal(new Set(Object.values(SOS_DICT).map(d => d.smsHint)).size, 4);
});
test("SOS sources contain no network, storage or logging calls", () => {
  const dir = join(import.meta.dirname, "../pages/living-guide/sos");
  for (const f of readdirSync(dir).filter((n) => /\.tsx?$/.test(n))) {
    const src = readFileSync(join(dir, f), "utf8");
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|console\.|new Image|<img|apiClient|useMutation|useQuery/, f);
  }
});
