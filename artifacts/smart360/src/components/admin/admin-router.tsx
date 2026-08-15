import { Route, Switch, useLocation } from "wouter";
import AdminLogin from "@/pages/admin/login";
import AdminResetPassword from "@/pages/admin/reset-password";
import AdminAccount from "@/pages/admin/account";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminLayout from "@/components/admin/admin-layout";
import AdminTenantEdit from "@/pages/admin/tenant-edit";

export function AdminRouter() {
  const [location] = useLocation();

  if (location === "/admin/login") {
    return <AdminLogin />;
  }

  if (location === "/admin/reset-password") {
    return <AdminResetPassword />;
  }

  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/account" component={AdminAccount} />
        <Route path="/admin/tenants/:id" component={AdminTenantEdit} />
      </Switch>
    </AdminLayout>
  );
}
