"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssistantDrawer } from "./assistant-drawer";
import { useTaskBadge } from "./use-task-badge";

const links = [
  { href: "/admin/marketing", label: "Resumen" },
  { href: "/admin/marketing/seguimiento", label: "Seguimiento", badge: true },
  { href: "/admin/marketing/empresas", label: "Empresas" },
  { href: "/admin/marketing/oportunidades", label: "Pipeline" },
  { href: "/admin/marketing/contactos", label: "Contactos" },
  { href: "/admin/marketing/tareas", label: "Tareas", badge: true },
  { href: "/admin/marketing/respuestas", label: "Respuestas" },
  { href: "/admin/marketing/campanas", label: "Campañas" },
  { href: "/admin/marketing/catalogo", label: "Catálogo" },
] as const;

export function MarketingSubnav() {
  const pathname = usePathname();
  const { toggle } = useAssistantDrawer();
  const taskBadge = useTaskBadge();
  const urgentCount = taskBadge.overdue + taskBadge.dueToday;

  return (
    <nav aria-label="Marketing" className="flex flex-wrap items-center gap-1 border-b border-border pb-px">
      {links.map((link) => {
        const active =
          link.href === "/admin/marketing"
            ? pathname === "/admin/marketing"
            : pathname === link.href || pathname.startsWith(link.href + "/");
        const showBadge = "badge" in link && link.badge && urgentCount > 0;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "relative px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
            {showBadge && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground leading-none">
                {urgentCount > 99 ? "99+" : urgentCount}
              </span>
            )}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={toggle}
        title="Asistente IA (⌘K)"
        className="ml-auto flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">IA</span>
        <kbd className="hidden lg:inline text-[10px] font-mono bg-muted rounded px-1">⌘K</kbd>
      </button>
    </nav>
  );
}
