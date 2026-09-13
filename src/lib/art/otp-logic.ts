import { hashOtpCode, isExpired, maxOtpAttempts } from "@/lib/art/tokens";

export type OtpChallengeState = {
  challengeId: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  consumed: boolean;
  channel: "email" | "whatsapp" | "sms";
  purpose: "phone" | "email";
};

export function verifyOtpAttempt(
  challenge: OtpChallengeState,
  code: string,
  now = Date.now()
): { ok: true; nextAttempts: number } | { ok: false; reason: "expired" | "consumed" | "max_attempts" | "invalid" } {
  if (challenge.consumed) return { ok: false, reason: "consumed" };
  if (isExpired(challenge.expiresAt, now)) return { ok: false, reason: "expired" };
  if (challenge.attempts >= maxOtpAttempts()) return { ok: false, reason: "max_attempts" };
  const hashed = hashOtpCode(challenge.challengeId, String(code || "").trim());
  const nextAttempts = challenge.attempts + 1;
  if (hashed !== challenge.codeHash) {
    if (nextAttempts >= maxOtpAttempts()) return { ok: false, reason: "max_attempts" };
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, nextAttempts };
}

/** El canal real del OTP determina qué contacto queda verificado. Email nunca marca teléfono. */
export function contactVerifiedByOtpChannel(
  channel: OtpChallengeState["channel"]
): "email" | "phone" {
  return channel === "email" ? "email" : "phone";
}

/**
 * Hoy el OTP productivo es solo email. WhatsApp AUTH queda preparado (channel whatsapp/sms)
 * pero no se envía sin template aprobado.
 */
export function assertOtpPurposeForChannel(
  purpose: "phone" | "email",
  channel: OtpChallengeState["channel"]
): { ok: true } | { ok: false; reason: "phone_otp_unavailable" | "otp_channel_unavailable" } {
  if (channel !== "email") return { ok: false, reason: "otp_channel_unavailable" };
  if (purpose === "phone") return { ok: false, reason: "phone_otp_unavailable" };
  return { ok: true };
}
