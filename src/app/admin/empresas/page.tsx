import { AdminAuth } from "@/components/admin/admin-auth";
import OrganizationsAdmin from "@/components/admin/organizations-admin";

export default function AdminEmpresasPage() {
  return (
    <AdminAuth>
      <OrganizationsAdmin />
    </AdminAuth>
  );
}
