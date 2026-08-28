import Link from "next/link";

import { Button } from "@/components/ui/button";

type ArticleCtaProps = {
  title?: string;
  description?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function ArticleCta({
  title = "Generar evidencia de una comunicación",
  description = "Creá una cuenta para enviar por WhatsApp o email, o verificá una constancia ya emitida sin iniciar sesión.",
  primaryHref = "/signup",
  primaryLabel = "Crear cuenta",
  secondaryHref = "/verify",
  secondaryLabel = "Verificar una constancia",
}: ArticleCtaProps) {
  return (
    <section className="rounded-lg border border-border bg-background/60 p-6" aria-labelledby="cta-heading">
      <h2 id="cta-heading" className="text-xl font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
        {description}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button asChild>
          <Link href={primaryHref}>{primaryLabel}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={secondaryHref}>{secondaryLabel}</Link>
        </Button>
      </div>
    </section>
  );
}
