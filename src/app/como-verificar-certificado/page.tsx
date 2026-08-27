import type { Metadata } from "next";
import Link from "next/link";

import { PublicArticle } from "@/components/public-article";
import { createPageMetadata, getSeoGuide } from "@/lib/seo";

const page = getSeoGuide("/como-verificar-certificado");

export const metadata: Metadata = createPageMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
  ogType: "article",
  keywords: [
    "verificar certificado Notificas",
    "autenticidad PDF Notificas",
    "verificación Polygon",
  ],
});

export default function ComoVerificarCertificadoPage() {
  return (
    <PublicArticle title={page.title} description={page.description} path={page.path}>
      <p>
        El validador está en{" "}
        <Link href="/verify" className="text-primary underline-offset-4 hover:underline">
          notificas.com.ar/verify
        </Link>
        . Subí el PDF original o ingresá el identificador del mensaje. Comparamos la huella del
        archivo con la que quedó en Polygon. También podés copiar el código de transacción del PDF y
        buscarlo en polygonscan.com.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Qué significa un resultado válido</h2>
      <p>
        Que ese archivo coincide con un registro emitido por Notificas y que la huella no fue
        alterada. No califica el valor legal del documento. El certificado de lectura se emite una
        sola vez: si después hubo otra lectura o un rebote, no están en esa copia.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Si no valida</h2>
      <p>
        Suele ser un PDF reenviado, recortado o impreso y vuelto a escanear. Hace falta el archivo
        original. Los certificados viejos pueden mencionar notificas.com; el validador vigente es
        este sitio, notificas.com.ar.
      </p>
      <p>
        Abrí el{" "}
        <Link href="/verify" className="text-primary font-medium underline-offset-4 hover:underline">
          verificador
        </Link>
        . Si estás armando un envío,{" "}
        <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
          registrate
        </Link>
        .
      </p>
    </PublicArticle>
  );
}
