import type { Metadata } from "next";
import Link from "next/link";

import { PublicArticle } from "@/components/public-article";
import { createPageMetadata, getGeoLanding } from "@/lib/seo";

const page = getGeoLanding("/notificacion-digital-vs-carta-documento");

export const metadata: Metadata = createPageMetadata({
  title: "Notificación digital vs. carta documento",
  description: page.description,
  path: page.path,
  keywords: page.keywords ? [...page.keywords] : undefined,
  ogType: "article",
});

const faqs = [
  {
    question: "¿Una comunicación por WhatsApp o email reemplaza una carta documento?",
    answer:
      "No necesariamente. Son medios distintos, con distinta forma, operador y efectos. Si una norma o un contrato exigen carta documento u otra forma puntual, hay que usar esa forma. La comunicación digital puede aportar evidencia técnica; no se convierte sola en el acto postal o procesal.",
  },
  {
    question: "¿Cuándo suele usarse cada una?",
    answer:
      "La carta documento se usa cuando se busca el recaudo formal de ese servicio postal, o cuando una práctica o una cláusula la mencionan. La comunicación digital se usa cuando se necesita velocidad, escala y rastro técnico de un mensaje por WhatsApp o email. Hay casos en los que conviven, no se sustituyen.",
  },
  {
    question: "¿Cuál deja mejor evidencia?",
    answer:
      "Depende de qué se pretenda probar. La carta documento deja constancia de un servicio postal con sus propias reglas. La comunicación digital puede dejar contenido, destinos, sellos de tiempo, eventos del canal y huellas verificables. No son el mismo tipo de constancia.",
  },
  {
    question: "¿Notificas es más económica que una carta documento?",
    answer:
      "En la operación cotidiana suele ser más rápida y de menor costo unitario, sobre todo a escala. Eso es una comparación operativa, no un argumento de equivalencia jurídica.",
  },
  {
    question: "¿El blockchain hace válida una notificación?",
    answer:
      "No. Una huella en una red pública puede ayudar a detectar alteraciones posteriores. No otorga por sí sola validez jurídica al acto ni reemplaza la forma que la ley exija.",
  },
];

export default function NotificacionVsCartaDocumentoPage() {
  return (
    <PublicArticle
      title={page.title}
      description={page.description}
      path={page.path}
      lead="La notificación digital y la carta documento no son necesariamente equivalentes. Difieren en forma, operador, costos operativos, velocidad, escala y tipo de evidencia. Hay casos en los que una comunicación digital es suficiente para el objetivo práctico, y casos en los que la ley o el contrato exigen otra forma. Notificas no pretende sustituir automáticamente esos requisitos."
      faqs={faqs}
    >
      <h2 className="pt-2 text-xl font-semibold text-foreground">No son el mismo acto</h2>
      <p>
        La carta documento es un servicio postal del Correo Oficial, con pieza física o
        electrónica según la modalidad contratada, y un régimen propio de emisión y constancias. Una
        notificación digital por WhatsApp o email es una comunicación a través de canales de
        proveedores privados, de la que puede conservarse evidencia técnica.
      </p>
      <p>
        Confundirlas genera expectativas que el producto no puede sostener: ni “reemplaza la carta
        documento”, ni “tiene el mismo valor”, ni “garantiza validez judicial”. Un tribunal u
        organismo valorará cada medio según el caso. El{" "}
        <a
          href="http://servicios.infoleg.gob.ar/infolegInternet/anexos/235000-239999/235975/texact.htm"
          className="text-primary underline-offset-4 hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          Código Civil y Comercial
        </a>{" "}
        y normas especiales pueden exigir formas determinadas para ciertos actos; esa lectura
        corresponde al caso concreto, no a un sitio web.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Comparación operativa</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="mb-2 text-left text-sm text-muted-foreground">
            Comparación orientativa. No es un cuadro de equivalencia jurídica.
          </caption>
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-3 font-semibold">Aspecto</th>
              <th className="py-2 pr-3 font-semibold">Comunicación digital (WhatsApp / email)</th>
              <th className="py-2 font-semibold">Carta documento</th>
            </tr>
          </thead>
          <tbody className="align-top text-muted-foreground">
            <tr className="border-b">
              <td className="py-3 pr-3 font-medium text-foreground">Forma</td>
              <td className="py-3 pr-3">Mensaje digital por canal de un proveedor privado.</td>
              <td className="py-3">Servicio postal con constancia propia del correo oficial.</td>
            </tr>
            <tr className="border-b">
              <td className="py-3 pr-3 font-medium text-foreground">Velocidad</td>
              <td className="py-3 pr-3">Minutos u horas, según el canal y la cola de envío.</td>
              <td className="py-3">Plazos postales; no es instantánea.</td>
            </tr>
            <tr className="border-b">
              <td className="py-3 pr-3 font-medium text-foreground">Escalabilidad</td>
              <td className="py-3 pr-3">
                Apta para cientos o miles de destinatarios, con CSV y envío progresivo.
              </td>
              <td className="py-3">Unitaria o por lote postal; el costo y la logística crecen rápido.</td>
            </tr>
            <tr className="border-b">
              <td className="py-3 pr-3 font-medium text-foreground">Costos operativos</td>
              <td className="py-3 pr-3">
                Suele ser de menor costo unitario, sobre todo a escala. Las campañas se cotizan.
              </td>
              <td className="py-3">Costo postal por pieza, variable según modalidad y destino.</td>
            </tr>
            <tr className="border-b">
              <td className="py-3 pr-3 font-medium text-foreground">Evidencia disponible</td>
              <td className="py-3 pr-3">
                Contenido, destino, tiempo, eventos del canal (entrega/lectura si se informan),
                huellas verificables.
              </td>
              <td className="py-3">Constancias del servicio postal según la modalidad contratada.</td>
            </tr>
            <tr>
              <td className="py-3 pr-3 font-medium text-foreground">Límite jurídico típico</td>
              <td className="py-3 pr-3">
                No cubre por sí sola una forma legal que exija otro medio.
              </td>
              <td className="py-3">
                Tampoco cubre por sí sola cualquier acto: hay notificaciones judiciales u otras
                formas específicas.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Usos frecuentes de cada medio</h2>
      <p>
        La comunicación digital se usa mucho para avisos de mora, vencimientos, gestiones de
        cobranza a escala, comunicaciones comerciales y laborales de trámite cotidiano, y para dejar
        rastro de un mensaje que de otro modo solo existiría en un chat o en un buzón. La carta
        documento suele reservarse para momentos en los que se busca expresamente ese recaudo formal,
        o cuando una cláusula o una práctica del caso la mencionan.
      </p>
      <p>
        No hay una regla de este sitio que diga “usá siempre una” o “usá siempre la otra”. Hay
        situaciones en las que ambas se usan en momentos distintos de la misma relación.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Cómo interviene Notificas</h2>
      <p>
        Notificas ofrece el plano digital: envío por WhatsApp y email, preservación de evidencia
        técnica, trazabilidad de eventos y verificación posterior de constancias. No emite cartas
        documento ni actúa como correo oficial. Una descripción más corta de ese alcance está en{" "}
        <Link href="/carta-documento-digital" className="text-primary underline-offset-4 hover:underline">
          carta documento digital: qué cubre Notificas y qué no
        </Link>
        .
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Límites que no negociamos en el texto</h2>
      <p>
        Blockchain no hace válida una notificación. Un PDF de Notificas no es una sentencia. Un
        WhatsApp entregado no es, por ese solo hecho, el equivalente funcional de una carta
        documento. Quien deba decidir un conflicto puede apartarse de cualquiera de estos medios.
      </p>
      <p>
        Normas de consumo, laborales o procesales pueden imponer recaudos adicionales. A modo de
        referencia general —no como catálogo del producto— pueden consultarse fuentes oficiales como{" "}
        <a
          href="https://www.argentina.gob.ar"
          className="text-primary underline-offset-4 hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          Argentina.gob.ar
        </a>{" "}
        e{" "}
        <a
          href="https://www.infoleg.gob.ar"
          className="text-primary underline-offset-4 hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          InfoLEG
        </a>
        .
      </p>
    </PublicArticle>
  );
}
