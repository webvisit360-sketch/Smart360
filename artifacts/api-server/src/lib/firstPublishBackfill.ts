import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

/**
 * `first_published_at` arrived after tenants had already been published.
 * Stamp every currently-published tenant that lacks it, so:
 *  - their slug is frozen immediately (they have printed QR codes), and
 *  - the "guide published" e-mail can never fire retroactively for them.
 *
 * Idempotent and race-safe: the predicate is part of the UPDATE itself.
 * Publishing syncs schema, never data — this runs at startup in every
 * environment (see prod-data-backfills memory).
 */
export async function runFirstPublishedBackfillAtStartup(): Promise<void> {
  try {
    const res = await db.execute(sql`
      UPDATE tenants SET first_published_at = now()
      WHERE is_published AND first_published_at IS NULL`);
    const n = res.rowCount ?? 0;
    if (n > 0) {
      logger.info({ stamped: n }, "[firstPublishedBackfill] stamped published tenants");
    }
  } catch (err) {
    logger.error({ err }, "[firstPublishedBackfill] failed");
  }
}
