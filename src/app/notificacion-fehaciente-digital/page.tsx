import type { Metadata } from "next";
import Link from "next/link";

import { PublicArticle } from "@/components/public-article";
import { createPageMetadata, getSeoGuide } from "@/lib/seo";

const page = getSeoGuide("/notificacion-fehaciente-digital");

export const metadata: Metadata = createPageMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
  ogType: "article",
  keywords: [
    "notificación fehaciente digital",
    "notificaciones fehacientes Argentina",
    "constancia de envío digital",
    "certificado de lectura",
  ],
});

export default function NotificacionFehacientePage() {
  return (
    <PublicArticle title={page.title} description={page.description} path={page.path}>
      <p>
        En la práctica, “fehaciente” significa que podés mostrar qué se envió, a quién y cuándo, con un
        rastro que no depende de un pantallazo. Notificas deja esa constancia técnica: el texto, los
        destinos y una huella en Polygon. La valoración jurídica corresponde al juez.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Qué queda registrado</h2>
      <p>
        Del correo anotamos si nuestro servidor lo aceptó para enviar. Si el buzón rebota y nos llega el aviso, lo anotamos. Del
        enlace de lectura, si hay un click, queda el primero. El certificado de lectura lo emitís vos,
        una sola vez, como una foto de ese momento.
      </p>
      <p>
        Por WhatsApp no viaja la carta completa, salvo que la plantilla sea exactamente ese texto.
        Viaja la plantilla que Meta ya aprobó, con los datos de esa persona. Meta informa si el aviso
        llegó al teléfono o si lo leyeron; eso es lo que registramos.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Qué aporta</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Qué texto se envió, a quién y en qué fecha y hora.</li>
        <li>Si el servidor de correo lo aceptó para enviar y los rebotes cuando nos llegan.</li>
        <li>Lo que Meta informó del aviso de WhatsApp: entrega y lectura.</li>
        <li>Una huella anclada en Polygon, que se puede verificar sin depender de Notificas.</li>
      </ul>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Cómo se usa</h2>
      <p>
        La constancia de envío se genera cuando sale el mensaje. El certificado de lectura se baja
        cuando conviene congelar ese instante. Después podés descargar la misma copia; no se le
        agregan lecturas ni rebotes nuevos. Adjuntos y texto se conservan 5 años en Notificas; lo
        publicado en Polygon no se borra.
      </p>
      <p>
        Para comprobar un PDF, usá{" "}
        <Link href="/verify" className="text-primary underline-offset-4 hover:underline">
          Verificar certificado
        </Link>
        . Si necesitás volumen, hay{" "}
        <Link
          href="/notificaciones-whatsapp-empresas"
          className="text-primary underline-offset-4 hover:underline"
        >
          campañas por WhatsApp y correo
        </Link>
        , previa cotización. Para empezar un envío uno a uno,{" "}
        <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
          creá una cuenta
        </Link>
        .
      </p>
    </PublicArticle>
  );
}
