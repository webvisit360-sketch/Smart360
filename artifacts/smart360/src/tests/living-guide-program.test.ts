import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWeek,
  dayCodeOf,
  formatTimeRange,
  ljubljanaDateKey,
  matchesFilter,
  mondayOf,
  normalizeEventSchedule,
  occurrencesOn,
  parseLegacyEventStart,
  programEventOf,
  programItems,
  programLabel,
  programToday,
  recurrenceHint,
  setProgramTodayOverride,
  signupNote,
  weekRangeLabel,
  dayShort2,
} from "../pages/living-guide/living-guide-program-model";
import { findDatedEventDestination, getLivingGuideAvailableFeatures } from "../pages/living-guide/living-guide-nav-resolver";
import { selectHomeTodayEntries } from "../pages/living-guide/living-guide-home";
import { programFixtureTenant } from "../pages/living-guide/living-guide-program-fixture-data";

const weekly = (days: string[], extra: object = {}) => ({ type: "weekly", days, timeFrom: "09:00", timeTo: "10:00", ...extra });
const cat = (items: any[]) => ({ id: "c", layout: "events", isVisible: true, items });

test("weekly expansion respects inclusive season", () => {
  const rows = programItems(cat([{ id: "a", title: "A", eventSchedule: weekly(["thu"], { validFrom: "2026-08-20", validTo: "2026-08-27" }) }]));
  assert.equal(occurrencesOn(rows, "2026-08-13").length, 0);
  assert.equal(occurrencesOn(rows, "2026-08-20").length, 1);
  assert.equal(occurrencesOn(rows, "2026-08-27").length, 1);
  assert.equal(occurrencesOn(rows, "2026-09-03").length, 0);
  assert.equal(occurrencesOn(rows, "2026-08-21").length, 0);
});

test("once occurs only on its date; invalid schedules rejected", () => {
  const rows = programItems(cat([{ id: "o", eventSchedule: { type: "once", date: "2026-08-20", timeFrom: "10:00", timeTo: "15:00" } }]));
  assert.equal(occurrencesOn(rows, "2026-08-20").length, 1);
  assert.equal(occurrencesOn(rows, "2026-08-21").length, 0);
  assert.equal(normalizeEventSchedule({ type: "once", date: "2026-08-20", timeFrom: "10:00" }), null, "once requires timeTo");
  assert.equal(normalizeEventSchedule({ type: "weekly", days: [], timeFrom: "10:00", timeTo: "11:00" }), null);
  assert.equal(normalizeEventSchedule({ type: "weekly", days: ["mon"], timeFrom: "11:00", timeTo: "10:00" }), null);
});

test("legacy eventStart: naive = Ljubljana wall time, offset converted, no end/badge", () => {
  assert.deepEqual(parseLegacyEventStart("2026-08-21T20:00:00"), { date: "2026-08-21", time: "20:00" });
  assert.deepEqual(parseLegacyEventStart("2026-08-20T22:30:00Z"), { date: "2026-08-21", time: "00:30" });
  const ev = programEventOf({ eventStart: "2026-08-21T20:00:00" })!;
  assert.equal(ev.kind, "legacy");
  assert.equal(ev.timeTo, null);
  assert.equal(ev.inCamp, undefined);
  assert.equal(formatTimeRange(ev, "sl"), "20.00");
});

test("week is Monday aligned with dots only on days with occurrences", () => {
  const rows = programItems(cat([{ id: "a", eventSchedule: weekly(["thu", "fri", "sat", "sun"]) }]));
  const week = buildWeek(rows, "2026-08-20");
  assert.equal(week[0]!.date, "2026-08-17");
  assert.equal(week[0]!.code, "mon");
  assert.deepEqual(week.map((c) => c.hasEvents), [false, false, false, true, true, true, true]);
  assert.equal(mondayOf("2026-08-23"), "2026-08-17");
  assert.equal(dayCodeOf("2026-08-20"), "thu");
  assert.equal(dayShort2("thu", "sl"), "če");
  assert.equal(weekRangeLabel("2026-08-20", "sl"), "17.–23. avgust");
});

test("recurrence hint: vsak dan and contiguous run, localized", () => {
  assert.equal(recurrenceHint(programEventOf({ eventSchedule: weekly(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) })!, "sl"), "vsak dan");
  assert.equal(recurrenceHint(programEventOf({ eventSchedule: weekly(["thu", "fri", "sat", "sun"]) })!, "sl"), "čet–ned");
  assert.equal(recurrenceHint(programEventOf({ eventSchedule: weekly(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) })!, "de"), "täglich");
  assert.equal(recurrenceHint(programEventOf({ eventSchedule: { type: "once", date: "2026-08-20", timeFrom: "09:00", timeTo: "10:00" } })!, "sl"), null);
});

test("filters and badge use explicit inCamp only (undefined not inferred)", () => {
  const inside = programEventOf({ eventSchedule: weekly(["mon"], { inCamp: true }) })!;
  const outside = programEventOf({ eventSchedule: weekly(["mon"], { inCamp: false }) })!;
  const unknown = programEventOf({ eventSchedule: weekly(["mon"]) })!;
  assert.equal(matchesFilter(inside, "in"), true);
  assert.equal(matchesFilter(outside, "in"), false);
  assert.equal(matchesFilter(unknown, "in"), false);
  assert.equal(matchesFilter(unknown, "out"), false);
  assert.equal(matchesFilter(unknown, "all"), true);
  assert.equal(unknown.inCamp, undefined);
});

test("timezone edge: 00:05 Ljubljana is already the new day", () => {
  // 2026-08-20 00:05 CEST == 2026-08-19 22:05 UTC
  assert.equal(ljubljanaDateKey(new Date("2026-08-19T22:05:00Z")), "2026-08-20");
  assert.equal(programToday(new Date("2026-08-19T22:05:00Z")), "2026-08-20");
  const sections = [{ key: "events", isVisible: true, categories: [cat([
    { id: "e", title: "Early", eventSchedule: { type: "once", date: "2026-08-20", timeFrom: "00:05", timeTo: "01:00" } },
  ])] }];
  assert.equal(selectHomeTodayEntries(sections, new Date("2026-08-19T22:05:00Z")).entries.length, 1);
});

test("localization of labels in 4 languages", () => {
  assert.equal(programLabel("sl", "in"), "V kampu");
  assert.equal(programLabel("en", "out"), "Nearby");
  assert.equal(programLabel("de", "signup"), "Anmeldung per Nachricht");
  assert.equal(programLabel("it", "all"), "Tutti");
});

test("nav + home integration with fixture (weekly today included, legacy still dated)", () => {
  setProgramTodayOverride("2026-08-20");
  try {
    const tenant = programFixtureTenant("sl");
    assert.equal(findDatedEventDestination(tenant.sections)?.category.id, "c-events");
    assert.ok(getLivingGuideAvailableFeatures(tenant.sections).has("program"));
    const ids = selectHomeTodayEntries(tenant.sections).entries.map((e) => e.item.id);
    assert.deepEqual(ids, ["ev-yoga", "ev-kids", "ev-bike", "ev-beer"]);
    const legacyOnly = [{ key: "events", isVisible: true, categories: [cat([{ id: "l", title: "L", eventStart: "2026-08-20T20:00:00" }])] }];
    assert.equal(selectHomeTodayEntries(legacyOnly).entries.length, 1);
  } finally {
    setProgramTodayOverride(null);
  }
});

test("hidden (draft/invisible) items never produce occurrences", () => {
  const rows = programItems(cat([{ id: "h", isVisible: false, eventSchedule: weekly(["thu"]) }]));
  assert.equal(rows.length, 0);
});

test("sign-up note carries title and chosen date", () => {
  const ev = programEventOf({ eventSchedule: weekly(["thu"]) })!;
  const note = signupNote("Jutranja joga", "2026-08-20", ev, "sl");
  assert.match(note, /Jutranja joga/);
  assert.match(note, /20\. avgust 2026/);
  assert.match(note, /9\.00–10\.00/);
});

import { readFileSync } from "node:fs";
import { bottomNavScreen } from "../pages/living-guide/living-guide-nav-resolver";
import { orderPrefillNoteFor } from "../pages/living-guide/living-guide-program-model";

test("direct Program/detail link highlights Program, not Domov", () => {
  const events = { id: "c-events", layout: "events" };
  assert.equal(bottomNavScreen("detail", "home", events, { key: "events" }), "detail");
  assert.equal(bottomNavScreen("detail", "home", { id: "x", layout: "rules" }, { key: "stay" }), "home");
  assert.equal(bottomNavScreen("home", "home", null, null), "home");
});

test("sign-up prefill survives sign-in detour and is keyed to the item", () => {
  const prefill = { itemId: "ev-yoga", note: "Prijava: Jutranja joga — četrtek, 20. avgust 2026" };
  assert.equal(orderPrefillNoteFor(prefill, "ev-yoga"), prefill.note);
  assert.equal(orderPrefillNoteFor(prefill, "other"), "");
  assert.equal(orderPrefillNoteFor(null, "ev-yoga"), "");
  const shell = readFileSync(new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /setPendingOrderItemId\(itemId\)/);
  assert.match(shell, /initialNote=\{orderPrefillNoteFor\(orderPrefill, item\.id\)\}/);
});

test("card shows any age text (not only digits) and program scope uses reference system font", () => {
  const view = readFileSync(new URL("../pages/living-guide/LivingGuideProgram.tsx", import.meta.url), "utf8");
  assert.match(view, /\{event\.ageText && <span className="lgp-rep">\{event\.ageText\}<\/span>\}/);
  const css = readFileSync(new URL("../pages/living-guide/living-guide-program.css", import.meta.url), "utf8");
  assert.match(css, /\.lg2-app \.lgp-root \{ font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; line-height: normal;/);
});

test("week without occurrences yields no dots and empty day; legacy-only category stays a programme", () => {
  const rows = programItems(cat([{ id: "a", eventSchedule: weekly(["mon"], { validTo: "2026-01-31" }) }]));
  assert.ok(buildWeek(rows, "2026-08-20").every((c) => !c.hasEvents));
  assert.equal(occurrencesOn(rows, "2026-08-20").length, 0);
  const legacy = [{ key: "events", isVisible: true, categories: [cat([{ id: "l", title: "L", eventStart: "2025-05-01T18:00:00+02:00" }])] }];
  assert.equal(findDatedEventDestination(legacy)?.category.id, "c");
  assert.equal(programItems(legacy[0]!.categories[0]).length, 1);
});
