import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export const TRIESTE_ITEM_UPDATE = sql`
  UPDATE "items"
  SET "distance_meters" = 30398.2
  WHERE "id" = '4e13555e-eaf4-471a-a5e8-061d90589b83'
    AND "title" = 'Trst'
    AND "map_query" = 'Trieste, Piazza dell''Unità d''Italia'
    AND "distance_meters" = 57375
`;

export const TRIESTE_PROPOSAL_UPDATE = sql`
  UPDATE "item_distance_proposals"
  SET
    "status" = 'approved',
    "source" = 'geocoded',
    "confidence" = 'low',
    "latitude" = 45.6501002,
    "longitude" = 13.7677033,
    "distance_meters" = 30398.2,
    "duration_minutes" = 39.001666666666665,
    "resolved_address" =
      'Piazza Unità d''Italia, Cavana, San Vito, Città Nuova-Barriera Nuova-San Vito-Città Vecchia, Trieste, Friuli-Venezia Giulia, Italia',
    "geocode_query" = 'Piazza dell''Unità d''Italia, Trieste, Italy',
    "input_fingerprint" =
      '00b4dcd8e3ae27176f52db4e48ebfdfbeb3e2a92d3fbbafca3237df8059c3d76',
    "error" = NULL,
    "updated_at" = now()
  WHERE "id" = 'c57e4ab1-bfde-4534-a0a6-44094024e7b3'
    AND "item_id" = '4e13555e-eaf4-471a-a5e8-061d90589b83'
    AND "status" = 'approved'
    AND "distance_meters" = 57375
`;

type CorrectionCounts = { itemRows: number; proposalRows: number };
type CorrectionTx = {
  execute: (statement: typeof TRIESTE_ITEM_UPDATE) => Promise<{ rowCount?: number | null }>;
};
type TransactionExecutor = (
  work: (tx: CorrectionTx) => Promise<CorrectionCounts>,
) => Promise<CorrectionCounts>;
type CorrectionLogger = Pick<typeof logger, "info" | "warn" | "fatal">;

export async function executeTriesteDistanceCorrection(
  transaction: TransactionExecutor,
  log: CorrectionLogger,
): Promise<CorrectionCounts> {
  return transaction(async (tx) => {
    const itemResult = await tx.execute(TRIESTE_ITEM_UPDATE);
    const proposalResult = await tx.execute(TRIESTE_PROPOSAL_UPDATE);
    const itemRows = itemResult.rowCount ?? 0;
    const proposalRows = proposalResult.rowCount ?? 0;
    log.info(
      { itemRows, proposalRows },
      "[triesteDistanceCorrection] approved statements completed",
    );
    if (itemRows === 0 && proposalRows === 0) return { itemRows, proposalRows };
    if (itemRows !== 1 || proposalRows !== 1) {
      throw new Error(`Expected one item and one proposal row, got ${itemRows} and ${proposalRows}`);
    }
    return { itemRows, proposalRows };
  });
}

/**
 * One-deploy production data correction approved by the owner on 2026-08-28.
 *
 * Remove this file and its startup hook in the next deploy after production
 * verification. It must never prevent the application from starting.
 */
export async function runTriesteDistanceCorrectionAtStartup(
  options: {
    nodeEnv?: string;
    transaction?: TransactionExecutor;
    log?: CorrectionLogger;
  } = {},
): Promise<void> {
  if ((options.nodeEnv ?? process.env["NODE_ENV"]) !== "production") return;
  const log = options.log ?? logger;
  const transaction = options.transaction ?? ((work) => db.transaction(work));

  try {
    const counts = await executeTriesteDistanceCorrection(transaction, log);

    if (counts.itemRows === 0 && counts.proposalRows === 0) {
      log.warn(
        counts,
        "[triesteDistanceCorrection] no rows changed; patch was already applied or guards did not match",
      );
    }
  } catch (err) {
    log.fatal(
      { err },
      "[triesteDistanceCorrection] production correction failed; startup continues",
    );
  }
}