import type { Metadata } from "next";

import { ColombiaLegalShell } from "@/components/co/colombia-legal-shell";
import {
  COLOMBIA_PATH,
  COLOMBIA_PRIVACY_PATH,
  COLOMBIA_TERMS_PATH,
  colombiaPageMetadata,
} from "@/lib/colombia-site";
import { SITE_CONTACT, SITE_LEGAL_NAME } from "@/lib/seo";

export const metadata: Metadata = colombiaPageMetadata({
  title: "Términos y Condiciones | Notificas Colombia",
  description:
    "Términos del servicio de Notificas SRL para organizaciones en Colombia: infraestructura de comunicaciones por WhatsApp y correo electrónico con evidencia técnica.",
  path: COLOMBIA_TERMS_PATH,
});

export default function ColombiaTermsPage() {
  return (
    <ColombiaLegalShell
      title="Términos y Condiciones"
      updated="Última actualización: septiembre de 2026"
      crumbs={[
        { name: "Notificas Colombia", path: COLOMBIA_PATH },
        { name: "Términos", path: COLOMBIA_TERMS_PATH },
      ]}
    >
      <section>
        <h2 className="mb-2 text-lg font-semibold">1. Prestador</h2>
        <p>
          El servicio es prestado por <strong>{SITE_LEGAL_NAME}</strong>, CUIT 33-71729868-9,
          Argentina. Contacto:{" "}
          <a href={`mailto:${SITE_CONTACT.email}`} className="text-primary underline">
            {SITE_CONTACT.email}
          </a>
          . No se afirma la existencia de una sociedad colombiana de Notificas.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">2. Objeto</h2>
        <p>
          Notificas es infraestructura tecnológica para comunicaciones empresariales por WhatsApp y
          correo electrónico, con trazabilidad, evidencia individual y reportes. No es una empresa
          de cobranza, no es asesora legal y no sustituye el sistema de cartera del cliente.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">3. Alcance B2B</h2>
        <p>
          La oferta colombiana está dirigida a organizaciones. El cliente define la finalidad, el
          contenido, los destinatarios, los canales y la legitimidad de cada comunicación. Notificas
          ejecuta y documenta según instrucciones y condiciones contractuales.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">4. Evidencia técnica</h2>
        <p>
          La plataforma genera registros técnicos (contenido comunicado, fecha, canal,
          identificadores y eventos disponibles) y puede asociar mecanismos de integridad. Esos
          registros no constituyen, por sí solos, una categoría jurídica específica ni una garantía
          de resultado judicial.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">5. Compliance</h2>
        <p>
          Las funcionalidades son herramientas tecnológicas. Cada organización es responsable de
          determinar la base jurídica, oportunidad, contenido, destinatarios y canales aplicables,
          incluyendo las reglas de la Ley 2300 de 2023, la Ley 1266 de 2008 y la Ley 1581 de 2012
          cuando correspondan.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">6. Datos personales</h2>
        <p>
          El tratamiento de datos de destinatarios se rige por la{" "}
          <a href={COLOMBIA_PRIVACY_PATH} className="text-primary underline">
            Política de Tratamiento de Datos Personales
          </a>{" "}
          y por el contrato con el cliente.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">7. Contratación</h2>
        <p>
          Los precios y condiciones se definen por propuesta según volumen, canales y modo de
          integración. No hay tarifa pública en este sitio.
        </p>
      </section>
    </ColombiaLegalShell>
  );
}
