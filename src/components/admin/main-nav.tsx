
"use client"

import Link from "next/link"
import { usePathname } from 'next/navigation'

import { cn } from "@/lib/utils"

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname()

  const links = [
    { href: "/admin", label: "Resumen" },
    { href: "/admin/users", label: "Usuarios" },
    { href: "/admin/plans", label: "Planes" },
    { href: "/admin/settings", label: "Configuración" },
  ]

  return (
    <nav
      className={cn("flex items-center space-x-4 lg:space-x-6", className)}
      {...props}
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            pathname === link.href ? "text-primary" : "text-muted-foreground"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
