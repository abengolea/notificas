import Link from "next/link";
import type { ReactNode } from "react";

import { LandingHeader } from "@/components/landing-header";
import { JsonLd } from "@/components/json-ld";
import { SEO_GUIDE_PAGES } from "@/lib/seo";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/structured-data";

type PublicArticleProps = {
  title: string;
  description: string;
  path: string;
  children: ReactNode;
};

export function PublicArticle({ title, description, path, children }: PublicArticleProps) {
  const related = SEO_GUIDE_PAGES.filter((page) => page.path !== path);

  return (
    <div className="brand-canvas flex min-h-screen flex-col text-foreground">
      <JsonLd data={articleJsonLd({ title, description, path })} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: title, path },
        ])}
      />
      <LandingHeader />
      <main className="flex-1 container max-w-3xl px-4 py-12">
        <nav className="mb-6 text-sm text-muted-foreground">
          <Link href="/" className="text-primary underline-offset-4 hover:underline">
            Inicio
          </Link>
          <span aria-hidden> / </span>
          <span className="text-foreground">{title}</span>
        </nav>
        <article className="space-y-6 text-sm leading-relaxed text-foreground/90 sm:text-base">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {children}
        </article>

        <section className="mt-12 border-t pt-8">
          <h2 className="mb-3 text-lg font-semibold">Seguir leyendo</h2>
          <ul className="space-y-2 text-sm">
            {related.map((page) => (
              <li key={page.path}>
                <Link href={page.path} className="text-primary underline-offset-4 hover:underline">
                  {page.title}
                </Link>
                <span className="text-muted-foreground"> — {page.blurb}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10 text-sm text-muted-foreground">
          <Link href="/" className="text-primary hover:underline">
            ← Volver al inicio
          </Link>
        </p>
      </main>
    </div>
  );
}
