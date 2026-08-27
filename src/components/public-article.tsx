import type { ReactNode } from "react";
import Link from "next/link";

import { LandingHeader } from "@/components/landing-header";
import { JsonLd } from "@/components/json-ld";
import { PublicFooter } from "@/components/public-footer";
import { ArticleCta } from "@/components/seo/article-cta";
import { ArticleFaq } from "@/components/seo/article-faq";
import { ArticleHeader } from "@/components/seo/article-header";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { LegalDisclaimer } from "@/components/seo/legal-disclaimer";
import { RelatedResources } from "@/components/seo/related-resources";
import { RESOURCE_HUB } from "@/lib/public-resources";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
} from "@/lib/structured-data";

type PublicArticleProps = {
  title: string;
  description: string;
  path: string;
  children: ReactNode;
  lead?: string;
  faqs?: ReadonlyArray<{ question: string; answer: string }>;
  cta?: {
    title?: string;
    description?: string;
    primaryHref?: string;
    primaryLabel?: string;
    secondaryHref?: string;
    secondaryLabel?: string;
  };
};

export function PublicArticle({
  title,
  description,
  path,
  children,
  lead,
  faqs,
  cta,
}: PublicArticleProps) {
  const crumbs = [
    { name: "Inicio", path: "/" },
    { name: "Recursos", path: RESOURCE_HUB.path },
    { name: title, path },
  ];

  return (
    <div className="brand-canvas flex min-h-screen flex-col text-foreground">
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={softwareApplicationJsonLd()} />
      <JsonLd data={articleJsonLd({ title, description, path })} />
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      {faqs?.length ? <JsonLd data={faqPageJsonLd(faqs)} /> : null}
      <LandingHeader />
      <main className="flex-1 container max-w-3xl px-4 py-12">
        <Breadcrumbs items={crumbs} />
        <article className="space-y-6 text-sm leading-relaxed text-foreground/90 sm:text-base">
          {lead ? (
            <ArticleHeader title={title} lead={lead} />
          ) : (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">
                Última actualización: 27 de agosto de 2026 · Responsable: Notificas SRL
              </p>
            </>
          )}
          {children}
          {faqs?.length ? <ArticleFaq items={faqs} /> : null}
          <LegalDisclaimer />
          <ArticleCta {...cta} />
        </article>

        <RelatedResources currentPath={path} />

        <p className="mt-10 text-sm text-muted-foreground">
          <Link href="/" className="text-primary hover:underline">
            ← Volver al inicio
          </Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
