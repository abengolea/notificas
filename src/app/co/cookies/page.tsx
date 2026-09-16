import type { Metadata } from "next";
import Link from "next/link";

import { ColombiaLegalIdentity, ColombiaMailLink } from "@/components/co/colombia-legal-identity";
import { ColombiaLegalShell } from "@/components/co/colombia-legal-shell";
import {
  COLOMBIA_COOKIES_PATH,
  COLOMBIA_LEGAL_UPDATED_LABEL,
  COLOMBIA_PATH,
  COLOMBIA_PRIVACY_PATH,
  colombiaPageMetadata,
} from "@/lib/colombia-site";

export const metadata: Metadata = colombiaPageMetadata({
  title: "Cookies | Notificas Colombia",
  description:
    "Uso de cookies en el sitio de Notificas Colombia, prestado por NOTIFICAS S.R.L. desde Argentina. Cookies técnicas necesarias para la sesión y preferencias de visualización.",
  path: COLOMBIA_COOKIES_PATH,
});

export default function ColombiaCookiesPage() {
  return (
    <ColombiaLegalShell
      title="Política de Cookies"
      updated={`Última actualización: ${COLOMBIA_LEGAL_UPDATED_LABEL}`}
      crumbs={[
        { name: "Notificas Colombia", path: COLOMBIA_PATH },
        { name: "Cookies", path: COLOMBIA_COOKIES_PATH },
      ]}
    >
      <section>
        <h2 className="mb-2 text-lg font-semibold">1. Prestador</h2>
        <div className="space-y-3">
          <ColombiaLegalIdentity compact />
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">2. Qué utilizamos</h2>
        <p>
          Este sitio utiliza cookies estrictamente necesarias para el funcionamiento técnico: sesión
          cuando corresponde, preferencia de tema (claro, oscuro o sistema) y medidas de seguridad
          básicas.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">3. Qué no utilizamos</h2>
        <p>
          No utilizamos cookies de seguimiento publicitario de terceros en esta landing. No
          construimos perfiles de marketing a partir de la navegación de este sitio.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">4. Gestión</h2>
        <p>
          Puede bloquear o eliminar cookies desde la configuración de su navegador. Si deshabilita
          cookies técnicas, algunas funciones (por ejemplo, recordar el tema) pueden dejar de
          operar.
        </p>
        <p className="mt-2">
          El tratamiento de datos personales asociado al sitio se describe en la{" "}
          <Link href={COLOMBIA_PRIVACY_PATH} className="text-primary underline">
            Política de Tratamiento de Datos Personales
          </Link>
          . Consultas: <ColombiaMailLink />.
        </p>
      </section>
    </ColombiaLegalShell>
  );
}
