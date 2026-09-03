import assert from "node:assert/strict";
import test from "node:test";
import {
  executeGrilOriginCorrection,
  GRIL_ORIGIN_UPDATE,
  runGrilOriginCorrectionAtStartup,
} from "../lib/grilOriginCorrection";

const quietLog = {
  info() {},
  warn() {},
  fatal() {},
} as never;

test("Gril correction executes exactly the guarded approved statement", async () => {
  const calls: unknown[] = [];
  const changedRows = await executeGrilOriginCorrection(
    async (statement) => {
      calls.push(statement);
      return { rowCount: 1 };
    },
    quietLog,
  );

  assert.equal(changedRows, 1);
  assert.deepEqual(calls, [GRIL_ORIGIN_UPDATE]);
});

test("Gril correction is production-only and an already-fixed row is a no-op", async () => {
  let calls = 0;
  await runGrilOriginCorrectionAtStartup({
    nodeEnv: "test",
    execute: async () => {
      calls += 1;
      return { rowCount: 1 };
    },
    log: quietLog,
  });
  assert.equal(calls, 0);

  await runGrilOriginCorrectionAtStartup({
    nodeEnv: "production",
    execute: async (statement) => {
      calls += 1;
      assert.equal(statement, GRIL_ORIGIN_UPDATE);
      return { rowCount: 0 };
    },
    log: quietLog,
  });
  assert.equal(calls, 1);
});

test("Gril correction failure cannot block API startup", async () => {
  let fatalLogs = 0;
  await assert.doesNotReject(() =>
    runGrilOriginCorrectionAtStartup({
      nodeEnv: "production",
      execute: async () => {
        throw new Error("guarded update failed");
      },
      log: {
        info() {},
        warn() {},
        fatal() {
          fatalLogs += 1;
        },
      } as never,
    }),
  );
  assert.equal(fatalLogs, 1);
});