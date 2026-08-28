import { personalizeCampaignText } from "@/lib/campaign-email-html";
import { recipientValueText } from "@/lib/parse-campaign-csv";
import { isWaLiteralVar, usesNotificasDefaultTemplate, waLiteralText } from "@/lib/wa-template-fields";

/** Campaña email+WhatsApp con template propio de Meta: el correo muestra el mismo globo. */
export function usesMetaTemplateAsEmailBody(
  canal: string | undefined | null,
  waTemplateName: string | undefined | null
): boolean {
  return String(canal || "") === "ambos" && !usesNotificasDefaultTemplate(waTemplateName);
}

export function fillNumericPlaceholders(template: string, values: string[]): string {
  return String(template || "").replace(/\{\{(\d+)\}\}/g, (_, raw: string) => {
    const i = Number(raw) - 1;
    return values[i] != null && String(values[i]) !== "" ? String(values[i]) : `{{${raw}}}`;
  });
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

/** Texto que ve el destinatario en el correo (y que se lacra como contentHash). */
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
  const metaBody = String(input.waTemplateBody || "").trim() || cuerpo;
  if (usesMetaTemplateAsEmailBody(input.canal, input.waTemplateName) && metaBody.trim()) {
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
