import assert from "node:assert/strict";
import test from "node:test";

const hoursModulePath = "../../../smart360/src/lib/hours.ts";
const { getOpenStatus } = await import(hoursModulePath);

function week(...ranges: Array<[number, number] | null>): string {
  return JSON.stringify(ranges);
}

test("reports a later opening on the same day", () => {
  const status = getOpenStatus(
    week([600, 1200], null, null, null, null, null, null),
    new Date(2026, 7, 17, 9, 15),
  );
  assert.deepEqual(status, {
    isOpen: false,
    closesAt: null,
    opensAt: "10:00",
  });
});

test("reports the next day's first opening", () => {
  const status = getOpenStatus(
    week([600, 720], [540, 1020], null, null, null, null, null),
    new Date(2026, 7, 17, 13, 0),
  );
  assert.deepEqual(status, {
    isOpen: false,
    closesAt: null,
    opensAt: "09:00",
  });
});

test("keeps a previous-day overnight range open", () => {
  const status = getOpenStatus(
    week([1380, 120], null, null, null, null, null, null),
    new Date(2026, 7, 18, 1, 30),
  );
  assert.deepEqual(status, {
    isOpen: true,
    closesAt: "02:00",
    opensAt: null,
  });
});

test("treats the exact overnight close as closed", () => {
  const status = getOpenStatus(
    week([1380, 120], null, null, null, null, null, null),
    new Date(2026, 7, 18, 2, 0),
  );
  assert.deepEqual(status, {
    isOpen: false,
    closesAt: null,
    opensAt: "23:00",
  });
});

test("wraps from Sunday to Monday", () => {
  const status = getOpenStatus(
    week([480, 960], null, null, null, null, null, null),
    new Date(2026, 7, 23, 18, 0),
  );
  assert.deepEqual(status, {
    isOpen: false,
    closesAt: null,
    opensAt: "08:00",
  });
});

test("returns no next opening when every day is closed", () => {
  const status = getOpenStatus(
    week(null, null, null, null, null, null, null),
    new Date(2026, 7, 17, 9, 0),
  );
  assert.deepEqual(status, {
    isOpen: false,
    closesAt: null,
    opensAt: null,
  });
});

test("rejects missing or malformed weekly data", () => {
  assert.equal(getOpenStatus(null), null);
  assert.equal(getOpenStatus("not json"), null);
  assert.equal(getOpenStatus(JSON.stringify([[480, 960]])), null);
});