"use client";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CuentaPageComponent } from "@/components/dashboard/cuenta-page";

export function CuentaDashboardRoute() {
  return (
    <DashboardShell headerTitle="Mi cuenta" folderNavMode="route">
      <CuentaPageComponent />
    </DashboardShell>
  );
}
