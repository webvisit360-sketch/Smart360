import type { Request } from "express";
import { eq } from "drizzle-orm";
import {
  changelogTable,
  db,
  tenantsTable,
} from "@workspace/db";

export const MANAGEMENT_MODES = ["self_service", "concierge"] as const;
export type ManagementMode = (typeof MANAGEMENT_MODES)[number];

export function isManagementMode(value: unknown): value is ManagementMode {
  return value === "self_service" || value === "concierge";
}

/**
 * Changes only the access policy. The tenant row lock serializes concurrent
 * toggles and token issuance. Sessions remain valid in both modes; permissions
 * are resolved from the tenant on every request, never copied into a cookie.
 */
export async function changeTenantManagementMode(
  tenantId: string,
  managementMode: ManagementMode,
  req: Request,
): Promise<{ found: boolean; changed: boolean; managementMode: ManagementMode }> {
  return db.transaction(async (tx) => {
    const [tenant] = await tx
      .select({
        id: tenantsTable.id,
        managementMode: tenantsTable.managementMode,
      })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId))
      .limit(1)
      .for("update");
    if (!tenant) return { found: false, changed: false, managementMode };
    if (tenant.managementMode === managementMode) {
      return { found: true, changed: false, managementMode };
    }

    await tx
      .update(tenantsTable)
      .set({ managementMode })
      .where(eq(tenantsTable.id, tenantId));

    await tx.insert(changelogTable).values({
      tenantId,
      action: "update",
      entity: "tenant-management-mode",
      summary: managementMode === "concierge"
        ? "Način upravljanja je spremenjen na »Ureja Smart360«; stranka ima omejen dostop."
        : "Način upravljanja je spremenjen na »Gostitelj ureja sam«.",
      actorType: "owner",
      actorLabel: "Smart360",
      requestIp: req.ip ?? null,
    });
    return { found: true, changed: true, managementMode };
  });
}