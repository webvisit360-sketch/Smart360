import type { QueryClient } from "@tanstack/react-query";
import { getGetTenantQueryKey } from "@workspace/api-client-react";

type CachedTenant = {
  hasUnpublishedChanges?: boolean;
};

export function markTenantDirtyInCache(
  queryClient: QueryClient,
  tenantId: string,
): void {
  queryClient.setQueryData(
    getGetTenantQueryKey(tenantId),
    (cached: CachedTenant | undefined) =>
      cached ? { ...cached, hasUnpublishedChanges: true } : cached,
  );
}

export async function refreshTenantAfterGuestWrite(
  queryClient: QueryClient,
  tenantId: string,
): Promise<void> {
  markTenantDirtyInCache(queryClient, tenantId);
  await queryClient.invalidateQueries({
    queryKey: getGetTenantQueryKey(tenantId),
    exact: true,
  });
}