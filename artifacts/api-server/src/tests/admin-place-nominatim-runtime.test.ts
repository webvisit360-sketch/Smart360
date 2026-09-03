import assert from "node:assert/strict";
import test from "node:test";
import { fetchAdminPlaceNominatim } from "../lib/adminPlaceCreation";

test("Nominatim requests reject redirects instead of following a different host", async () => {
  await assert.rejects(
    fetchAdminPlaceNominatim("/search", { q: "Logarska dolina", limit: "1" }, {
      throttle: false,
      fetchFn: async (url, init) => {
        const value = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
        assert.equal(new URL(value).host, "nominatim.openstreetmap.org");
        assert.equal(init?.redirect, "error");
        throw new TypeError("redirect rejected");
      },
    }),
    /redirect rejected/,
  );
});

test("Nominatim streamed response is capped before JSON parsing", async () => {
  const oversized = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(256_001));
      controller.close();
    },
  });
  await assert.rejects(
    fetchAdminPlaceNominatim("/search", { q: "Logarska dolina", limit: "1" }, {
      throttle: false,
      fetchFn: async () => new Response(oversized, { status: 200 }),
    }),
    /prevelik odgovor/,
  );
});

test("Nominatim fetch receives an abort signal and waits for the existing throttle turn", async () => {
  let acquired = false;
  await assert.rejects(
    fetchAdminPlaceNominatim("/search", { q: "Logarska dolina", limit: "1" }, {
      timeoutMs: 5,
      acquireTurn: async () => { acquired = true; return 0; },
      fetchFn: async (_url, init) => {
        assert.equal(acquired, true, "the DB throttle turn is acquired before fetch");
        await new Promise<void>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
        throw new Error("unreachable");
      },
    }),
    /aborted/,
  );
});