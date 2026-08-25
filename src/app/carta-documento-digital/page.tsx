import type { Metadata } from "next";
import Link from "next/link";

import { PublicArticle } from "@/components/public-article";
import { createPageMetadata, getSeoGuide } from "@/lib/seo";

const page = getSeoGuide("/carta-documento-digital");

export const metadata: Metadata = createPageMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
  keywords: [
    "carta documento digital",
    "alternativa carta documento Argentina",
    "notificación fehaciente vs carta documento",
  ],
});

export default function CartaDocumentoDigitalPage() {
  return (
    <PublicArticle title={page.title} description={page.description} path={page.path}>
      <p>
        No. Si una norma pide carta documento u otra forma puntual, hay que usar esa forma. Notificas
        es más rápido y suele ser más económico, y deja un rastro comprobable. Un juez o un organismo
        decide qué valor le da a esa constancia; Notificas no lo decide.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Para qué sirve entonces</h2>
      <p>
        Sirve cuando necesitás dejar asentado un mensaje digital: intimaciones de pago, avisos de mora,
        comunicaciones laborales o comerciales, reclamos, cortes de servicio, vencimientos. Queda qué
        texto salió, a quién y cuándo, con huella en una red pública (Polygon) y expediente en
        Notificas por 5 años.
      </p>
      <p>
        No sirve para “convertir” ese envío en el acto formal que el Código o una ley especial
        reservan a la carta documento, al telegrama o a la notificación judicial.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Qué lleva el certificado</h2>
      <p>
        Hay dos documentos. La constancia de envío sale sola cuando el mensaje se procesa. El
        certificado de lectura lo emitís una sola vez: texto, huellas y lo que haya pasado hasta ahí
        (aceptación SMTP, rebote si llegó, click al enlace, lectura en pantalla o lo que Meta reporte
        de WhatsApp). Lo que ocurra después no entra en ese archivo.
      </p>

      <p>
        Más detalle en{" "}
        <Link
          href="/notificacion-fehaciente-digital"
          className="text-primary underline-offset-4 hover:underline"
        >
          qué es una notificación fehaciente digital
        </Link>{" "}
        y en los{" "}
        <Link href="/terminos" className="text-primary underline-offset-4 hover:underline">
          términos del servicio
        </Link>
        . Para enviar,{" "}
        <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
          registrate
        </Link>
        .
      </p>
    </PublicArticle>
  );
}
