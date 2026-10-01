export type ManagementMode = "self_service" | "concierge";

/** UI affordances only. The server re-resolves tenant scope and mode on every request. */
export function tenantPermissions({
  operator,
  hostTenantId,
  tenantId,
  managementMode,
}: {
  operator: boolean;
  hostTenantId?: string;
  tenantId: string;
  managementMode?: ManagementMode;
}) {
  const selfService = Boolean(hostTenantId && hostTenantId === tenantId && managementMode === "self_service");
  return {
    isOperator: operator,
    canManageContent: operator || selfService,
    canEditIdentity: operator || selfService,
    canEditAppearance: operator || selfService,
    canPublish: operator || selfService,
    canUseCreator: operator,
    canReviewOnboarding: operator,
    canConfirmHostPin: operator,
    canPurge: operator,
  };
}