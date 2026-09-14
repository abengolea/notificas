"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

type Crumb = { label: string; href?: string };

export function empresaCrumbs(pathname: string, orgId: string): Crumb[] {
  const base = `/empresa/${orgId}`;
  if (pathname.startsWith(`${base}/adhesiones-electronicas`)) {
    return [{ label: "Configuración" }, { label: "Adhesiones electrónicas" }];
  }
  if (pathname.startsWith(`${base}/campanas`)) {
    return [{ label: "Comunicaciones" }, { label: "Envíos masivos" }];
  }
  if (pathname.startsWith(`${base}/envios`)) {
    return [{ label: "Comunicaciones" }, { label: "Envíos individuales" }];
  }
  if (pathname.startsWith(`${base}/verificacion-meta`)) {
    return [{ label: "Configuración" }, { label: "Canales" }, { label: "Verificación Meta" }];
  }
  if (pathname.startsWith(`${base}/verificacion-resend`)) {
    return [{ label: "Configuración" }, { label: "Canales" }, { label: "Verificación Resend" }];
  }
  if (pathname.startsWith(`${base}/listas`)) {
    return [{ label: "Comunicaciones" }, { label: "Listas" }];
  }
  return [{ label: "Inicio" }];
}

export function OrgBreadcrumb({ orgId }: { orgId: string }) {
  const pathname = usePathname() || "";
  const crumbs = empresaCrumbs(pathname, orgId);

  return (
    <nav aria-label="Ruta" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-1 text-[13px] leading-5 text-muted-foreground">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden /> : null}
              {last || !crumb.href ? (
                <span className={last ? "truncate font-medium text-foreground" : "truncate"}>{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="truncate hover:text-foreground">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
