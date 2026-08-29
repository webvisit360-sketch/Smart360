import assert from "node:assert/strict";
import test from "node:test";
import { withAbortTimeout } from "../lib/passkey-timeout";

test("passkey watchdog aborts a ceremony that never settles", async () => {
  const controller = new AbortController();
  const never = new Promise<never>(() => {});

  await assert.rejects(
    withAbortTimeout(never, controller, 5),
    (error: unknown) => error instanceof DOMException && error.name === "TimeoutError",
  );
  assert.equal(controller.signal.aborted, true);
});

test("passkey watchdog preserves a result that completes before the deadline", async () => {
  const controller = new AbortController();
  const result = await withAbortTimeout(Promise.resolve("ok"), controller, 1_000);

  assert.equal(result, "ok");
  assert.equal(controller.signal.aborted, false);
});

test("manual abort immediately releases a ceremony that never settles", async () => {
  const controller = new AbortController();
  const never = new Promise<never>(() => {});
  const result = withAbortTimeout(never, controller, 60_000);

  controller.abort(new DOMException("Passkey login was cancelled", "AbortError"));

  await assert.rejects(
    result,
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});