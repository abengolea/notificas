import type { Metadata } from "next";
import Link from "next/link";

import { PublicArticle } from "@/components/public-article";
import { createPageMetadata, getSeoGuide } from "@/lib/seo";

const page = getSeoGuide("/notificaciones-whatsapp-empresas");

export const metadata: Metadata = createPageMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
  ogType: "article",
  keywords: [
    "notificaciones WhatsApp empresas",
    "campañas WhatsApp Business",
    "notificaciones masivas Argentina",
    "gestión de mora WhatsApp",
  ],
});

export default function WhatsAppEmpresasPage() {
  return (
    <PublicArticle title={page.title} description={page.description} path={page.path}>
      <p>
        Las campañas corporativas usan WhatsApp Business Platform. No es un chat libre: van plantillas
        que Meta tiene que haber aprobado, con sus reglas y cupos. Notificas procesa la base,
        personaliza cada fila, envía de a poco según capacidad, anota lo que Meta reporta y deja
        huella en Polygon.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Qué se certifica en WhatsApp</h2>
      <p>
        Se registra la plantilla aprobada con los datos de esa persona. Meta avisa si el aviso llegó
        al teléfono o si lo leyeron. Eso no es la carta completa, salvo que la plantilla sea ese
        texto. El certificado de lectura, si lo emitís, es una foto de ese momento: se saca una sola
        vez.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Correo en paralelo</h2>
      <p>
        En el mail anotamos si nuestro servidor lo aceptó, si nos llega un rebote, y si la persona
        abrió el enlace de lectura. SMTP aceptado no significa “llegó a la bandeja”. Podés combinar
        ambos canales en la misma campaña; cada uno deja su propio rastro.
      </p>

      <h2 className="pt-2 text-xl font-semibold text-foreground">Volumen y cotización</h2>
      <p>
        Los envíos uno a uno se pagan con créditos. Cientos o miles de destinatarios se cotizan caso
        por caso: no publicamos tarifas de Meta ni un precio único de campaña. Hace falta evaluación
        técnica (calidad de la base, plantilla, ritmo de envío).
      </p>
      <p>
        Pedí una cotización desde el{" "}
        <Link href="/#empresas" className="text-primary underline-offset-4 hover:underline">
          formulario para empresas
        </Link>
        , leé{" "}
        <Link
          href="/notificaciones-masivas-empresas"
          className="text-primary underline-offset-4 hover:underline"
        >
          notificaciones digitales masivas
        </Link>{" "}
        o creá una{" "}
        <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
          cuenta
        </Link>
        . Para el marco legal del servicio, leé{" "}
        <Link
          href="/notificacion-fehaciente-digital"
          className="text-primary underline-offset-4 hover:underline"
        >
          notificación fehaciente digital
        </Link>
        .
      </p>
    </PublicArticle>
  );
}
