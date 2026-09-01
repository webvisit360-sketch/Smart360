export const CREATOR_DEVELOPMENT_RUN_CONFIRMATION = "ljubno-source-first-development-only";
export const CREATOR_LJUBNO_PRODUCTION_TENANT_ID = "177e633a-6030-4eca-8ce8-e0a0afdff599";
export const CREATOR_LJUBNO_LEGACY_DEVELOPMENT_TENANT_ID = "34fdde13-6b5c-408c-a1d8-9554a936d31e";
export const CREATOR_LJUBNO_PROTECTED_TENANT_IDS = [
  CREATOR_LJUBNO_PRODUCTION_TENANT_ID,
  CREATOR_LJUBNO_LEGACY_DEVELOPMENT_TENANT_ID,
] as const;

type DevelopmentRunEnvironment = {
  NODE_ENV?: string;
  REPLIT_DEPLOYMENT?: string;
  REPLIT_DEPLOYMENT_ID?: string;
  REPLIT_DEV_DOMAIN?: string;
  CONFIRM_CREATOR_DEVELOPMENT_RUN?: string;
};

/** One-off Creator data scripts fail closed unless they are visibly running in
 * the development workspace and the operator supplies the exact task-specific
 * confirmation. This check must run before the first database operation. */
export function assertCreatorDevelopmentRunEnvironment(
  environment: DevelopmentRunEnvironment,
): void {
  if (
    environment.NODE_ENV !== "development" ||
    environment.REPLIT_DEPLOYMENT ||
    environment.REPLIT_DEPLOYMENT_ID ||
    !environment.REPLIT_DEV_DOMAIN ||
    environment.CONFIRM_CREATOR_DEVELOPMENT_RUN !== CREATOR_DEVELOPMENT_RUN_CONFIRMATION
  ) {
    throw new Error("Creator source run is locked to the confirmed Replit development workspace.");
  }
}

/** Reject protected production and legacy test tenants before any lookup can
 * disclose or mutate them through a one-off Ljubno runner. */
export function assertCreatorLjubnoTargetTenantId(tenantId: string): void {
  if ((CREATOR_LJUBNO_PROTECTED_TENANT_IDS as readonly string[]).includes(tenantId)) {
    throw new Error("Protected tenant is outside the Ljubno source-run boundary.");
  }
}