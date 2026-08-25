import type { Metadata } from "next";
import Link from "next/link";

import { PublicArticle } from "@/components/public-article";
import { createPageMetadata, getSeoGuide } from "@/lib/seo";

const page = getSeoGuide("/notificacion-fehaciente-digital");

export const metadata: Metadata = createPageMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
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
        destinos y una huella en Polygon. No decide qué valor le da un juez.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Qué queda registrado</h2>
      <p>
        Del correo anotamos si nuestro servidor lo aceptó para enviar. Eso no prueba que haya llegado a
        la bandeja ni que lo hayan leído. Si el buzón rebota y nos llega el aviso, lo anotamos. Del
        enlace de lectura, si hay un click, queda el primero. El certificado de lectura lo emitís vos,
        una sola vez, como una foto de ese momento.
      </p>
      <p>
        Por WhatsApp no viaja la carta completa, salvo que la plantilla sea exactamente ese texto.
        Viaja la plantilla que Meta ya aprobó, con los datos de esa persona. Meta informa si el aviso
        llegó al teléfono o si lo leyeron; eso es lo que registramos.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Qué no prueba</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Que el mail “entró a Gmail o Outlook” solo porque SMTP lo aceptó.</li>
        <li>Que el destinatario leyó el cuerpo entero del WhatsApp, si viajó una plantilla corta.</li>
        <li>Que reemplaza carta documento, cédula u otra forma que una norma exija.</li>
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
