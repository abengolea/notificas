import type { ReactNode } from "react";
import Link from "next/link";

import { BrazilHeader } from "@/components/br/brazil-header";
import { JsonLd } from "@/components/json-ld";
import { PublicFooter } from "@/components/public-footer";
import { BRAZIL_PATH, brazilBreadcrumbJsonLd } from "@/lib/brazil-site";

export function BrazilLegalShell({
  title,
  updated,
  crumbs,
  children,
}: {
  title: string;
  updated: string;
  crumbs: ReadonlyArray<{ name: string; path: string }>;
  children: ReactNode;
}) {
  return (
    <div className="brand-canvas flex min-h-screen flex-col text-foreground">
      <JsonLd data={brazilBreadcrumbJsonLd(crumbs)} />
      <BrazilHeader />
      <main className="container max-w-3xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mb-10 mt-2 text-sm text-muted-foreground">{updated}</p>
        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">{children}</div>
        <p className="mt-12 border-t pt-6 text-sm">
          <Link href={BRAZIL_PATH} className="text-primary underline-offset-4 hover:underline">
            Voltar à Notificas Brasil
          </Link>
        </p>
      </main>
      <PublicFooter locale="pt-BR" />
    </div>
  );
}
