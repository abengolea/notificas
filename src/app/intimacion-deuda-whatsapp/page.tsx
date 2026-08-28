import type { Metadata } from "next";
import Link from "next/link";

import { PublicArticle } from "@/components/public-article";
import { createPageMetadata, getGeoLanding } from "@/lib/seo";

const page = getGeoLanding("/intimacion-deuda-whatsapp");

export const metadata: Metadata = createPageMetadata({
  title: "Intimaciones de deuda por WhatsApp",
  description: page.description,
  path: page.path,
  keywords: page.keywords ? [...page.keywords] : undefined,
  ogType: "article",
});

const faqs = [
  {
    question: "¿Se puede intimar una deuda por WhatsApp?",
    answer:
      "Se puede comunicar una intimación de pago por WhatsApp y conservar evidencia técnica de ese envío. Cumplir o no un recaudo jurídico concreto —plazo, forma, domicilio, contenido mínimo— depende de la relación, del contrato y de la normativa aplicable, no del canal elegido.",
  },
  {
    question: "¿Sirve para cobranza empresarial?",
    answer:
      "Muchas áreas de mora usan WhatsApp porque llega rápido y a escala. Eso ayuda a comunicar. Acreditar el despacho es un segundo paso. Un tercer paso, distinto, es verificar si para ese crédito o ese procedimiento la ley pide una forma determinada.",
  },
  {
    question: "¿Qué evidencia conviene guardar en una intimación?",
    answer:
      "El texto enviado a esa persona, el destino, la fecha, los eventos de entrega o lectura si el canal los informa, y una constancia que pueda verificarse después. También conviene no mezclar plantillas distintas en un mismo relato.",
  },
  {
    question: "¿Si no leen el WhatsApp, la intimación no existe?",
    answer:
      "La falta de lectura no borra el envío ni, cuando exista, la entrega. Qué efecto tiene esa secuencia sobre plazos o constitutivos de mora es una cuestión jurídica del caso, no un resultado que el software pueda garantizar.",
  },
  {
    question: "¿Una intimación por WhatsApp reemplaza la carta documento?",
    answer:
      "No automáticamente. Son comunicaciones distintas. Si el crédito, el contrato o una norma exigen carta documento u otro medio, ese recaudo sigue vigente.",
  },
];

export default function IntimacionDeudaWhatsAppPage() {
  return (
    <PublicArticle
      title={page.title}
      description={page.description}
      path={page.path}
      lead="Una intimación de deuda por WhatsApp es, en primer lugar, una comunicación. Conservar evidencia de su envío y de los eventos del canal es un segundo plano, técnico. Un tercero, jurídico, es si ese medio alcanza para el recaudo que el caso exige. Los tres no coinciden automáticamente."
      faqs={faqs}
      cta={{
        title: "Intimaciones de volumen para cobranza",
        description:
          "Las campañas corporativas se evalúan y cotizan según base, plantilla y canal. También podés verificar una constancia ya emitida.",
        primaryHref: "/#cotizacion",
        primaryLabel: "Solicitar cotización",
      }}
    >
      <h2 className="pt-2 text-xl font-semibold text-foreground">
        Tres planos que conviene no mezclar
      </h2>
      <p>
        En cobranza empresarial aparece con frecuencia la misma confusión: se envía un WhatsApp, se
        obtiene un tilde o un reporte, y se asume que “ya está intimado” en el sentido jurídico del
        término. Conviene separar:
      </p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          <strong className="text-foreground">Realizar una comunicación.</strong> El mensaje salió
          hacia un número, con un texto de reclamo, vencimiento o mora.
        </li>
        <li>
          <strong className="text-foreground">Acreditar técnicamente su envío.</strong> Queda
          registro de contenido, destino, fecha y, si el canal lo informa, entrega o lectura.
        </li>
        <li>
          <strong className="text-foreground">Cumplir requisitos jurídicos específicos.</strong>{" "}
          Algunos procedimientos, contratos o normas piden forma, domicilio, contenido mínimo o
          un medio determinado. Eso no lo resuelve el canal.
        </li>
      </ol>

      <h2 className="pt-2 text-xl font-semibold text-foreground">
        Casos frecuentes en empresas
      </h2>
      <p>
        Áreas de mora, estudios de cobranza, fintech, utilities y retailers suelen intimar saldos
        vencidos, cuotas impagas o cortes de servicio. WhatsApp permite personalizar nombre, DNI,
        monto, fecha de vencimiento y días de atraso, y procesar cientos o miles de destinatarios.
        Eso es operación. No es, por sí solo, una calificación legal del acto.
      </p>
      <p>
        También es habitual combinar canales: un WhatsApp de aviso y un email con más detalle. Cada
        canal deja su propio rastro. Mezclarlos en un relato sin distinguir qué viajó por cada uno
        debilita la evidencia. El envío a escala se explica en{" "}
        <Link
          href="/notificaciones-masivas-empresas"
          className="text-primary underline-offset-4 hover:underline"
        >
          notificaciones digitales masivas
        </Link>
        .
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Qué evidencia es relevante aquí</h2>
      <p>
        En una intimación interesa poder mostrar, más adelante, qué se dijo, a quién, cuándo, y si
        el proveedor del canal informó entrega. Interesa no sobredimensionar la lectura: muchas
        personas no abren el aviso y aun así el envío ocurrió. Interesa no afirmar que el número
        “es” el deudor si esa vinculación no está documentada en la relación comercial.
      </p>
      <p>
        Sobre los elementos (contenido, identificadores, integridad) ver{" "}
        <Link href="/whatsapp-como-prueba" className="text-primary underline-offset-4 hover:underline">
          WhatsApp como prueba
        </Link>
        .
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Cómo interviene Notificas</h2>
      <p>
        Notificas permite despachar intimaciones por WhatsApp Business con plantillas aprobadas,
        registrar lo enviado a cada destinatario y conservar los eventos que Meta reporte. Puede
        combinarse con email. Las campañas de volumen se cotizan; no hay una tarifa pública única de
        Meta ni de campaña.
      </p>
      <p>
        El certificado de lectura, si se emite, es una foto de ese momento: se genera una sola vez.
        No convierte la intimación en un acto procesal ni en una carta documento.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Límites</h2>
      <p>
        Hay créditos, fueros y contratos en los que la forma de intimar está reglada. Hay plazos que
        se cuentan desde una notificación hecha de cierta manera. WhatsApp puede ser un canal útil
        de comunicación y de evidencia técnica; no dispensa de revisar si el caso exige otra forma.
        La comparación con la carta documento está en{" "}
        <Link
          href="/notificacion-digital-vs-carta-documento"
          className="text-primary underline-offset-4 hover:underline"
        >
          notificación digital y carta documento
        </Link>
        .
      </p>
    </PublicArticle>
  );
}
