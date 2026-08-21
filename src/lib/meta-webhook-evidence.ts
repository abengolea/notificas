import { createHash } from "node:crypto";
import { verifyWhatsAppHubSignature } from "@/lib/whatsapp-webhook-auth";
import { payloadContainsSecrets } from "@/lib/meta-graph-client";
import type { HistoricalMetaEvent, RecipientMetaEvidence } from "@/lib/meta-communication-types";
import type { MetaVerifyStatus } from "@/lib/meta-verify-status";

export type StoredProviderEvent = {
  id?: string;
  provider?: string;
  eventType?: string;
  providerMessageId?: string | null;
  recipient?: string | null;
  providerTimestamp?: string | null;
  signatureHeader?: string | null;
  signatureValid?: boolean | null;
  payloadHash?: string | null;
  httpBody?: unknown;
  contentType?: string | null;
  wabaId?: string | null;
  phoneNumberId?: string | null;
  receivedAt?: unknown;
  receivedAtIso?: string | null;
  raw?: unknown;
};

function httpBodyString(httpBody: unknown): { text: string | null; truncated: boolean } {
  if (typeof httpBody === "string") return { text: httpBody, truncated: false };
  if (httpBody && typeof httpBody === "object" && (httpBody as { _truncated?: boolean })._truncated) {
    return { text: null, truncated: true };
  }
  return { text: null, truncated: false };
}

export function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function toIsoUnknown(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "object") {
    const rec = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof rec.toDate === "function") {
      try {
        const d = rec.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
      } catch {
        return null;
      }
    }
    const secs = rec._seconds ?? rec.seconds;
    if (typeof secs === "number" && Number.isFinite(secs)) return new Date(secs * 1000).toISOString();
  }
  return null;
}

export function normalizeWaRecipient(value: string | null | undefined): string {
  return String(value || "").replace(/\D/g, "");
}

/** Quita el 9 de celulares AR (54 9 …) para comparar con recipient_id de Meta. */
function dropArMobileNine(digits: string): string {
  if (digits.startsWith("549") && digits.length >= 12) return `54${digits.slice(3)}`;
  return digits;
}

/** Coincidencia probatoria entre teléfono consignado y recipient_id de Meta. */
export function waRecipientsCorrespond(
  consigned: string | null | undefined,
  metaRecipientId: string | null | undefined
): boolean {
  const a = normalizeWaRecipient(consigned);
  const b = normalizeWaRecipient(metaRecipientId);
  if (!a || !b) return false;
  if (a === b) return true;
  if (dropArMobileNine(a) === dropArMobileNine(b)) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return shorter.length >= 8 && longer.endsWith(shorter);
}

export function wamidsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = String(a || "").trim();
  const y = String(b || "").trim();
  if (!x || !y) return false;
  const strip = (s: string) => (s.startsWith("wamid.") ? s.slice("wamid.".length) : s);
  return x === y || strip(x) === strip(y);
}

export function recomputeWebhookIntegrity(input: {
  httpBody: unknown;
  storedHash: string | null | undefined;
  signatureHeader: string | null | undefined;
  appSecret: string | null | undefined;
  ingestSignatureValid: boolean | null | undefined;
}): {
  rawPreserved: boolean;
  rawTruncated: boolean;
  payloadSha256: string | null;
  hashMatches: boolean | null;
  signatureValidation: HistoricalMetaEvent["signatureValidation"];
} {
  const body = httpBodyString(input.httpBody);
  if (body.truncated) {
    return {
      rawPreserved: true,
      rawTruncated: true,
      payloadSha256: input.storedHash || null,
      hashMatches: null,
      signatureValidation:
        input.ingestSignatureValid === true
          ? "ingest_only"
          : input.ingestSignatureValid === false
            ? "incorrect"
            : "not_available",
    };
  }
  if (!body.text) {
    return {
      rawPreserved: false,
      rawTruncated: false,
      payloadSha256: input.storedHash || null,
      hashMatches: null,
      signatureValidation:
        input.ingestSignatureValid === true
          ? "ingest_only"
          : input.ingestSignatureValid === false
            ? "incorrect"
            : "not_available",
    };
  }
  const hash = sha256Utf8(body.text);
  const hashMatches = input.storedHash ? hash === input.storedHash : true;
  const secret = (input.appSecret || "").trim();
  let signatureValidation: HistoricalMetaEvent["signatureValidation"] = "not_available";
  if (secret && input.signatureHeader) {
    signatureValidation = verifyWhatsAppHubSignature(body.text, input.signatureHeader, secret)
      ? "correct"
      : "incorrect";
  } else if (input.ingestSignatureValid === true) {
    signatureValidation = "ingest_only";
  } else if (input.ingestSignatureValid === false) {
    signatureValidation = "incorrect";
  }
  return {
    rawPreserved: true,
    rawTruncated: false,
    payloadSha256: hash,
    hashMatches,
    signatureValidation,
  };
}

export function mapEventKind(eventType: string | undefined): HistoricalMetaEvent["kind"] {
  const t = String(eventType || "").toLowerCase();
  if (t === "sent" || t === "whatsapp_sent") return "sent";
  if (t === "delivered" || t === "whatsapp_delivered") return "delivered";
  if (t === "read" || t === "whatsapp_read") return "read";
  if (t === "failed" || t === "whatsapp_failed") return "failed";
  return "other";
}

function titleFor(kind: HistoricalMetaEvent["kind"]): string {
  switch (kind) {
    case "sent":
      return "Aceptado por Meta";
    case "delivered":
      return "WhatsApp entregado";
    case "read":
      return "WhatsApp leído";
    case "failed":
      return "WhatsApp fallido";
    default:
      return "Evento Meta";
  }
}

function claimFor(kind: HistoricalMetaEvent["kind"], when: string | null): string {
  const whenTxt = when ? ` el ${when}` : "";
  switch (kind) {
    case "sent":
      return `Meta informó el estado sent${whenTxt} respecto del identificador técnico del mensaje.`;
    case "delivered":
      return `Meta informó el estado delivered${whenTxt} respecto del identificador técnico del destinatario consignado.`;
    case "read":
      return `Meta informó a Notificas el estado read${whenTxt} respecto del mensaje identificado por el WAMID indicado.`;
    case "failed":
      return `Meta informó el estado failed${whenTxt} respecto del identificador técnico del mensaje.`;
    default:
      return `Meta informó un evento${whenTxt}.`;
  }
}

export function historicalEventFromProvider(
  ev: StoredProviderEvent,
  opts: {
    expectedWamid?: string | null;
    expectedRecipient?: string | null;
    appSecret?: string | null;
    polygon?: HistoricalMetaEvent["polygon"];
  }
): HistoricalMetaEvent {
  const kind = mapEventKind(ev.eventType);
  const integrity = recomputeWebhookIntegrity({
    httpBody: ev.httpBody,
    storedHash: ev.payloadHash,
    signatureHeader: ev.signatureHeader,
    appSecret: opts.appSecret,
    ingestSignatureValid: ev.signatureValid,
  });
  const wamid = typeof ev.providerMessageId === "string" ? ev.providerMessageId : null;
  const recipient = typeof ev.recipient === "string" ? ev.recipient : null;
  const wamidMismatch = opts.expectedWamid && wamid ? !wamidsEqual(wamid, opts.expectedWamid) : false;
  const recipientMismatch =
    opts.expectedRecipient && recipient ? !waRecipientsCorrespond(opts.expectedRecipient, recipient) : false;

  let status: MetaVerifyStatus = "HISTORICAL_PRESERVED";
  if (wamidMismatch || recipientMismatch || integrity.signatureValidation === "incorrect" || integrity.hashMatches === false) {
    status = "FAILED";
  } else if (integrity.signatureValidation === "correct" && integrity.rawPreserved) {
    status = "HISTORICAL_VERIFIED";
  }

  const rawSensitive = payloadContainsSecrets(ev.httpBody) || payloadContainsSecrets(ev.raw);
  const webhookAuthLabel =
    integrity.signatureValidation === "correct"
      ? "Autenticación criptográfica del webhook verificada mediante HMAC-SHA256 contra X-Hub-Signature-256."
      : integrity.signatureValidation === "ingest_only"
        ? "Firma X-Hub-Signature-256 presente. Validación criptográfica retrospectiva no disponible para este evento (se registró al recibirlo, sin recomputar HMAC ahora)."
        : integrity.signatureValidation === "incorrect"
          ? "La autenticación técnica del webhook no coincide."
          : "Validación criptográfica de X-Hub-Signature-256 no disponible para este evento.";

  return {
    status,
    kind,
    title: titleFor(kind),
    claim: claimFor(kind, ev.providerTimestamp || null),
    source: "meta_webhook_historical",
    wamid,
    recipientId: recipient,
    metaTimestamp: ev.providerTimestamp || null,
    receivedAt: toIsoUnknown(ev.receivedAt) || toIsoUnknown(ev.receivedAtIso),
    rawPreserved: integrity.rawPreserved,
    rawTruncated: integrity.rawTruncated,
    signatureHeaderPresent: Boolean(ev.signatureHeader),
    signatureValidation: integrity.signatureValidation,
    payloadSha256: integrity.payloadSha256,
    integrityMatchesStoredHash: integrity.hashMatches,
    webhookAuthLabel,
    rawPublic: !integrity.rawPreserved ? "none" : rawSensitive ? "omitted_sensitive" : "hash_only",
    polygon: opts.polygon,
  };
}

export function sendResponseEvent(input: {
  wamid: string | null;
  httpStatus?: number | null;
  bodyHash?: string | null;
  receivedAt?: string | null;
  rawPreserved: boolean;
}): HistoricalMetaEvent {
  return {
    status: input.wamid ? "HISTORICAL_PRESERVED" : "NOT_AVAILABLE",
    kind: "sent",
    title: "Respuesta de Meta al envío",
    claim: input.rawPreserved
      ? "Se conservó el cuerpo HTTP RAW de la respuesta de Meta al POST /messages, incluido el WAMID."
      : input.wamid
        ? "El WAMID registrado por Notificas corresponde al identificador devuelto por Meta al procesar el envío. Para esta comunicación histórica se conservó el identificador extraído, pero no el cuerpo HTTP RAW completo de la respuesta."
        : "No consta una respuesta RAW conservada del POST de envío a Meta.",
    source: "meta_send_response",
    wamid: input.wamid,
    recipientId: null,
    metaTimestamp: input.receivedAt || null,
    receivedAt: input.receivedAt || null,
    rawPreserved: input.rawPreserved,
    rawTruncated: false,
    signatureHeaderPresent: false,
    signatureValidation: "not_available",
    payloadSha256: input.bodyHash || null,
    integrityMatchesStoredHash: null,
    webhookAuthLabel: "No aplica: es la respuesta HTTP del POST /messages, no un webhook firmado con X-Hub-Signature-256.",
    rawPublic: input.rawPreserved ? "hash_only" : "none",
  };
}

export function detectWamidMismatch(
  sendWamid: string | null | undefined,
  eventWamid: string | null | undefined
): boolean {
  if (!sendWamid || !eventWamid) return false;
  return !wamidsEqual(sendWamid, eventWamid);
}

export function buildRecipientMetaEvidence(input: {
  consignedPhone: string | null;
  chronology: HistoricalMetaEvent[];
}): RecipientMetaEvidence {
  const webhookEvents = input.chronology.filter(
    (e) => e.source === "meta_webhook_historical" && Boolean(e.recipientId)
  );
  const matchingEvent = input.consignedPhone
    ? webhookEvents.find((e) => waRecipientsCorrespond(input.consignedPhone, e.recipientId))
    : undefined;
  const webhookRecipientId = matchingEvent?.recipientId || webhookEvents[0]?.recipientId || null;
  const match =
    input.consignedPhone && webhookRecipientId
      ? waRecipientsCorrespond(input.consignedPhone, webhookRecipientId)
      : null;
  const relatedToMetaId = webhookRecipientId
    ? webhookEvents.filter((e) => waRecipientsCorrespond(webhookRecipientId, e.recipientId))
    : [];
  const related = match === true ? relatedToMetaId : [];
  const delivered = related.some((e) => e.kind === "delivered");
  const read = related.some((e) => e.kind === "read");
  const rawPreserved = relatedToMetaId.some((e) => e.rawPreserved);

  let status: MetaVerifyStatus = "NOT_AVAILABLE";
  let matchMessage = "No hay recipient_id de Meta conservado para confrontar con el destinatario de la constancia.";
  if (match === true) {
    status = "VERIFIED";
    matchMessage = "Coincidencia verificada";
  } else if (match === false) {
    status = "FAILED";
    matchMessage = "El teléfono consignado en la constancia no coincide con el recipient_id informado por Meta.";
  } else if (input.consignedPhone && !webhookRecipientId) {
    status = "NOT_AVAILABLE";
    matchMessage =
      "Hay un destinatario consignado en la constancia, pero no hay recipient_id de Meta para acreditarlo.";
  }

  const states = [delivered ? "delivered" : null, read ? "read" : null].filter(Boolean) as string[];
  const statesTxt =
    states.length === 1 ? `el estado ${states[0]}` : states.length > 1 ? `los estados ${states.join(" y ")}` : "";
  const summary =
    match === true && webhookRecipientId && statesTxt
      ? `Meta informó ${statesTxt} respecto del recipient_id ${webhookRecipientId}, correspondiente al destinatario consignado en esta constancia.`
      : match === true && webhookRecipientId
        ? `El recipient_id ${webhookRecipientId} informado por Meta corresponde al destinatario consignado en esta constancia.`
        : matchMessage;

  const sourceNote = !webhookRecipientId
    ? null
    : rawPreserved
      ? "Fuente del recipient_id: payload original del webhook de Meta preservado por Notificas."
      : "Fuente del recipient_id: identificador extraído del webhook de Meta. El payload RAW no está conservado para estos eventos.";

  return {
    consignedPhone: input.consignedPhone,
    webhookRecipientId,
    match,
    status,
    matchMessage,
    delivered,
    read,
    rawPreserved,
    summary,
    sourceNote,
  };
}
