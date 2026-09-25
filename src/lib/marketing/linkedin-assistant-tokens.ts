import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getAdminPanelConfig, isAdminAllowedEmail } from "@/lib/admin-session";

export const EXTENSION_ACCESS_TTL_SEC = 30 * 60;
export const EXTENSION_REFRESH_TTL_SEC = 14 * 24 * 60 * 60;
export const EXTENSION_TOKEN_ISS = "notificas";
export const EXTENSION_TOKEN_AUD = "linkedin-assistant";
export const EXTENSION_ACCESS_TYP = "ext_access";
export const EXTENSION_REFRESH_TYP = "ext_refresh";
export const EXTENSION_CONNECT_TYP = "ext_connect";
export const EXTENSION_CONNECT_TTL_SEC = 3 * 60;

export type ExtensionTokenTyp =
  | typeof EXTENSION_ACCESS_TYP
  | typeof EXTENSION_REFRESH_TYP
  | typeof EXTENSION_CONNECT_TYP;

export type ExtensionTokenPayload = {
  typ: ExtensionTokenTyp;
  e: string;
  exp: number;
  iat: number;
  iss: string;
  aud: string;
  jti?: string;
};

export type VerifiedExtensionToken =
  | { ok: true; payload: ExtensionTokenPayload }
  | { ok: false; reason: "expired" | "invalid" };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function encodeToken(data: ExtensionTokenPayload, secret: string): string {
  const payload = Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
  return `${payload}.${signPayload(payload, secret)}`;
}

function decodeSignedPayload(token: string, secret: string): ExtensionTokenPayload | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = signPayload(payload, secret);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<ExtensionTokenPayload>;
    if (
      data.typ !== EXTENSION_ACCESS_TYP &&
      data.typ !== EXTENSION_REFRESH_TYP &&
      data.typ !== EXTENSION_CONNECT_TYP
    ) {
      return null;
    }
    if (typeof data.e !== "string" || !data.e.trim()) return null;
    if (typeof data.exp !== "number" || typeof data.iat !== "number") return null;
    if (data.iss !== EXTENSION_TOKEN_ISS || data.aud !== EXTENSION_TOKEN_AUD) return null;
    return {
      typ: data.typ,
      e: normalizeEmail(data.e),
      exp: data.exp,
      iat: data.iat,
      iss: data.iss,
      aud: data.aud,
      jti: typeof data.jti === "string" ? data.jti : undefined,
    };
  } catch {
    return null;
  }
}

export function getExtensionSigningSecret(): string | null {
  return getAdminPanelConfig()?.secret ?? null;
}

export function signExtensionAccessToken(email: string, secret: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  return encodeToken(
    {
      typ: EXTENSION_ACCESS_TYP,
      e: normalizeEmail(email),
      exp: iat + EXTENSION_ACCESS_TTL_SEC,
      iat,
      iss: EXTENSION_TOKEN_ISS,
      aud: EXTENSION_TOKEN_AUD,
    },
    secret,
  );
}

export function signExtensionRefreshToken(email: string, secret: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  return encodeToken(
    {
      typ: EXTENSION_REFRESH_TYP,
      e: normalizeEmail(email),
      exp: iat + EXTENSION_REFRESH_TTL_SEC,
      iat,
      iss: EXTENSION_TOKEN_ISS,
      aud: EXTENSION_TOKEN_AUD,
      jti: randomBytes(16).toString("hex"),
    },
    secret,
  );
}

export function signExtensionConnectCode(email: string, secret: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  return encodeToken(
    {
      typ: EXTENSION_CONNECT_TYP,
      e: normalizeEmail(email),
      exp: iat + EXTENSION_CONNECT_TTL_SEC,
      iat,
      iss: EXTENSION_TOKEN_ISS,
      aud: EXTENSION_TOKEN_AUD,
      jti: randomBytes(16).toString("hex"),
    },
    secret,
  );
}

export function issueExtensionSession(email: string, secret: string, now = Date.now()) {
  const accessToken = signExtensionAccessToken(email, secret, now);
  const refreshToken = signExtensionRefreshToken(email, secret, now);
  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer" as const,
    expiresIn: EXTENSION_ACCESS_TTL_SEC,
    refreshExpiresIn: EXTENSION_REFRESH_TTL_SEC,
    user: { email: normalizeEmail(email) },
  };
}

export function verifyExtensionToken(
  token: string,
  secret: string,
  expectedTyp: ExtensionTokenTyp,
  now = Date.now(),
): VerifiedExtensionToken {
  const payload = decodeSignedPayload(token, secret);
  if (!payload || payload.typ !== expectedTyp) return { ok: false, reason: "invalid" };
  if (!isAdminAllowedEmail(payload.e)) return { ok: false, reason: "invalid" };
  if (payload.exp < Math.floor(now / 1000)) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}

export function passwordsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    const dummy = Buffer.alloc(b.length);
    timingSafeEqual(dummy, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
