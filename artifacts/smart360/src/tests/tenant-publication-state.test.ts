import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { getGetTenantQueryKey } from "@workspace/api-client-react";
import { markTenantDirtyInCache } from "../lib/tenant-publication-state";

test("admin writes mark the cached tenant dirty after every publish cycle", () => {
  const queryClient = new QueryClient();
  const tenantId = "tenant-repeat-cycle";
  const queryKey = getGetTenantQueryKey(tenantId);

  queryClient.setQueryData(queryKey, {
    id: tenantId,
    isPublished: true,
    hasUnpublishedChanges: false,
  });
  markTenantDirtyInCache(queryClient, tenantId);
  assert.equal(
    queryClient.getQueryData<{ hasUnpublishedChanges: boolean }>(queryKey)
      ?.hasUnpublishedChanges,
    true,
  );

  queryClient.setQueryData(queryKey, (cached: Record<string, unknown> | undefined) =>
    cached ? { ...cached, hasUnpublishedChanges: false } : cached,
  );
  markTenantDirtyInCache(queryClient, tenantId);
  assert.equal(
    queryClient.getQueryData<{ hasUnpublishedChanges: boolean }>(queryKey)
      ?.hasUnpublishedChanges,
    true,
  );
});