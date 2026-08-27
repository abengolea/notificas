import type { Metadata } from "next";
import Link from "next/link";

import { LandingHeader } from "@/components/landing-header";
import { JsonLd } from "@/components/json-ld";
import { PublicFooter } from "@/components/public-footer";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import {
  GEO_LANDING_PAGES,
  RESOURCE_HUB,
  SEO_GUIDE_PAGES,
} from "@/lib/public-resources";
import { createPageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd, organizationJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = createPageMetadata({
  title: "Recursos",
  description: RESOURCE_HUB.description,
  path: RESOURCE_HUB.path,
});

const crumbs = [
  { name: "Inicio", path: "/" },
  { name: "Recursos", path: RESOURCE_HUB.path },
];

export default function RecursosPage() {
  return (
    <div className="brand-canvas flex min-h-screen flex-col text-foreground">
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <LandingHeader />
      <main className="flex-1 container max-w-3xl px-4 py-12">
        <Breadcrumbs items={crumbs} />
        <article className="space-y-8">
          <header className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">{RESOURCE_HUB.title}</h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              Artículos públicos sobre comunicaciones digitales verificables por WhatsApp y email.
              Están pensados para responder preguntas reales, con lenguaje preciso sobre evidencia
              técnica y sin afirmar equivalencias jurídicas que el producto no sostiene.
            </p>
          </header>

          <section aria-labelledby="geo-heading">
            <h2 id="geo-heading" className="mb-4 text-xl font-semibold">
              Preguntas frecuentes de búsqueda
            </h2>
            <ul className="grid gap-4">
              {GEO_LANDING_PAGES.map((page) => (
                <li key={page.path}>
                  <Link
                    href={page.path}
                    className="block rounded-lg border border-border bg-background/60 p-4 transition-colors hover:bg-muted/60"
                  >
                    <span className="font-semibold leading-snug">{page.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{page.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="guias-heading">
            <h2 id="guias-heading" className="mb-4 text-xl font-semibold">
              Guías del producto
            </h2>
            <ul className="grid gap-4">
              {SEO_GUIDE_PAGES.map((page) => (
                <li key={page.path}>
                  <Link
                    href={page.path}
                    className="block rounded-lg border border-border bg-background/60 p-4 transition-colors hover:bg-muted/60"
                  >
                    <span className="font-semibold leading-snug">{page.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{page.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-sm text-muted-foreground">
            Para comprobar una constancia ya emitida, usá{" "}
            <Link href="/verify" className="text-primary underline-offset-4 hover:underline">
              Verificar
            </Link>
            . Para enviar,{" "}
            <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
              registrate
            </Link>
            .
          </p>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
