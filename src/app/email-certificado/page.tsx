import type { Metadata } from "next";
import Link from "next/link";

import { PublicArticle } from "@/components/public-article";
import { createPageMetadata, getGeoLanding } from "@/lib/seo";

const page = getGeoLanding("/email-certificado");

export const metadata: Metadata = createPageMetadata({
  title: "Email verificable y trazabilidad de comunicaciones",
  description: page.description,
  path: page.path,
  keywords: page.keywords ? [...page.keywords] : undefined,
  ogType: "article",
});

const faqs = [
  {
    question: "¿Qué es un email verificable en este contexto?",
    answer:
      "Es un correo del que se conserva evidencia técnica de qué se envió, a quién, cuándo y qué estados posteriores se conocieron (aceptación del envío, rebote, apertura de un enlace de lectura si ocurre). No es una garantía de que el mensaje haya sido leído ni de que reemplace una forma legal.",
  },
  {
    question: "¿Email certificado significa validez jurídica automática?",
    answer:
      "No en el sentido en que a veces se usa esa expresión. “Certificado” aquí no debe leerse como un sello estatal ni como equivalencia a una carta documento. Describe constancias técnicas sobre el envío y sus eventos.",
  },
  {
    question: "¿El servidor aceptó el correo equivale a que llegó a la bandeja?",
    answer:
      "No. La aceptación SMTP indica que el servidor de origen (o el de retransmisión) tomó el mensaje para enviarlo. No prueba por sí sola la entrega en Gmail, Outlook u otro buzón, ni la lectura.",
  },
  {
    question: "¿Qué evidencia conserva Notificas del email?",
    answer:
      "El contenido enviado, el destinatario, la aceptación del envío, los rebotes cuando nos llegan, el primer click al enlace de lectura si ocurre, y huellas de ese conjunto. El certificado de lectura se emite una sola vez, como una foto de ese momento.",
  },
  {
    question: "¿Puede verificarse posteriormente una constancia?",
    answer:
      "Sí. En notificas.com.ar/verify se puede subir el PDF o ingresar el identificador para contrastar la huella con el registro. Un resultado válido habla de integridad del archivo, no del valor legal del acto.",
  },
];

export default function EmailCertificadoPage() {
  return (
    <PublicArticle
      title={page.title}
      description={page.description}
      path={page.path}
      lead="Un correo puede dejar constancia técnica de envío, destinatario, contenido y de algunos estados posteriores. Eso ayuda a reconstruir la comunicación. No convierte al email en un “certificado jurídico” ni reemplaza, por sí solo, una forma que la ley o el contrato exijan."
      faqs={faqs}
    >
      <h2 className="pt-2 text-xl font-semibold text-foreground">
        Por qué evitamos tratar “certificado” como garantía
      </h2>
      <p>
        La expresión “email certificado” aparece en búsquedas porque muchas personas buscan un
        correo con constancia. En este sitio la usamos con cautela: lo que puede conservarse es
        evidencia verificable del envío y de ciertos eventos. No hay aquí una certificación estatal
        del acto, ni una equivalencia automática con medios postales o procesales.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Evidencia de un correo</h2>

      <h3 className="pt-1 text-lg font-semibold text-foreground">Envío</h3>
      <p>
        Queda qué texto salió, a qué dirección y cuándo. Si el servidor de correo aceptó el mensaje
        para despacharlo, ese hecho se puede anotar. Es el punto de partida, no la prueba de
        lectura.
      </p>

      <h3 className="pt-1 text-lg font-semibold text-foreground">Destinatario y contenido</h3>
      <p>
        La dirección de destino y el cuerpo enviado (y adjuntos, si forman parte del envío) son el
        núcleo de lo que más adelante se puede exhibir. Sin ellos, un reporte de “enviado” dice poco.
      </p>

      <h3 className="pt-1 text-lg font-semibold text-foreground">Estado</h3>
      <p>
        Los estados útiles son los que realmente se conocen: aceptación del envío, rebote si el
        buzón rechaza y el aviso vuelve, y —si el diseño del mensaje incluye un enlace de lectura—
        el primer acceso a ese enlace. No registramos como lectura el hecho de que un cliente de
        correo haya “marcado como leído” en Gmail u Outlook.
      </p>

      <h3 className="pt-1 text-lg font-semibold text-foreground">Trazabilidad y conservación</h3>
      <p>
        Trazabilidad es poder ordenar esos eventos en el tiempo. Conservación es guardarlos el plazo
        del servicio: en Notificas, adjuntos, PDFs y el texto sellado se conservan 5 años y no se
        borran a pedido en ese plazo. Las huellas ancladas en Polygon no se reescriben.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Ejemplos de uso</h2>
      <p>
        El correo se usa para comunicaciones con más detalle que una plantilla corta de WhatsApp:
        reclamos, avisos contractuales, documentación adjunta, copias de resguardo. Muchas empresas
        combinan ambos canales. Cada uno deja evidencia distinta; no se deben fusionar en un solo
        relato. El canal WhatsApp está en{" "}
        <Link href="/notificacion-whatsapp" className="text-primary underline-offset-4 hover:underline">
          notificaciones por WhatsApp
        </Link>
        .
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Cómo interviene Notificas</h2>
      <p>
        Notificas envía el correo, conserva el contenido, anota aceptación y rebotes cuando
        corresponden, y puede registrar el primer click al enlace de lectura. El certificado de
        lectura lo emite el usuario una sola vez. Después puede descargar la misma copia; no se le
        agregan eventos posteriores. La verificación pública está en{" "}
        <Link href="/verify" className="text-primary underline-offset-4 hover:underline">
          /verify
        </Link>
        .
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Límites</h2>
      <p>
        Filtros antispam, rebotes silenciosos y buzones que no informan lectura dejan zonas grises.
        Un email verificable documenta lo que el sistema pudo observar; no documenta lo que no
        observó. Tampoco sustituye una carta documento ni una notificación judicial. Ver{" "}
        <Link
          href="/notificacion-digital-vs-carta-documento"
          className="text-primary underline-offset-4 hover:underline"
        >
          notificación digital y carta documento
        </Link>{" "}
        y{" "}
        <Link
          href="/notificacion-fehaciente-digital"
          className="text-primary underline-offset-4 hover:underline"
        >
          qué es una notificación fehaciente digital
        </Link>
        .
      </p>
    </PublicArticle>
  );
}
