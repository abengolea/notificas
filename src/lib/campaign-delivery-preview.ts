import type { CanalCampaign } from "@/lib/types";
import {
  buildCampaignMailHtml,
  CAMPAIGN_MAILBOX_MODE,
  campaignBodyToHtmlFragment,
  stripMailboxHiddenHtml,
  type CampaignPersonalizeRow,
} from "@/lib/campaign-email-html";
import { injectContentForReader } from "@/lib/inject-content-for-reader";
import {
  effectiveMixedDeliveryMode,
  mixedModeEmailIsDirect,
  mixedModeWhatsAppUsesReader,
  renderCampaignMessageBody,
  renderMetaTemplateBody,
  type MixedDeliveryMode,
} from "@/lib/campaign-mixed-message";
import { usesNotificasDefaultTemplate } from "@/lib/wa-template-fields";
import { sanitizeHtmlForReader } from "@/lib/sanitize-reader-html";
import { stripUntrackedAttachmentSectionFromMailHtml } from "@/lib/strip-reader-attachment-duplicate-html";

export type CampaignDeliveryPreviewInput = {
  canal: CanalCampaign;
  sender: string;
  row: CampaignPersonalizeRow & { nombre: string; email?: string; telefono?: string };
  cuerpo: string;
  waTemplateName?: string | null;
  waTemplateBody?: string | null;
  waTemplateVariables?: string[] | null;
  waUrlButton?: boolean;
  /** Campaña mixta: cómo viaja el enlace al lector. Por defecto, reader_both. */
  mixedMode?: MixedDeliveryMode | null;
};

export type CampaignDeliveryPreviewResult = {
  letter: string;
  mailboxHtml: string;
  /** Vacío cuando ningún canal lleva el enlace al lector (same_text). */
  readerHtml: string;
  /** El correo trae el texto completo y no tiene enlace al lector. */
  emailDirect: boolean;
  /** WhatsApp lleva el enlace al lector. */
  waReader: boolean;
  waText: string;
  sampleName: string;
  sampleEmail: string;
};

/** Lo que sale por cada canal, con el mismo recorte que sendEmail + el lector. */
export function buildCampaignDeliveryPreview(
  input: CampaignDeliveryPreviewInput
): CampaignDeliveryPreviewResult {
  const sampleName = input.row.nombre || "Destinatario";
  const sampleEmail = String(input.row.email || "destinatario@ejemplo.com").toLowerCase();
  const mixedMode =
    input.canal === "ambos"
      ? effectiveMixedDeliveryMode(input.mixedMode, usesNotificasDefaultTemplate(input.waTemplateName))
      : undefined;
  const emailDirect = mixedModeEmailIsDirect(mixedMode);
  const waReader = input.canal === "ambos" ? mixedModeWhatsAppUsesReader(mixedMode) : true;
  const letter = renderCampaignMessageBody({
    canal: input.canal,
    waTemplateName: input.waTemplateName,
    waTemplateBody: input.waTemplateBody,
    waTemplateVariables: input.waTemplateVariables,
    waUrlButton: input.waUrlButton === true,
    mixedMode,
    cuerpo: input.cuerpo,
    row: input.row,
    senderName: input.sender,
  });
  const html = buildCampaignMailHtml({
    recipientEmail: sampleEmail,
    recipientName: sampleName,
    sender: input.sender,
    bodyHtml: campaignBodyToHtmlFragment(letter),
    attachments: [],
    mode: emailDirect ? "direct" : CAMPAIGN_MAILBOX_MODE,
  });
  const mailboxHtml = stripMailboxHiddenHtml(html);
  const hasReader = !emailDirect || waReader;
  const readerHtml = hasReader
    ? sanitizeHtmlForReader(
        stripUntrackedAttachmentSectionFromMailHtml(
          injectContentForReader(html, { message: { content: letter } })
        )
      )
    : "";
  const metaBody = String(input.waTemplateBody || "").trim();
  const waText =
    (input.canal === "whatsapp" || input.canal === "ambos") && metaBody
      ? renderMetaTemplateBody({
          templateBody: metaBody,
          variables: input.waTemplateVariables,
          urlButton: input.waUrlButton === true,
          row: input.row,
          senderName: input.sender,
          recipientName: sampleName,
          phone: input.row.telefono,
        })
      : "";

  return { letter, mailboxHtml, readerHtml, emailDirect, waReader, waText, sampleName, sampleEmail };
}
