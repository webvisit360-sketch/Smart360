import { Route, Switch, useLocation } from "wouter";
import { lazy } from "react";
import AdminLogin from "@/pages/admin/login";
import { ChunkLoadSucceeded } from "@/lib/chunk-recovery";

// Login must not wait for the content editor, preview bridge or onboarding.
const AdminEnroll = lazy(() => import("@/pages/admin/enroll"));
const AdminAccount = lazy(() => import("@/pages/admin/account"));
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminLayout = lazy(() => import("@/components/admin/admin-layout"));
const AdminTenantEdit = lazy(() => import("@/pages/admin/tenant-edit"));
const AdminEnquiriesPage = lazy(() => import("@/pages/admin/enquiries"));
const HostOnboarding = lazy(() => import("@/pages/host/onboarding"));

export function AdminRouter() {
  const [location] = useLocation();

  if (location === "/admin/login") {
    return <div data-surface="admin" className="admin-scope"><AdminLogin /><ChunkLoadSucceeded /></div>;
  }

  if (location === "/admin/enroll") {
    return <div data-surface="admin" className="admin-scope"><AdminEnroll /><ChunkLoadSucceeded /></div>;
  }

  if (location === "/admin/onboarding") {
    return <div data-surface="admin" className="admin-scope"><HostOnboarding /><ChunkLoadSucceeded /></div>;
  }

  return (
    <div data-surface="admin" className="admin-scope">
      <AdminLayout>
        <Switch>
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/account" component={AdminAccount} />
          <Route path="/admin/enquiries" component={AdminEnquiriesPage} />
          <Route path="/admin/tenants/:id" component={AdminTenantEdit} />
        </Switch>
        <ChunkLoadSucceeded />
      </AdminLayout>
    </div>
  );
}
