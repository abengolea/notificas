import type { Metadata } from "next";

import { ColombiaLegalShell } from "@/components/co/colombia-legal-shell";
import {
  COLOMBIA_COOKIES_PATH,
  COLOMBIA_PATH,
  colombiaPageMetadata,
} from "@/lib/colombia-site";

export const metadata: Metadata = colombiaPageMetadata({
  title: "Cookies | Notificas Colombia",
  description:
    "Uso de cookies en el sitio de Notificas Colombia. Cookies técnicas necesarias para la sesión y preferencias de visualización.",
  path: COLOMBIA_COOKIES_PATH,
});

export default function ColombiaCookiesPage() {
  return (
    <ColombiaLegalShell
      title="Cookies"
      updated="Última actualización: septiembre de 2026"
      crumbs={[
        { name: "Notificas Colombia", path: COLOMBIA_PATH },
        { name: "Cookies", path: COLOMBIA_COOKIES_PATH },
      ]}
    >
      <section>
        <h2 className="mb-2 text-lg font-semibold">Qué utilizamos</h2>
        <p>
          Este sitio utiliza cookies estrictamente necesarias para el funcionamiento técnico: sesión
          cuando corresponde, preferencia de tema (claro, oscuro o sistema) y medidas de seguridad
          básicas.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Qué no utilizamos</h2>
        <p>
          No utilizamos cookies de seguimiento publicitario de terceros en esta landing. No
          construimos perfiles de marketing a partir de la navegación de este sitio.
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Gestión</h2>
        <p>
          Puede bloquear o eliminar cookies desde la configuración de su navegador. Si deshabilita
          cookies técnicas, algunas funciones (por ejemplo, recordar el tema) pueden dejar de
          operar.
        </p>
      </section>
    </ColombiaLegalShell>
  );
}
