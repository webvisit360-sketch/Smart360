/**
 * Message thread retention: delete expired threads (deleteAfter < now).
 *
 * Threads deleted here cascade to their messages via the FK ON DELETE CASCADE.
 *
 * Called:
 *  1. At server startup (best-effort, inside the startup chain)
 *  2. On a daily unref'd timer (so it never blocks process exit)
 *
 * No DDL is executed here — the deleteAfter column is set at thread creation
 * and extended by each new message.
 */
import { lt } from "drizzle-orm";
import { db, messageThreadsTable } from "@workspace/db";
import { logger } from "./logger";

export const MESSAGE_RETENTION_DAYS = 90;
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Returns a deleteAfter timestamp 90 days from now.
 */
export function makeMessageDeleteAfter(): Date {
  return new Date(Date.now() + MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Delete all threads whose deleteAfter is in the past.
 * Cascades to messages via FK.
 * Returns the number of deleted rows (for logging/testing).
 */
export async function purgeExpiredThreads(): Promise<number> {
  try {
    const deleted = await db
      .delete(messageThreadsTable)
      .where(lt(messageThreadsTable.deleteAfter, new Date()))
      .returning({ id: messageThreadsTable.id });
    if (deleted.length > 0) {
      logger.info(
        { count: deleted.length },
        "[messageRetention] purged expired threads",
      );
    }
    return deleted.length;
  } catch (err) {
    logger.error({ err }, "[messageRetention] failed to purge expired threads");
    return 0;
  }
}

/**
 * Schedule a daily purge of expired threads.
 * The timer is unref'd so it will not prevent the process from exiting naturally.
 */
export function scheduleMessageRetention(): void {
  const timer = setInterval(async () => {
    await purgeExpiredThreads();
  }, RETENTION_INTERVAL_MS);
  timer.unref();
  logger.info(
    { intervalHours: RETENTION_INTERVAL_MS / 3_600_000 },
    "[messageRetention] daily retention timer scheduled",
  );
}
