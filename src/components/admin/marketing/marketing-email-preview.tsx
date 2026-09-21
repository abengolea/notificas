"use client";

import { useMemo, useState } from "react";
import {
  type CampaignEmailContent,
  previewCampaignEmail,
} from "@/lib/marketing/campaign-email";
import {
  buildMergeFields,
  PREVIEW_SAMPLE_CONTACT,
  PREVIEW_SAMPLE_CONTACT_WITHOUT_NAME,
} from "@/lib/marketing/merge-fields";

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
  className,
}: {
  content: CampaignEmailContent;
  className?: string;
}) {
  const [mode, setMode] = useState<PreviewMode>("desktop");
  const [sample, setSample] = useState<SampleRecipient>("named");
  const [blockImages, setBlockImages] = useState(false);
  const [noFonts, setNoFonts] = useState(false);
  const fields = sample === "named" ? NAMED_FIELDS : UNNAMED_FIELDS;
  const html = useMemo(() => {
    let rendered = previewCampaignEmail(content, fields).html;
    if (noFonts) rendered = withoutExternalFonts(rendered);
    if (blockImages) rendered = withBlockedImages(rendered);
    return rendered;
  }, [blockImages, content, fields, noFonts]);
  const width = mode === "mobile" ? 375 : 600;
  const sampleLabel =
    sample === "named"
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
        <p className="text-sm text-muted-foreground">Destinatario de muestra: {sampleLabel}</p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        El preview personaliza el correo con datos de un destinatario de muestra. En el envío real la
        sustitución se hace por cada contacto, con el mismo motor.
      </p>
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
