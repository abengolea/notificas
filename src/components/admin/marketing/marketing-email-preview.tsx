"use client";

import { useMemo, useState } from "react";
import {
  applyCampaignMergeFields,
  type CampaignEmailContent,
  mergeFieldsForCampaignRecipient,
} from "@/lib/marketing/campaign-email";
import { previewAssembledCampaignEmail } from "@/lib/marketing/html";
import {
  buildMergeFields,
  PREVIEW_SAMPLE_CONTACT,
  PREVIEW_SAMPLE_CONTACT_WITHOUT_NAME,
} from "@/lib/marketing/merge-fields";
import type { PreviewContact } from "./marketing-recipient-preview";

type PreviewMode = "desktop" | "mobile";
type SampleRecipient = "named" | "unnamed";

function withBlockedImages(html: string): string {
  return html.replace(/\ssrc="[^"]*"/gi, " src=\"\"");
}

function withoutExternalFonts(html: string): string {
  return html.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/gi, "");
}

const NAMED_FIELDS = buildMergeFields(PREVIEW_SAMPLE_CONTACT);
const UNNAMED_FIELDS = buildMergeFields(PREVIEW_SAMPLE_CONTACT_WITHOUT_NAME);

export function MarketingEmailPreview({
  content,
  subject,
  className,
  audienceRecipient,
  unsavedCopy,
}: {
  content: CampaignEmailContent;
  subject?: string;
  className?: string;
  /** Primer destinatario elegible (o el elegido) de la campaña; desactiva César/YPF de muestra. */
  audienceRecipient?: PreviewContact | null;
  /** Hay cambios en el formulario que todavía no se guardaron en la campaña. */
  unsavedCopy?: boolean;
}) {
  const [mode, setMode] = useState<PreviewMode>("desktop");
  const [sample, setSample] = useState<SampleRecipient>("named");
  const [blockImages, setBlockImages] = useState(false);
  const [noFonts, setNoFonts] = useState(false);

  const useRealAudience = Boolean(audienceRecipient);
  const fields = useRealAudience
    ? mergeFieldsForCampaignRecipient(audienceRecipient!)
    : sample === "named"
      ? NAMED_FIELDS
      : UNNAMED_FIELDS;

  const mergedSubject = useMemo(
    () => (subject?.trim() ? applyCampaignMergeFields(subject.trim(), fields) : ""),
    [subject, fields],
  );

  const html = useMemo(() => {
    let rendered = previewAssembledCampaignEmail(content, fields, audienceRecipient?.id || "preview").html;
    if (noFonts) rendered = withoutExternalFonts(rendered);
    if (blockImages) rendered = withBlockedImages(rendered);
    return rendered;
  }, [audienceRecipient?.id, blockImages, content, fields, noFonts]);

  const width = mode === "mobile" ? 375 : 600;

  const sampleLabel = useRealAudience
    ? `${audienceRecipient!.name || "Sin nombre"} · ${audienceRecipient!.company || audienceRecipient!.email}`
    : sample === "named"
      ? `${PREVIEW_SAMPLE_CONTACT.name} · ${PREVIEW_SAMPLE_CONTACT.company}`
      : `Sin nombre · ${PREVIEW_SAMPLE_CONTACT_WITHOUT_NAME.company}`;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm ${mode === "desktop" ? "bg-foreground text-background" : "bg-background"}`}
            onClick={() => setMode("desktop")}
          >
            Escritorio
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm ${mode === "mobile" ? "bg-foreground text-background" : "bg-background"}`}
            onClick={() => setMode("mobile")}
          >
            Móvil
          </button>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={blockImages} onChange={(e) => setBlockImages(e.target.checked)} />
            Imágenes bloqueadas
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={noFonts} onChange={(e) => setNoFonts(e.target.checked)} />
            Sin fuentes externas
          </label>
        </div>
      </div>
      {unsavedCopy ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Tenés cambios sin guardar. Este preview muestra el texto que estás editando ahora; al pulsar «Enviar campaña» se
          guarda y se envía esa versión.
        </p>
      ) : null}
      {!useRealAudience ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm ${sample === "named" ? "bg-foreground text-background" : "bg-background"}`}
            onClick={() => setSample("named")}
          >
            Con nombre
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm ${sample === "unnamed" ? "bg-foreground text-background" : "bg-background"}`}
            onClick={() => setSample("unnamed")}
          >
            Sin nombre
          </button>
          <p className="text-sm text-muted-foreground">
            Destinatario ficticio de muestra (no es tu lista): {sampleLabel}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Destinatario real de tu campaña: {sampleLabel}
        </p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">
        A la izquierda ves las variables {"{{firstName}}"}, {"{{companyName}}"}, etc. A la derecha, el mismo mensaje ya
        reemplazado para este contacto. En el envío real cada destinatario recibe su versión con el mismo motor.
        {useRealAudience
          ? " Para revisar otro contacto de la lista usá «Mensaje exacto por destinatario» más abajo."
          : " Cargá destinatarios para previsualizar con datos reales."}
      </p>
      {mergedSubject ? (
        <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <p className="font-medium">Asunto tal como lo verá este destinatario</p>
          <p className="mt-1">{mergedSubject}</p>
        </div>
      ) : null}
      <div className="mt-3 overflow-auto rounded-lg border bg-[#F4F8FD] p-3">
        <iframe
          title={mode === "mobile" ? "Preview móvil del correo" : "Preview de escritorio del correo"}
          srcDoc={html}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          className="mx-auto block border-0 bg-white"
          style={{ width, height: 820, maxWidth: "100%" }}
        />
      </div>
    </div>
  );
}
