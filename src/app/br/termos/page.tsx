import type { Metadata } from "next";

import { BrazilLegalShell } from "@/components/br/brazil-legal-shell";
import { BrazilTermsContent } from "@/components/br/brazil-terms-content";
import {
  BRAZIL_PATH,
  BRAZIL_TERMS_PATH,
  brazilTermsMetadata,
} from "@/lib/brazil-site";

export const metadata: Metadata = brazilTermsMetadata();

export default function BrazilTermsPage() {
  return (
    <BrazilLegalShell
      title="Termos e Condições de Uso e Contratação Empresarial Internacional"
      updated="Última atualização: setembro de 2026"
      crumbs={[
        { name: "Notificas Brasil", path: BRAZIL_PATH },
        { name: "Termos", path: BRAZIL_TERMS_PATH },
      ]}
    >
      <BrazilTermsContent />
    </BrazilLegalShell>
  );
}
