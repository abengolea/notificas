"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";

import { OrgSidebarNav, useOrganization } from "@/components/empresa/org-sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function EmpresaOrgLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const orgId = params.orgId as string;
  const org = useOrganization(orgId);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <div className="flex min-h-dvh w-full flex-col bg-background lg:min-h-screen lg:flex-row">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-card/95 px-3 pt-[env(safe-area-inset-top,0px)] backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden">
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Abrir menú de navegación">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{org?.nombre || "Cargando…"}</p>
            {org?.cuit ? (
              <p className="truncate text-xs text-muted-foreground">{org.cuit}</p>
            ) : null}
          </div>
        </header>

        <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex lg:min-h-screen">
          <OrgSidebarNav orgId={orgId} org={org} />
        </aside>

        <SheetContent
          side="left"
          className="flex w-[min(100vw,20rem)] flex-col gap-0 border-r p-0 sm:max-w-sm"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menú de organización</SheetTitle>
          </SheetHeader>
          <OrgSidebarNav orgId={orgId} org={org} onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>

        <div className="min-w-0 flex-1 overflow-x-hidden">{children}</div>
      </div>
    </Sheet>
  );
}
