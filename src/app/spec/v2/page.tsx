import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingHeader } from '@/components/landing-header';
import { PublicFooter } from '@/components/public-footer';
import { JsonLd } from '@/components/json-ld';
import { createPageMetadata, SITE_CONTACT, SITE_LEGAL_NAME } from '@/lib/seo';
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
              v1 no tiene <code>leavesDigest</code>. El PDF de lote v4 solo se emite si el digest del
              payload v2 coincide con las hojas impresas.
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
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Árbol Merkle</h2>
            <p>
              Padre = SHA-256(UTF-8(left + &quot;|&quot; + right)). Hoja impar: se duplica la última.
              Un solo nodo: la raíz es esa hoja. La raíz viaja en el payload on-chain. El PDF de lote
              no incluye pruebas Merkle por destinatario; eso está en la constancia individual.
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
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Lo que esto no prueba</h2>
            <p>
              No es notificación fehaciente, no identifica civilmente al titular del teléfono y no
              prueba la deuda que declare el cliente. La inmutabilidad la aporta la transacción, no el
              PDF.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
