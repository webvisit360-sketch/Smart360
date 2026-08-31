import assert from "node:assert/strict";
import test from "node:test";
import { computeHostResponseStats } from "../lib/hostResponseStats";

function message(threadId: string, sender: "guest" | "host", minute: number) {
  return {
    threadId,
    sender,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, minute)),
  };
}

test("response time stays hidden before five real answered exchanges", () => {
  const rows = [
    message("a", "guest", 0), message("a", "host", 10),
    message("a", "guest", 20), message("a", "host", 40),
    message("b", "guest", 0), message("b", "host", 30),
    message("b", "guest", 40), message("b", "host", 80),
  ];
  assert.deepEqual(computeHostResponseStats(rows), {
    answeredCount: 4,
    medianMinutes: null,
  });
});

test("one host reply answers one pending guest exchange and median rounds up", () => {
  const rows = [
    message("a", "guest", 0), message("a", "guest", 1), message("a", "host", 10),
    message("a", "guest", 20), message("a", "host", 40),
    message("b", "guest", 0), message("b", "host", 31),
    message("b", "guest", 40), message("b", "host", 80),
    message("c", "host", 0), message("c", "guest", 1), message("c", "host", 52),
  ];
  assert.deepEqual(computeHostResponseStats(rows), {
    answeredCount: 5,
    medianMinutes: 31,
  });
});