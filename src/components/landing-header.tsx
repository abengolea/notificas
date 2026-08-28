"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navLinks = [
  { href: "/#ventajas", label: "Ventajas" },
  { href: "/#empresas", label: "Empresas" },
  { href: "/recursos", label: "Recursos" },
  { href: "/verify", label: "Verificar certificado" },
  { href: "/docs/api/embed", label: "API" },
  { href: "/#faq", label: "Preguntas frecuentes" },
];

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="container flex h-14 items-center justify-between gap-2 px-4 sm:h-16 md:px-6">
        <Link href="/" className="flex min-w-0 shrink items-center gap-2">
          <Logo className="h-8 w-auto shrink-0 sm:h-10" />
          <span className="truncate font-bold text-base sm:text-xl">Notificas</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium lg:flex">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <div className="hidden items-center gap-2 sm:flex">
            <Button variant="outline" size="sm" asChild className="whitespace-nowrap">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button size="sm" asChild className="whitespace-nowrap">
              <Link href="/signup">Registrate</Link>
            </Button>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[min(100vw,20rem)] flex-col gap-6 sm:max-w-sm">
              <SheetHeader>
                <SheetTitle className="text-left">Menú</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1">
                {navLinks.map(({ href, label }) => (
                  <SheetClose asChild key={href}>
                    <Link
                      href={href}
                      className="rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
                    >
                      {label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2 border-t pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/login">Iniciar sesión</Link>
                </Button>
                <Button className="w-full" asChild>
                  <Link href="/signup">Registrate</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
