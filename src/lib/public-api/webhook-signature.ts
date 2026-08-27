import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/public-api/crypto";

export const WEBHOOK_SIGNATURE_HEADER = "notificas-signature";
export const WEBHOOK_ID_HEADER = "notificas-id";
export const WEBHOOK_TIMESTAMP_HEADER = "notificas-timestamp";

/** Ventana anti-replay (segundos). */
export const WEBHOOK_REPLAY_WINDOW_SECONDS = 5 * 60;

export function webhookSignedPayload(eventId: string, timestamp: string, rawBody: string): string {
  return `${eventId}.${timestamp}.${rawBody}`;
}

export function signWebhookPayload(secret: string, eventId: string, timestamp: string, rawBody: string): string {
  const hex = hmacSha256Hex(secret, webhookSignedPayload(eventId, timestamp, rawBody));
  return `v1=${hex}`;
}

export function parseSignatureHeader(header: string | null | undefined): string | null {
  const raw = String(header || "").trim();
  if (!raw) return null;
  const part = raw.split(",").map((p) => p.trim()).find((p) => p.startsWith("v1="));
  if (!part) return raw.startsWith("v1=") ? raw.slice(3) : raw;
  return part.slice(3);
}

export function verifyWebhookSignature(opts: {
  secret: string;
  eventId: string;
  timestamp: string;
  rawBody: string;
  signatureHeader: string | null | undefined;
  nowMs?: number;
  replayWindowSeconds?: number;
}): { ok: true } | { ok: false; code: "invalid_signature" | "timestamp_expired" | "invalid_timestamp" } {
  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts) || ts <= 0) return { ok: false, code: "invalid_timestamp" };
  const now = opts.nowMs ?? Date.now();
  const windowMs = (opts.replayWindowSeconds ?? WEBHOOK_REPLAY_WINDOW_SECONDS) * 1000;
  if (Math.abs(now - ts * 1000) > windowMs) return { ok: false, code: "timestamp_expired" };

  const provided = parseSignatureHeader(opts.signatureHeader);
  if (!provided) return { ok: false, code: "invalid_signature" };
  const expectedHex = hmacSha256Hex(opts.secret, webhookSignedPayload(opts.eventId, opts.timestamp, opts.rawBody));
  if (!timingSafeEqualHex(provided.toLowerCase(), expectedHex.toLowerCase())) {
    return { ok: false, code: "invalid_signature" };
  }
  return { ok: true };
}
