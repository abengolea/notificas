"use client";

import { Mail, MessageCircle, FileText } from "lucide-react";
import type { CanalCampaign } from "@/lib/types";
import type { CampaignDeliveryPreviewResult } from "@/lib/campaign-delivery-preview";

function PreviewFrame({ title, html }: { title: string; html: string }) {
  return (
    <iframe
      title={title}
      sandbox=""
      srcDoc={html}
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
                  Lo que llega a la bandeja: aviso y botón. La carta no va acá.
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
                  Al abrir el enlace. Acá sí está el texto certificado.
                </p>
              </div>
            </div>
            <PreviewFrame title="Vista previa del lector" html={preview.readerHtml} />
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
