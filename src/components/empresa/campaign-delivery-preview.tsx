"use client";

import { useEffect, useState } from "react";
import { Mail, MessageCircle, FileText } from "lucide-react";
import type { CanalCampaign } from "@/lib/types";
import type { CampaignDeliveryPreviewResult } from "@/lib/campaign-delivery-preview";

/**
 * El correo y el lector se diseñan siempre sobre fondo claro. Si la app está en modo oscuro, el iframe hereda
 * `color-scheme: dark` y el texto sin color explícito se pinta casi blanco sobre el fondo blanco: queda "vacío".
 * Se fija el esquema claro tanto en el elemento como dentro del documento.
 */
const LIGHT_SCHEME_HEAD =
  '<meta name="color-scheme" content="light"><style>:root{color-scheme:light}html,body{background:#fff;color:#111827}</style>';

function withLightScheme(html: string): string {
  // Dentro de <head> para conservar el doctype (si no, el navegador pasa a modo quirks).
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + LIGHT_SCHEME_HEAD);
  return html;
}

function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}-${(h >>> 0).toString(36)}`;
}

/**
 * Cambiar `srcdoc` de un iframe con sandbox mientras todavía está cargando el anterior puede dejarlo en blanco
 * (pasa al escribir en la carta: cada tecla cambia el HTML). Por eso se espera a que el texto se asiente y se
 * monta un iframe nuevo por cada contenido: la primera carga con `srcdoc` ya puesto es la más confiable.
 */
function PreviewFrame({ title, html }: { title: string; html: string }) {
  const [settled, setSettled] = useState(html);
  useEffect(() => {
    if (html === settled) return;
    const t = setTimeout(() => setSettled(html), 250);
    return () => clearTimeout(t);
  }, [html, settled]);

  return (
    <iframe
      key={hashString(settled)}
      title={title}
      sandbox=""
      srcDoc={withLightScheme(settled)}
      style={{ colorScheme: "light" }}
      className="h-[22rem] w-full border-0 bg-white"
    />
  );
}

export function CampaignDeliveryPreview({
  canal,
  preview,
}: {
  canal: CanalCampaign;
  preview: CampaignDeliveryPreviewResult;
}) {
  const showMail = canal === "email" || canal === "ambos";
  const showWa = canal === "whatsapp" || canal === "ambos";
  if (!showMail && !showWa) return null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Vista previa · {preview.sampleName}</p>
        <p className="text-xs text-muted-foreground">
          Cada recuadro es lo que sale por ese canal. El enlace del lector se completa al enviar.
        </p>
      </div>

      {showMail && (
        <div className="grid gap-3 md:grid-cols-2">
          <section className="overflow-hidden rounded-md border bg-background">
            <div className="flex items-start gap-2 border-b bg-muted/40 px-3 py-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Correo</p>
                <p className="text-xs text-muted-foreground">
                  {preview.emailDirect
                    ? "Lo que llega a la bandeja: el texto completo, sin enlace al lector."
                    : "Lo que llega a la bandeja: aviso y botón. La carta no va acá."}
                </p>
              </div>
            </div>
            <PreviewFrame title="Vista previa del correo" html={preview.mailboxHtml} />
          </section>
          <section className="overflow-hidden rounded-md border bg-background">
            <div className="flex items-start gap-2 border-b bg-muted/40 px-3 py-2">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Lector</p>
                <p className="text-xs text-muted-foreground">
                  {!preview.readerHtml
                    ? "No hay lector en esta opción."
                    : preview.emailDirect
                      ? "Se abre solo desde el enlace de WhatsApp. Acá está el texto certificado."
                      : "Al abrir el enlace. Acá sí está el texto certificado."}
                </p>
              </div>
            </div>
            {preview.readerHtml ? (
              <PreviewFrame title="Vista previa del lector" html={preview.readerHtml} />
            ) : (
              <p className="px-3 py-6 text-sm text-muted-foreground">
                Ni el correo ni WhatsApp llevan el enlace al lector. Los dos mandan el mismo texto.
              </p>
            )}
          </section>
        </div>
      )}

      {showWa && preview.waText ? (
        <section className="overflow-hidden rounded-md border bg-background">
          <div className="flex items-start gap-2 border-b bg-muted/40 px-3 py-2">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">WhatsApp</p>
              <p className="text-xs text-muted-foreground">
                Plantilla de Meta. No es el correo ni el lector.
              </p>
            </div>
          </div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap px-3 py-3 text-sm leading-6 text-foreground">
            {preview.waText}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
