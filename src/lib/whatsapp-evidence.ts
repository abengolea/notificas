import { sha256Hex } from "@/lib/merkle";

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

export const WHATSAPP_CHANNEL_DISCLAIMER =
  "WhatsApp entregó el texto del template aprobado por Meta, con los datos de este destinatario. Si el template tiene botón, el enlace también queda en el hash. No es un texto libre: es esa plantilla, ni más ni menos.";
