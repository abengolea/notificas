import type { ReactNode } from "react";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";

import { FooterContactForm } from "@/components/footer-contact-form";
import { Logo } from "@/components/logo";
import { BRAZIL_TERMS_PATH } from "@/lib/brazil-site";
import { ARGENTINA_ORIGIN } from "@/lib/international-site";
import {
  LEGACY_ARCHIVO_BASE_PATH,
  LEGACY_ARCHIVO_PUBLIC_LABEL,
} from "@/lib/legacy-archivo";
import { LEGAL_PUBLIC_PAGES, RESOURCE_HUB } from "@/lib/public-resources";
import { SITE_CONTACT, SITE_LEGAL_NAME } from "@/lib/seo";

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(208_38%_20%)]"
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

const BRAZIL_SITE_LINKS = [
  { href: "/br#evidencias", label: "Evidências" },
  { href: "/br/pre-negativacao", label: "Pré-negativação" },
  { href: "/br/verificar", label: "Verificar evidência" },
  { href: "/br#cotacao", label: "Cotação" },
] as const;

type PublicFooterProps = {
  variant?: "full" | "compact";
  locale?: "es-AR" | "pt-BR";
};

export function PublicFooter({
  variant = "compact",
  locale = "es-AR",
}: PublicFooterProps) {
  const isBrazil = locale === "pt-BR";
  const links = isBrazil ? BRAZIL_SITE_LINKS : SITE_LINKS;

  return (
    <footer className="footer-band selection:bg-primary/45 selection:text-white">
      <div className="container grid grid-cols-1 gap-10 px-4 py-10 md:grid-cols-12 md:gap-8 md:px-6 md:py-12">
        <div className="md:col-span-4">
          <h2 className="sr-only">Notificas</h2>
          <Logo
            variant="wordmark"
            onDark
            className="h-10 w-auto max-w-[16rem]"
          />
          <address className="mt-3 not-italic text-sm leading-relaxed text-white/80">
            {SITE_CONTACT.address.streetAddress}
            <br />
            {SITE_CONTACT.address.addressLocality}, {SITE_CONTACT.address.addressRegion}
            <br />
            Argentina
          </address>
          {isBrazil ? (
            <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-white/70">
              Empresa internacional. Operação societária em {SITE_LEGAL_NAME}, Argentina. Os
              termos de uso para o Brasil estão em português. A política de privacidade societária
              permanece em espanhol.
            </p>
          ) : null}
        </div>

        <nav className="md:col-span-3" aria-label={isBrazil ? "Páginas" : "Páginas"}>
          <h2 className="text-lg font-bold tracking-tight">
            {isBrazil ? "Páginas" : "Páginas"}
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {links.map((item) => (
              <li key={item.href}>
                {"external" in item ? (
                  <a
                    href={item.href}
                    className="text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(208_38%_20%)]"
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
          <h2 className="text-lg font-bold tracking-tight">
            {isBrazil ? "Contato" : "Contacto"}
          </h2>
          {variant === "full" && !isBrazil ? (
            <div className="mt-3">
              <FooterContactForm />
              <p className="mt-4 text-sm leading-relaxed text-white/80">
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
              <p className="flex items-center gap-2 text-white/80">
                <Mail className="h-4 w-4 shrink-0" aria-hidden />
                <a
                  href={`mailto:${SITE_CONTACT.email}`}
                  className="underline-offset-4 hover:underline"
                >
                  {SITE_CONTACT.email}
                </a>
              </p>
              <p className="flex items-center gap-2 text-white/80">
                <Phone className="h-4 w-4 shrink-0" aria-hidden />
                <a
                  href={`tel:${SITE_CONTACT.phone}`}
                  className="underline-offset-4 hover:underline"
                >
                  {SITE_CONTACT.phoneDisplay}
                </a>
              </p>
              <p className="text-white/80">
                <FooterLink href={isBrazil ? "/br#cotacao" : "/#contacto"}>
                  {isBrazil ? "Ir ao formulário de cotação" : "Ir al formulario de contacto"}
                </FooterLink>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/20">
        <div className="container flex flex-col gap-3 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-white/80 md:flex-row md:items-center md:justify-between md:gap-6 md:px-6">
          <p>{isBrazil ? "Direitos autorais © 2026" : "Copyright © 2026"} | {SITE_LEGAL_NAME}</p>
          <nav aria-label={isBrazil ? "Informação legal" : "Información legal"}>
            <ul className="flex flex-col gap-2 md:flex-row md:flex-wrap md:gap-x-4 md:gap-y-1">
              {(isBrazil
                ? [
                    { path: BRAZIL_TERMS_PATH, title: "Termos" },
                    { path: "/privacidad", title: "Privacidade (ES)" },
                  ]
                : LEGAL_PUBLIC_PAGES
              ).map((page) => (
                <li key={page.path}>
                  <FooterLink href={page.path}>{page.title}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>
          <p>
            <Link
              href={isBrazil ? `${ARGENTINA_ORIGIN}/login?next=/empresa` : "/login?next=/empresa"}
              className="text-sm leading-tight text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              {isBrazil ? "Acesso à plataforma" : "Acceso empresas"}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
