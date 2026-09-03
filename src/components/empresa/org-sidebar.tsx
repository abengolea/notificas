"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import type { Organization } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Mail, Megaphone, PenSquare, PlusCircle, Send, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export function useOrganization(orgId: string) {
  const [org, setOrg] = useState<Organization | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "organizations", orgId), (s) => {
      if (!s.exists()) {
        setOrg(null);
        return;
      }
      const d = s.data();
      setOrg({
        id: s.id,
        nombre: String(d.nombre ?? ""),
        cuit: String(d.cuit ?? ""),
        tipo: d.tipo as Organization["tipo"],
        adminUserId: String(d.adminUserId ?? ""),
        members: Array.isArray(d.members) ? d.members : [],
        plan: (d.plan as Organization["plan"]) || "starter",
        logoUrl: d.logoUrl,
        createdAt: d.createdAt,
      });
    });
    return () => unsub();
  }, [orgId]);

  return org;
}

export type OrgSidebarNavProps = {
  orgId: string;
  org: Organization | null;
  /** Al navegar (p. ej. cerrar el drawer móvil) */
  onNavigate?: () => void;
  className?: string;
};

export function OrgSidebarNav({ orgId, org, onNavigate, className }: OrgSidebarNavProps) {
  const pathname = usePathname();
  const base = `/empresa/${orgId}`;
  const [orgCount, setOrgCount] = useState<number | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      void (async () => {
        if (!user) {
          setOrgCount(null);
          return;
        }
        try {
          const token = await user.getIdToken();
          const res = await fetch("/api/organizations", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const data = (await res.json()) as { organizations?: unknown };
          const orgs = Array.isArray(data.organizations) ? data.organizations : [];
          setOrgCount(orgs.length);
        } catch {
          /* ignorar */
        }
      })();
    });
    return () => unsub();
  }, []);

  const links = [
    { href: `${base}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
    { href: `${base}/campanas`, label: "Envíos masivos", icon: Megaphone },
    { href: `${base}/envios`, label: "Envíos individuales", icon: Send },
    { href: `${base}/verificacion-meta`, label: "Verificación Meta", icon: ShieldCheck },
    { href: `${base}/verificacion-resend`, label: "Verificación Resend", icon: Mail },
  ];

  return (
    <div className={cn("flex min-h-full flex-col bg-card", className)}>
      <div className="border-b p-4">
        <div className="truncate text-sm font-semibold text-muted-foreground">{org?.nombre || "…"}</div>
        {org?.cuit ? <div className="text-xs text-muted-foreground">{org.cuit}</div> : null}
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => onNavigate?.()}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button asChild className="w-full gap-2">
          <Link href={`${base}/campanas/nueva`} onClick={() => onNavigate?.()}>
            <PlusCircle className="h-4 w-4" />
            Enviar nuevo envío masivo
          </Link>
        </Button>
        <Button variant="outline" asChild className="mt-2 w-full gap-2">
          <Link href={`${base}/envios`} onClick={() => onNavigate?.()}>
            <PenSquare className="h-4 w-4" />
            Nuevo envío 1:1
          </Link>
        </Button>
        {orgCount !== null && orgCount > 1 ? (
          <Button variant="ghost" className="mt-2 w-full" asChild>
            <Link href="/empresa" onClick={() => onNavigate?.()}>
              Cambiar organización
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
