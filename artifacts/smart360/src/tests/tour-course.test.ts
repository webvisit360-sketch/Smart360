import { test } from "node:test";
import { strict as assert } from "node:assert";
import { courseIdentity, nextCourseBearing, sessionCourseMode, shortestBearing } from "../lib/tour-course";

test("shortest turn unwraps north rather than rotating 340 degrees", () => {
  assert.equal(shortestBearing(350, 10), 370);
  assert.equal(shortestBearing(10, 350), -10);
  assert.equal(shortestBearing(-10, 10), 10);
});
test("only valid moving fast GPS course changes bearing", () => {
  assert.equal(nextCourseBearing(17, 360, 2, true, "course"), 0);
  for (const heading of [null, undefined, NaN, Infinity, -1, 361]) {
    assert.equal(nextCourseBearing(17, heading, 4, true, "course"), 17);
  }
  for (const speed of [null, undefined, NaN, Infinity, 0, 1]) {
    assert.equal(nextCourseBearing(17, 25, speed, true, "course"), 17);
  }
  assert.equal(nextCourseBearing(17, 25, 4, false, "course"), 17); // manual or auto pause
  assert.equal(nextCourseBearing(17, 25, 4, true, "north"), 17);
});
test("session preference resets only for a new tour or inactivity", () => {
  const a = courseIdentity("route/a", 100, true);
  assert.equal(sessionCourseMode(a, null, "north"), "course");
  assert.equal(sessionCourseMode(a, a, "north"), "north");
  assert.equal(sessionCourseMode(courseIdentity("route/a", 101, true), a, "north"), "course");
  assert.equal(sessionCourseMode(courseIdentity("route/b", 100, true), a, "north"), "course");
  assert.equal(sessionCourseMode(courseIdentity("route/a", 100, false), a, "north"), "north");
});