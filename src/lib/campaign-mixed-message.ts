import { campaignBodyToHtmlFragment, personalizeCampaignText } from "@/lib/campaign-email-html";
import { recipientValueText } from "@/lib/parse-campaign-csv";
import { isWaLiteralVar, usesNotificasDefaultTemplate, waLiteralText } from "@/lib/wa-template-fields";

/**
 * Campaña email+WhatsApp con plantilla propia de Meta (no el sobre default de Notificas).
 * El globo no va a Gmail: el correo es un aviso al lector. Sirve para exigir el BODY
 * aprobado y, si no hay carta, lacrar ese texto en el lector.
 */
export function usesMetaTemplateAsEmailBody(
  canal: string | undefined | null,
  waTemplateName: string | undefined | null
): boolean {
  return String(canal || "") === "ambos" && !usesNotificasDefaultTemplate(waTemplateName);
}

export function mixedWhatsAppUsesReaderLink(urlButton: boolean | undefined | null): boolean {
  return urlButton === true;
}

export function fillNumericPlaceholders(template: string, values: string[]): string {
  return String(template || "").replace(/\{\{(\d+)\}\}/g, (_, raw: string) => {
    const i = Number(raw) - 1;
    return values[i] != null && String(values[i]) !== "" ? String(values[i]) : `{{${raw}}}`;
  });
}

/** BODY de Meta ({{1}}, {{2}}) → carta editable del lector ({{nombre}}, {{dni}}, …). */
export function readerLetterFromMetaTemplate(input: {
  templateBody?: string | null;
  variables?: string[] | null;
  urlButton?: boolean;
}): string {
  const templateBody = String(input.templateBody || "").trim();
  if (!templateBody) return "";
  const urlButton = input.urlButton === true;
  const fields = (input.variables || []).filter(
    (field) => !(urlButton && (field === "url_lectura" || field === "boton_url"))
  );
  const values = fields.map((field) => {
    if (isWaLiteralVar(field)) return waLiteralText(field);
    const f = String(field || "").trim();
    return f ? `{{${f}}}` : "";
  });
  return fillNumericPlaceholders(templateBody, values).trim();
}

export type MixedMessageRow = {
  nombre?: string;
  dni?: string;
  legajo?: string;
  email?: string;
  telefono?: string;
  dias?: string;
  fecha?: string;
  monto?: string;
  cuotas?: string;
  area?: string;
};

function asWaText(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v);
}

export function resolveTemplateFieldValue(
  field: string,
  row: MixedMessageRow,
  extras: { senderName?: string; recipientName?: string; phone?: string; readerUrl?: string }
): string {
  const f = String(field || "").trim();
  if (!f) return "";
  if (isWaLiteralVar(f)) return waLiteralText(f);
  switch (f) {
    case "nombre":
      return asWaText(row.nombre) || asWaText(extras.recipientName);
    case "dni":
      return asWaText(row.dni);
    case "legajo":
      return asWaText(row.legajo);
    case "email":
      return asWaText(row.email);
    case "telefono":
      return asWaText(row.telefono) || asWaText(extras.phone);
    case "dias":
    case "dias_atraso":
      return asWaText(row.dias);
    case "fecha":
      return asWaText(row.fecha);
    case "monto":
      return asWaText(row.monto);
    case "cuotas":
      return presentOrText(row.cuotas);
    case "area":
      return asWaText(row.area);
    case "remitente":
    case "empresa":
      return asWaText(extras.senderName);
    case "url_lectura":
    case "boton_url":
      return asWaText(extras.readerUrl);
    default:
      return asWaText((row as Record<string, unknown>)[f]);
  }
}

function presentOrText(v: unknown): string {
  const t = recipientValueText(v);
  return t || asWaText(v);
}

export function resolveTemplateBodyValues(input: {
  variables: string[] | undefined | null;
  urlButton?: boolean;
  row: MixedMessageRow;
  senderName?: string;
  recipientName?: string;
  phone?: string;
  readerUrl?: string;
}): string[] {
  const urlButton = input.urlButton === true;
  const fields = (input.variables || []).filter(
    (field) => !(urlButton && (field === "url_lectura" || field === "boton_url"))
  );
  return fields.map((field) =>
    resolveTemplateFieldValue(field, input.row, {
      senderName: input.senderName,
      recipientName: input.recipientName,
      phone: input.phone,
      readerUrl: input.readerUrl,
    })
  );
}

export function renderMetaTemplateBody(input: {
  templateBody: string;
  variables: string[] | undefined | null;
  urlButton?: boolean;
  row: MixedMessageRow;
  senderName?: string;
  recipientName?: string;
  phone?: string;
  readerUrl?: string;
}): string {
  const values = resolveTemplateBodyValues(input);
  return fillNumericPlaceholders(input.templateBody, values).trim();
}

/** En el HTML del correo, la CF sendEmail reemplaza este ancla por la URL real del lector. */
export const MAILBOX_READER_URL_SENTINEL = "https://notificas.com.ar/n/READ";

export function htmlFromFilledMetaBody(filled: string): string {
  const fragment = campaignBodyToHtmlFragment(filled);
  const link =
    '<a href="#" target="_blank" rel="noopener">[El enlace se agregará al enviar el mensaje]</a>';
  return fragment.split(MAILBOX_READER_URL_SENTINEL).join(link);
}

/** Texto lacrado (contentHash) y mostrado en el lector. El sobre de Gmail no lo exhibe. */
export function renderCampaignMessageBody(input: {
  canal?: string | null;
  waTemplateName?: string | null;
  waTemplateBody?: string | null;
  waTemplateVariables?: string[] | null;
  waUrlButton?: boolean;
  cuerpo?: string | null;
  row: MixedMessageRow;
  senderName?: string;
}): string {
  const cuerpo = String(input.cuerpo || "");
  const letter = personalizeCampaignText(cuerpo, input.row).trim();
  if (letter) return letter;
  const metaBody = String(input.waTemplateBody || "").trim();
  if (usesMetaTemplateAsEmailBody(input.canal, input.waTemplateName) && metaBody) {
    return renderMetaTemplateBody({
      templateBody: metaBody,
      variables: input.waTemplateVariables,
      urlButton: input.waUrlButton,
      row: input.row,
      senderName: input.senderName,
      recipientName: input.row.nombre,
      phone: input.row.telefono,
    });
  }
  return personalizeCampaignText(cuerpo, input.row);
}
