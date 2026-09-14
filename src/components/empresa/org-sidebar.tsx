"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { listenWhenSignedIn } from "@/lib/listen-when-signed-in";
import type { Organization } from "@/lib/types";
import {
  ClipboardCheck,
  Home,
  Mail,
  Megaphone,
  Send,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export function useOrganization(orgId: string) {
  const [org, setOrg] = useState<Organization | null>(null);

  useEffect(() => {
    return listenWhenSignedIn(
      () =>
        onSnapshot(
          doc(db, "organizations", orgId),
          (s) => {
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
          },
          () => setOrg(null),
        ),
      () => setOrg(null),
    );
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

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
  inset = false,
}: {
  href: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate?: () => void;
  inset?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={() => onNavigate?.()}
      className={cn(
        "flex min-h-9 items-center gap-2 rounded-md px-2.5 py-1.5 text-[14px] leading-5 transition-colors",
        inset && "pl-7",
        active ? "bg-primary/10 font-medium text-primary" : "font-normal text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-80" /> : null}
      {label}
    </Link>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 pt-5 first:pt-0">
      <p className="px-2.5 pb-1 text-[12px] font-medium leading-4 text-muted-foreground">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

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

  const [artEnabled, setArtEnabled] = useState(false);

  useEffect(() => {
    void fetch(`/api/art/status?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((d) => setArtEnabled(d.enabled === true))
      .catch(() => setArtEnabled(false));
  }, [orgId]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className={cn("flex min-h-full flex-col bg-card", className)}>
      <div className="border-b border-border/70 px-4 py-4">
        <div className="truncate text-[13px] font-medium leading-5 text-foreground">{org?.nombre || "…"}</div>
        {org?.cuit ? <div className="mt-0.5 text-[12px] leading-4 text-muted-foreground">{org.cuit}</div> : null}
      </div>
      <nav className="flex-1 space-y-1 p-3">
        <NavLink
          href={`${base}/dashboard`}
          label="Inicio"
          icon={Home}
          active={isActive(`${base}/dashboard`) || pathname === base}
          onNavigate={onNavigate}
        />

        <NavSection title="Comunicaciones">
          <NavLink
            href={`${base}/campanas`}
            label="Envíos masivos"
            icon={Megaphone}
            active={isActive(`${base}/campanas`)}
            onNavigate={onNavigate}
          />
          <NavLink
            href={`${base}/envios`}
            label="Envíos individuales"
            icon={Send}
            active={isActive(`${base}/envios`)}
            onNavigate={onNavigate}
          />
        </NavSection>

        <NavSection title="Configuración">
          {artEnabled ? (
            <NavLink
              href={`${base}/adhesiones-electronicas`}
              label="Adhesiones"
              icon={ClipboardCheck}
              active={isActive(`${base}/adhesiones-electronicas`)}
              onNavigate={onNavigate}
            />
          ) : null}
          <p className="px-2.5 pb-0.5 pt-1 text-[12px] leading-4 text-muted-foreground/90">Canales</p>
          <NavLink
            href={`${base}/verificacion-meta`}
            label="Verificación Meta"
            icon={ShieldCheck}
            active={isActive(`${base}/verificacion-meta`)}
            onNavigate={onNavigate}
            inset
          />
          <NavLink
            href={`${base}/verificacion-resend`}
            label="Verificación Resend"
            icon={Mail}
            active={isActive(`${base}/verificacion-resend`)}
            onNavigate={onNavigate}
            inset
          />
        </NavSection>
      </nav>
      {orgCount !== null && orgCount > 1 ? (
        <div className="mt-auto border-t border-border/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link
            href="/empresa"
            onClick={() => onNavigate?.()}
            className="flex min-h-9 items-center rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Cambiar organización
          </Link>
        </div>
      ) : null}
    </div>
  );
}
