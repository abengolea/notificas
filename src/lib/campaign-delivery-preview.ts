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
  renderCampaignMessageBody,
  renderMetaTemplateBody,
} from "@/lib/campaign-mixed-message";
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
};

export type CampaignDeliveryPreviewResult = {
  letter: string;
  mailboxHtml: string;
  readerHtml: string;
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
  const letter = renderCampaignMessageBody({
    canal: input.canal,
    waTemplateName: input.waTemplateName,
    waTemplateBody: input.waTemplateBody,
    waTemplateVariables: input.waTemplateVariables,
    waUrlButton: input.waUrlButton === true,
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
    mode: CAMPAIGN_MAILBOX_MODE,
  });
  const mailboxHtml = stripMailboxHiddenHtml(html);
  const readerHtml = sanitizeHtmlForReader(
    stripUntrackedAttachmentSectionFromMailHtml(
      injectContentForReader(html, { message: { content: letter } })
    )
  );
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

  return { letter, mailboxHtml, readerHtml, waText, sampleName, sampleEmail };
}
