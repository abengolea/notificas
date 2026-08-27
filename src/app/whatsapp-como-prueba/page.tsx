import type { Metadata } from "next";
import Link from "next/link";

import { PublicArticle } from "@/components/public-article";
import { createPageMetadata, getGeoLanding } from "@/lib/seo";

const page = getGeoLanding("/whatsapp-como-prueba");

export const metadata: Metadata = createPageMetadata({
  title: "WhatsApp como prueba: evidencia y trazabilidad",
  description: page.description,
  path: page.path,
  keywords: page.keywords ? [...page.keywords] : undefined,
  ogType: "article",
});

const faqs = [
  {
    question: "¿Un WhatsApp sirve como prueba?",
    answer:
      "Puede constituir un elemento probatorio sobre una comunicación, si se logra acreditar contenido, partes, fecha y, cuando sea posible, integridad. No hay una respuesta única: el peso de ese elemento lo determina quien deba valorarlo, según el caso y las reglas aplicables.",
  },
  {
    question: "¿Qué conviene conservar además del texto?",
    answer:
      "Remitente, destinatario, fecha y hora, identificadores del mensaje, eventos de entrega y de lectura cuando existan, y un mecanismo para verificar que el conjunto no fue modificado. El texto suelto, sin contexto ni integridad, suele ser más débil.",
  },
  {
    question: "¿Sirve un pantallazo?",
    answer:
      "Un pantallazo puede ilustrar un contenido, pero no demuestra por sí mismo que no fue recortado, reenviado o editado, ni reconstruye la secuencia de entrega. Conviene complementarlo con registros técnicos del envío.",
  },
  {
    question: "¿Qué pasa si el chat se borra después?",
    answer:
      "Si la única copia estaba en el teléfono, puede perderse. Por eso importa conservar el contenido y los eventos fuera del dispositivo, con una huella que permita detectar alteraciones posteriores.",
  },
  {
    question: "¿Notificas transforma un WhatsApp en prueba plena?",
    answer:
      "No. Notificas preserva evidencia técnica y trazabilidad de eventos. No califica el valor legal de esa evidencia ni reemplaza pericias, oficios u otros medios que un proceso pueda requerir.",
  },
];

export default function WhatsAppComoPruebaPage() {
  return (
    <PublicArticle
      title={page.title}
      description={page.description}
      path={page.path}
      lead="Si un mensaje de WhatsApp puede llegar a discutirse, conviene conservar no solo el texto, sino también quién lo envió, a quién, cuándo, cómo se identificó el mensaje y qué eventos de entrega o lectura quedaron registrados. Esa evidencia es un elemento técnico; su suficiencia jurídica se valora en cada caso."
      faqs={faqs}
    >
      <h2 className="pt-2 text-xl font-semibold text-foreground">
        Por qué el contenido solo no alcanza
      </h2>
      <p>
        Un mensaje de WhatsApp es fácil de copiar y de sacar de contexto. Quien lo exhibe más
        adelante suele necesitar mostrar, con el mayor rigor posible, que ese texto es el que se
        envió, a ese destinatario, en esa fecha, y que no fue reescrito. Esa es una cuestión de
        evidencia, no de eslóganes sobre “fehaciencia”.
      </p>
      <p>
        Este artículo no asesora sobre el resultado de un juicio. Describe qué datos suelen ser
        útiles para reconstruir una comunicación y dónde aparecen sus límites.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Elementos que conviene registrar</h2>

      <h3 className="pt-1 text-lg font-semibold text-foreground">Contenido</h3>
      <p>
        El texto efectivamente despachado, no un resumen posterior. En envíos empresariales con
        plantillas, el contenido relevante es la plantilla aprobada más los datos de esa persona. Si
        había encabezado, pie o botones, también forman parte de lo enviado.
      </p>

      <h3 className="pt-1 text-lg font-semibold text-foreground">Remitente y destinatario</h3>
      <p>
        Qué número o cuenta envió el mensaje y a qué número se dirigió. Identificar el teléfono no
        equivale, por sí solo, a identificar a una persona determinada: esa correspondencia puede
        requerir otros elementos (contratos, padrones internos, reconocimientos, etc.).
      </p>

      <h3 className="pt-1 text-lg font-semibold text-foreground">Fecha y hora</h3>
      <p>
        El sello temporal del despacho, y el de los eventos posteriores si el canal los informa.
        Conviene conservar la zona horaria o el criterio de registro para evitar ambigüedades.
      </p>

      <h3 className="pt-1 text-lg font-semibold text-foreground">Identificación de mensajes</h3>
      <p>
        Los proveedores suelen asignar un identificador al mensaje (por ejemplo, un WAMID en
        WhatsApp Business). Ese dato ayuda a distinguir un envío de otro y a correlacionar eventos
        de entrega o lectura con el texto concreto.
      </p>

      <h3 className="pt-1 text-lg font-semibold text-foreground">Entrega y lectura</h3>
      <p>
        La entrega, cuando se informa, apunta a que el aviso llegó al dispositivo o a la cuenta. La
        lectura, cuando existe, es un evento posterior y distinto. Ninguno de los dos prueba que la
        persona haya aceptado el contenido, ni que haya leído cada párrafo.
      </p>

      <h3 className="pt-1 text-lg font-semibold text-foreground">Integridad, conservación y trazabilidad</h3>
      <p>
        Integridad significa poder detectar si el registro fue alterado. Conservación significa
        guardarlo el tiempo necesario fuera del teléfono. Trazabilidad significa poder ordenar los
        eventos: envío, entrega, lectura, clicks a un enlace, emisión de una constancia. Un archivo
        que no se puede verificar más tarde pierde utilidad.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Cómo interviene Notificas</h2>
      <p>
        Notificas registra el contenido despachado por WhatsApp Business, los destinos, los eventos
        que Meta reporta y una huella de ese conjunto. Esa huella puede anclarse en Polygon. Las
        constancias PDF pueden contrastarse después en{" "}
        <Link href="/verify" className="text-primary underline-offset-4 hover:underline">
          notificas.com.ar/verify
        </Link>
        . El detalle operativo del canal está en{" "}
        <Link href="/notificacion-whatsapp" className="text-primary underline-offset-4 hover:underline">
          notificaciones por WhatsApp
        </Link>
        .
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Límites</h2>
      <p>
        Conservar evidencia no decide el conflicto. Un juez, un mediador o un organismo pueden
        pedir otros recaudos, restar valor a un medio o exigir una forma distinta. WhatsApp, además,
        no identifica por sí mismo al titular de la línea con certeza absoluta.
      </p>
      <p>
        Si el acto requiere una forma legal determinada, la evidencia digital no la reemplaza. Ver{" "}
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
