import type { Metadata } from "next";
import Link from "next/link";

import { ColombiaLegalShell } from "@/components/co/colombia-legal-shell";
import {
  COLOMBIA_PATH,
  COLOMBIA_PRIVACY_PATH,
  colombiaPageMetadata,
} from "@/lib/colombia-site";
import { SITE_CONTACT, SITE_LEGAL_NAME } from "@/lib/seo";

export const metadata: Metadata = colombiaPageMetadata({
  title: "Política de Tratamiento de Datos Personales | Notificas Colombia",
  description:
    "Política de tratamiento de datos personales de Notificas SRL para el servicio en Colombia, incluyendo el rol de Encargado del Tratamiento frente a clientes B2B.",
  path: COLOMBIA_PRIVACY_PATH,
});

export default function ColombiaPrivacyPage() {
  return (
    <ColombiaLegalShell
      title="Política de Tratamiento de Datos Personales"
      updated="Última actualización: septiembre de 2026"
      crumbs={[
        { name: "Notificas Colombia", path: COLOMBIA_PATH },
        { name: "Privacidad", path: COLOMBIA_PRIVACY_PATH },
      ]}
    >
      <section>
        <h2 className="mb-2 text-lg font-semibold">1. Identificación</h2>
        <p>
          El servicio es prestado por <strong>{SITE_LEGAL_NAME}</strong>, CUIT 33-71729868-9, con
          domicilio en Colón 12, primer piso, San Nicolás de los Arroyos, Buenos Aires, Argentina.
          Contacto:{" "}
          <a href={`mailto:${SITE_CONTACT.email}`} className="text-primary underline">
            {SITE_CONTACT.email}
          </a>
          .
        </p>
        <p className="mt-2">
          No existe una sociedad colombiana de Notificas. Esta política describe el tratamiento de
          datos en el marco de la oferta dirigida a organizaciones en Colombia.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">2. Responsable y Encargado</h2>
        <p>
          Cuando un cliente colombiano utiliza Notificas para procesar datos de sus destinatarios
          (nombres, teléfonos, correos, variables de cartera u otros datos necesarios para ejecutar
          una comunicación), el cliente actúa como <strong>Responsable del Tratamiento</strong> y
          Notificas puede operar como <strong>Encargado del Tratamiento</strong>, bajo
          instrucciones del cliente y mediante los instrumentos contractuales correspondientes,
          conforme a la Ley 1581 de 2012 y sus normas complementarias.
        </p>
        <p className="mt-2">
          Respecto de los datos de contacto de quienes solicitan una demostración o propuesta
          comercial a través de este sitio (nombre, apellido, empresa, cargo, correo, teléfono y
          volumen estimado), {SITE_LEGAL_NAME} actúa como responsable de ese tratamiento con la
          finalidad de atender la solicitud comercial.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">3. Datos tratados</h2>
        <ul className="ml-2 list-inside list-disc space-y-1">
          <li>Datos de contacto comercial: nombre, apellido, empresa, cargo, correo y teléfono.</li>
          <li>
            Datos operativos suministrados por el cliente: destinatarios, canales, variables de
            personalización y registros técnicos de envío, entrega y eventos asociados.
          </li>
          <li>Datos técnicos de uso de la plataforma: identificadores de mensaje, estados y evidencias.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">4. Finalidades</h2>
        <ul className="ml-2 list-inside list-disc space-y-1">
          <li>Ejecutar y documentar las comunicaciones instruidas por el cliente.</li>
          <li>Generar trazabilidad, evidencias individuales y reportes.</li>
          <li>Atender solicitudes de demostración o propuesta comercial.</li>
          <li>Cumplir obligaciones legales y contractuales aplicables.</li>
        </ul>
        <p className="mt-2">
          Notificas no utiliza las bases de destinatarios del cliente para publicidad propia ni
          para comercializar esos datos.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">5. Blockchain</h2>
        <p>
          Puede registrarse una huella criptográfica (hash) de la evidencia mediante tecnología
          blockchain. Los datos personales y el contenido de la comunicación no se publican en
          blockchain. Se registra únicamente la huella correspondiente.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">6. Derechos</h2>
        <p>
          Los titulares pueden ejercer los derechos previstos en la normativa aplicable, en
          particular acceso, actualización, rectificación y supresión, ante el Responsable de su
          caso. Si el tratamiento lo realiza Notificas como Encargado, canalizaremos la solicitud
          ante el cliente Responsable.
        </p>
        <p className="mt-2">
          Para consultas sobre esta política:{" "}
          <a href={`mailto:${SITE_CONTACT.email}`} className="text-primary underline">
            {SITE_CONTACT.email}
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">7. Cookies</h2>
        <p>
          El sitio utiliza cookies estrictamente necesarias para el funcionamiento de la sesión y
          preferencias de visualización. Consulte la{" "}
          <Link href="/co/cookies" className="text-primary underline">
            política de cookies
          </Link>
          .
        </p>
      </section>
    </ColombiaLegalShell>
  );
}
