import { Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  LEGACY_ARCHIVO_LOGIN_HREF,
  LEGACY_ARCHIVO_PUBLIC_BLURB,
  LEGACY_ARCHIVO_PUBLIC_HEADING,
  LEGACY_ARCHIVO_PUBLIC_LABEL,
} from "@/lib/legacy-archivo";

/** Enlace nativo: /archivo es un SPA estático, no una ruta de App Router. */
export function LegacyArchiveCallout() {
  return (
    <aside
      id="archivo-historico"
      className="mt-14 max-w-xl border-t border-border pt-10"
      aria-labelledby="archivo-historico-heading"
    >
      <h3
        id="archivo-historico-heading"
        className="mb-3 flex items-center gap-2 text-xl font-semibold text-foreground"
      >
        <Archive className="h-5 w-5 text-primary" aria-hidden />
        {LEGACY_ARCHIVO_PUBLIC_HEADING}
      </h3>
      <p className="mb-5 max-w-[60ch] text-muted-foreground">{LEGACY_ARCHIVO_PUBLIC_BLURB}</p>
      <Button asChild variant="outline" size="lg">
        <a href={LEGACY_ARCHIVO_LOGIN_HREF}>{LEGACY_ARCHIVO_PUBLIC_LABEL}</a>
      </Button>
    </aside>
  );
}
