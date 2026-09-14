import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  return (
    process.env.MARKETING_HMAC_SECRET ||
    process.env.TRACKING_HMAC_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    "notificas-marketing-dev-hmac"
  );
}

function hmac(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEq(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type MarketingTokenPurpose = "o" | "c" | "u";

export function signMarketingToken(purpose: MarketingTokenPurpose, id: string, extra = ""): string {
  const payload = extra ? `${purpose}:${id}:${extra}` : `${purpose}:${id}`;
  return `${purpose}.${id}.${hmac(payload)}`;
}

export function verifyMarketingToken(
  token: string,
  purpose: MarketingTokenPurpose,
  extra = "",
): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [gotPurpose, id, sig] = parts;
  if (gotPurpose !== purpose || !id || !sig) return null;
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(id)) return null;
  const payload = extra ? `${purpose}:${id}:${extra}` : `${purpose}:${id}`;
  const expected = hmac(payload);
  if (!safeEq(sig, expected)) return null;
  return id;
}

export function appBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://notificas.com";
}

export function marketingOpenUrl(sendId: string): string {
  return `${appBaseUrl()}/api/marketing/o/${signMarketingToken("o", sendId)}`;
}

export function marketingUnsubUrl(contactId: string): string {
  return `${appBaseUrl()}/api/marketing/u/${signMarketingToken("u", contactId)}`;
}

export function marketingClickUrl(sendId: string, target: string): string {
  const encoded = Buffer.from(target, "utf8").toString("base64url");
  const token = signMarketingToken("c", sendId, encoded);
  return `${appBaseUrl()}/api/marketing/c/${token}?u=${encodeURIComponent(encoded)}`;
}

export function decodeClickTarget(encoded: string): string | null {
  try {
    const url = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
