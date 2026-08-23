import assert from "node:assert/strict";
import test from "node:test";

import {
  millisecondsToNextSunBoundary,
  resolveSunWindow,
  sunBoundaries,
  sunTimes,
  themeForSun,
} from "../pages/living-guide/sun-times";
import {
  currentLivingTheme,
  livingThemeForHour,
  millisecondsToNextBoundary,
} from "../pages/living-guide/theme-clock";

const IZOLA = { latitude: 45.5126898, longitude: 13.6339282 };
const TZ = "Europe/Ljubljana";

function local(d: Date): string {
  return d.toLocaleTimeString("sl-SI", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timesFor(dateIso: string) {
  // Local noon of the requested calendar day picks the right solar day.
  const t = sunTimes(
    new Date(`${dateIso}T11:00:00Z`),
    IZOLA.latitude,
    IZOLA.longitude,
  );
  assert.ok(t, `sun times must exist for Izola on ${dateIso}`);
  return t;
}

/**
 * The owner's prototype reference table — these values are BINDING to the
 * minute (21.6. and 21.12. were given explicitly; the rest were derived with
 * the same NOAA algorithm and verified against the boundary/theme probes).
 */
test("Izola sun table matches the prototype to the minute", () => {
  const expected: Record<string, [string, string, string, string]> = {
    "2026-06-21": ["04:38", "05:16", "20:57", "21:35"],
    "2026-08-23": ["05:44", "06:15", "19:59", "20:31"],
    "2026-10-24": ["07:03", "07:33", "18:04", "18:35"],
    "2026-10-26": ["06:05", "06:36", "17:01", "17:32"],
    "2026-12-21": ["07:08", "07:42", "16:24", "16:58"],
  };
  for (const [date, [dawn, sunrise, sunset, dusk]] of Object.entries(expected)) {
    const t = timesFor(date);
    assert.deepEqual(
      [local(t.dawn), local(t.sunrise), local(t.sunset), local(t.dusk)],
      [dawn, sunrise, sunset, dusk],
      date,
    );
  }
});

test("DST edge: local sunrise jumps back ~1h between 24 and 26 October", () => {
  const before = timesFor("2026-10-24"); // CEST (UTC+2)
  const after = timesFor("2026-10-26"); // CET (UTC+1)
  // Local clock: 07:33 → 06:36. Absolute time between the two sunrises is
  // ~26h03m — the 57-minute local shift is purely the DST changeover.
  assert.equal(local(before.sunrise), "07:33");
  assert.equal(local(after.sunrise), "06:36");
  const absoluteDeltaMin =
    (after.sunrise.getTime() - before.sunrise.getTime()) / 60000;
  assert.ok(
    Math.abs(absoluteDeltaMin - (2 * 24 * 60 + 3)) <= 2,
    `absolute delta ${absoluteDeltaMin} min`,
  );
});

test("theme probes on 23 August (CEST) follow the sun boundaries", () => {
  const t = timesFor("2026-08-23");
  const probe = (hhmm: string) =>
    themeForSun(new Date(`2026-08-23T${hhmm}:00+02:00`), t);
  assert.equal(probe("04:00"), "noc"); // before dawn 05:44
  assert.equal(probe("06:00"), "jutro"); // dawn→sunrise+90 (07:45)
  assert.equal(probe("08:00"), "dan"); // after 07:45
  assert.equal(probe("12:00"), "dan");
  assert.equal(probe("19:00"), "vecer"); // after sunset−90 (18:29)
  assert.equal(probe("21:30"), "noc"); // after dusk 20:31
});

test("theme probes on 21 December (CET) follow the sun boundaries", () => {
  const t = timesFor("2026-12-21");
  const probe = (hhmm: string) =>
    themeForSun(new Date(`2026-12-21T${hhmm}:00+01:00`), t);
  assert.equal(probe("06:00"), "noc"); // before dawn 07:08
  assert.equal(probe("08:00"), "jutro"); // sunrise 07:42 + 90 = 09:12
  assert.equal(probe("15:00"), "vecer"); // sunset 16:24 − 90 = 14:54
  assert.equal(probe("17:00"), "noc"); // after dusk 16:58
});

test("boundary instants land exactly on dawn / sunrise+90 / sunset−90 / dusk", () => {
  const t = timesFor("2026-08-23");
  const [dawn, morningEnd, dayEnd, dusk] = sunBoundaries(t);
  const justBefore = (d: Date) => new Date(d.getTime() - 1000);
  assert.equal(themeForSun(justBefore(dawn!), t), "noc");
  assert.equal(themeForSun(dawn!, t), "jutro");
  assert.equal(themeForSun(justBefore(morningEnd!), t), "jutro");
  assert.equal(themeForSun(morningEnd!, t), "dan");
  assert.equal(themeForSun(justBefore(dayEnd!), t), "dan");
  assert.equal(themeForSun(dayEnd!, t), "vecer");
  assert.equal(themeForSun(justBefore(dusk!), t), "vecer");
  assert.equal(themeForSun(dusk!, t), "noc");
});

test("scheduler wakes at the next boundary, including across midnight", () => {
  const t = timesFor("2026-08-23");
  // 20:25 local — dusk at 20:31: next boundary in ~6 minutes.
  const nearDusk = new Date("2026-08-23T20:25:00+02:00");
  const msToDusk = millisecondsToNextSunBoundary(
    nearDusk,
    IZOLA.latitude,
    IZOLA.longitude,
  );
  assert.ok(msToDusk !== null);
  assert.equal(
    Math.round(msToDusk / 60000),
    Math.round((t.dusk.getTime() - nearDusk.getTime()) / 60000),
  );

  // 23:00 local — next boundary is TOMORROW's dawn (05:46 on 24 Aug).
  const lateNight = new Date("2026-08-23T23:00:00+02:00");
  const msToDawn = millisecondsToNextSunBoundary(
    lateNight,
    IZOLA.latitude,
    IZOLA.longitude,
  );
  assert.ok(msToDawn !== null);
  const tomorrow = timesFor("2026-08-24");
  assert.equal(
    Math.round(msToDawn / 60000),
    Math.round((tomorrow.dawn.getTime() - lateNight.getTime()) / 60000),
  );

  // The hook path uses the same computation when coordinates are present.
  assert.equal(millisecondsToNextBoundary(nearDusk, IZOLA), msToDusk);
});

test("UTC-day seam: Izola local 00:30 CEST stays night and wakes at that day's dawn", () => {
  // 00:30 local on 24 Aug = 22:30 UTC on 23 Aug — the PREVIOUS UTC day.
  const now = new Date("2026-08-24T00:30:00+02:00");
  const window = resolveSunWindow(now, IZOLA.latitude, IZOLA.longitude);
  assert.ok(window);
  assert.equal(window.theme, "noc");
  const dawn24 = timesFor("2026-08-24").dawn;
  assert.equal(
    Math.round(window.nextBoundaryMs / 60000),
    Math.round((dawn24.getTime() - now.getTime()) / 60000),
  );
  assert.equal(currentLivingTheme(now, IZOLA), "noc");
});

test("UTC-day seam: eastern tenant (Tokyo, UTC+9) gets jutro at local 06:00", () => {
  const TOKYO = { latitude: 35.6764, longitude: 139.65 };
  // 06:00 JST on 23 Aug = 21:00 UTC on 22 Aug — prior UTC date, but that
  // morning's dawn/sunrise belong to the 23 Aug computation. The naive
  // single-UTC-day lookup returned "noc" here; the seam-proof window must not.
  const now = new Date("2026-08-23T06:00:00+09:00");
  const window = resolveSunWindow(now, TOKYO.latitude, TOKYO.longitude);
  assert.ok(window);
  // Tokyo 23 Aug: sunrise ~05:10 JST → jutro until ~06:40.
  assert.equal(window.theme, "jutro");
  assert.equal(currentLivingTheme(now, TOKYO), "jutro");
  // And mid-afternoon local is "dan", not the prior UTC day's night.
  assert.equal(
    currentLivingTheme(new Date("2026-08-23T14:00:00+09:00"), TOKYO),
    "dan",
  );
});

test("polar day/night and missing coordinates fall back to fixed hours — never crash", () => {
  const midsummer = new Date("2026-06-21T11:00:00Z");
  const midwinter = new Date("2026-12-21T11:00:00Z");
  // Longyearbyen: no sunset in June, no sunrise in December.
  assert.equal(sunTimes(midsummer, 78.22, 15.63), null);
  assert.equal(sunTimes(midwinter, 78.22, 15.63), null);

  const polar = { latitude: 78.22, longitude: 15.63 };
  assert.equal(
    currentLivingTheme(midsummer, polar),
    livingThemeForHour(midsummer.getHours()),
  );
  // Fixed-hour fallback also schedules a boundary (finite, positive).
  const ms = millisecondsToNextBoundary(midsummer, polar);
  assert.ok(ms >= 1000 && Number.isFinite(ms));

  // No coordinates at all — tenant keeps the current fixed hours.
  const now = new Date();
  assert.equal(
    currentLivingTheme(now, { latitude: null, longitude: null }),
    livingThemeForHour(now.getHours()),
  );
  assert.equal(currentLivingTheme(now), livingThemeForHour(now.getHours()));

  // Garbage coordinates must not throw either.
  assert.equal(
    currentLivingTheme(now, { latitude: Number.NaN, longitude: 999 }),
    livingThemeForHour(now.getHours()),
  );
});
