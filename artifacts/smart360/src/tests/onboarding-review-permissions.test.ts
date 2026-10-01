import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Tabs, TabsList } from "../components/ui/tabs";
import { HostOnboardingReviewPanel, HostOnboardingReviewTrigger } from "../components/admin/host-onboarding-review";
import { tenantPermissions } from "../lib/tenant-permissions";

test("both host modes render neither onboarding review navigation nor its query-bearing panel", () => {
  for (const managementMode of ["concierge", "self_service"] as const) {
    const permissions = tenantPermissions({ operator: false, hostTenantId: "a", tenantId: "a", managementMode });
    assert.equal(permissions.canReviewOnboarding, false);
    assert.equal(permissions.canConfirmHostPin, false);
    // Deliberately no QueryClient or Tabs provider: accidentally mounting the
    // operator review/query would throw, not merely render a hidden trigger.
    assert.equal(renderToStaticMarkup(createElement(HostOnboardingReviewTrigger, { permissions })), "");
    assert.equal(renderToStaticMarkup(createElement(HostOnboardingReviewPanel, { tenantId: "a", permissions })), "");
  }
});

test("operator onboarding tab and actual review panel remain reachable", () => {
  const permissions = tenantPermissions({ operator: true, tenantId: "a", managementMode: "concierge" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const markup = renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(Tabs, { value: "onboarding" },
      createElement(TabsList, null, createElement(HostOnboardingReviewTrigger, { permissions })),
      createElement(HostOnboardingReviewPanel, { tenantId: "a", permissions }),
    ),
  ));
  assert.match(markup, /tab-onboarding-review/);
  assert.match(markup, /Obrazec za gostitelja/);
  assert.ok(client.getQueryCache().getAll().length > 0, "operator panel mounts its review query");
  client.clear();
});