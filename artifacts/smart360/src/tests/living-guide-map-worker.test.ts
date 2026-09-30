import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createControlledMapWorkerUrl } from "../pages/living-guide/living-guide-map-worker";

test("controlled-window worker fetch becomes one reusable self-contained Blob bootstrap", async () => {
  const calls: Array<[unknown, unknown]> = [];
  const blobs: Blob[] = [];
  const getUrl = createControlledMapWorkerUrl(
    (async (url: unknown, options: unknown) => {
      calls.push([url, options]);
      return new Response("self.onmessage = () => {}; /* bundled worker */");
    }) as typeof fetch,
    (blob) => { blobs.push(blob); return "blob:local-worker"; },
  );
  const first = getUrl("/assets/maplibre-gl-worker-test.js");
  const second = getUrl("/assets/maplibre-gl-worker-test.js");
  assert.equal(first, second);
  assert.equal(await first, "blob:local-worker");
  assert.equal(await getUrl("/assets/maplibre-gl-worker-test.js"), "blob:local-worker");
  assert.deepEqual(calls, [["/assets/maplibre-gl-worker-test.js", { credentials: "same-origin" }]]);
  assert.equal(blobs.length, 1);
  assert.equal(blobs[0].type, "text/javascript");
  assert.match(await blobs[0].text(), /bundled worker/);
});

test("failed worker fetch is explicit and permits a later mount retry", async () => {
  let requests = 0;
  const getUrl = createControlledMapWorkerUrl(
    (async () => ++requests === 1 ? new Response(null, { status: 503 }) : new Response("worker code")) as typeof fetch,
    () => "blob:retry-worker",
  );
  await assert.rejects(getUrl("/assets/worker.js"), /503/);
  assert.equal(await getUrl("/assets/worker.js"), "blob:retry-worker");
  assert.equal(requests, 2);
});

test("Living Guide awaits page fetch before constructing Map; canceled mounts and legacy stay safe", () => {
  const source = readFileSync(new URL("../pages/living-guide/living-guide-gpx.tsx", import.meta.url), "utf8");
  const start = source.indexOf("const workerUrl = allowOfflineStyle");
  const construct = source.indexOf("const map = new Map(", start);
  const setup = source.slice(start, construct);
  assert.match(setup, /await controlledMapWorkerUrl\(mapWorkerUrl\)/);
  assert.match(setup, /: mapWorkerUrl/);
  assert.match(setup, /if \(disposed\) return/);
  assert.match(setup, /setWorkerUrl\(workerUrl\)/);
  const helper = readFileSync(new URL("../pages/living-guide/living-guide-map-worker.ts", import.meta.url), "utf8");
  assert.doesNotMatch(helper, /revokeObjectURL|globalThis|window\./);
});