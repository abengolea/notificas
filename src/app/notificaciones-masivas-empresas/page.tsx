import type { Metadata } from "next";
import Link from "next/link";

import { PublicArticle } from "@/components/public-article";
import { createPageMetadata, getGeoLanding } from "@/lib/seo";

const page = getGeoLanding("/notificaciones-masivas-empresas");

export const metadata: Metadata = createPageMetadata({
  title: "Notificaciones digitales masivas para empresas",
  description: page.description,
  path: page.path,
  keywords: page.keywords ? [...page.keywords] : undefined,
  ogType: "article",
});

const faqs = [
  {
    question: "¿Se pueden realizar notificaciones masivas?",
    answer:
      "Sí. Notificas procesa campañas corporativas de cientos o miles de destinatarios por WhatsApp o email, con personalización por fila, envío progresivo y registro de eventos. El volumen se cotiza; no se publica una tarifa única.",
  },
  {
    question: "¿Cómo se cargan los destinatarios?",
    answer:
      "En el panel de empresas las campañas aceptan archivos CSV con las columnas que pida el canal y la plantilla (por ejemplo teléfono, nombre y variables del mensaje). No anunciamos aquí una API pública de clientes: el mecanismo disponible para las campañas es la carga de archivos y el panel.",
  },
  {
    question: "¿WhatsApp masivo es un chat libre?",
    answer:
      "No. WhatsApp Business Platform usa plantillas aprobadas por Meta, con reglas y cupos del proveedor. Notificas envía esas plantillas, registra lo despachado y anota lo que Meta reporta.",
  },
  {
    question: "¿Queda evidencia de cada destinatario?",
    answer:
      "Cada fila se trata como un envío individual: contenido personalizado, destino, estados y eventos. Eso permite reportes y constancias por comunicación, no solo un total de campaña.",
  },
  {
    question: "¿El envío masivo cumple cualquier requisito legal?",
    answer:
      "No. Escalar un canal no cambia la forma que una norma o un contrato puedan exigir. La evidencia técnica de cada envío es un plano distinto al cumplimiento jurídico del acto.",
  },
];

export default function NotificacionesMasivasPage() {
  return (
    <PublicArticle
      title={page.title}
      description={page.description}
      path={page.path}
      lead="Las empresas pueden enviar comunicaciones digitales masivas por WhatsApp y email con seguimiento por destinatario, siempre que el canal y la base lo permitan. Notificas registra esos envíos y sus eventos. El volumen no convierte cada mensaje en un acto formal equivalente a una carta documento."
      faqs={faqs}
      cta={{
        title: "Campañas corporativas",
        description:
          "Contanos volumen, canal y tipo de comunicación. Las campañas de alto volumen se implementan previa evaluación técnica y cotización.",
        primaryHref: "/#cotizacion",
        primaryLabel: "Solicitar cotización",
        secondaryHref: "/login?next=/empresa",
        secondaryLabel: "Acceso empresas",
      }}
    >
      <h2 className="pt-2 text-xl font-semibold text-foreground">Para quién está pensado</h2>
      <p>
        El envío uno a uno alcanza cuando hay pocos destinatarios. Cuando hay cientos o miles —
        clientes, usuarios, afiliados, deudores, asegurados — hace falta procesar una base,
        personalizar cada fila, respetar los límites del canal y dejar rastro de cada comunicación.
      </p>
      <p>Eso aparece, entre otros, en:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>fintech y entidades financieras;</li>
        <li>bancos y compañías de crédito;</li>
        <li>retailers y ecommerce;</li>
        <li>seguros;</li>
        <li>telecomunicaciones y empresas de servicios;</li>
        <li>cobranzas y estudios;</li>
        <li>plataformas digitales con bases de usuarios.</li>
      </ul>
      <p>
        Los usos concretos van desde avisos de vencimiento y gestión de mora hasta comunicaciones
        contractuales, cortes de servicio o novedades operativas. Cada rubro tiene normas propias;
        este artículo describe el plano técnico del envío, no el régimen de cada industria.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">CSV, panel y lo que no anunciamos</h2>
      <p>
        En el panel de empresas, las campañas permiten cargar destinatarios mediante CSV. El archivo
        debe traer las columnas que el canal y la plantilla exijan —identidad de contacto y
        variables del mensaje—. Un CSV mal separado o incompleto no se procesa. Ese flujo está
        disponible hoy para las organizaciones que operan campañas.
      </p>
      <p>
        No describimos aquí una API pública de integración para clientes finales porque no es un
        producto documentado en este sitio. Si una organización necesita una integración a medida,
        eso se evalúa en la cotización; no se presenta como funcionalidad ya publicada.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Canales y evidencia</h2>
      <p>
        WhatsApp usa plantillas de Meta, envío progresivo según capacidad, y registro de lo que el
        proveedor informe sobre entrega o lectura. El correo anota si el servidor aceptó el envío,
        si llegó un rebote y si la persona abrió el enlace de lectura cuando ese evento ocurre. SMTP
        aceptado no significa que el mail haya ingresado a la bandeja. Más detalle en{" "}
        <Link href="/notificacion-whatsapp" className="text-primary underline-offset-4 hover:underline">
          notificaciones por WhatsApp
        </Link>{" "}
        y en{" "}
        <Link href="/email-certificado" className="text-primary underline-offset-4 hover:underline">
          email verificable
        </Link>
        .
      </p>
      <p>
        La certificación tecnológica consiste en huellas de contenido y eventos, que pueden
        anclarse en Polygon. No es un aval de un organismo público.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Cómo se cotiza</h2>
      <p>
        Los envíos individuales del panel personal usan créditos. Las campañas de volumen se
        evalúan caso por caso: calidad de la base, plantilla, ritmo, canal y reportes. No
        publicamos tarifas de Meta ni un precio único de campaña.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Límites</h2>
      <p>
        Meta puede limitar plantillas, números o velocidad. Una base con teléfonos inválidos produce
        fallas de entrega, no “notificaciones jurídicas”. El envío masivo no sustituye formas
        legales puntuales ni dispensa de políticas de privacidad y de consentimiento que correspondan
        a cada organización.
      </p>
      <p>
        Para el marco del producto frente a la carta documento, ver{" "}
        <Link
          href="/notificacion-digital-vs-carta-documento"
          className="text-primary underline-offset-4 hover:underline"
        >
          notificación digital y carta documento
        </Link>
        . El enfoque operativo de WhatsApp Business también está en{" "}
        <Link
          href="/notificaciones-whatsapp-empresas"
          className="text-primary underline-offset-4 hover:underline"
        >
          notificaciones por WhatsApp para empresas
        </Link>
        .
      </p>
    </PublicArticle>
  );
}
