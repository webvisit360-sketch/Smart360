import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { renderGuestServiceWorker } from "../lib/guestServiceWorker";

function harness(version: string) {
  const handlers = new Map<string, (event: any) => void>();
  const script = renderGuestServiceWorker("alpine-lodge", version);
  runInNewContext(script, {
    self: {
      location: { origin: "https://example.test" },
      addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler),
      skipWaiting: () => {},
      clients: { claim: () => Promise.resolve() },
    },
    URL,
    fetch: (request: unknown) => ({ network: request }),
  });
  return { script, handlers };
}

test("only same-origin tenant document navigations pass through the worker", () => {
  const fetchHandler = harness("v1").handlers.get("fetch")!;
  const cases: [string, string, boolean][] = [
    ["/alpine-lodge/", "navigate", true],
    ["/alpine-lodge/home", "navigate", true],
    ["/alpine-lodge/c/abc", "navigate", true],
    ["/alpine-lodge", "navigate", false],
    ["/alpine-lodge-other/", "navigate", false],
    ["/admin/", "navigate", false],
    ["/portal/povabilo", "navigate", false],
    ["/alpine-lodge/admin/", "navigate", false],
    ["/old-slug/", "navigate", false], // historical 301 alias
    ["/api/public/tenants/alpine-lodge", "navigate", false],
    ["/api/public/tenants/alpine-lodge/manifest.webmanifest", "navigate", false],
    ["/alpine-lodge/route.gpx", "navigate", false],
    ["/alpine-lodge/photo.jpg", "navigate", false],
    ["/alpine-lodge/", "cors", false],
  ];
  for (const [path, mode, expected] of cases) {
    let handled = false;
    fetchHandler({
      request: { url: `https://example.test${path}`, method: "GET", mode },
      respondWith: (response: { network: { url: string } }) => {
        handled = true;
        assert.equal(response.network.url, `https://example.test${path}`);
      },
    });
    assert.equal(handled, expected, `${path} (${mode})`);
  }
  let externalHandled = false;
  fetchHandler({ request: { url: "https://external.test/alpine-lodge/", mode: "navigate", method: "GET" }, respondWith: () => { externalHandled = true; } });
  assert.equal(externalHandled, false);
});

test("new script revision changes bytes; fetch remains network-only across updates", () => {
  const first = harness("v1");
  const next = harness("v2");
  assert.notEqual(first.script, next.script);
  for (const worker of [first, next]) {
    let installed = false;
    worker.handlers.get("install")!({});
    worker.handlers.get("activate")!({ waitUntil: (promise: Promise<unknown>) => {
      installed = true;
      assert.ok(promise instanceof Promise);
    } });
    assert.ok(installed);
    assert.ok(!worker.script.includes("caches.open"));
    assert.ok(!worker.script.includes("CacheStorage"));
  }
});