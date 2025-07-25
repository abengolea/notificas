"use client"

import Link from "next/link"

import { cn } from "@/lib/utils"
import { Logo } from "../logo"

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav
      className={cn("flex items-center space-x-4 lg:space-x-6", className)}
      {...props}
    >
      <Logo className="h-8 w-auto mr-4" />
      <Link
        href="/admin"
        className="text-sm font-medium transition-colors hover:text-primary"
      >
        Resumen
      </Link>
      <Link
        href="/admin/users"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Usuarios
      </Link>
      <Link
        href="/admin/plans"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Planes
      </Link>
      <Link
        href="/admin/settings"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Configuración
      </Link>
    </nav>
  )
}
