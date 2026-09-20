"use client";

import { useMemo, useState } from "react";
import {
  PREVIEW_MERGE_FIELDS,
  type CampaignEmailContent,
  previewCampaignEmail,
} from "@/lib/marketing/campaign-email";

type PreviewMode = "desktop" | "mobile";

function withBlockedImages(html: string): string {
  return html.replace(/\ssrc="[^"]*"/gi, " src=\"\"");
}

function withoutExternalFonts(html: string): string {
  return html.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/gi, "");
}

export function MarketingEmailPreview({
  content,
  className,
}: {
  content: CampaignEmailContent;
  className?: string;
}) {
  const [mode, setMode] = useState<PreviewMode>("desktop");
  const [blockImages, setBlockImages] = useState(false);
  const [noFonts, setNoFonts] = useState(false);
  const html = useMemo(() => {
    let rendered = previewCampaignEmail(content, PREVIEW_MERGE_FIELDS).html;
    if (noFonts) rendered = withoutExternalFonts(rendered);
    if (blockImages) rendered = withBlockedImages(rendered);
    return rendered;
  }, [blockImages, content, noFonts]);
  const width = mode === "mobile" ? 375 : 600;

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
      <p className="mt-2 text-sm text-muted-foreground">
        El preview usa la misma función que el envío (`renderCampaignEmail`). El HTML de Gmail solo agrega el pixel de apertura y, en envíos reales, el seguimiento de clics.
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
