import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

export const ADMIN_SESSION_COOKIE = "notificas_admin_sess";

/** Sesión corta solo para rutas `/api/admin/*` (cookies HttpOnly). */
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 8;

function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** ADMIN_PANEL_EMAIL más extras opcionales en ADMIN_ALLOWED_EMAILS (coma). */
export function getAdminAllowedEmails(): string[] {
  const emails = new Set<string>();
  const primary = process.env.ADMIN_PANEL_EMAIL?.trim();
  if (primary) emails.add(normalizeAdminEmail(primary));
  const extra = process.env.ADMIN_ALLOWED_EMAILS ?? "";
  for (const part of extra.split(",")) {
    const email = part.trim();
    if (email) emails.add(normalizeAdminEmail(email));
  }
  return [...emails];
}

export function isAdminAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminAllowedEmails().includes(normalizeAdminEmail(email));
}

export function signAdminSession(email: string, secret: string): string {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SEC;
  const payload = Buffer.from(
    JSON.stringify({ e: normalizeAdminEmail(email), exp }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function decodeAdminSessionPayload(
  token: string,
  secret: string,
): { e: string; exp: number } | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expectedSig = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      e?: unknown;
      exp?: unknown;
    };
    if (typeof data.exp !== "number" || data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (typeof data.e !== "string" || !data.e.trim()) return null;
    return { e: normalizeAdminEmail(data.e), exp: data.exp };
  } catch {
    return null;
  }
}

export function verifyAdminSessionToken(
  token: string,
  secret: string,
  expectedEmail?: string,
): boolean {
  return readAdminSessionEmail(token, secret, expectedEmail) !== null;
}

/** Email de la cookie si la firma es válida y está en la allowlist del panel. */
export function readAdminSessionEmail(
  token: string,
  secret: string,
  expectedEmail?: string,
): string | null {
  const data = decodeAdminSessionPayload(token, secret);
  if (!data) return null;
  if (expectedEmail && data.e === normalizeAdminEmail(expectedEmail)) return data.e;
  return isAdminAllowedEmail(data.e) ? data.e : null;
}

export function applyAdminSessionCookie(
  res: NextResponse,
  email: string,
  secret: string,
): void {
  const token = signAdminSession(email, secret);
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SEC,
  });
}

export type AdminPanelConfig = { email: string; password: string; secret: string };

/** True si hay cookie de panel admin válida (no escribe respuesta). */
export function hasAdminSession(request: NextRequest): boolean {
  const cfg = getAdminPanelConfig();
  if (!cfg) return false;
  const raw = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return Boolean(raw && verifyAdminSessionToken(raw, cfg.secret, cfg.email));
}

/** Credenciales del panel + secreto para firmar cookies (solo servidor). */
export function getAdminPanelConfig(): AdminPanelConfig | null {
  const email = process.env.ADMIN_PANEL_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PANEL_PASSWORD?.trim();
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!email || !password || !secret) return null;
  return { email, password, secret };
}
