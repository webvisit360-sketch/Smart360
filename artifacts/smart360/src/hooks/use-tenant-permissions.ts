import { useGetAdminSession, useGetTenant, getGetTenantQueryKey } from "@workspace/api-client-react";
import { useHostSession } from "./use-host-session";
import { tenantPermissions } from "../lib/tenant-permissions";

/** Shared query cache keeps all controls in sync without resetting form drafts. */
export function useTenantPermissions(tenantId: string) {
  const { data: operator } = useGetAdminSession();
  const host = useHostSession();
  const tenant = useGetTenant(tenantId, {
    query: {
      queryKey: getGetTenantQueryKey(tenantId),
      enabled: Boolean(tenantId && (operator?.authenticated || host.data?.authenticated)),
      refetchInterval: 15_000,
      refetchOnWindowFocus: "always",
      staleTime: 0,
    },
    request: { cache: "no-store" },
  });
  const sessionMode = host.data?.tenantId === tenantId ? host.data.managementMode : undefined;
  const managementMode = host.dataUpdatedAt > tenant.dataUpdatedAt
    ? sessionMode ?? tenant.data?.managementMode
    : tenant.data?.managementMode ?? sessionMode;
  return tenantPermissions({
    operator: Boolean(operator?.authenticated),
    hostTenantId: !host.isError && !tenant.isError && host.data?.authenticated ? host.data.tenantId : undefined,
    tenantId,
    managementMode,
  });
}