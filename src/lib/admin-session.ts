import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "notificas_admin_sess";

/** Sesión corta solo para rutas `/api/admin/*` (cookies HttpOnly). */
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 8;

export function signAdminSession(email: string, secret: string): string {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SEC;
  const payload = Buffer.from(JSON.stringify({ e: email, exp }), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(
  token: string,
  secret: string,
  expectedEmail: string,
): boolean {
  const i = token.lastIndexOf(".");
  if (i <= 0) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expectedSig = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      e: string;
      exp: number;
    };
    if (data.exp < Math.floor(Date.now() / 1000)) return false;
    return data.e === expectedEmail;
  } catch {
    return false;
  }
}

export type AdminPanelConfig = { email: string; password: string; secret: string };

/** Credenciales del panel + secreto para firmar cookies (solo servidor). */
export function getAdminPanelConfig(): AdminPanelConfig | null {
  const email = process.env.ADMIN_PANEL_EMAIL?.trim();
  const password = process.env.ADMIN_PANEL_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!email || !password || !secret) return null;
  return { email, password, secret };
}
