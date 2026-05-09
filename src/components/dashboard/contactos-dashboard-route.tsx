"use client";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ContactosPageComponent } from "@/components/dashboard/contactos-page";

export function ContactosDashboardRoute() {
  return (
    <DashboardShell headerTitle="Contactos" folderNavMode="route">
      <ContactosPageComponent layout="shell" />
    </DashboardShell>
  );
}
