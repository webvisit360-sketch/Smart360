import { db, changelogTable } from "@workspace/db";

export async function logChange(entry: {
  tenantId?: string | null;
  tenantName?: string | null;
  action: string;
  entity: string;
  detail?: string | null;
}): Promise<void> {
  await db.insert(changelogTable).values({
    tenantId: entry.tenantId ?? null,
    tenantName: entry.tenantName ?? null,
    action: entry.action,
    entity: entry.entity,
    detail: entry.detail ?? null,
  });
}
