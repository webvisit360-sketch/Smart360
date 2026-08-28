import { lt } from "drizzle-orm";
import { db, enquiriesTable } from "@workspace/db";
import { logger } from "./logger";

const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function purgeExpiredEnquiries(): Promise<number> {
  try {
    const deleted = await db
      .delete(enquiriesTable)
      .where(lt(enquiriesTable.deleteAfter, new Date()))
      .returning({ id: enquiriesTable.id });
    if (deleted.length > 0) {
      logger.info({ count: deleted.length }, "[enquiryRetention] purged expired enquiries");
    }
    return deleted.length;
  } catch (err) {
    logger.error({ err }, "[enquiryRetention] failed to purge expired enquiries");
    return 0;
  }
}

export function scheduleEnquiryRetention(): void {
  const timer = setInterval(purgeExpiredEnquiries, RETENTION_INTERVAL_MS);
  timer.unref();
  logger.info({ intervalHours: 24 }, "[enquiryRetention] daily retention timer scheduled");
}