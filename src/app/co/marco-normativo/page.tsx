import type { Metadata } from "next";

import { ColombiaLegalIdentity, ColombiaMailLink } from "@/components/co/colombia-legal-identity";
import { ColombiaLegalShell } from "@/components/co/colombia-legal-shell";
import { colombiaCopy } from "@/lib/colombia-content";
import {
  COLOMBIA_FRAMEWORK_PATH,
  COLOMBIA_LEGAL_UPDATED_LABEL,
  COLOMBIA_PATH,
  LEY_1266_URL,
  LEY_1581_URL,
  LEY_2300_URL,
  colombiaPageMetadata,
} from "@/lib/colombia-site";

export const metadata: Metadata = colombiaPageMetadata({
  title: "Marco normativo | Notificas Colombia",
  description:
    "Referencia educativa sobre la Ley 2300 de 2023, el artículo 12 de la Ley 1266 de 2008 y la Ley 1581 de 2012 para operaciones de cobranza y comunicaciones documentadas.",
  path: COLOMBIA_FRAMEWORK_PATH,
  keywords: [
    "Ley 2300 de 2023",
    "Ley 1266 artículo 12",
    "comunicación previa reporte negativo",
    "canales de cobranza Colombia",
  ],
});

export default function ColombiaFrameworkPage() {
  const copy = colombiaCopy.marco;

  return (
    <ColombiaLegalShell
      title={copy.title}
      updated={`Última actualización: ${COLOMBIA_LEGAL_UPDATED_LABEL}`}
      crumbs={[
        { name: "Notificas Colombia", path: COLOMBIA_PATH },
        { name: "Marco normativo", path: COLOMBIA_FRAMEWORK_PATH },
      ]}
    >
      <section>
        <h2 className="mb-2 text-lg font-semibold">Prestador</h2>
        <div className="space-y-3">
          <ColombiaLegalIdentity compact />
        </div>
      </section>
      <p>{copy.lead}</p>
      <section>
        <h2 className="mb-2 text-lg font-semibold">{copy.ley2300Title}</h2>
        <p>{copy.ley2300Body}</p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">{copy.ley1266Title}</h2>
        <p>{copy.ley1266Body}</p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">{copy.ley1581Title}</h2>
        <p>{copy.ley1581Body}</p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">{copy.sourcesLabel}</h2>
        <ul className="space-y-2">
          <li>
            <a href={LEY_2300_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Ley 2300 de 2023 — Función Pública
            </a>
          </li>
          <li>
            <a href={LEY_1266_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Ley 1266 de 2008 — Función Pública
            </a>
          </li>
          <li>
            <a href={LEY_1581_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Ley 1581 de 2012 — Función Pública
            </a>
          </li>
        </ul>
        <p className="mt-3">
          Consultas: <ColombiaMailLink />.
        </p>
      </section>
    </ColombiaLegalShell>
  );
}
