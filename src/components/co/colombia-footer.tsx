import Link from "next/link";

import { Logo } from "@/components/logo";
import { colombiaCopy } from "@/lib/colombia-content";
import { COLOMBIA_FOOTER_LINKS, COLOMBIA_PATH } from "@/lib/colombia-site";
import { SITE_CONTACT, SITE_LEGAL_NAME } from "@/lib/seo";

export function ColombiaFooter() {
  return (
    <footer className="footer-band selection:bg-primary/45 selection:text-white">
      <div className="container grid grid-cols-1 gap-10 px-4 py-12 md:grid-cols-12 md:gap-8 md:px-6">
        <div className="md:col-span-5">
          <Link href={COLOMBIA_PATH} aria-label="Notificas Colombia">
            <Logo variant="wordmark" onDark className="h-10 w-auto max-w-[16rem]" />
          </Link>
          <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-white/80">
            {colombiaCopy.brand.tagline}
          </p>
          <p className="mt-4 text-sm text-white/70">{colombiaCopy.brand.legalLine}</p>
          <p className="mt-1 text-sm text-white/70">{colombiaCopy.brand.entityLine}</p>
          <p className="mt-1 text-sm text-white/70">{colombiaCopy.brand.markets}</p>
        </div>

        <nav className="md:col-span-4" aria-label="Colombia">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {COLOMBIA_FOOTER_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="md:col-span-3">
          <p className="text-sm text-white/80">
            <a
              href={`mailto:${SITE_CONTACT.email}`}
              className="underline-offset-4 hover:underline"
            >
              {SITE_CONTACT.email}
            </a>
          </p>
          <p className="mt-3 text-xs leading-relaxed text-white/55">
            {SITE_LEGAL_NAME}, CUIT {SITE_CONTACT.cuit}. Domicilio en{" "}
            {SITE_CONTACT.address.streetAddress}, {SITE_CONTACT.address.addressLocality},{" "}
            {SITE_CONTACT.address.addressRegion}, Argentina. No existe una sociedad colombiana
            de Notificas. El servicio para Colombia se presta desde Argentina.
          </p>
        </div>
      </div>

      <div className="border-t border-white/20">
        <div className="container flex flex-col gap-2 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-white/70 md:flex-row md:items-center md:justify-between md:px-6">
          <p>Copyright © 2026 | {SITE_LEGAL_NAME}</p>
          <p>{colombiaCopy.brand.markets}</p>
        </div>
      </div>
    </footer>
  );
}
