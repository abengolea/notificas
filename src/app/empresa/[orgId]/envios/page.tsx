"use client";

import { useParams } from "next/navigation";
import DashboardClient from "@/components/dashboard/dashboard-client";

export default function EmpresaEnviosPage() {
  const { orgId } = useParams<{ orgId: string }>();
  return (
    <DashboardClient
      embed
      orgId={orgId}
      messageBasePath={`/empresa/${orgId}/envios`}
      walletHref="/dashboard/billetera"
    />
  );
}
