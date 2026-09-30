import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scheduleDraft, scheduleFromDraft, validateSchedule } from "../components/admin/event-schedule-editor";

test("a new event cannot save without a date, start, and end", () => {
  const draft = scheduleDraft();
  assert.match(validateSchedule(draft) ?? "", /datum/);
  draft.date = "2026-06-15";
  assert.match(validateSchedule(draft) ?? "", /začetek in konec/);
  draft.timeFrom = "09:00";
  draft.timeTo = "10:00";
  assert.equal(validateSchedule(draft), null);
  assert.deepEqual(scheduleFromDraft(draft), {
    type: "once", date: "2026-06-15", timeFrom: "09:00", timeTo: "10:00",
  });
});

test("legacy timestamp prepopulates Ljubljana date and start but does not invent an end or save on opening", () => {
  const local = scheduleDraft(null, "2026-06-15T09:30:00");
  assert.equal(local.date, "2026-06-15");
  assert.equal(local.timeFrom, "09:30");
  assert.equal(local.timeTo, "");
  assert.notEqual(validateSchedule(local), null);
  const utc = scheduleDraft(null, "2026-06-14T22:05:00Z");
  assert.equal(utc.date, "2026-06-15");
  assert.equal(utc.timeFrom, "00:05");
  const malformed = scheduleDraft(null, "not-a-date");
  assert.match(validateSchedule(malformed) ?? "", /datum/);
});

test("editing a weekly schedule preserves the current values and submits only weekly fields", () => {
  const existing = {
    type: "weekly" as const, days: ["thu", "sun"] as const,
    timeFrom: "09:00", timeTo: "10:00",
    validFrom: "2026-06-01", validTo: "2026-09-30",
    locationText: "Healthy Corner", ageText: "18+", inCamp: false,
  };
  const draft = scheduleDraft({ ...existing, days: [...existing.days] });
  assert.equal(validateSchedule(draft), null);
  assert.deepEqual(scheduleFromDraft(draft), existing);
  draft.days = [];
  assert.match(validateSchedule(draft) ?? "", /vsaj en dan/);
  draft.days = ["mon"];
  draft.validTo = "2026-05-01";
  assert.match(validateSchedule(draft) ?? "", /sezone/);
  draft.validTo = "";
  draft.type = "once";
  draft.date = "2026-07-07";
  assert.equal(validateSchedule(draft), null);
  assert.deepEqual(scheduleFromDraft(draft), {
    type: "once", date: "2026-07-07", timeFrom: "09:00", timeTo: "10:00",
    locationText: "Healthy Corner", ageText: "18+", inCamp: false,
  });
});

test("times are same-day and extras can stay unspecified", () => {
  const draft = scheduleDraft();
  draft.date = "2026-02-30";
  draft.timeFrom = "23:30";
  draft.timeTo = "00:05";
  assert.match(validateSchedule(draft) ?? "", /datum/);
  draft.date = "2026-02-28";
  assert.match(validateSchedule(draft) ?? "", /Konec dogodka/);
  draft.timeTo = "23:30";
  assert.match(validateSchedule(draft) ?? "", /Konec dogodka/);
  draft.timeTo = "23:40";
  assert.equal(validateSchedule(draft), null);
  assert.equal("inCamp" in scheduleFromDraft(draft), false);
});

test("editor keeps opening read-only, retains eventStart and uses the ordinary draft/write flow", () => {
  const editor = readFileSync(new URL("../components/admin/content-editor.tsx", import.meta.url), "utf8");
  assert.match(editor, /sectionKey === "events" \|\| category\?\.key === "events" \|\| category\?\.layout === "events" \|\| item\?\.eventSchedule != null/);
  assert.match(editor, /sectionKey=\{section\.key\}/);
  assert.match(editor, /sectionKey=\{sectionKey\}/);
  assert.match(editor, /useState\(\(\) => scheduleDraft\(item\?\.eventSchedule, item\?\.eventStart\)\)/);
  assert.match(editor, /eventScheduleDraft: scheduleDraft\(item\?\.eventSchedule, item\?\.eventStart\)/);
  assert.match(editor, /if \(editingSchedule\) \{\s*const error = validateSchedule\(eventScheduleDraft\)/);
  assert.match(editor, /eventSchedule: scheduleFromDraft\(eventScheduleDraft\)/);
  // Saving a schedule sends no legacy eventStart field, so the old timestamp stays readable.
  assert.match(editor, /\? \{ eventSchedule: scheduleFromDraft\(eventScheduleDraft\) \}\s*: \{ eventStart: toEventStartIso\(eventStart\) \}/);
  assert.doesNotMatch(editor, /useEffect\(\(\) => \{\s*updateItem\(/);
});

test("isolated fixture mounts production editor, validates in memory and never calls admin writes", () => {
  const fixture = readFileSync(new URL("./fixtures/event-schedule.tsx", import.meta.url), "utf8");
  const html = readFileSync(new URL("./fixtures/event-schedule.html", import.meta.url), "utf8");
  assert.match(html, /src="\.\/event-schedule\.tsx"/);
  assert.match(fixture, /from "\.\.\/\.\.\/components\/admin\/event-schedule-editor"/);
  assert.match(fixture, /<EventScheduleEditor draft=\{draft\} onChange=\{setDraft\} error=\{error\}/);
  assert.match(fixture, /const message = validateSchedule\(draft\)/);
  assert.match(fixture, /setSaved\(\{ eventSchedule: scheduleFromDraft\(draft\) \}\)/);
  assert.doesNotMatch(fixture, /\b(?:fetch|updateItem|createItem|localStorage)\s*\(/);
});