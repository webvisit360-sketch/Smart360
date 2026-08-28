import assert from "node:assert/strict";
import test from "node:test";
import {
  executeTriesteDistanceCorrection,
  runTriesteDistanceCorrectionAtStartup,
  TRIESTE_ITEM_UPDATE,
  TRIESTE_PROPOSAL_UPDATE,
} from "../lib/triesteDistanceCorrection";

const quietLog = {
  info() {},
  warn() {},
  fatal() {},
} as never;

function transactionWithCounts(counts: [number, number], calls: unknown[]) {
  return async (work: (tx: { execute: (statement: typeof TRIESTE_ITEM_UPDATE) => Promise<{ rowCount: number }> }) => Promise<{ itemRows: number; proposalRows: number }>) =>
    work({
      async execute(statement) {
        calls.push(statement);
        return { rowCount: counts[calls.length - 1] ?? 0 };
      },
    });
}

test("Trieste correction executes exactly the two approved statements in one transaction", async () => {
  const calls: unknown[] = [];
  const counts = await executeTriesteDistanceCorrection(transactionWithCounts([1, 1], calls), quietLog);
  assert.deepEqual(counts, { itemRows: 1, proposalRows: 1 });
  assert.deepEqual(calls, [TRIESTE_ITEM_UPDATE, TRIESTE_PROPOSAL_UPDATE]);
});

test("Trieste correction is production-only and 0/0 is a no-op", async () => {
  let transactions = 0;
  await runTriesteDistanceCorrectionAtStartup({
    nodeEnv: "test",
    transaction: async () => {
      transactions += 1;
      return { itemRows: 1, proposalRows: 1 };
    },
    log: quietLog,
  });
  assert.equal(transactions, 0);

  const calls: unknown[] = [];
  await runTriesteDistanceCorrectionAtStartup({
    nodeEnv: "production",
    transaction: transactionWithCounts([0, 0], calls),
    log: quietLog,
  });
  assert.deepEqual(calls, [TRIESTE_ITEM_UPDATE, TRIESTE_PROPOSAL_UPDATE]);
});

test("mixed Trieste correction counts roll back and startup continues", async () => {
  let rolledBack = false;
  let fatalLogs = 0;
  const calls: unknown[] = [];
  const transaction = async (work: Parameters<ReturnType<typeof transactionWithCounts>>[0]) => {
    try {
      return await transactionWithCounts([1, 0], calls)(work);
    } catch (error) {
      rolledBack = true;
      throw error;
    }
  };

  await assert.doesNotReject(() => runTriesteDistanceCorrectionAtStartup({
    nodeEnv: "production",
    transaction,
    log: {
      info() {},
      warn() {},
      fatal() { fatalLogs += 1; },
    } as never,
  }));
  assert.equal(rolledBack, true);
  assert.equal(fatalLogs, 1);
  assert.deepEqual(calls, [TRIESTE_ITEM_UPDATE, TRIESTE_PROPOSAL_UPDATE]);
});