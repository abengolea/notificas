import type { ReactNode } from "react";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";

import { FooterContactForm } from "@/components/footer-contact-form";
import {
  LEGACY_ARCHIVO_BASE_PATH,
  LEGACY_ARCHIVO_PUBLIC_LABEL,
} from "@/lib/legacy-archivo";
import { LEGAL_PUBLIC_PAGES, RESOURCE_HUB } from "@/lib/public-resources";
import { SITE_CONTACT } from "@/lib/seo";

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-background/80 underline-offset-4 transition-colors hover:text-background hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/50 focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
    >
      {children}
    </Link>
  );
}

const SITE_LINKS = [
  { href: RESOURCE_HUB.path, label: "Recursos" },
  { href: "/verify", label: "Verificar un certificado" },
  { href: LEGACY_ARCHIVO_BASE_PATH, label: LEGACY_ARCHIVO_PUBLIC_LABEL, external: true },
] as const;

export function PublicFooter({ variant = "compact" }: { variant?: "full" | "compact" }) {
  return (
    <footer className="bg-foreground text-background selection:bg-primary/45 selection:text-background">
      <div className="container grid grid-cols-1 gap-10 px-4 py-10 md:grid-cols-12 md:gap-8 md:px-6 md:py-12">
        <div className="md:col-span-4">
          <h2 className="text-lg font-bold tracking-tight">Notificas</h2>
          <address className="mt-3 not-italic text-sm leading-relaxed text-background/80">
            {SITE_CONTACT.address.streetAddress}
            <br />
            {SITE_CONTACT.address.addressLocality}, {SITE_CONTACT.address.addressRegion}
            <br />
            Argentina
          </address>
        </div>

        <nav className="md:col-span-3" aria-label="Páginas">
          <h2 className="text-lg font-bold tracking-tight">Páginas</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {SITE_LINKS.map((item) => (
              <li key={item.href}>
                {"external" in item ? (
                  <a
                    href={item.href}
                    className="text-background/80 underline-offset-4 transition-colors hover:text-background hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/50 focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
                  >
                    {item.label}
                  </a>
                ) : (
                  <FooterLink href={item.href}>{item.label}</FooterLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div id="contacto" className="scroll-mt-24 md:col-span-5">
          <h2 className="text-lg font-bold tracking-tight">Contacto</h2>
          {variant === "full" ? (
            <div className="mt-3">
              <FooterContactForm />
              <p className="mt-4 text-sm leading-relaxed text-background/80">
                O escribinos a{" "}
                <a
                  href={`mailto:${SITE_CONTACT.email}`}
                  className="underline-offset-4 hover:underline"
                >
                  {SITE_CONTACT.email}
                </a>
                {" · "}
                <a
                  href={`tel:${SITE_CONTACT.phone}`}
                  className="underline-offset-4 hover:underline"
                >
                  {SITE_CONTACT.phoneDisplay}
                </a>
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-3 text-sm">
              <p className="flex items-center gap-2 text-background/80">
                <Mail className="h-4 w-4 shrink-0" aria-hidden />
                <a
                  href={`mailto:${SITE_CONTACT.email}`}
                  className="underline-offset-4 hover:underline"
                >
                  {SITE_CONTACT.email}
                </a>
              </p>
              <p className="flex items-center gap-2 text-background/80">
                <Phone className="h-4 w-4 shrink-0" aria-hidden />
                <a
                  href={`tel:${SITE_CONTACT.phone}`}
                  className="underline-offset-4 hover:underline"
                >
                  {SITE_CONTACT.phoneDisplay}
                </a>
              </p>
              <p className="text-background/80">
                <FooterLink href="/#contacto">Ir al formulario de contacto</FooterLink>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-background/20">
        <div className="container flex flex-col gap-3 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-background/80 md:flex-row md:items-center md:justify-between md:gap-6 md:px-6">
          <p>Copyright © 2026 | Notificas SRL</p>
          <nav aria-label="Información legal">
            <ul className="flex flex-col gap-2 md:flex-row md:flex-wrap md:gap-x-4 md:gap-y-1">
              {LEGAL_PUBLIC_PAGES.map((page) => (
                <li key={page.path}>
                  <FooterLink href={page.path}>{page.title}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>
          <p>
            <Link
              href="/login?next=/empresa"
              className="text-sm leading-tight text-background/80 transition-colors hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/50"
            >
              Acceso empresas
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
