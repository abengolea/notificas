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
 * Texto canónico de lo que se pidió a Meta.
 * v2: envíos con mensaje lacrado (renderedBody). v1: snapshots históricos sin ese campo.
 */
export function canonicalWhatsAppBody(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object") return "";
  const rec = snapshot as Record<string, unknown>;
  const rendered = typeof rec.renderedBody === "string" ? rec.renderedBody.trim() : "";
  if (rendered) {
    const buttons = Array.isArray(rec.sentButtons)
      ? rec.sentButtons.map((raw) => {
          const b = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
          return [String(b.text || ""), String(b.url || ""), String(b.urlParameter || "")].join("^");
        })
      : paramTexts(rec.buttons);
    return [
      "WA_BODY",
      "v2",
      String(rec.type || "template"),
      String(rec.to || ""),
      String(rec.templateName || ""),
      String(rec.templateLang || ""),
      String(rec.templateId || ""),
      String(rec.templateHash || ""),
      String(rec.renderedHeader || "").trim(),
      rendered,
      String(rec.renderedFooter || "").trim(),
      ...paramTexts(rec.parameters),
      ...(buttons.length ? ["btn", ...buttons] : []),
    ].join("|");
  }

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

export function sealedWhatsAppRenderedBody(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object") return "";
  const body = (snapshot as Record<string, unknown>).renderedBody;
  return typeof body === "string" ? body.trim() : "";
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

export type WhatsAppSentButton = {
  text: string | null;
  url: string | null;
  urlParameter: string | null;
};

export type WhatsAppSentContent = {
  templateName: string;
  templateLang: string;
  templateHash: string | null;
  templateId: string | null;
  /** Texto del globo si quedó lacrado en el snapshot; si no, null. */
  renderedBody: string | null;
  renderedHeader: string | null;
  renderedFooter: string | null;
  /** True si el envío nuevo no pudo congelar el BODY de Meta. */
  templateBodyMissing: boolean;
  variables: Array<{ n: number; field?: string; value: string }>;
  buttons: WhatsAppSentButton[];
};

function fillTemplatePlaceholders(template: string, values: string[]): string {
  return template.replace(/\{\{(\d+)\}\}/g, (_, raw: string) => {
    const i = Number(raw) - 1;
    return values[i] != null && values[i] !== "" ? values[i] : `{{${raw}}}`;
  });
}

function asTrimmedString(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
  return s || null;
}

function buttonsFromSnapshot(rec: Record<string, unknown>): WhatsAppSentButton[] {
  if (Array.isArray(rec.sentButtons) && rec.sentButtons.length > 0) {
    return rec.sentButtons.map((raw) => {
      const b = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      return {
        text: asTrimmedString(b.text),
        url: asTrimmedString(b.url),
        urlParameter: asTrimmedString(b.urlParameter),
      };
    });
  }
  const requestButtonParams = paramTexts(rec.buttons).map((t) => t.trim()).filter(Boolean);
  if (requestButtonParams.length === 0) return [];
  return requestButtonParams.map((urlParameter) => ({
    text: null,
    url: null,
    urlParameter,
  }));
}

/** Lee el pedido sellado a Meta. No usa readerUrl interno como botón. */
export function describeWhatsAppSentContent(
  requestSnapshot: unknown,
  templateVariables?: string[] | null
): WhatsAppSentContent | null {
  if (!requestSnapshot || typeof requestSnapshot !== "object") return null;
  const rec = requestSnapshot as Record<string, unknown>;
  const templateName = String(rec.templateName || "").trim();
  const bodyText = typeof rec.bodyText === "string" ? rec.bodyText.trim() : "";
  const values = paramTexts(rec.parameters);
  const fields = (templateVariables || [])
    .map((v) => String(v || "").trim())
    .filter((v) => v && v !== "url_lectura" && v !== "boton_url");

  if (!templateName && !bodyText && values.length === 0 && !asTrimmedString(rec.renderedBody)) return null;

  const variables = values.map((value, i) => ({
    n: i + 1,
    field: fields[i] || undefined,
    value,
  }));

  const sealedRendered = asTrimmedString(rec.renderedBody);
  let renderedBody: string | null = sealedRendered;
  if (!renderedBody && bodyText) {
    renderedBody = bodyText;
  } else if (!renderedBody && usesNotificasDefaultTemplate(templateName) && values.length >= 1) {
    renderedBody = fillTemplatePlaceholders(WA_DEFAULT_TEMPLATE_BODY, values);
  }

  return {
    templateName: templateName || "—",
    templateLang: String(rec.templateLang || "es_AR"),
    templateHash: asTrimmedString(rec.templateHash),
    templateId: asTrimmedString(rec.templateId),
    renderedBody,
    renderedHeader: asTrimmedString(rec.renderedHeader),
    renderedFooter: asTrimmedString(rec.renderedFooter),
    templateBodyMissing: rec.templateBodyMissing === true && !sealedRendered,
    variables,
    buttons: buttonsFromSnapshot(rec),
  };
}

export const WHATSAPP_CHANNEL_DISCLAIMER =
  "WhatsApp entregó el texto del template aprobado por Meta, con los datos de este destinatario. Si el template tiene botón, el enlace también queda en el hash. No es un texto libre: es esa plantilla, ni más ni menos.";
