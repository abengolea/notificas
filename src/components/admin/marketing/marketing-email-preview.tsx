"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function recipientOptionLabel(c: PreviewContact): string {
  const who = c.name || c.email;
  return c.company ? `${who} · ${c.company}` : who;
}

export function MarketingEmailPreview({
  content,
  subject,
  className,
  audienceRecipient,
  audienceContacts,
  selectedContactId,
  onSelectContact,
  unsavedCopy,
}: {
  content: CampaignEmailContent;
  subject?: string;
  className?: string;
  audienceRecipient?: PreviewContact | null;
  audienceContacts?: PreviewContact[];
  selectedContactId?: string | null;
  onSelectContact?: (id: string) => void;
  unsavedCopy?: boolean;
}) {
  const [mode, setMode] = useState<PreviewMode>("desktop");
  const [sample, setSample] = useState<SampleRecipient>("named");
  const [blockImages, setBlockImages] = useState(false);
  const [noFonts, setNoFonts] = useState(false);
  const [tallPreview, setTallPreview] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const eligibleContacts = useMemo(
    () => (audienceContacts || []).filter((c) => c.eligible),
    [audienceContacts],
  );
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
  const frameHeight = tallPreview ? 720 : 420;

  const sampleLabel = useRealAudience
    ? recipientOptionLabel(audienceRecipient!)
    : sample === "named"
      ? `${PREVIEW_SAMPLE_CONTACT.name} · ${PREVIEW_SAMPLE_CONTACT.company}`
      : `Sin nombre · ${PREVIEW_SAMPLE_CONTACT_WITHOUT_NAME.company}`;

  return (
    <div id="email-preview-panel" className={className}>
      <div className="rounded-lg border bg-muted/20 p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Preview</span>
          <div className="flex gap-1">
            {(["desktop", "mobile"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`rounded border px-2 py-0.5 text-xs ${mode === m ? "bg-foreground text-background" : "bg-background"}`}
                onClick={() => setMode(m)}
              >
                {m === "desktop" ? "Escritorio" : "Móvil"}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input type="checkbox" className="size-3.5" checked={blockImages} onChange={(e) => setBlockImages(e.target.checked)} />
            Sin imágenes
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input type="checkbox" className="size-3.5" checked={noFonts} onChange={(e) => setNoFonts(e.target.checked)} />
            Sin fuentes ext.
          </label>
        </div>

        {unsavedCopy ? (
          <p className="mt-2 rounded border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-xs text-foreground">
            Cambios sin guardar — al enviar se usa este texto.
          </p>
        ) : null}

        {eligibleContacts.length > 0 && onSelectContact ? (
          <div className="mt-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Personalizar preview para</Label>
            <Select value={selectedContactId || eligibleContacts[0]?.id || ""} onValueChange={onSelectContact}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Destinatario" />
              </SelectTrigger>
              <SelectContent>
                {eligibleContacts.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {recipientOptionLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : !useRealAudience ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={`rounded border px-2 py-0.5 text-xs ${sample === "named" ? "bg-foreground text-background" : "bg-background"}`}
              onClick={() => setSample("named")}
            >
              Con nombre
            </button>
            <button
              type="button"
              className={`rounded border px-2 py-0.5 text-xs ${sample === "unnamed" ? "bg-foreground text-background" : "bg-background"}`}
              onClick={() => setSample("unnamed")}
            >
              Sin nombre
            </button>
            <span className="text-[11px] text-muted-foreground">Muestra: {sampleLabel}</span>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">{sampleLabel}</p>
        )}

        {mergedSubject ? (
          <p className="mt-2 truncate text-xs" title={mergedSubject}>
            <span className="text-muted-foreground">Asunto: </span>
            <span className="font-medium">{mergedSubject}</span>
          </p>
        ) : null}

        <Collapsible open={helpOpen} onOpenChange={setHelpOpen} className="mt-2">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              {helpOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              ¿Por qué el preview no muestra {"{{variables}}"}?
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            El editor guarda plantillas con variables; acá ves el mismo texto ya reemplazado para el contacto
            elegido. Cada destinatario recibe su versión al enviar.
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="mt-2 overflow-auto rounded-md border bg-[#F4F8FD] p-2">
        <iframe
          title={mode === "mobile" ? "Preview móvil del correo" : "Preview de escritorio del correo"}
          srcDoc={html}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          className="mx-auto block border-0 bg-white"
          style={{ width, height: frameHeight, maxWidth: "100%" }}
        />
      </div>
      <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={() => setTallPreview((v) => !v)}>
        {tallPreview ? "Preview más bajo" : "Preview más alto"}
      </Button>
    </div>
  );
}
