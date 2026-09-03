import { createHash } from "node:crypto";
import { verifyResendSvixSignatureHistorical } from "@/lib/resend-webhook-verify";
import { evidentiaryClass } from "@/lib/resend-webhook";
import { liveMetaFailureDoesNotInvalidateDocument, type MetaVerifyStatus } from "@/lib/meta-verify-status";
import type { HistoricalResendEvent, ResendEventKind } from "@/lib/resend-communication-types";

export function resendLiveFailureDoesNotInvalidateHistory(status: MetaVerifyStatus): boolean {
  return liveMetaFailureDoesNotInvalidateDocument(status);
}

export type ResendSignatureRecord = {
  eventType?: unknown;
  providerMessageId?: unknown;
  smtpMessageId?: unknown;
  recipient?: unknown;
  occurredAt?: unknown;
  providerTimestamp?: unknown;
  receivedAtIso?: unknown;
  receivedAt?: unknown;
  httpBody?: unknown;
  rawBody?: unknown;
  httpBodyTruncated?: unknown;
  signatureHeader?: unknown;
  svixId?: unknown;
  webhookEventId?: unknown;
  svixTimestamp?: unknown;
  signatureVerified?: unknown;
  signatureValid?: unknown;
  payloadHash?: unknown;
  evidentiaryClass?: unknown;
};

export function mapResendEventKind(eventType: string): ResendEventKind {
  switch (eventType) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.delivery_delayed":
      return "delayed";
    case "email.bounced":
      return "bounced";
    case "email.failed":
      return "failed";
    case "email.complained":
      return "complained";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.suppressed":
      return "suppressed";
    default:
      return "other";
  }
}

export function titleForResendKind(kind: ResendEventKind): string {
  switch (kind) {
    case "sent":
      return "Aceptado por Resend";
    case "delivered":
      return "Servidor de correo aceptó el mensaje";
    case "delayed":
      return "Demora temporal";
    case "bounced":
      return "Rebote";
    case "failed":
      return "Fallo de envío";
    case "complained":
      return "Marca de spam";
    case "opened":
      return "Señal técnica de apertura";
    case "clicked":
      return "Señal técnica de clic";
    case "suppressed":
      return "Suprimido";
    default:
      return "Evento Resend";
  }
}

export function claimForResendEvent(kind: ResendEventKind): string {
  switch (kind) {
    case "sent":
      return "Resend aceptó el mensaje para generar y entregar. No afirma que llegó al buzón.";
    case "delivered":
      return "Resend informó que el servidor de correo del destinatario aceptó el mensaje. No afirma que el correo esté en la bandeja de entrada ni que una persona lo haya leído.";
    case "delayed":
      return "Resend informó una demora temporal de entrega. No afirma llegada al buzón.";
    case "bounced":
      return "Resend informó rebote: el mensaje no llegó al buzón.";
    case "failed":
      return "Resend informó fallo de envío. El mensaje no se entregó.";
    case "complained":
      return "Resend informó una marca de spam. No identifica a una persona ni afirma lectura.";
    case "opened":
      return "Señal técnica de apertura informada por Resend (pixel o proxy). No es lectura fehaciente ni identifica a una persona.";
    case "clicked":
      return "Señal técnica de clic informada por Resend. No es lectura fehaciente.";
    case "suppressed":
      return "Resend no envió: la dirección está en lista de supresión.";
    default:
      return "Evento informado por Resend. No se interpreta como lectura fehaciente ni como bandeja de entrada.";
  }
}

export function extractResendRawBody(rec: ResendSignatureRecord): {
  raw: string | null;
  truncated: boolean;
} {
  if (rec.httpBodyTruncated === true) return { raw: null, truncated: true };
  if (rec.httpBody && typeof rec.httpBody === "object" && !Array.isArray(rec.httpBody)) {
    const obj = rec.httpBody as { _truncated?: boolean };
    if (obj._truncated === true) return { raw: null, truncated: true };
  }
  if (typeof rec.httpBody === "string" && rec.httpBody.length) {
    return { raw: rec.httpBody, truncated: false };
  }
  if (typeof rec.rawBody === "string" && rec.rawBody.length) {
    return { raw: rec.rawBody, truncated: false };
  }
  return { raw: null, truncated: false };
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function classifyResendHistoricalSignature(
  rec: ResendSignatureRecord,
  secret: string | null
): {
  status: MetaVerifyStatus;
  signatureValidation: HistoricalResendEvent["signatureValidation"];
  webhookAuthLabel: string;
  rawPreserved: boolean;
  rawTruncated: boolean;
  payloadSha256: string | null;
  integrityMatchesStoredHash: boolean | null;
} {
  const { raw, truncated } = extractResendRawBody(rec);
  const storedHash = asString(rec.payloadHash);
  const payloadSha256 = raw ? sha256Utf8(raw) : storedHash;
  const integrityMatchesStoredHash =
    raw && storedHash ? payloadSha256 === storedHash.toLowerCase() : storedHash ? null : raw ? true : null;
  const header = asString(rec.signatureHeader);
  const svixId = asString(rec.svixId) || asString(rec.webhookEventId);
  const timestamp = asString(rec.svixTimestamp);
  const ingestedOk = rec.signatureVerified === true || rec.signatureValid === true;

  if (!raw || truncated) {
    return {
      status: "HISTORICAL_PRESERVED",
      signatureValidation: ingestedOk ? "ingest_only" : "not_available",
      webhookAuthLabel: truncated
        ? "RAW truncado. El HMAC no se puede recomputar. La firma se validó al ingresar, si consta."
        : ingestedOk
          ? "Firma Svix validada al ingresar. El cuerpo RAW no está conservado: no se recompute HMAC histórico. Eso no es por sí solo una notificación fehaciente."
          : "Evidencia histórica sin cuerpo RAW ni recomputación HMAC.",
      rawPreserved: false,
      rawTruncated: truncated,
      payloadSha256,
      integrityMatchesStoredHash,
    };
  }

  if (!header || !svixId || !timestamp || !secret) {
    return {
      status: "HISTORICAL_PRESERVED",
      signatureValidation: ingestedOk ? "ingest_only" : "not_available",
      webhookAuthLabel: ingestedOk
        ? "Firma presente y validada al ingresar. Faltan datos para recomputar HMAC histórico."
        : "Cuerpo RAW conservado. Validación criptográfica retrospectiva no disponible.",
      rawPreserved: true,
      rawTruncated: false,
      payloadSha256,
      integrityMatchesStoredHash,
    };
  }

  const verified = verifyResendSvixSignatureHistorical({
    secret,
    rawBody: raw,
    svixId,
    svixTimestamp: timestamp,
    svixSignature: header,
  });

  if (verified.ok) {
    return {
      status: "HISTORICAL_VERIFIED",
      signatureValidation: "correct",
      webhookAuthLabel:
        "HMAC-SHA256 verificado contra Svix (id.timestamp.raw). Autentica el webhook recibido. No es por sí solo una notificación fehaciente.",
      rawPreserved: true,
      rawTruncated: false,
      payloadSha256,
      integrityMatchesStoredHash,
    };
  }

  return {
    status: "FAILED",
    signatureValidation: "incorrect",
    webhookAuthLabel: "El HMAC histórico no coincide con el cuerpo y la cabecera conservados.",
    rawPreserved: true,
    rawTruncated: false,
    payloadSha256,
    integrityMatchesStoredHash,
  };
}

export function historicalEventFromResend(
  rec: ResendSignatureRecord,
  secret: string | null,
  source: HistoricalResendEvent["source"] = "resend_webhook_historical"
): HistoricalResendEvent {
  const eventType = asString(rec.eventType) || "";
  const kind = mapResendEventKind(eventType);
  const sig = classifyResendHistoricalSignature(rec, secret);
  return {
    status: sig.status,
    kind,
    title: titleForResendKind(kind),
    claim: claimForResendEvent(kind),
    source,
    emailId: asString(rec.providerMessageId),
    smtpMessageId: asString(rec.smtpMessageId),
    recipient: asString(rec.recipient),
    providerTimestamp: asString(rec.occurredAt) || asString(rec.providerTimestamp),
    receivedAt: asString(rec.receivedAtIso) || asString(rec.receivedAt),
    rawPreserved: sig.rawPreserved,
    rawTruncated: sig.rawTruncated,
    signatureHeaderPresent: Boolean(asString(rec.signatureHeader)),
    signatureValidation: sig.signatureValidation,
    payloadSha256: sig.payloadSha256,
    integrityMatchesStoredHash: sig.integrityMatchesStoredHash,
    webhookAuthLabel: sig.webhookAuthLabel,
    rawPublic: sig.rawPreserved ? "hash_only" : "none",
    evidentiaryClass: asString(rec.evidentiaryClass) || evidentiaryClass(eventType),
  };
}

export const RESEND_VERIFICATION_DISCLAIMER =
  "Esta constancia verifica evidencia técnica de Resend conservada por Notificas. delivered no equivale a bandeja de entrada. opened y clicked no equivalen a lectura fehaciente ni identifican a una persona. Un HMAC histórico válido autentica el webhook recibido; no es por sí solo una notificación fehaciente. Si la consulta en vivo a la API de Resend falla, la cronología histórica no se invalida.";
