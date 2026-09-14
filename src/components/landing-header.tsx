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

export type LandingHeaderLink = {
  href: string;
  label: string;
};

export type LandingHeaderAction = {
  href: string;
  label: string;
};

const DEFAULT_NAV_LINKS: LandingHeaderLink[] = [
  { href: "/#ventajas", label: "Ventajas" },
  { href: "/#empresas", label: "Empresas" },
  { href: "/recursos", label: "Recursos" },
  { href: "/verify", label: "Verificar certificado" },
  { href: "/#faq", label: "Preguntas frecuentes" },
];

type LandingHeaderProps = {
  homeHref?: string;
  navLinks?: LandingHeaderLink[];
  loginHref?: string;
  loginLabel?: string;
  signupHref?: string;
  signupLabel?: string;
  showAuthActions?: boolean;
  primaryAction?: LandingHeaderAction;
  menuLabel?: string;
  openMenuLabel?: string;
  themeLabel?: string;
};

export function LandingHeader({
  homeHref = "/",
  navLinks = DEFAULT_NAV_LINKS,
  loginHref = "/login",
  loginLabel = "Iniciar sesión",
  signupHref = "/signup",
  signupLabel = "Registrate",
  showAuthActions = true,
  primaryAction,
  menuLabel = "Menú",
  openMenuLabel = "Abrir menú",
  themeLabel,
}: LandingHeaderProps = {}) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="container flex h-14 items-center justify-between gap-2 px-4 sm:h-16 md:px-6">
        <Link href={homeHref} className="flex min-w-0 shrink items-center" aria-label="Notificas">
          <Logo
            variant="wordmark"
            className="h-9 w-auto max-w-[min(100%,14rem)] shrink-0 sm:h-11 sm:max-w-[18rem]"
          />
        </Link>

        <nav className="hidden items-center gap-6 text-[0.875rem] font-semibold leading-none lg:flex">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle ariaLabel={themeLabel} />
          <div className="hidden items-center gap-2 sm:flex">
            {showAuthActions ? (
              <>
                <Button variant="outline" size="sm" asChild className="whitespace-nowrap">
                  <Link href={loginHref}>{loginLabel}</Link>
                </Button>
                <Button size="sm" asChild className="whitespace-nowrap">
                  <Link href={signupHref}>{signupLabel}</Link>
                </Button>
              </>
            ) : null}
            {primaryAction ? (
              <Button size="sm" asChild className="whitespace-nowrap">
                <Link href={primaryAction.href}>{primaryAction.label}</Link>
              </Button>
            ) : null}
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label={openMenuLabel}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[min(100vw,20rem)] flex-col gap-6 sm:max-w-sm">
              <SheetHeader>
                <SheetTitle className="text-left">{menuLabel}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1">
                {navLinks.map(({ href, label }) => (
                  <SheetClose asChild key={href}>
                    <Link
                      href={href}
                      className="rounded-lg px-3 py-3 text-base font-semibold text-foreground hover:bg-muted"
                    >
                      {label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2 border-t pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                {showAuthActions ? (
                  <>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={loginHref}>{loginLabel}</Link>
                    </Button>
                    <Button className="w-full" asChild>
                      <Link href={signupHref}>{signupLabel}</Link>
                    </Button>
                  </>
                ) : null}
                {primaryAction ? (
                  <Button className="w-full" asChild>
                    <Link href={primaryAction.href}>{primaryAction.label}</Link>
                  </Button>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
