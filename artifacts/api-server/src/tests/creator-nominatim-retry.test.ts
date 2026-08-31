import assert from "node:assert/strict";
import test from "node:test";
import { createPacedNominatimFetch } from "../lib/creatorNominatimRetry";

test("paced Nominatim fetch backs off and retries a 429", async () => {
  let calls = 0;
  const waits: number[] = [];
  const client = createPacedNominatimFetch({
    minimumIntervalMs: 0,
    maxAttempts: 2,
    sleepFn: async (milliseconds) => { waits.push(milliseconds); },
    fetchFn: (async () => {
      calls++;
      return calls === 1
        ? new Response("busy", { status: 429, headers: { "retry-after": "0" } })
        : Response.json([]);
    }) as typeof fetch,
  });

  const response = await client.fetchFn(new URL("https://nominatim.openstreetmap.org/search"));
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.deepEqual(waits, [0]);
  assert.equal(client.isStopped(), false);
});

test("paced Nominatim fetch stops after repeated timeouts", async () => {
  let calls = 0;
  const waits: number[] = [];
  const client = createPacedNominatimFetch({
    minimumIntervalMs: 0,
    maxAttempts: 2,
    sleepFn: async (milliseconds) => { waits.push(milliseconds); },
    fetchFn: (async () => {
      calls++;
      throw new DOMException("timed out", "AbortError");
    }) as typeof fetch,
  });

  await assert.rejects(
    client.fetchFn(new URL("https://nominatim.openstreetmap.org/search")),
    /timed out/,
  );
  assert.equal(calls, 2);
  assert.deepEqual(waits, [2_000]);
  assert.equal(client.isStopped(), true);
  assert.match(client.stopReason() ?? "", /remained unavailable/);
});