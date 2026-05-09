
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

/** Enlaces del panel admin (barra superior + menú móvil). */
export const adminNavLinks = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/users", label: "Usuarios" },
  { href: "/admin/empresas", label: "Empresa" },
  { href: "/admin/plans", label: "Planes" },
  { href: "/admin/email-test", label: "Test Emails" },
  { href: "/admin/settings", label: "Configuración" },
] as const

function linkActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin"
  return pathname === href || pathname.startsWith(href + "/")
}

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname()

  const navList = (
    <>
      {adminNavLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            linkActive(pathname, link.href) ? "text-primary" : "text-muted-foreground"
          )}
        >
          {link.label}
        </Link>
      ))}
    </>
  )

  return (
    <>
      <nav
        className={cn(
          "hidden md:flex items-center space-x-4 lg:space-x-6",
          className
        )}
        {...props}
      >
        {navList}
      </nav>

      <div className="flex md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Abrir menú de administración">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(100vw-2rem,280px)]">
            <SheetHeader className="text-left mb-4">
              <SheetTitle>Menú admin</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-3">{navList}</nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
