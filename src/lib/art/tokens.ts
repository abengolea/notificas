import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function newArtSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashArtSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function artSecretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    timingSafeEqual(left, Buffer.alloc(left.length));
    return false;
  }
  return timingSafeEqual(left, right);
}

export function invitationTtlMs(): number {
  const n = Number(process.env.ART_INVITE_TTL_HOURS);
  const hours = Number.isFinite(n) && n > 0 ? n : 24 * 14;
  return hours * 60 * 60 * 1000;
}

export function otpTtlMs(): number {
  const n = Number(process.env.ART_OTP_TTL_MINUTES);
  const minutes = Number.isFinite(n) && n > 0 ? n : 10;
  return minutes * 60 * 1000;
}

export function maxOtpAttempts(): number {
  const n = Number(process.env.ART_OTP_MAX_ATTEMPTS);
  if (Number.isFinite(n) && n >= 1 && n <= 20) return Math.floor(n);
  return 5;
}

export function isExpired(expiresAtIso: string, now = Date.now()): boolean {
  const t = Date.parse(expiresAtIso);
  if (!Number.isFinite(t)) return true;
  return now > t;
}

export function generateOtpCode(length = 6): string {
  const digits = "0123456789";
  const buf = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += digits[buf[i] % 10];
  return out;
}

export function hashOtpCode(challengeId: string, code: string): string {
  return createHash("sha256").update(`otp:${challengeId}:${code}`, "utf8").digest("hex");
}
