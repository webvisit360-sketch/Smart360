import { eq } from "drizzle-orm";
import { db, tenantsTable } from "@workspace/db";

/**
 * Marks a completed tenant-scoped admin mutation as unpublished.
 *
 * Content/media transactions still use their database triggers so their data
 * write and dirty transition remain atomic. This helper is for successful
 * admin mutations whose tables are not part of that trigger set.
 */
export async function markTenantAdminChangeDirty(tenantId: string): Promise<void> {
  if (!tenantId) return;
  await db
    .update(tenantsTable)
    .set({ hasUnpublishedChanges: true })
    .where(eq(tenantsTable.id, tenantId));
}