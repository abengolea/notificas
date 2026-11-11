import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingHeader } from '@/components/landing-header';
import { PublicFooter } from '@/components/public-footer';
import { JsonLd } from '@/components/json-ld';
import { createPageMetadata, SITE_CONTACT, SITE_LEGAL_NAME } from '@/lib/seo';
import { PDF_SCHEMA } from '@/lib/pdf-evidence-format';
import { breadcrumbJsonLd } from '@/lib/structured-data';
import {
  LEAF_SPEC_PATH,
  POLYGON_PUBLISHED_CHAIN_ID,
  POLYGON_PUBLISHED_SIGNER,
} from '@/lib/polygon-published';

export const metadata: Metadata = createPageMetadata({
  title: 'Spec de hojas v2',
  description:
    'Formato de hojas Merkle, payload on-chain y dirección emisora publicada de Notificas SRL en Polygon.',
  path: LEAF_SPEC_PATH,
});

const CODE = 'break-all font-mono text-[13px] leading-relaxed';

export default function LeafSpecV2Page() {
  return (
    <div className="brand-canvas flex min-h-screen flex-col text-foreground">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Inicio', path: '/' },
          { name: 'Spec de hojas v2', path: LEAF_SPEC_PATH },
        ])}
      />
      <LandingHeader />
      <main className="flex-1 container max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Spec de hojas v2</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Documento técnico. No es un certificado ni una constancia individual.
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Quién firma</h2>
            <p>
              Los anclajes de lotes de campaña los emite {SITE_LEGAL_NAME}, CUIT {SITE_CONTACT.cuit},
              en Polygon (chainId {POLYGON_PUBLISHED_CHAIN_ID}) desde esta dirección:
            </p>
            <p className={`${CODE} mt-3 rounded-md bg-muted px-3 py-2`}>{POLYGON_PUBLISHED_SIGNER}</p>
            <p className="mt-3">
              Esa dirección es pública. Si una transacción de lote no sale de ahí, no es un anclaje
              de Notificas. La clave privada no se publica.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Payload on-chain (una transacción por lote)</h2>
            <p>UTF-8, campos separados por <code>|</code>, una sola línea:</p>
            <p className={`${CODE} mt-3 rounded-md bg-muted px-3 py-2`}>
              CAMPAIGN_SEND|v2|{'{campaignId}'}|{'{batchId}'}|{'{merkleRoot}'}|{'{leafCount}'}|{'{timestamp}'}|{'{leavesDigest}'}|{'{templateSealHash?}'}
            </p>
            <p className={`${CODE} mt-2 rounded-md bg-muted px-3 py-2`}>
              CAMPAIGN_EVENT|v2|{'{campaignId}'}|{'{batchId}'}|{'{merkleRoot}'}|{'{leafCount}'}|{'{timestamp}'}|{'{leavesDigest}'}
            </p>
            <p className="mt-3">
              v1 no tiene <code>leavesDigest</code>. El PDF de lote ({PDF_SCHEMA.actaTanda}) solo se emite
              si el digest del payload v2 coincide con las hojas impresas. El campo{' '}
              <code>timestamp</code> es el instante en que se armó el payload (ISO 8601 UTC, milisegundos);
              el momento del anclaje es el timestamp del bloque de la transacción, siempre posterior.
            </p>
            <p className="mt-3">
              El timestamp del bloque es la fecha cierta de la <strong>publicación</strong> de las huellas.
              El envío y los hechos (entrega, lectura, apertura) son anteriores y se publican después, en
              transacciones distintas; el orden en que se minan esas transacciones no prueba el orden de los
              hechos. El puntero entre un hecho y su envío es el <code>sendLeafHash</code> (campo 7 de la
              hoja de evento), no cuál de las dos transacciones se minó primero. La fecha y la hora de cada
              hecho están en su hoja (<code>occurredAt</code> y, para entrega y lectura, lo que informó
              Meta).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Digest de hojas</h2>
            <p>
              Cada hoja es SHA-256(UTF-8(leafPayload)) en hex minúscula de 64 caracteres.{' '}
              <code>leavesDigest</code> es:
            </p>
            <p className={`${CODE} mt-3 rounded-md bg-muted px-3 py-2`}>
              SHA-256(UTF-8(JSON.stringify(leafHashes.sort())))
            </p>
            <p className="mt-3">
              El <code>sort</code> es el de JavaScript sobre strings UTF-16. El JSON es compacto, sin
              espacios. Un hash recortado o rellenado no reproduce el digest.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Payload de una hoja</h2>
            <p className="font-medium">Envío (v2)</p>
            <p className={`${CODE} mt-2 rounded-md bg-muted px-3 py-2`}>
              v2|send|campaignId|messageId|email|phone|dni|nombre|monto|cuotas|rowHash|contentHash|attHashes|smtpId|wamid|waBodyHash|templateSealHash
            </p>
            <p className="font-medium mt-4">Evento (v2)</p>
            <p className={`${CODE} mt-2 rounded-md bg-muted px-3 py-2`}>
              v2|event|campaignId|messageId|eventType|occurredAt|sendLeafHash|wamid|status|metaTimestamp|recipientId|rawPayloadHash
            </p>
            <p className="mt-3">
              <code>eventType</code>: <code>email_read</code>, <code>wa_delivered</code> o{' '}
              <code>wa_read</code>.
            </p>
            <p className="font-medium mt-4">Evento sin evidencia de Meta (v1)</p>
            <p className={`${CODE} mt-2 rounded-md bg-muted px-3 py-2`}>
              v1|event|campaignId|messageId|eventType|occurredAt|sendLeafHash
            </p>
            <p className="mt-3">
              Los hechos que no traen <code>rawPayloadHash</code> (por ejemplo la apertura del correo)
              usan esta forma de siete campos dentro de un lote cuyo payload on-chain sigue siendo v2.
            </p>
            <p className="font-medium mt-4">rawPayloadHash</p>
            <p className="mt-1">
              Para los eventos de WhatsApp (<code>wa_delivered</code>, <code>wa_read</code>),{' '}
              <code>rawPayloadHash</code> es:
            </p>
            <p className={`${CODE} mt-2 rounded-md bg-muted px-3 py-2`}>
              SHA-256(UTF-8(cuerpo HTTP tal como llegó de Meta))
            </p>
            <p className="mt-2">
              El hash se calcula sobre el body crudo —el string recibido en el POST— antes de parsear el
              JSON. Esto permite a un perito verificar que el payload conservado por Notificas en{' '}
              <code>provider_events</code> es byte a byte idéntico al que firmó Meta con HMAC-SHA256. El
              mismo body que pasa la verificación del encabezado{' '}
              <code>X-Hub-Signature-256</code> es el que se hashea. Para reproducirlo:{' '}
              <code>printf &#39;%s&#39; &quot;$raw_body&quot; | sha256sum</code> o equivalente en cualquier
              entorno que lea el payload como UTF-8 sin normalización.
            </p>
            <p className="mt-2">
              El <code>rawPayloadHash</code> en la hoja Merkle ancla criptográficamente la existencia de
              ese cuerpo en el momento del bloque. Para confrontar el payload conservado con el hash
              anclado basta calcular SHA-256 del body guardado en <code>provider_events</code> y
              compararlo con el campo 11 de la hoja; cualquier alteración posterior produce un hash
              distinto.
            </p>
            <p className="font-medium mt-4">Cómo se serializa cada campo</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                Los campos se unen con <code>|</code>. Un campo vacío es una cadena vacía (queda{' '}
                <code>||</code>); no se escribe <code>null</code> ni <code>undefined</code>.
              </li>
              <li>
                En los valores de texto, <code>|</code> se reemplaza por <code>/</code>, los saltos de
                línea por un espacio y se recortan los extremos.
              </li>
              <li>
                <code>email</code> va en minúsculas; <code>phone</code> y <code>dni</code> solo con
                dígitos; <code>attHashes</code> son los SHA-256 de adjuntos ordenados y separados por coma
                (vacío si no hay).
              </li>
              <li>
                <code>contentHash</code> = SHA-256(UTF-8(trim(texto plano))) del cuerpo enviado. El texto
                se hashea tal cual, con sus saltos de línea y líneas en blanco; unir las líneas con espacios
                da otro hash.
              </li>
              <li>
                <code>waBodyHash</code> = SHA-256 del pedido a Meta canonicalizado (
                <code>WA_BODY|v2|…</code>: destinatario, plantilla, idioma, encabezado, cuerpo renderizado,
                pie y variables). Incluye el <code>templateHash</code> del pedido, que es un dato distinto
                del <code>templateSealHash</code>.
              </li>
              <li>
                <code>templateSealHash</code> es el sello de la plantilla aprobada de la campaña. Es el
                «Hash plantilla» del PDF de lote y el último campo de la hoja de envío. El «Hash del pedido
                a Meta» que figura en la constancia individual es el <code>templateHash</code> del request,
                no este sello.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Árbol Merkle</h2>
            <p>
              Padre = SHA-256(UTF-8(left + &quot;|&quot; + right)). Hoja impar: se duplica la última.
              Un solo nodo: la raíz es esa hoja. La raíz viaja en el payload on-chain. El PDF de lote
              no incluye pruebas Merkle por destinatario; están en el anexo técnico de la constancia
              individual, junto con la preimagen de cada hoja.
            </p>
            <p className="mt-3 font-medium">Orden de las hojas</p>
            <p className="mt-1">
              Al cerrar la tanda, las hojas se ordenan por su id (<code>messageId</code> en los envíos,{' '}
              <code>messageId_eventType</code> en los hechos) y recién entonces se asigna{' '}
              <code>leafIndex</code> y se arma el árbol. No es el instante de sellado ni el orden
              alfabético de los hashes: el <code>sort</code> de la sección 3 se aplica solo al calcular el{' '}
              <code>leavesDigest</code>. Para verificar no hace falta reproducir ese orden: el PDF imprime
              el índice de cada hoja y el camino de hermanos, y con eso se recalcula la raíz. Armar el árbol
              con los hashes ordenados alfabéticamente da otra raíz.
            </p>
            <p className="mt-3 font-medium">Verificar una prueba</p>
            <p className={`${CODE} mt-2 whitespace-pre-line rounded-md bg-muted px-3 py-2`}>
              h = leafHash; i = leafIndex{'\n'}
              por cada hermano s del camino: si i es par, h = SHA-256(h + &quot;|&quot; + s); si es impar,
              h = SHA-256(s + &quot;|&quot; + h); luego i = floor(i / 2){'\n'}
              al final, h debe ser igual a merkleRoot del payload on-chain
            </p>
            <p className="mt-3 font-medium">Límites del esquema</p>
            <p className="mt-1">
              El árbol no distingue hojas de nodos internos (no hay prefijo de dominio) y duplica la
              última hoja cuando el nivel es impar, así que dos listas de hojas distintas pueden dar la
              misma raíz si una es la otra con su última hoja repetida. El payload on-chain fija{' '}
              <code>leafCount</code> y cada hoja lleva su <code>messageId</code>, lo que descarta esa
              ambigüedad en lotes legítimos; un esquema con prefijos de dominio sería una versión nueva
              del formato (v3), no un cambio de esta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Cómo verificar un lote</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Abrí la transacción en Polygonscan, decodificá Input Data como UTF-8 y copiá el payload
                en una sola línea.
              </li>
              <li>
                Comprobá que <code>from</code> sea {POLYGON_PUBLISHED_SIGNER}.
              </li>
              <li>
                Recalculá <code>leavesDigest</code> con los hashes de hoja impresos (64 hex cada uno,
                mismo orden del anexo ordenado alfabéticamente para el JSON).
              </li>
              <li>
                La constancia de una persona no es este lote. En{' '}
                <Link href="/verify" className="text-primary underline">
                  /verify
                </Link>{' '}
                el parámetro <code>leaf</code> es el hash de esa hoja.
              </li>
              <li>
                Constancia individual: en el anexo técnico, recalculá SHA-256 de la preimagen de cada hoja
                (debe dar su <code>leafHash</code>), recorré el camino de hermanos como en la sección 5 y
                comprobá que termina en la raíz de la TX. Los hechos citan el <code>leafHash</code> de
                envío en su campo 7. Esa última comparación, raíz contra la transacción, se hace a mano en
                el explorador: el PDF imprime la raíz y la TX completas, pero no puede atestiguar lo que
                dice la cadena.
              </li>
              <li>
                Publicación: compará el timestamp del bloque de cada TX para ver cuándo se publicó cada
                conjunto de huellas, no para datar el hecho. El PDF imprime cada TX completa para poder
                hacerlo en el explorador. La fecha y la hora de cada hecho están en su hoja.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Revisiones de esta spec</h2>
            <p>
              Esta página se versiona por revisión. Un cambio de formato que altere cómo se calcula una
              hoja, un digest o una raíz es una spec nueva (v3) y esta se conserva en su URL. Los ajustes
              de redacción o los datos que se agregan al PDF suben solo la revisión.
            </p>
            <p className="mt-2">
              La cadena prueba los payloads anclados, no este instructivo, y esta página está en un sitio
              que controla Notificas. Quien la use como referencia debe dejar constancia de la fecha y la
              revisión que leyó (por ejemplo, con una copia archivada de la página ese día).
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>v2, rev. 2026-11-11</strong>: se documenta <code>rawPayloadHash</code>: SHA-256
                del cuerpo HTTP crudo del webhook de Meta (antes del parse JSON), campo 11 de la hoja de
                evento v2, que permite a un perito verificar la integridad del payload conservado en{' '}
                <code>provider_events</code> contra el hash anclado en Polygon. Sin cambios de formato ni
                de cálculo.
              </li>
              <li>
                <strong>v2, rev. 2026-11-05</strong>: se aclara que el timestamp del bloque data la
                publicación de las huellas y no el envío ni cada hecho, y que el orden de minado de las
                transacciones no prueba el orden de los hechos. Sin cambios de formato ni de cálculo.
              </li>
              <li>
                <strong>v2, rev. 2026-11-04</strong>: se definen la serialización de campos, el orden de las
                hojas en el árbol, la verificación de una prueba, el cálculo de <code>contentHash</code>, la
                diferencia entre <code>templateSealHash</code> y el hash del pedido a Meta, el evento v1
                dentro de un lote v2 y los límites del esquema. Sin cambios en el cálculo de ninguna hoja,
                digest o raíz ya emitidos.
              </li>
              <li>
                <strong>v2, rev. inicial</strong>: dirección emisora, payloads, digest, forma de las hojas y
                árbol.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Alcance</h2>
            <p>
              Esta spec describe cómo se verifican la integridad de los registros y la fecha de su
              publicación en la cadena. La inmutabilidad la aporta la transacción, no el PDF. La
              valoración jurídica de los hechos corresponde al juez.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
