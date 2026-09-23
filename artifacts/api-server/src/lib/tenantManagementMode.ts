import type { Request } from "express";
import { and, eq, isNull } from "drizzle-orm";
import {
  changelogTable,
  db,
  hostAuthEventsTable,
  hostInvitesTable,
  hostMembershipsTable,
  hostPasswordResetsTable,
  hostSessionsTable,
  hostUsersTable,
  tenantsTable,
} from "@workspace/db";

export const MANAGEMENT_MODES = ["self_service", "concierge"] as const;
export type ManagementMode = (typeof MANAGEMENT_MODES)[number];

export function isManagementMode(value: unknown): value is ManagementMode {
  return value === "self_service" || value === "concierge";
}

/**
 * Changes only the access policy. The tenant row lock serializes concurrent
 * toggles and token issuance; moving to concierge revokes every access path in
 * the same transaction as the mode and audit changes.
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

    const [membership] = await tx
      .select({ hostUserId: hostMembershipsTable.hostUserId })
      .from(hostMembershipsTable)
      .where(eq(hostMembershipsTable.tenantId, tenantId))
      .limit(1)
      .for("update");

    await tx
      .update(tenantsTable)
      .set({ managementMode })
      .where(eq(tenantsTable.id, tenantId));

    if (managementMode === "concierge" && membership) {
      await tx
        .select({ id: hostUsersTable.id })
        .from(hostUsersTable)
        .where(eq(hostUsersTable.id, membership.hostUserId))
        .limit(1)
        .for("update");
      const now = new Date();
      await tx.delete(hostSessionsTable)
        .where(eq(hostSessionsTable.hostUserId, membership.hostUserId));
      await tx.update(hostInvitesTable)
        .set({ invalidatedAt: now })
        .where(and(
          eq(hostInvitesTable.hostUserId, membership.hostUserId),
          isNull(hostInvitesTable.usedAt),
          isNull(hostInvitesTable.invalidatedAt),
        ));
      await tx.update(hostPasswordResetsTable)
        .set({ usedAt: now })
        .where(and(
          eq(hostPasswordResetsTable.hostUserId, membership.hostUserId),
          isNull(hostPasswordResetsTable.usedAt),
        ));
      await tx.insert(hostAuthEventsTable).values({
        hostUserId: membership.hostUserId,
        type: "management_mode_access_revoked",
        detail: "actor=owner;mode=concierge",
        ip: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      });
    }

    await tx.insert(changelogTable).values({
      tenantId,
      action: "update",
      entity: "tenant-management-mode",
      summary: managementMode === "concierge"
        ? "Način upravljanja je spremenjen na »Ureja Smart360«; dostop stranke je preklican."
        : "Način upravljanja je spremenjen na »Gostitelj ureja sam«.",
      actorType: "owner",
      actorLabel: "Smart360",
      requestIp: req.ip ?? null,
    });
    return { found: true, changed: true, managementMode };
  });
}