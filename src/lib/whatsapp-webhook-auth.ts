import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta firma el POST con HMAC-SHA256 del body crudo.
 * Header: X-Hub-Signature-256: sha256=<hex>
 */
export function verifyWhatsAppHubSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  const secret = appSecret.trim();
  const header = (signatureHeader || "").trim();
  if (!secret || !header.startsWith("sha256=")) return false;
  const received = header.slice("sha256=".length);
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
