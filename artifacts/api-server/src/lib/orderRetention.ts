/**
 * Order retention: delete expired orders (deleteAfter < now) from the database.
 *
 * Called:
 *  1. At server startup (once, synchronously in the startup chain)
 *  2. On a daily unref'd timer (so it never blocks process exit)
 *
 * No DDL is executed here — the deleteAfter column is set at row creation time.
 */
import { lt } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import { logger } from "./logger";

const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Delete all orders whose deleteAfter timestamp is in the past.
 * Returns the number of deleted rows (for logging/testing).
 */
export async function purgeExpiredOrders(): Promise<number> {
  try {
    const deleted = await db
      .delete(ordersTable)
      .where(lt(ordersTable.deleteAfter, new Date()))
      .returning({ id: ordersTable.id });
    if (deleted.length > 0) {
      logger.info({ count: deleted.length }, "[orderRetention] purged expired orders");
    }
    return deleted.length;
  } catch (err) {
    logger.error({ err }, "[orderRetention] failed to purge expired orders");
    return 0;
  }
}

/**
 * Schedule a daily purge of expired orders.  The timer is unref'd so it will
 * not prevent the process from exiting naturally.
 */
export function scheduleOrderRetention(): void {
  const timer = setInterval(async () => {
    await purgeExpiredOrders();
  }, RETENTION_INTERVAL_MS);
  timer.unref();
  logger.info(
    { intervalHours: RETENTION_INTERVAL_MS / 3_600_000 },
    "[orderRetention] daily retention timer scheduled",
  );
}
