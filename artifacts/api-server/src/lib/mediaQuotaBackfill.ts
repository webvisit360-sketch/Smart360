import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const OLD_BINARY_DEFAULT = 2_147_483_648;
const DECIMAL_DEFAULT = 2_000_000_000;

/**
 * Converts only the former untouched default. Explicit custom quotas are
 * preserved. The exact predicate makes this self-disabling after one run.
 */
export async function runDecimalMediaQuotaBackfillAtStartup(): Promise<void> {
  try {
    const changed = await db
      .update(tenantsTable)
      .set({ mediaQuotaBytes: DECIMAL_DEFAULT })
      .where(eq(tenantsTable.mediaQuotaBytes, OLD_BINARY_DEFAULT))
      .returning({ id: tenantsTable.id });

    if (changed.length > 0) {
      logger.info(
        { count: changed.length },
        "[mediaQuotaBackfill] converted former 2 GiB defaults to decimal 2 GB",
      );
    }
  } catch (err) {
    logger.error({ err }, "[mediaQuotaBackfill] failed");
  }
}