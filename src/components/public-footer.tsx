import type { ReactNode } from "react";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";

import { FooterContactForm } from "@/components/footer-contact-form";
import { LEGAL_PUBLIC_PAGES, RESOURCE_HUB } from "@/lib/public-resources";
import { SITE_CONTACT } from "@/lib/seo";

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block text-background/80 underline-offset-4 hover:text-background hover:underline"
    >
      {children}
    </Link>
  );
}

export function PublicFooter({ variant = "compact" }: { variant?: "full" | "compact" }) {
  return (
    <footer className="bg-foreground text-background">
      <div className="container grid grid-cols-1 gap-10 px-4 py-12 md:grid-cols-3 md:gap-8 md:px-6 md:py-14">
        <div>
          <h2 className="mb-4 text-lg font-bold">Notificas</h2>
          <p className="text-sm text-background/80">
            {SITE_CONTACT.address.streetAddress} - {SITE_CONTACT.address.addressLocality}
          </p>
          <p className="text-sm text-background/80">
            {SITE_CONTACT.address.addressRegion} - Argentina
          </p>
          <nav className="mt-5 space-y-2 text-sm" aria-label="Recursos">
            <p className="font-semibold text-background">Recursos</p>
            <FooterLink href={RESOURCE_HUB.path}>Todos los recursos</FooterLink>
            <FooterLink href="/notificacion-whatsapp">Notificaciones por WhatsApp</FooterLink>
            <FooterLink href="/whatsapp-como-prueba">WhatsApp como prueba</FooterLink>
            <FooterLink href="/intimacion-deuda-whatsapp">Intimación de deuda</FooterLink>
            <FooterLink href="/notificaciones-masivas-empresas">Notificaciones masivas</FooterLink>
            <FooterLink href="/email-certificado">Email verificable</FooterLink>
            <FooterLink href="/notificacion-digital-vs-carta-documento">
              Digital vs. carta documento
            </FooterLink>
            <FooterLink href="/notificacion-fehaciente-digital">Notificación fehaciente digital</FooterLink>
            <FooterLink href="/carta-documento-digital">Carta documento digital</FooterLink>
            <FooterLink href="/notificaciones-whatsapp-empresas">WhatsApp para empresas</FooterLink>
            <FooterLink href="/como-verificar-certificado">Cómo verificar un certificado</FooterLink>
            <FooterLink href="/verify">Verificar una constancia</FooterLink>
            {LEGAL_PUBLIC_PAGES.map((page) => (
              <FooterLink key={page.path} href={page.path}>
                {page.title}
              </FooterLink>
            ))}
          </nav>
        </div>
        {variant === "full" ? (
          <div id="contacto" className="scroll-mt-24">
            <h2 className="mb-4 text-lg font-bold">Contáctenos</h2>
            <FooterContactForm />
          </div>
        ) : (
          <div id="contacto" className="scroll-mt-24">
            <h2 className="mb-4 text-lg font-bold">Contáctenos</h2>
            <p className="text-sm leading-relaxed text-background/80">
              Escribinos a {SITE_CONTACT.email} o usá el formulario de la página de inicio.
            </p>
            <FooterLink href="/#contacto">Ir al formulario de contacto</FooterLink>
          </div>
        )}
        <div>
          <h2 className="mb-4 text-lg font-bold">Contacto Directo</h2>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-background/80">
              <Mail className="h-4 w-4" aria-hidden />
              <a href={`mailto:${SITE_CONTACT.email}`} className="underline-offset-4 hover:underline">
                {SITE_CONTACT.email}
              </a>
            </p>
            <p className="flex items-center gap-2 text-background/80">
              <Phone className="h-4 w-4" aria-hidden />
              <span>{SITE_CONTACT.phoneDisplay}</span>
            </p>
          </div>
        </div>
      </div>
      <div className="border-t border-background/20">
        <div className="container space-y-2 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-sm text-background/80 md:px-6">
          <p>Copyright © 2026 | Notificas SRL</p>
          <p>
            <Link
              href="/login?next=/empresa"
              className="text-xs leading-tight text-background/55 transition-colors hover:text-background/80"
            >
              Acceso empresas
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
