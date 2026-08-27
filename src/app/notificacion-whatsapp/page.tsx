import type { Metadata } from "next";
import Link from "next/link";

import { PublicArticle } from "@/components/public-article";
import { createPageMetadata, getGeoLanding } from "@/lib/seo";

const page = getGeoLanding("/notificacion-whatsapp");

export const metadata: Metadata = createPageMetadata({
  title: "Notificaciones por WhatsApp con evidencia",
  description: page.description,
  path: page.path,
  keywords: page.keywords ? [...page.keywords] : undefined,
  ogType: "article",
});

const faqs = [
  {
    question: "¿Se puede notificar por WhatsApp?",
    answer:
      "Sí se puede enviar una comunicación por WhatsApp y conservar evidencia técnica de ese envío. Eso no significa, por sí solo, que el medio cubra cualquier requisito formal que una ley, un reglamento o un contrato impongan para ese acto.",
  },
  {
    question: "¿Cómo se acredita qué mensaje fue enviado?",
    answer:
      "Conviene conservar el texto efectivamente despachado, la plantilla utilizada si aplica, el destinatario, la fecha y hora, y un identificador del mensaje. En Notificas se registra la plantilla de WhatsApp Business aprobada por Meta, con los datos de esa persona, y una huella de ese contenido.",
  },
  {
    question: "¿Qué diferencia existe entre envío y entrega?",
    answer:
      "El envío es el acto de despachar el mensaje hacia el canal. La entrega, cuando el proveedor la informa, indica que el aviso llegó al dispositivo o a la cuenta. Son hechos distintos: un envío puede no entregarse, y una entrega no implica que el destinatario haya leído el contenido.",
  },
  {
    question: "¿Qué ocurre si el destinatario no lee el mensaje?",
    answer:
      "Puede quedar constancia del envío y, si Meta lo reporta, de la entrega. La ausencia de lectura no borra esos eventos anteriores. El valor que se le asigne a esa secuencia depende del caso y de quien deba valorarla.",
  },
  {
    question: "¿Una comunicación por WhatsApp reemplaza una carta documento?",
    answer:
      "No necesariamente. Son medios distintos. Si una norma o un contrato exigen carta documento u otra forma puntual, hay que usar esa forma. WhatsApp puede aportar elementos de evidencia sobre una comunicación digital; no convierte automáticamente esa comunicación en el acto formal reservado a otro medio.",
  },
];

export default function NotificacionWhatsAppPage() {
  return (
    <PublicArticle
      title={page.title}
      description={page.description}
      path={page.path}
      lead="Una comunicación por WhatsApp puede generar evidencia útil respecto del contenido enviado, el destinatario y los eventos posteriores que el canal informe. Su valor jurídico dependerá del caso concreto y de los requisitos legales o contractuales aplicables."
      faqs={faqs}
    >
      <h2 className="pt-2 text-xl font-semibold text-foreground">
        Qué es una notificación por WhatsApp
      </h2>
      <p>
        En la práctica, notificar por WhatsApp significa enviar un mensaje identificable a un número
        determinado, con un texto concreto y una marca de tiempo. Las empresas suelen hacerlo a
        través de WhatsApp Business Platform, con plantillas que Meta debe haber aprobado cuando el
        envío no es una respuesta a una conversación abierta.
      </p>
      <p>
        Ese canal es masivo, rápido y familiar para el destinatario. También es un canal de un
        proveedor privado: los eventos de entrega o lectura, cuando existen, los informa Meta, no el
        remitente. Conservar esos eventos de manera ordenada es distinto a “haber mandado un
        mensaje”.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">
        Qué evidencia suele ser relevante
      </h2>
      <p>
        Para que un envío posterior pueda reconstruirse, conviene registrar al menos:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>el contenido despachado (el texto de la plantilla con los datos de esa persona);</li>
        <li>el número de destino;</li>
        <li>la fecha y hora del despacho;</li>
        <li>el identificador del mensaje que asigne el proveedor, si está disponible;</li>
        <li>si el proveedor informó entrega al dispositivo;</li>
        <li>si informó lectura, cuando ese evento exista;</li>
        <li>una forma de comprobar que ese conjunto no fue alterado después.</li>
      </ul>
      <p>
        Un pantallazo aislado muestra una imagen. No siempre permite verificar integridad, ni
        reconstruir la secuencia de eventos, ni distinguir entre “lo envié yo” y “lo edité después”.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Ejemplos de uso frecuentes</h2>
      <p>
        Empresas y estudios usan WhatsApp para avisos de vencimiento, recordatorios, intimaciones de
        pago, comunicaciones comerciales y notificaciones operativas a clientes. En esos escenarios
        el objetivo suele ser doble: que el mensaje llegue y que, más adelante, pueda mostrarse qué
        se envió y qué eventos del canal quedaron registrados.
      </p>
      <p>
        No todos esos usos tienen el mismo marco. Un recordatorio comercial no se valora igual que
        un acto para el que una norma pide una forma específica. Ampliar sobre cobranza está en{" "}
        <Link href="/intimacion-deuda-whatsapp" className="text-primary underline-offset-4 hover:underline">
          intimaciones de deuda por WhatsApp
        </Link>
        ; sobre el valor como elemento de prueba, en{" "}
        <Link href="/whatsapp-como-prueba" className="text-primary underline-offset-4 hover:underline">
          WhatsApp como prueba
        </Link>
        .
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Cómo interviene Notificas</h2>
      <p>
        Notificas permite enviar comunicaciones por WhatsApp Business y preservar evidencia técnica
        de ese envío: plantilla utilizada, datos del destinatario, eventos que Meta reporte (por
        ejemplo, si el aviso llegó al teléfono o si se marcó como leído) y una huella que puede
        anclarse en Polygon. El expediente en Notificas (texto, destinos, eventos) se conserva
        aparte; no está “en la blockchain”.
      </p>
      <p>
        Por WhatsApp no viaja automáticamente “la carta completa”, salvo que la plantilla sea
        exactamente ese texto. Viaja la plantilla aprobada, con las variables de esa persona. Eso es
        lo que queda registrado. Las campañas de volumen se describen en{" "}
        <Link
          href="/notificaciones-masivas-empresas"
          className="text-primary underline-offset-4 hover:underline"
        >
          notificaciones digitales masivas para empresas
        </Link>
        .
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Límites</h2>
      <p>
        WhatsApp no es un organismo público ni un medio procesal. La lectura, cuando se informa, no
        prueba que la persona haya comprendido el texto ni que haya aceptado su contenido. La
        entrega no prueba que el número pertenezca a quien se pretendía notificar si esa
        identificación no está acreditada por otros medios.
      </p>
      <p>
        Si la ley o el contrato exigen carta documento, cédula, notificación judicial u otra forma,
        ese requisito no se cumple por el solo hecho de haber enviado un WhatsApp. La comparación
        está desarrollada en{" "}
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
