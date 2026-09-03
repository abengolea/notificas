import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SEC = 300;

export type ResendSvixVerifyOk = { ok: true };
export type ResendSvixVerifyFail = { ok: false; reason: string };
export type ResendSvixVerifyResult = ResendSvixVerifyOk | ResendSvixVerifyFail;

function secretBytes(secret: string): Buffer | null {
  const raw = secret.trim();
  if (!raw) return null;
  const payload = raw.startsWith("whsec_") ? raw.slice("whsec_".length) : raw;
  try {
    const buf = Buffer.from(payload, "base64");
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

function parseSignatures(header: string): string[] {
  return header
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const comma = part.indexOf(",");
      if (comma < 0) return part;
      const version = part.slice(0, comma);
      const value = part.slice(comma + 1);
      return version === "v1" ? value : "";
    })
    .filter(Boolean);
}

function equalB64(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Firma Standard Webhooks / Svix usada por Resend:
 * HMAC-SHA256(base64(secret), `${svix-id}.${svix-timestamp}.${rawBody}`)
 */
export function verifyResendSvixSignature(input: {
  secret: string;
  rawBody: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  nowSec?: number;
  toleranceSec?: number;
  /** Recomputa HMAC de un webhook ya ingerido. No aplica la ventana de 5 minutos. */
  skipTimestampCheck?: boolean;
}): ResendSvixVerifyResult {
  const secret = secretBytes(input.secret);
  if (!secret) return { ok: false, reason: "missing_secret" };
  const id = input.svixId.trim();
  const timestamp = input.svixTimestamp.trim();
  const header = input.svixSignature.trim();
  if (!id || !timestamp || !header) return { ok: false, reason: "missing_headers" };
  if (!/^\d+$/.test(timestamp)) return { ok: false, reason: "bad_timestamp" };

  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  const tolerance = input.toleranceSec ?? DEFAULT_TOLERANCE_SEC;
  if (!input.skipTimestampCheck && Math.abs(now - ts) > tolerance) {
    return { ok: false, reason: "timestamp_out_of_range" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${id}.${timestamp}.${input.rawBody}`)
    .digest("base64");
  const candidates = parseSignatures(header);
  if (!candidates.length) return { ok: false, reason: "missing_v1_signature" };
  if (candidates.some((sig) => equalB64(sig, expected))) return { ok: true };
  return { ok: false, reason: "bad_signature" };
}

/** HMAC histórico: misma firma Svix, sin exigir que el timestamp sea reciente. */
export function verifyResendSvixSignatureHistorical(input: {
  secret: string;
  rawBody: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
}): ResendSvixVerifyResult {
  return verifyResendSvixSignature({ ...input, skipTimestampCheck: true });
}
