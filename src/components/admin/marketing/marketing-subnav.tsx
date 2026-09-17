"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin/marketing", label: "Por país" },
  { href: "/admin/marketing/contactos", label: "Contactos" },
  { href: "/admin/marketing/campanas", label: "Campañas" },
  { href: "/admin/marketing/asistente", label: "Asistente IA" },
] as const;

export function MarketingSubnav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Marketing" className="flex flex-wrap gap-1 border-b border-border pb-px">
      {links.map((link) => {
        const active =
          link.href === "/admin/marketing"
            ? pathname === "/admin/marketing"
            : pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
