import { and, isNotNull, lt } from "drizzle-orm";
import { changelogTable, db } from "@workspace/db";
import { logger } from "./logger";

const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Same calendar day twelve months ago, clamped for e.g. leap day. */
export function changelogIpRetentionCutoff(now: Date): Date {
  const cutoff = new Date(now);
  const day = cutoff.getDate();
  cutoff.setDate(1);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const lastDay = new Date(cutoff.getFullYear(), cutoff.getMonth() + 1, 0).getDate();
  cutoff.setDate(Math.min(day, lastDay));
  return cutoff;
}

export function isExpiredChangelogIp(createdAt: Date, now: Date): boolean {
  return createdAt.getTime() < changelogIpRetentionCutoff(now).getTime();
}

/** Clear only IP addresses after twelve months; audit evidence itself remains. */
export async function clearExpiredChangelogIps(now = new Date()): Promise<number> {
  try {
    const cutoff = changelogIpRetentionCutoff(now);
    const cleared = await db
      .update(changelogTable)
      .set({ requestIp: null })
      .where(and(isNotNull(changelogTable.requestIp), lt(changelogTable.createdAt, cutoff)))
      .returning({ id: changelogTable.id });
    if (cleared.length) logger.info({ count: cleared.length }, "[changelogRetention] cleared expired IP addresses");
    return cleared.length;
  } catch (err) {
    logger.error({ err }, "[changelogRetention] failed to clear expired IP addresses");
    return 0;
  }
}

export function scheduleChangelogRetention(): void {
  const timer = setInterval(() => { void clearExpiredChangelogIps(); }, RETENTION_INTERVAL_MS);
  timer.unref();
  logger.info({ intervalHours: 24 }, "[changelogRetention] daily IP retention timer scheduled");
}