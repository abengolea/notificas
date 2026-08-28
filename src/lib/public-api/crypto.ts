import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function timingSafeEqualText(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    const dummy = Buffer.alloc(left.length);
    timingSafeEqual(left, dummy);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function encryptionKey(): Buffer {
  const raw =
    process.env.PUBLIC_API_ENCRYPTION_KEY ||
    process.env.PUBLIC_API_KEY_PEPPER ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.CAMPAIGN_WORKER_SECRET ||
    "notificas-dev-public-api-encryption";
  return createHash("sha256").update(`enc:${raw}`).digest();
}

/** AES-256-GCM. El valor en claro nunca debe loguearse. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("invalid_encrypted_secret");
  }
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const enc = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function apiKeyPepper(): string {
  return (
    process.env.PUBLIC_API_KEY_PEPPER ||
    sha256Hex(`notificas-api-key-pepper:${process.env.ADMIN_SESSION_SECRET || process.env.CAMPAIGN_WORKER_SECRET || "dev"}`)
  );
}

export function hashApiKey(fullKey: string): string {
  return sha256Hex(`${apiKeyPepper()}\n${fullKey}`);
}
