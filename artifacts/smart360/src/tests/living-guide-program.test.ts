import { buildSimpleSections } from "../pages/living-guide/simple/simple-tiles";
import { PROGRAM_HOME_LABELS, PROGRAM_ROUTE_ID, houseProgramContext, programHomeLabel } from "../pages/living-guide/living-guide-program-model";
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
  programEntries,
  isProgramCategory,
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

test("host-created default text category inherits its events section and joins legacy Program entries", () => {
  const event = { id: "host-weekly", title: "Weekly Termin", eventSchedule: weekly(["mon"], { timeFrom: "17:00", timeTo: "18:00" }) };
  const newCategory = { id: "host-events-category", key: null, layout: "text", label: "Tedenski dogodki", items: [event] };
  const sections = [
    { key: "explore", categories: [{ id: "legacy-events", key: "events", layout: "events", items: [
      { id: "legacy-daily", eventSchedule: weekly(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) },
    ] }] },
    { key: "events", categories: [newCategory] },
  ];
  const before = structuredClone(sections);
  assert.equal(isProgramCategory(newCategory, sections[1]), true);
  const rows = programEntries(sections);
  assert.deepEqual(rows.map((row) => row.item.id), ["legacy-daily", "host-weekly"]);
  const monday = occurrencesOn(rows, "2026-09-28");
  assert.deepEqual(monday.map((row) => [row.item.id, row.categoryId]), [
    ["legacy-daily", "legacy-events"], ["host-weekly", "host-events-category"],
  ]);
  assert.equal(monday[1]?.event.timeFrom, "17:00");
  assert.equal(monday[1]?.event.timeTo, "18:00");
  assert.deepEqual(occurrencesOn(rows, "2026-10-01").map((row) => row.item.id), ["legacy-daily"]);
  assert.equal(findDatedEventDestination(sections, "2026-10-01")?.category.id, "legacy-events",
    "existing nav route remains canonical, but its Program view includes all categories");
  assert.deepEqual(sections, before, "aggregation never changes published content or its schedule");
});

test("aggregate Programme excludes hidden/deleted categories, sections and entries and unrelated scheduled content", () => {
  const item = (id: string) => ({ id, eventSchedule: weekly(["mon"]) });
  const sections = [
    { key: "events", categories: [
      { id: "visible", layout: "text", items: [item("visible"), { ...item("hidden"), isVisible: false }, { ...item("deleted"), deletedAt: "2026-01-01" }] },
      { id: "hidden-category", isVisible: false, items: [item("hidden-category-item")] },
      { id: "deleted-category", deletedAt: "2026-01-01", items: [item("deleted-category-item")] },
    ] },
    { key: "events", isVisible: false, categories: [cat([item("hidden-section-item")])] },
    { key: "events", deletedAt: "2026-01-01", categories: [cat([item("deleted-section-item")])] },
    { key: "stay", categories: [{ id: "ordinary-text", layout: "text", items: [item("not-programme")] }] },
  ];
  assert.deepEqual(programEntries(sections).map((row) => row.item.id), ["visible"]);
});

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
    // Programme moved to the Domov entry; never a bottom-nav feature.
    assert.ok(!getLivingGuideAvailableFeatures(tenant.sections).has("program"));
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
import { orderPrefillNoteFor, restrictiveAgeHint } from "../pages/living-guide/living-guide-program-model";
import { resolveLivingGuideNav } from "../pages/living-guide/living-guide-nav-resolver";

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

test("cards show restrictions only; detail retains original age text", () => {
  for (const value of [null, "", "Za vse", " za vse ", "All ages", "For everyone", "Für alle", "Alle Altersgruppen", "Per tutti", "Tutte le età", "Dobrodošli"]) {
    assert.equal(restrictiveAgeHint(value), null);
  }
  for (const value of ["18+", "6–12 let", "Za odrasle", "Adults only", "Nur Erwachsene", "Solo adulti"]) {
    assert.equal(restrictiveAgeHint(value), value);
  }
  const view = readFileSync(new URL("../pages/living-guide/LivingGuideProgram.tsx", import.meta.url), "utf8");
  assert.match(view, /restrictiveAgeHint\(event.ageText\) && <span/);
  assert.match(view, /event.ageText && <div className="lgp-mrow">/);
  const css = readFileSync(new URL("../pages/living-guide/living-guide-program.css", import.meta.url), "utf8");
  assert.match(css, /\.lg2-app \.lgp-root \{ font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; line-height: normal;/);
});

test("week without occurrences yields no dots and empty day; legacy-only category stays a programme", () => {
  const rows = programItems(cat([{ id: "a", eventSchedule: weekly(["mon"], { validTo: "2026-01-31" }) }]));
  assert.ok(buildWeek(rows, "2026-08-20").every((c) => !c.hasEvents));
  assert.equal(occurrencesOn(rows, "2026-08-20").length, 0);
  const legacy = [{ key: "events", isVisible: true, categories: [cat([{ id: "l", title: "L", eventStart: "2025-05-01T18:00:00+02:00" }])] }];
  assert.equal(findDatedEventDestination(legacy), null);
  assert.equal(programItems(legacy[0]!.categories[0]).length, 1);
});

test("House programme entry requires a visible upcoming occurrence; never in bottom nav", () => {
  setProgramTodayOverride("2026-08-20");
  try {
    const nav = (sections: any[]) => resolveLivingGuideNav(["home", "stay", "explore", "program", "messages"], getLivingGuideAvailableFeatures(sections), false).resolved;
    const has = (sections: any[]) => findDatedEventDestination(sections) !== null;
    const sections = (items: any[]) => [{ key: "events", categories: [cat(items)] }];
    assert.equal(has([]), false);
    assert.equal(has(sections([])), false);
    assert.equal(has(sections([{ eventStart: "2025-01-01T10:00:00" }])), false);
    assert.equal(has(sections([{ eventSchedule: weekly(["mon"], { validTo: "2026-08-19" }) }])), false);
    assert.equal(has(sections([{ isVisible: false, eventSchedule: weekly(["mon"]) }])), false);
    assert.equal(has(sections([{ deletedAt: "2026-08-19", eventSchedule: weekly(["mon"]) }])), false);
    assert.equal(has([{ ...sections([])[0], isVisible: false, categories: [cat([{ eventSchedule: weekly(["mon"]) }])] }]), false);
    assert.equal(has(sections([{ eventSchedule: weekly(["mon"]) }])), true);
    assert.equal(has(sections([{ eventSchedule: weekly(["mon"], { validFrom: "2029-01-01" }) }])), true);
    assert.equal(has(sections([{ eventStart: "2026-09-01T10:00:00" }])), true);
    assert.ok(!nav(sections([{ eventSchedule: weekly(["mon"]) }])).includes("program"));
  } finally { setProgramTodayOverride(null); }
});

test("House programme: 7 exact labels, Domov tile, visibility toggle, Okolica events untouched", () => {
  assert.deepEqual(PROGRAM_HOME_LABELS, { sl: "Hišni program", en: "Our programme", de: "Unser Programm", it: "Il nostro programma", fr: "Notre programme", nl: "Ons programma", hr: "Naš program" });
  const sections = [{ key: "explore", categories: [{ id: "loc-ev", key: "events", layout: "events", label: "Dogodki", items: [{ id: "x", title: "Flosarski bal" }] }] }];
  const rt = { hasWeather: false, hasContact: false, installAvailable: false, hasOrderable: false, recordingEnabled: false, mapHref: null };
  const homeTiles = (extra: any, lang = "sl") => buildSimpleSections(sections, lang, { ...rt, ...extra }).find((s) => s.key === "home")?.tiles ?? [];
  assert.ok(!homeTiles({ hasProgram: false }).some((t) => t.id === "program"));
  const tile = homeTiles({ hasProgram: true }).find((t) => t.id === "program")!;
  assert.equal(tile.label, "Hišni program");
  assert.equal(tile.icon, "calendar");
  assert.deepEqual(tile.action, { kind: "program" });
  assert.equal(homeTiles({ hasProgram: true }, "hr").find((t) => t.id === "program")?.label, "Naš program");
  assert.ok(!homeTiles({ hasProgram: true, systemTileVisibility: { program: false } }).some((t) => t.id === "program"));
  assert.ok(homeTiles({ hasProgram: true, systemTileVisibility: { weather: false } }).some((t) => t.id === "program"));
  const explore = buildSimpleSections(sections, "sl", { ...rt, hasProgram: true }).find((s) => s.key === "explore")!;
  assert.deepEqual(explore.tiles.map((t) => [t.label, t.action]), [["Dogodki", { kind: "category", categoryId: "loc-ev" }]]);
  const ctx = houseProgramContext("en");
  assert.equal(ctx.category.id, PROGRAM_ROUTE_ID);
  assert.equal(isProgramCategory(ctx.category, ctx.section), true);
  assert.equal(programHomeLabel("xx"), "Hišni program");
  assert.equal(bottomNavScreen("detail", "home", ctx.category, ctx.section), "home");
});
