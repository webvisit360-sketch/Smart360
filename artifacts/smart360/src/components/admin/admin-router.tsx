import { Route, Switch, useLocation } from "wouter";
import AdminLogin from "@/pages/admin/login";
import AdminEnroll from "@/pages/admin/enroll";
import AdminAccount from "@/pages/admin/account";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminLayout from "@/components/admin/admin-layout";
import AdminTenantEdit from "@/pages/admin/tenant-edit";
import AdminEnquiriesPage from "@/pages/admin/enquiries";

export function AdminRouter() {
  const [location] = useLocation();

  if (location === "/admin/login") {
    return <div data-surface="admin" className="admin-scope"><AdminLogin /></div>;
  }

  if (location === "/admin/enroll") {
    return <div data-surface="admin" className="admin-scope"><AdminEnroll /></div>;
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
      </AdminLayout>
    </div>
  );
}
