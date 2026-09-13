"use client";

import { useParams } from "next/navigation";
import { OrganizationAdminDetail } from "@/components/admin/organization-admin-detail";

export default function AdminEmpresaDetallePage() {
  const params = useParams();
  const orgId = typeof params.orgId === "string" ? params.orgId : "";
  if (!orgId) return null;
  return <OrganizationAdminDetail orgId={orgId} />;
}
