import { sha256Hex } from "@/lib/merkle";
import {
  usesNotificasDefaultTemplate,
  WA_DEFAULT_TEMPLATE_BODY,
} from "@/lib/wa-template-fields";

function paramTexts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    if (p && typeof p === "object" && "text" in p) return String((p as { text?: unknown }).text || "");
    return String(p ?? "");
  });
}

/**
 * Texto canónico de lo que se pidió a Meta: template, variables del cuerpo y, si hay, el botón URL.
 */
export function canonicalWhatsAppBody(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object") return "";
  const rec = snapshot as Record<string, unknown>;
  if (typeof rec.bodyText === "string" && rec.bodyText.trim()) {
    return [
      "WA_BODY",
      "v1",
      "text",
      String(rec.to || ""),
      rec.bodyText.trim(),
      String(rec.readerUrl || ""),
    ].join("|");
  }

  const params = paramTexts(rec.parameters);
  const buttons = paramTexts(rec.buttons);

  return [
    "WA_BODY",
    "v1",
    String(rec.type || "template"),
    String(rec.to || ""),
    String(rec.templateName || ""),
    String(rec.templateLang || ""),
    ...params,
    ...(buttons.length ? ["btn", ...buttons] : []),
    String(rec.readerUrl || ""),
  ].join("|");
}

export async function hashWhatsAppBody(snapshot: unknown): Promise<string> {
  const body = canonicalWhatsAppBody(snapshot);
  return body ? sha256Hex(body) : "";
}

export function buildWhatsAppOnChainPayload(input: {
  mailId: string;
  wamid: string;
  waBodyHash: string;
  templateName: string;
  to: string;
  timestamp: string;
}): string {
  return [
    "WA",
    "v1",
    input.mailId,
    input.wamid,
    input.waBodyHash,
    input.templateName || "",
    input.to.replace(/\D/g, ""),
    input.timestamp,
  ].join("|");
}

export function extractWhatsAppHashFromPayload(payload: string | null): string | null {
  if (!payload) return null;
  const parts = payload.split("|");
  if (parts[0] !== "WA" || parts[1] !== "v1") return null;
  const hash = parts[4];
  return hash && /^[a-f0-9]{64}$/i.test(hash) ? hash.toLowerCase() : null;
}

export type WhatsAppSentContent = {
  templateName: string;
  templateLang: string;
  /** Texto del globo si se puede reconstruir; si no, null y se listan variables. */
  renderedBody: string | null;
  variables: Array<{ n: number; field?: string; value: string }>;
  buttonUrl: string | null;
};

function fillTemplatePlaceholders(template: string, values: string[]): string {
  return template.replace(/\{\{(\d+)\}\}/g, (_, raw: string) => {
    const i = Number(raw) - 1;
    return values[i] != null && values[i] !== "" ? values[i] : `{{${raw}}}`;
  });
}

/** Reconstruye lo enviado a Meta a partir del requestSnapshot sellado. */
export function describeWhatsAppSentContent(
  requestSnapshot: unknown,
  templateVariables?: string[] | null
): WhatsAppSentContent | null {
  if (!requestSnapshot || typeof requestSnapshot !== "object") return null;
  const rec = requestSnapshot as Record<string, unknown>;
  const templateName = String(rec.templateName || "").trim();
  const bodyText = typeof rec.bodyText === "string" ? rec.bodyText.trim() : "";
  const values = paramTexts(rec.parameters);
  const buttons = paramTexts(rec.buttons);
  const fields = (templateVariables || [])
    .map((v) => String(v || "").trim())
    .filter((v) => v && v !== "url_lectura" && v !== "boton_url");

  if (!templateName && !bodyText && values.length === 0) return null;

  const variables = values.map((value, i) => ({
    n: i + 1,
    field: fields[i] || undefined,
    value,
  }));

  let renderedBody: string | null = null;
  if (bodyText) {
    renderedBody = bodyText;
  } else if (usesNotificasDefaultTemplate(templateName) && values.length >= 1) {
    renderedBody = fillTemplatePlaceholders(WA_DEFAULT_TEMPLATE_BODY, values);
  }

  return {
    templateName: templateName || "—",
    templateLang: String(rec.templateLang || "es_AR"),
    renderedBody,
    variables,
    buttonUrl: buttons[0] || (typeof rec.readerUrl === "string" ? rec.readerUrl : null),
  };
}

export const WHATSAPP_CHANNEL_DISCLAIMER =
  "WhatsApp entregó el texto del template aprobado por Meta, con los datos de este destinatario. Si el template tiene botón, el enlace también queda en el hash. No es un texto libre: es esa plantilla, ni más ni menos.";
