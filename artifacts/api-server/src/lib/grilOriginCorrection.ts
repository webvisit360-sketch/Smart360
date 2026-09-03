import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Owner-approved restoration of the confirmed Gril Creator origin.
 *
 * This only matches the published Gril row in the exact damaged state and
 * requires a completed historical Creator run at the confirmed coordinates.
 */
export const GRIL_ORIGIN_UPDATE = sql`
  UPDATE "tenants" AS t
  SET
    "latitude" = 46.3536005,
    "longitude" = 14.8509723
  WHERE t."id" = '177e633a-6030-4eca-8ce8-e0a0afdff599'
    AND t."slug" = 'glamping-gril'
    AND t."address" = 'Ter 35, Ljubno, 3333, Slovenija'
    AND t."creator_draft" IS TRUE
    AND t."creator_origin_region" = 'Ter, Ljubno, 3333, Slovenija'
    AND t."municipality" = 'Ljubno ob Savinji'
    AND t."is_published" IS TRUE
    AND t."map_url" IS NULL
    AND t."latitude" IS NULL
    AND t."longitude" IS NULL
    AND EXISTS (
      SELECT 1
      FROM "creator_runs" AS r
      WHERE r."tenant_id" = t."id"
        AND r."status" = 'completed'
        AND r."origin_latitude" = 46.3536005
        AND r."origin_longitude" = 14.8509723
    )
`;

type CorrectionExecutor = (
  statement: typeof GRIL_ORIGIN_UPDATE,
) => Promise<{ rowCount?: number | null }>;
type CorrectionLogger = Pick<typeof logger, "info" | "warn" | "fatal">;

export async function executeGrilOriginCorrection(
  execute: CorrectionExecutor,
  log: CorrectionLogger,
): Promise<number> {
  const result = await execute(GRIL_ORIGIN_UPDATE);
  const changedRows = result.rowCount ?? 0;
  if (changedRows > 1) {
    throw new Error(`Expected at most one Gril tenant row, got ${changedRows}`);
  }
  log.info(
    { changedRows },
    "[grilOriginCorrection] guarded origin restoration completed",
  );
  return changedRows;
}

/**
 * One-deploy, production-only correction. Remove this hook and file after the
 * production row has been verified. A mismatch never blocks API startup.
 */
export async function runGrilOriginCorrectionAtStartup(
  options: {
    nodeEnv?: string;
    execute?: CorrectionExecutor;
    log?: CorrectionLogger;
  } = {},
): Promise<void> {
  if ((options.nodeEnv ?? process.env["NODE_ENV"]) !== "production") return;
  const log = options.log ?? logger;
  const execute = options.execute ?? ((statement) => db.execute(statement));

  try {
    const changedRows = await executeGrilOriginCorrection(execute, log);
    if (changedRows === 0) {
      log.warn(
        { changedRows },
        "[grilOriginCorrection] no row changed; correction was already applied or a guard did not match",
      );
    }
  } catch (err) {
    log.fatal(
      { err },
      "[grilOriginCorrection] production correction failed; startup continues",
    );
  }
}